import { Router } from "express";
import jwt from "jsonwebtoken";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import Stripe from "stripe";
import { sequelize } from "../database/datasource.js";
import { Subscriptions, Users } from "../database/models/models.js";

const router = Router();

const {
  PORT,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_CALLBACK_URL,
  JWT_SECRET,
  FRONTEND_URL,
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
  STRIPE_PRICE_ID,
} = process.env;

if (!JWT_SECRET) {
  throw new Error("Missing JWT_SECRET environment variable");
}

const serverPort = Number(PORT ?? 3000);
const frontendUrl = FRONTEND_URL || `http://localhost:${serverPort}`;

const oauthEnabled =
  !!GOOGLE_CLIENT_ID && !!GOOGLE_CLIENT_SECRET && !!GOOGLE_CALLBACK_URL;
const stripeEnabled =
  !!STRIPE_SECRET_KEY && !!STRIPE_WEBHOOK_SECRET && !!STRIPE_PRICE_ID;

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

export const authenticateToken = async (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    // get user from database
    const user = await Users.findByPk(payload.userId);

    if (!user) {
      return res.status(401).json({ error: "User no longer exists" });
    }

    // attach user to request
    req.user = user;

    return next();
  } catch (error) {
    console.error(error);

    return res.status(403).json({ error: "Invalid or expired token" });
  }
};

export const requireActiveSubscription = async (req, res, next) => {
  try {
    const subscription = await Subscriptions.findOne({
      where: { userId: req.user.userId },
    });

    if (subscription?.status !== "active") {
      return res
        .status(403)
        .json({ error: "Subscription expired. Please renew." });
    }

    // attach subscription to request
    req.subscription = subscription;

    return next();
  } catch (error) {
    return res.status(500).json({ error: "Database error" });
  }
};

function generateUniqueUsername(displayName, email, id) {
  const baseUsername = displayName || email?.split("@")[0] || "player";

  const username = `${baseUsername}_${id}`
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .slice(0, 255);
}

const findOrCreateUser = async (profile) => {
  const providerUserId = profile.id;
  const email = profile.emails?.[0]?.value;

  if (!email) {
    throw new Error("Google profile did not include an email address");
  }

  // try to find existing user
  const existingUser = await Users.findOne({
    where: {
      authProvider: "google",
      providerUserId,
    },
  });

  if (existingUser) {
    return existingUser;
  }

  // create new user
  else {
    // create unique username
    const username = `${profile.displayName || "player"}_${profile.id}`
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .slice(0, 255);

    const user = await sequelize.transaction(async (transaction) => {
      // create new user in db
      const newUser = await Users.create(
        {
          email,
          username,
          authProvider: "google",
          providerUserId,
        },
        { transaction },
      );

      await Subscriptions.create(
        {
          userId: newUser.userId,
          status: "pending_payment",
        },
        { transaction },
      );

      return newUser;
    });

    return user;
  }
};

if (oauthEnabled) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: GOOGLE_CALLBACK_URL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const user = await findOrCreateUser(profile);
          return done(null, user);
        } catch (error) {
          return done(error, null);
        }
      },
    ),
  );
}

router.post("/api/webhook", async (req, res) => {
  if (!stripeEnabled || !stripe) {
    return res.status(503).json({
      error: "Stripe is not configured. Set STRIPE_* environment variables.",
    });
  }

  const signature = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  try {
    const setSubscriptionStatus = async ({
      status,
      stripeSubscriptionId,
      stripeCustomerId,
    }) => {
      const [updatedBySubscriptionId] = await Subscriptions.update(
        { status },
        { where: { stripeSubscriptionId } },
      );

      if (updatedBySubscriptionId > 0 || !stripeCustomerId) {
        return updatedBySubscriptionId;
      }

      const [updatedByCustomerId] = await Subscriptions.update(
        { status },
        { where: { stripeCustomerId } },
      );

      return updatedByCustomerId;
    };

    if (event.type === "checkout.session.completed") {
      const checkoutSession = event.data.object;
      const userId = Number(
        checkoutSession.client_reference_id ||
          checkoutSession.metadata?.user_id,
      );

      if (!Number.isInteger(userId)) {
        return res.status(400).json({
          error: "checkout.session.completed missing valid user reference",
        });
      }

      await Subscriptions.update(
        {
          status: "active",
          stripeCustomerId: checkoutSession.customer,
          stripeSubscriptionId: checkoutSession.subscription,
        },
        { where: { userId: userId } },
      );
    }

    if (event.type === "customer.subscription.updated") {
      const updatedSubscription = event.data.object;
      const stripeCustomerId =
        typeof updatedSubscription.customer === "string"
          ? updatedSubscription.customer
          : updatedSubscription.customer?.id;

      if (
        updatedSubscription.cancel_at_period_end ||
        updatedSubscription.status === "canceled"
      ) {
        await setSubscriptionStatus({
          status: "pending_payment",
          stripeSubscriptionId: updatedSubscription.id,
          stripeCustomerId,
        });
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const deletedSubscription = event.data.object;
      const stripeCustomerId =
        typeof deletedSubscription.customer === "string"
          ? deletedSubscription.customer
          : deletedSubscription.customer?.id;

      await setSubscriptionStatus({
        status: "pending_payment",
        stripeSubscriptionId: deletedSubscription.id,
        stripeCustomerId,
      });
    }
  } catch (error) {
    return res.status(500).json({ error: "Failed to process webhook event" });
  }

  return res.json({ received: true });
});

router.get("/auth/google", (req, res, next) => {
  if (!oauthEnabled) {
    return res.status(503).json({
      error:
        "Google OAuth is not configured. Set GOOGLE_* environment variables.",
    });
  }

  return passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
  })(req, res, next);
});

router.get("/auth/google/callback", (req, res, next) => {
  if (!oauthEnabled) {
    return res.redirect(`${frontendUrl}/?login=unavailable`);
  }

  return passport.authenticate("google", {
    session: false,
    failureRedirect: `${frontendUrl}/?login=failed`,
  })(req, res, () => {
    const token = jwt.sign(
      {
        userId: req.user.userId,
      },
      JWT_SECRET,
      { expiresIn: "1h" },
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 3600000,
    });

    return res.redirect(frontendUrl);
  });
});

router.get("/api/me", authenticateToken, async (req, res) => {
  try {
    const subscription = await Subscriptions.findOne({
      where: { userId: req.user.userId },
    });

    return res.json({
      user: {
        userId: req.user.userId,
        email: req.user.email,
        username: req.user.username,
        subscriptionStatus: subscription?.status || "pending_payment",
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post(
  "/api/create-checkout-session",
  authenticateToken,
  async (req, res) => {
    if (!stripeEnabled || !stripe) {
      return res.status(503).json({
        error: "Stripe is not configured. Set STRIPE_* environment variables.",
      });
    }

    try {
      const checkoutSession = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "subscription",
        line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
        client_reference_id: String(req.user.userId),
        customer_email: req.user.email,
        metadata: {
          user_id: String(req.user.userId),
        },
        success_url: `${frontendUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontendUrl}/?checkout=canceled`,
      });

      return res.json({ url: checkoutSession.url });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  },
);

router.get("/api/checkout/confirm", authenticateToken, async (req, res) => {
  if (!stripeEnabled || !stripe) {
    return res.status(503).json({
      error: "Stripe is not configured. Set STRIPE_* environment variables.",
    });
  }

  const sessionId = String(req.query.session_id || "").trim();
  if (!sessionId) {
    return res
      .status(400)
      .json({ error: "Missing session_id query parameter." });
  }

  try {
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);
    const referenceUserId = Number(
      checkoutSession.client_reference_id || checkoutSession.metadata?.user_id,
    );

    if (
      !Number.isInteger(referenceUserId) ||
      referenceUserId !== req.user.userId
    ) {
      return res.status(403).json({
        error: "Checkout session does not belong to the authenticated user.",
      });
    }

    const isPaid =
      checkoutSession.payment_status === "paid" ||
      checkoutSession.payment_status === "no_payment_required";

    if (!isPaid || !checkoutSession.subscription) {
      return res.status(409).json({
        error: "Checkout is not completed yet. Please refresh in a moment.",
      });
    }

    await Subscriptions.update(
      {
        status: "active",
        stripeCustomerId: checkoutSession.customer,
        stripeSubscriptionId: checkoutSession.subscription,
      },
      { where: { userId: req.user.userId } },
    );

    return res.json({ status: "active" });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Unable to confirm checkout session." });
  }
});

router.get("/auth/logout", (req, res) => {
  res.clearCookie("token");
  return res.json({ error: "Logged out successfully" });
});

router.get(
  "/api/protected-data",
  authenticateToken,
  requireActiveSubscription,
  (req, res) => {
    return res.json({ secretData: "This is only for paying members." });
  },
);

export const authBillingRouter = router;

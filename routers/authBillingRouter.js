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

export const authenticateToken = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  jwt.verify(token, JWT_SECRET, (error, user) => {
    if (error) {
      return res.status(403).json({ message: "Forbidden" });
    }

    req.user = user;
    return next();
  });
};

export const requireActiveSubscription = async (req, res, next) => {
  try {
    const subscription = await Subscriptions.findOne({
      where: { userId: req.user.id },
    });

    if (subscription?.status !== "active") {
      return res
        .status(403)
        .json({ message: "Subscription expired. Please renew." });
    }

    return next();
  } catch (error) {
    return res.status(500).json({ message: "Database error" });
  }
};

const findOrCreateUser = async (profile) => {
  const providerUserId = profile.id;
  const email = profile.emails?.[0]?.value;
  const displayName = profile.displayName || "GeoGuesser Player";

  if (!email) {
    throw new Error("Google profile did not include an email address");
  }

  const existingUser = await Users.findOne({
    where: {
      authProvider: "google",
      providerUserId: providerUserId,
    },
  });

  if (existingUser) {
    const existingSubscription = await Subscriptions.findOne({
      where: { userId: existingUser.userId },
    });

    return {
      id: existingUser.userId,
      email: existingUser.email,
      name: existingUser.displayName,
      status: existingSubscription?.status || "pending_payment",
    };
  }

  const createdUser = await sequelize.transaction(async (transaction) => {
    const user = await Users.create(
      {
        email: email,
        displayName: displayName,
        authProvider: "google",
        providerUserId: providerUserId,
      },
      { transaction },
    );

    await Subscriptions.create(
      {
        userId: user.userId,
        status: "pending_payment",
      },
      { transaction },
    );

    return user;
  });

  return {
    id: createdUser.userId,
    email: createdUser.email,
    name: createdUser.displayName,
    status: "pending_payment",
  };
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
      message: "Stripe is not configured. Set STRIPE_* environment variables.",
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
    if (event.type === "checkout.session.completed") {
      const checkoutSession = event.data.object;
      const userId = Number(
        checkoutSession.client_reference_id || checkoutSession.metadata?.user_id,
      );

      if (!Number.isInteger(userId)) {
        return res.status(400).json({
          message: "checkout.session.completed missing valid user reference",
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

    if (event.type === "customer.subscription.deleted") {
      const deletedSubscription = event.data.object;
      await Subscriptions.update(
        { status: "pending_payment" },
        { where: { stripeSubscriptionId: deletedSubscription.id } },
      );
    }
  } catch (error) {
    return res.status(500).json({ message: "Failed to process webhook event" });
  }

  return res.json({ received: true });
});

router.get("/auth/google", (req, res, next) => {
  if (!oauthEnabled) {
    return res.status(503).json({
      message: "Google OAuth is not configured. Set GOOGLE_* environment variables.",
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
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        status: req.user.status,
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
    const currentSubscription = await Subscriptions.findOne({
      where: { userId: req.user.id },
    });

    const currentStatus = currentSubscription?.status || "pending_payment";
    if (currentStatus !== req.user.status) {
      const token = jwt.sign(
        {
          id: req.user.id,
          email: req.user.email,
          name: req.user.name,
          status: currentStatus,
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
    }

    return res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        status: currentStatus,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/api/create-checkout-session", authenticateToken, async (req, res) => {
  if (!stripeEnabled || !stripe) {
    return res.status(503).json({
      message: "Stripe is not configured. Set STRIPE_* environment variables.",
    });
  }

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      client_reference_id: String(req.user.id),
      customer_email: req.user.email,
      metadata: {
        user_id: String(req.user.id),
      },
      success_url: `${frontendUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/?checkout=canceled`,
    });

    return res.json({ url: checkoutSession.url });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/api/checkout/confirm", authenticateToken, async (req, res) => {
  if (!stripeEnabled || !stripe) {
    return res.status(503).json({
      message: "Stripe is not configured. Set STRIPE_* environment variables.",
    });
  }

  const sessionId = String(req.query.session_id || "").trim();
  if (!sessionId) {
    return res.status(400).json({ message: "Missing session_id query parameter." });
  }

  try {
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);
    const referenceUserId = Number(
      checkoutSession.client_reference_id || checkoutSession.metadata?.user_id,
    );

    if (!Number.isInteger(referenceUserId) || referenceUserId !== req.user.id) {
      return res.status(403).json({
        message: "Checkout session does not belong to the authenticated user.",
      });
    }

    const isPaid =
      checkoutSession.payment_status === "paid" ||
      checkoutSession.payment_status === "no_payment_required";

    if (!isPaid || !checkoutSession.subscription) {
      return res.status(409).json({
        message: "Checkout is not completed yet. Please refresh in a moment.",
      });
    }

    await Subscriptions.update(
      {
        status: "active",
        stripeCustomerId: checkoutSession.customer,
        stripeSubscriptionId: checkoutSession.subscription,
      },
      { where: { userId: req.user.id } },
    );

    return res.json({ status: "active" });
  } catch (error) {
    return res.status(500).json({ message: "Unable to confirm checkout session." });
  }
});

router.get("/auth/logout", (req, res) => {
  res.clearCookie("token");
  return res.json({ message: "Logged out successfully" });
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

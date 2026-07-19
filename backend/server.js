require('dotenv').config();
const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { Pool } = require('pg');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
});

const {
  PORT, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
  GOOGLE_CALLBACK_URL, JWT_SECRET, FRONTEND_URL,
  STRIPE_WEBHOOK_SECRET
} = process.env;

app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(cookieParser());

app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.client_reference_id;
    const stripeCustomerId = session.customer;
    const stripeSubscriptionId = session.subscription;

    try {
      await pool.query(
        `UPDATE subscriptions
         SET status = 'active', stripe_customer_id = $1, stripe_subscription_id = $2
         WHERE user_id = $3`,
        [stripeCustomerId, stripeSubscriptionId, userId]
      );
      console.log(`User ${userId} successfully paid and upgraded to active!`);
    } catch (dbError) {
      console.error('Database update failed:', dbError);
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;

    try {
      await pool.query(
        `UPDATE subscriptions
         SET status = 'pending_payment'
         WHERE stripe_subscription_id = $1`,
        [subscription.id]
      );
      console.log(`Subscription ${subscription.id} expired. User locked out.`);
    } catch (dbError) {
      console.error('Database downgrade failed:', dbError);
    }
  }

  res.json({ received: true });
});

app.use(express.json());
app.use(passport.initialize());

const findOrCreateUser = async (profile) => {
  const providerId = profile.id;
  const email = profile.emails[0].value;
  const displayName = profile.displayName;

  // If user exists, fetch subscription status
  const userCheck = await pool.query(
    'SELECT * FROM users WHERE auth_provider = $1 AND provider_user_id = $2',
    ['google', providerId]
  );

  if (userCheck.rows.length > 0) {
    const existingUser = userCheck.rows[0];

    const subCheck = await pool.query(
      'SELECT status FROM subscriptions WHERE user_id = $1',
      [existingUser.id]
    );
    existingUser.status = subCheck.rows[0]?.status || 'pending_payment';

    return existingUser;
  }

  // Create user and send them to the payment page
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const newUserResult = await client.query(
      `INSERT INTO users (email, display_name, auth_provider, provider_user_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [email, displayName, 'google', providerId]
    );
    const newUser = newUserResult.rows[0];

    await client.query(
      'INSERT INTO subscriptions (user_id, status) VALUES ($1, $2)',
      [newUser.id, 'pending_payment']
    );

    await client.query('COMMIT');
    newUser.status = 'pending_payment';
    return newUser;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: GOOGLE_CALLBACK_URL
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const user = await findOrCreateUser(profile);
      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }
));

const authenticateToken = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Forbidden' });
    req.user = user;
    next();
  });
};

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${FRONTEND_URL}/login` }),
  (req, res) => {
    const token = jwt.sign(
      {
        id: req.user.id,
        email: req.user.email,
        name: req.user.display_name || req.user.displayName,
        status: req.user.status
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: false,
      maxAge: 3600000
    });

    res.redirect(FRONTEND_URL);
  }
);

app.post('/api/create-checkout-session', authenticateToken, async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      client_reference_id: req.user.id.toString(),
      success_url: `${process.env.FRONTEND_URL}/?success=true`,
      cancel_url: `${process.env.FRONTEND_URL}/?canceled=true`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Stripe Checkout Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/me', authenticateToken, async (req, res) => {
  try {
    // Change the stale token if the subscription status in the database has changed
    const subCheck = await pool.query(
      'SELECT status FROM subscriptions WHERE user_id = $1',
      [req.user.id]
    );
    const currentDbStatus = subCheck.rows[0]?.status || 'pending_payment';

    if (currentDbStatus !== req.user.status) {
      console.log(`Updating token status for user ${req.user.id} to ${currentDbStatus}`);

      // rebuild the payload to remove exp interference
      const payload = {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        status: currentDbStatus
      };

      const newToken = jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      res.cookie('token', newToken, {
        httpOnly: true,
        secure: false,
        maxAge: 3600000
      });

      return res.json({ user: req.user });
    }

    res.json({ user: req.user });

  } catch (error) {
    console.error("Error verifying user status:", error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

const requireActiveSubscription = async (req, res, next) => {
  try {
    const subCheck = await pool.query(
      'SELECT status FROM subscriptions WHERE user_id = $1',
      [req.user.id]
    );

    if (subCheck.rows[0]?.status !== 'active') {
      return res.status(403).json({ message: 'Subscription expired. Please renew.' });
    }

    next();
  } catch (error) {
    res.status(500).json({ message: 'Database error' });
  }
};

app.get('/api/protected-data', authenticateToken, requireActiveSubscription, (req, res) => {
  res.json({ secretData: "This is only for paying members." });
});

app.listen(PORT || 3000, () => console.log(`Backend listening on port ${PORT || 3000}`));
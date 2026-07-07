require('dotenv').config(); // Load environment variables first
const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const app = express();

const {
  PORT, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
  GOOGLE_CALLBACK_URL, JWT_SECRET, FRONTEND_URL
} = process.env;

app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use(passport.initialize());

const findOrCreateUser = async (profile) => {
  return {
    id: profile.id,
    email: profile.emails[0].value,
    displayName: profile.displayName
  };
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
    const token = jwt.sign({ id: req.user.id, email: req.user.email, name: req.user.displayName }, JWT_SECRET, { expiresIn: '1h' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: false, // must be true in production with HTTPS
      maxAge: 3600000
    });

    res.redirect(FRONTEND_URL);
  }
);

app.get('/api/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

app.get('/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

app.listen(PORT || 3000, () => console.log(`Backend listening on port ${PORT || 3000}`));
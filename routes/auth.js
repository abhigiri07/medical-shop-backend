const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const { JWT_SECRET } = require('../middleware/auth');
const { createOtp, checkOtp } = require('../utils/otp');
const { sendSms } = require('../utils/sms');
const { normalizePhone } = require('../utils/phone');

const VALID_PURPOSES = ['signup', 'reset'];

// POST /api/auth/send-otp   { phone, purpose: "signup" | "reset" }
router.post('/send-otp', async (req, res) => {
  try {
    const { purpose } = req.body;
    const phone = normalizePhone(req.body.phone);

    if (!phone || !VALID_PURPOSES.includes(purpose)) {
      return res.status(400).json({ error: 'A valid phone and purpose ("signup" or "reset") are required' });
    }

    const { rows } = await pool.query('SELECT id FROM users WHERE phone = $1', [phone]);
    const existingUser = rows[0];

    if (purpose === 'signup' && existingUser) {
      return res.status(409).json({ error: 'An account with this phone number already exists' });
    }
    if (purpose === 'reset' && !existingUser) {
      return res.status(404).json({ error: 'No account found with this phone number' });
    }

    const otp = await createOtp(phone, purpose);
    await sendSms(phone, `Your Saikrupa Medical verification code is ${otp}. It expires in 5 minutes.`);

    res.json({ message: 'OTP sent' });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /api/auth/verify-otp   { phone, otp, purpose }
// Lets the OTP screen tell the user immediately if a code is wrong, without
// consuming it - the code is only actually "spent" by /register or
// /reset-password, whichever sensitive action it's authorizing.
router.post('/verify-otp', async (req, res) => {
  try {
    const { otp, purpose } = req.body;
    const phone = normalizePhone(req.body.phone);

    if (!phone || !otp || !VALID_PURPOSES.includes(purpose)) {
      return res.status(400).json({ error: 'phone, otp and purpose are required' });
    }

    const result = await checkOtp(phone, purpose, otp, { consume: false });
    if (!result.ok) {
      return res.status(400).json({ error: result.reason });
    }
    res.json({ message: 'OTP verified' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/register   { name, email, phone, password, otp }
// Requires a valid, still-unused "signup" OTP for this phone - this is the
// step that actually consumes it, so a code can't be replayed.
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, otp } = req.body;
    const phone = normalizePhone(req.body.phone);

    if (!name || !email || !password || !phone) {
      return res.status(400).json({ error: 'name, email, phone and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    if (!otp) {
      return res.status(400).json({ error: 'Phone verification code is required' });
    }

    const otpResult = await checkOtp(phone, 'signup', otp, { consume: true });
    if (!otpResult.ok) {
      return res.status(400).json({ error: otpResult.reason });
    }

    const normalizedEmail = email.toLowerCase();
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rows[0]) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO users (name, email, phone, password_hash) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, normalizedEmail, phone, passwordHash]
    );

    const user = { id: rows[0].id, name, email: normalizedEmail, phone };
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    const row = rows[0];
    if (!row) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = bcrypt.compareSync(password, row.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const user = { id: row.id, name: row.name, email: row.email, phone: row.phone };
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/reset-password   { phone, otp, newPassword }
// Re-checks the OTP one more time (and consumes it) before touching the
// password, since the client-side "verify" step alone isn't trustworthy.
router.post('/reset-password', async (req, res) => {
  try {
    const { otp, newPassword } = req.body;
    const phone = normalizePhone(req.body.phone);

    if (!phone || !otp || !newPassword) {
      return res.status(400).json({ error: 'phone, otp and newPassword are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const otpResult = await checkOtp(phone, 'reset', otp, { consume: true });
    if (!otpResult.ok) {
      return res.status(400).json({ error: otpResult.reason });
    }

    const { rows } = await pool.query('SELECT id FROM users WHERE phone = $1', [phone]);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'No account found with this phone number' });

    const passwordHash = bcrypt.hashSync(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, user.id]);

    res.json({ message: 'Password reset successful' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

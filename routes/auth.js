const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const { JWT_SECRET } = require('../middleware/auth');
const { sendOtpEmail } = require('../utils/mailer');

const OTP_TTL_MINUTES = 10;

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
}

async function createAndSendOtp(email, purpose) {
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  // Only one active code per email+purpose at a time.
  await pool.query('DELETE FROM otp_codes WHERE email = $1 AND purpose = $2', [email, purpose]);
  await pool.query(
    'INSERT INTO otp_codes (email, code, purpose, expires_at) VALUES ($1, $2, $3, $4)',
    [email, code, purpose, expiresAt]
  );

  await sendOtpEmail(email, code, purpose);
}

async function consumeValidOtp(email, code, purpose) {
  const { rows } = await pool.query(
    'SELECT * FROM otp_codes WHERE email = $1 AND purpose = $2 ORDER BY created_at DESC LIMIT 1',
    [email, purpose]
  );
  const row = rows[0];
  if (!row) return { ok: false, reason: 'No code was requested for this email' };
  if (row.code !== String(code)) return { ok: false, reason: 'Incorrect code' };
  if (new Date(row.expires_at) < new Date()) return { ok: false, reason: 'Code has expired' };

  await pool.query('DELETE FROM otp_codes WHERE id = $1', [row.id]);
  return { ok: true };
}

// POST /api/auth/register
// Creates an unverified user and emails them a 6-digit code.
// No token is returned yet — the account can't log in until verified.
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const normalizedEmail = email.toLowerCase();
    const existing = await pool.query('SELECT id, email_verified FROM users WHERE email = $1', [normalizedEmail]);

    if (existing.rows[0] && existing.rows[0].email_verified) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);

    if (existing.rows[0]) {
      // Unverified account from a previous, abandoned signup attempt —
      // overwrite it with the new details and send a fresh code.
      await pool.query(
        'UPDATE users SET name = $1, phone = $2, password_hash = $3 WHERE email = $4',
        [name, phone || '', passwordHash, normalizedEmail]
      );
    } else {
      await pool.query(
        'INSERT INTO users (name, email, phone, password_hash, email_verified) VALUES ($1, $2, $3, $4, FALSE)',
        [name, normalizedEmail, phone || '', passwordHash]
      );
    }

    await createAndSendOtp(normalizedEmail, 'signup');

    res.status(201).json({
      message: 'We sent a 6-digit verification code to your email.',
      email: normalizedEmail,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/verify-signup-otp
// Confirms the code, marks the account verified, and logs the user in.
router.post('/verify-signup-otp', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: 'email and code are required' });
    }

    const normalizedEmail = email.toLowerCase();
    const result = await consumeValidOtp(normalizedEmail, code, 'signup');
    if (!result.ok) {
      return res.status(400).json({ error: result.reason });
    }

    const { rows } = await pool.query(
      'UPDATE users SET email_verified = TRUE WHERE email = $1 RETURNING id, name, email, phone',
      [normalizedEmail]
    );
    const row = rows[0];
    if (!row) return res.status(404).json({ error: 'No account found for this email' });

    const user = { id: row.id, name: row.name, email: row.email, phone: row.phone };
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/resend-otp
// purpose: 'signup' | 'reset'
router.post('/resend-otp', async (req, res) => {
  try {
    const { email, purpose } = req.body;
    if (!email || !purpose) {
      return res.status(400).json({ error: 'email and purpose are required' });
    }
    if (purpose !== 'signup' && purpose !== 'reset') {
      return res.status(400).json({ error: 'purpose must be "signup" or "reset"' });
    }

    const normalizedEmail = email.toLowerCase();
    const { rows } = await pool.query('SELECT id, email_verified FROM users WHERE email = $1', [normalizedEmail]);
    const row = rows[0];

    // Don't reveal account existence for password resets.
    if (!row) {
      if (purpose === 'reset') {
        return res.json({ message: 'If an account exists for this email, a code has been sent.' });
      }
      return res.status(404).json({ error: 'No pending signup found for this email' });
    }
    if (purpose === 'signup' && row.email_verified) {
      return res.status(409).json({ error: 'This account is already verified' });
    }

    await createAndSendOtp(normalizedEmail, purpose);
    res.json({ message: 'A new code has been sent to your email.' });
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

    if (!row.email_verified) {
      return res.status(403).json({
        error: 'Please verify your email before logging in.',
        needsVerification: true,
        email: row.email,
      });
    }

    const user = { id: row.id, name: row.name, email: row.email, phone: row.phone };
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/forgot-password
// Always responds the same way whether or not the email exists, so
// callers can't use it to check which emails are registered.
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }

    const normalizedEmail = email.toLowerCase();
    const { rows } = await pool.query('SELECT id FROM users WHERE email = $1 AND email_verified = TRUE', [normalizedEmail]);
    if (rows[0]) {
      await createAndSendOtp(normalizedEmail, 'reset');
    }

    res.json({ message: 'If an account exists for this email, a reset code has been sent.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'email, code and newPassword are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const normalizedEmail = email.toLowerCase();
    const result = await consumeValidOtp(normalizedEmail, code, 'reset');
    if (!result.ok) {
      return res.status(400).json({ error: result.reason });
    }

    const passwordHash = bcrypt.hashSync(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [passwordHash, normalizedEmail]);

    res.json({ message: 'Password updated. You can now log in.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

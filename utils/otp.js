const crypto = require('crypto');
const { pool } = require('../db');

const OTP_EXPIRY_MINUTES = 5;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_ATTEMPTS = 5;

function hashOtp(otp) {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

function generateOtp() {
  // 6-digit numeric code, zero-padded (crypto.randomInt is CSPRNG-backed)
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

/**
 * Creates and stores a new OTP for (phone, purpose).
 * Throws a { status: 429 } error if the last code for this phone+purpose
 * was requested too recently, so people can't spam the SMS endpoint.
 * Returns the plaintext OTP so the caller can send it via SMS.
 */
async function createOtp(phone, purpose) {
  const { rows } = await pool.query(
    `SELECT created_at FROM otps WHERE phone = $1 AND purpose = $2 ORDER BY created_at DESC LIMIT 1`,
    [phone, purpose]
  );
  if (rows[0]) {
    const secondsSince = (Date.now() - new Date(rows[0].created_at).getTime()) / 1000;
    if (secondsSince < RESEND_COOLDOWN_SECONDS) {
      const err = new Error(`Please wait ${Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSince)}s before requesting another code`);
      err.status = 429;
      throw err;
    }
  }

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
  await pool.query(
    `INSERT INTO otps (phone, purpose, otp_hash, expires_at) VALUES ($1, $2, $3, $4)`,
    [phone, purpose, hashOtp(otp), expiresAt]
  );
  return otp;
}

/**
 * Checks a submitted code against the most recent unused OTP for
 * (phone, purpose). Wrong codes increment an attempt counter and lock out
 * after MAX_ATTEMPTS. Pass consume: true to mark the code used on success
 * (so it can't be replayed) - only the step that actually performs the
 * sensitive action (creating the account / changing the password) should
 * consume it; a plain "verify" step should not.
 */
async function checkOtp(phone, purpose, otp, { consume = false } = {}) {
  const { rows } = await pool.query(
    `SELECT * FROM otps WHERE phone = $1 AND purpose = $2 AND used = FALSE ORDER BY created_at DESC LIMIT 1`,
    [phone, purpose]
  );
  const row = rows[0];
  if (!row) return { ok: false, reason: 'No code was requested for this number' };
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: 'Code expired. Please request a new one.' };
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    return { ok: false, reason: 'Too many incorrect attempts. Please request a new code.' };
  }
  if (hashOtp(String(otp)) !== row.otp_hash) {
    await pool.query(`UPDATE otps SET attempts = attempts + 1 WHERE id = $1`, [row.id]);
    return { ok: false, reason: 'Incorrect code' };
  }
  if (consume) {
    await pool.query(`UPDATE otps SET used = TRUE WHERE id = $1`, [row.id]);
  }
  return { ok: true };
}

module.exports = { createOtp, checkOtp };

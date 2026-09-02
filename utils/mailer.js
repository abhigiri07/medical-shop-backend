const nodemailer = require('nodemailer');

// Uses Gmail SMTP by default. In your .env set:
//   SMTP_USER=youraddress@gmail.com
//   SMTP_PASS=<a Gmail "App Password", NOT your normal password>
// (Generate one at https://myaccount.google.com/apppasswords — requires
// 2-Step Verification to be enabled on the Google account.)
// To use a different provider instead, set SMTP_HOST/SMTP_PORT too.
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn(
      'WARNING: SMTP_USER / SMTP_PASS are not set. OTP emails will not be sent. ' +
      'Set them in backend/.env (see README).'
    );
  }

  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  } else {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }

  return transporter;
}

async function sendOtpEmail(toEmail, code, purpose) {
  const subject = purpose === 'reset'
    ? 'Your MediQuick password reset code'
    : 'Verify your MediQuick account';

  const heading = purpose === 'reset'
    ? 'Reset your password'
    : 'Verify your email';

  const intro = purpose === 'reset'
    ? 'Use the code below to reset your MediQuick password.'
    : 'Use the code below to verify your MediQuick account.';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color:#1a7a4c;">${heading}</h2>
      <p>${intro}</p>
      <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px; background:#f2f2f2; padding: 16px; text-align:center; border-radius: 8px;">${code}</p>
      <p style="color:#666; font-size: 13px;">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
    </div>
  `;

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    // No SMTP configured (e.g. local dev without credentials yet) —
    // log the code instead of throwing, so the flow is still testable.
    console.log(`[mailer] SMTP not configured. OTP for ${toEmail} (${purpose}): ${code}`);
    return;
  }

  await getTransporter().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: toEmail,
    subject,
    html,
  });
}

module.exports = { sendOtpEmail };

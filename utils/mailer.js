// Render's free tier blocks outbound SMTP (ports 25/465/587), so this
// sends over plain HTTPS via Brevo's transactional email API instead.
// Free Brevo account: https://app.brevo.com/ (300 emails/day, no card needed)
//   1. Sign up, then go to Senders, Domains & Dedicated IPs > Senders
//      and add + verify the email address you want to send FROM.
//   2. Go to SMTP & API > API Keys, create a new key.
//   3. Set BREVO_API_KEY and BREVO_SENDER_EMAIL in your .env / Render
//      environment variables.

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

async function sendOtpEmail(toEmail, code, purpose) {
  const subject = purpose === 'reset'
    ? 'Your Saikrupa Medical password reset code'
    : 'Verify your Saikrupa Medical account';

  const heading = purpose === 'reset' ? 'Reset your password' : 'Verify your email';

  const intro = purpose === 'reset'
    ? 'Use the code below to reset your Saikrupa Medical password.'
    : 'Use the code below to verify your Saikrupa Medical account.';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color:#1a7a4c;">${heading}</h2>
      <p>${intro}</p>
      <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px; background:#f2f2f2; padding: 16px; text-align:center; border-radius: 8px;">${code}</p>
      <p style="color:#666; font-size: 13px;">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
    </div>
  `;

  if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) {
    // Not configured yet — log the code instead of throwing, so the
    // flow is still testable locally.
    console.log(`[mailer] Brevo not configured. OTP for ${toEmail} (${purpose}): ${code}`);
    return;
  }

  const response = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'api-key': process.env.BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: {
        email: process.env.BREVO_SENDER_EMAIL,
        name: process.env.BREVO_SENDER_NAME || 'Saikrupa Medical',
      },
      to: [{ email: toEmail }],
      subject,
      htmlContent: html,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Brevo send failed (${response.status}): ${body}`);
  }
}

module.exports = { sendOtpEmail };

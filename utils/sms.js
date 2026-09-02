// Sends an SMS via Twilio's REST API using the built-in fetch (Node 18+),
// so no extra npm package is required. If Twilio credentials aren't set in
// the environment, it just logs the message instead - lets you build and
// test the whole OTP flow locally before you sign up for an SMS provider.
const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = process.env;

async function sendSms(toPhone, message) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    console.log(`[DEV SMS - no Twilio credentials set] To ${toPhone}: ${message}`);
    return;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
  const body = new URLSearchParams({ To: toPhone, From: TWILIO_FROM_NUMBER, Body: message });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SMS send failed (${res.status}): ${text}`);
  }
}

module.exports = { sendSms };

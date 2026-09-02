# OTP setup notes

## New environment variables
Add these to your `.env` (local) and to Render's Environment tab (production):

```
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
```

Leave them blank and OTP codes just get printed to the server console/logs
(`[DEV SMS ...]`) instead of being texted - useful for testing the whole
flow before you sign up for Twilio.

## New/changed files
- `db.js` - added the `otps` table
- `utils/otp.js` - OTP generate/hash/verify/cooldown logic (new)
- `utils/sms.js` - Twilio REST API sender with console fallback (new)
- `utils/phone.js` - normalizes numbers to E.164, e.g. 9876543210 -> +919876543210 (new)
- `routes/auth.js` - added `/send-otp`, `/verify-otp`, `/reset-password`;
  `/register` now requires and consumes a verified `otp` field

## New endpoints
- `POST /api/auth/send-otp` `{ phone, purpose: "signup" | "reset" }`
- `POST /api/auth/verify-otp` `{ phone, otp, purpose }`
- `POST /api/auth/register` `{ name, email, phone, password, otp }` (otp now required)
- `POST /api/auth/reset-password` `{ phone, otp, newPassword }`

## Security note
Rotate your Neon database password and pick a new random `JWT_SECRET` -
the ones in your previous `.env.example` looked like real values, and if
that file was ever committed to git they're now in your repo history.
Generate a strong secret with:
```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

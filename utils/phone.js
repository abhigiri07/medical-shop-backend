// Normalizes a user-entered phone number to E.164 (+<countrycode><number>)
// so the same number always maps to the same DB row and SMS providers accept it.
// Adjust the default country code if you're not targeting India.
const DEFAULT_COUNTRY_CODE = '91';

function normalizePhone(phone) {
  if (!phone) return phone;
  const trimmed = String(phone).trim();
  if (trimmed.startsWith('+')) return trimmed;

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return `+${DEFAULT_COUNTRY_CODE}${digits}`;
  return `+${digits}`;
}

module.exports = { normalizePhone };

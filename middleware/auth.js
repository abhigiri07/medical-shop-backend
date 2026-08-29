const jwt = require('jsonwebtoken');

// In production, set a real JWT_SECRET environment variable on your host
// (Render: Dashboard > your service > Environment). This fallback is only
// for local development.
const JWT_SECRET = process.env.JWT_SECRET || 'mediquick_dev_secret_change_in_production';

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided. Please log in.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }
}

module.exports = { verifyToken, JWT_SECRET };

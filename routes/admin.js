const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { db } = require('../db');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@mediquick.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const TOKEN_SECRET = process.env.ADMIN_TOKEN_SECRET || 'change-this-secret';

function signToken(email) {
  const payload = Buffer.from(JSON.stringify({ email, exp: Date.now() + 8 * 60 * 60 * 1000 })).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Admin authentication required' });
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return res.status(401).json({ error: 'Invalid admin token' });
  const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return res.status(401).json({ error: 'Invalid admin token' });
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (data.exp < Date.now()) return res.status(401).json({ error: 'Admin session expired' });
    req.admin = data;
    next();
  } catch { return res.status(401).json({ error: 'Invalid admin token' }); }
}

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Invalid email or password' });
  res.json({ token: signToken(email), admin: { email } });
});

router.get('/me', auth, (req, res) => res.json({ email: req.admin.email }));

router.get('/stats', auth, (req, res) => {
  const sql = `
    SELECT
      (SELECT COUNT(*) FROM medicines) AS medicines,
      (SELECT COUNT(*) FROM medicines WHERE stock_quantity = 0) AS out_of_stock,
      (SELECT COUNT(*) FROM medicines WHERE stock_quantity BETWEEN 1 AND 10) AS low_stock,
      (SELECT COUNT(*) FROM orders) AS orders,
      (SELECT COUNT(*) FROM orders WHERE status = 'PLACED') AS pending_orders,
      (SELECT COUNT(*) FROM contact_messages) AS messages,
      (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status != 'CANCELLED') AS revenue
  `;
  db.get(sql, (err, stats) => {
    if (err) return res.status(500).json({ error: err.message });
    db.all('SELECT id, customer_name, phone, total_amount, status, created_at FROM orders ORDER BY created_at DESC LIMIT 6', (err2, recentOrders) => {
      if (err2) return res.status(500).json({ error: err2.message });
      db.all('SELECT id, name, stock_quantity, category, price FROM medicines ORDER BY stock_quantity ASC, name ASC LIMIT 6', (err3, lowStock) => {
        if (err3) return res.status(500).json({ error: err3.message });
        res.json({ stats, recentOrders, lowStock });
      });
    });
  });
});

router.get('/categories', auth, (req, res) => {
  db.all(`SELECT category, COUNT(*) AS medicine_count FROM medicines WHERE category IS NOT NULL AND TRIM(category) != '' GROUP BY category ORDER BY category`, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.get('/messages', auth, (req, res) => {
  db.all('SELECT * FROM contact_messages ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.delete('/messages/:id', auth, (req, res) => {
  db.run('DELETE FROM contact_messages WHERE id = ?', [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (!this.changes) return res.status(404).json({ error: 'Message not found' });
    res.json({ message: 'Message deleted' });
  });
});

module.exports = { router, auth };

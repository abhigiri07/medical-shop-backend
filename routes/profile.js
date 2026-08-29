const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { verifyToken } = require('../middleware/auth');

// GET /api/profile - the logged-in user's own profile
router.get('/', verifyToken, (req, res) => {
  db.get('SELECT id, name, email, phone FROM users WHERE id = ?', [req.userId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'User not found' });
    res.json(row);
  });
});

// PUT /api/profile - update name/phone
router.put('/', verifyToken, (req, res) => {
  const { name, phone } = req.body;
  const sql = 'UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone) WHERE id = ?';

  db.run(sql, [name, phone, req.userId], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Profile updated' });
  });
});

module.exports = router;

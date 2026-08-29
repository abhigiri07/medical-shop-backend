const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { verifyToken } = require('../middleware/auth');

// GET /api/profile - the logged-in user's own profile
router.get('/', verifyToken, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, name, email, phone FROM users WHERE id = $1', [req.userId]);
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/profile - update name/phone
router.put('/', verifyToken, async (req, res) => {
  try {
    const { name, phone } = req.body;

    if (name !== undefined && name.trim() === '') {
      return res.status(400).json({ error: 'Name cannot be empty' });
    }

    const sql = 'UPDATE users SET name = COALESCE($1, name), phone = COALESCE($2, phone) WHERE id = $3';
    await pool.query(sql, [name, phone, req.userId]);
    res.json({ message: 'Profile updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

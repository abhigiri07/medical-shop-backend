const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// POST /api/contact - store a message from the app's Contact page
router.post('/', async (req, res) => {
  try {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'name, email and message are required' });
    }

    const { rows } = await pool.query(
      'INSERT INTO contact_messages (name, email, message) VALUES ($1, $2, $3) RETURNING id',
      [name, email, message]
    );
    res.status(201).json({ id: rows[0].id, name, email, message });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/contact - list messages (admin/shop owner view)
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM contact_messages ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

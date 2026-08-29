const express = require('express');
const router = express.Router();
const { db } = require('../db');

// POST /api/contact - store a message from the app's Contact page
router.post('/', (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'name, email and message are required' });
  }

  const sql = 'INSERT INTO contact_messages (name, email, message) VALUES (?, ?, ?)';
  db.run(sql, [name, email, message], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID, name, email, message });
  });
});

// GET /api/contact - list messages (admin/shop owner view)
router.get('/', (req, res) => {
  db.all('SELECT * FROM contact_messages ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

module.exports = router;

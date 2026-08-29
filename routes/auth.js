const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { name, email, phone, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  db.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()], (err, existing) => {
    if (err) return res.status(500).json({ error: err.message });
    if (existing) return res.status(409).json({ error: 'An account with this email already exists' });

    const passwordHash = bcrypt.hashSync(password, 10);
    const sql = 'INSERT INTO users (name, email, phone, password_hash) VALUES (?, ?, ?, ?)';

    db.run(sql, [name, email.toLowerCase(), phone || '', passwordHash], function (err2) {
      if (err2) return res.status(500).json({ error: err2.message });

      const user = { id: this.lastID, name, email: email.toLowerCase(), phone: phone || '' };
      const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '30d' });
      res.status(201).json({ token, user });
    });
  });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  db.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = bcrypt.compareSync(password, row.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const user = { id: row.id, name: row.name, email: row.email, phone: row.phone };
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user });
  });
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { db } = require('../db');

router.get('/', (req, res) => {
  const { category } = req.query;
  let sql = 'SELECT * FROM medicines';
  const params = [];
  if (category) {
    sql += ' WHERE category = ?';
    params.push(category);
  }
  sql += ' ORDER BY name ASC';

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(formatMedicine));
  });
});

router.get('/search', (req, res) => {
  const q = req.query.q || '';
  const sql = 'SELECT * FROM medicines WHERE name LIKE ? OR description LIKE ? ORDER BY name ASC';
  const like = `%${q}%`;
  db.all(sql, [like, like], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(formatMedicine));
  });
});

router.get('/:id', (req, res) => {
  db.get('SELECT * FROM medicines WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Medicine not found' });
    res.json(formatMedicine(row));
  });
});

router.post('/', (req, res) => {
  const { name, description, price, stock_quantity, image_url, category, prescription_required } = req.body;
  if (!name || price === undefined) {
    return res.status(400).json({ error: 'name and price are required' });
  }
  const sql = `
    INSERT INTO medicines (name, description, price, stock_quantity, image_url, category, prescription_required)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  const params = [name, description || '', price, stock_quantity || 0, image_url || '', category || '', prescription_required ? 1 : 0];

  db.run(sql, params, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID, ...req.body });
  });
});

router.put('/:id', (req, res) => {
  const { name, description, price, stock_quantity, image_url, category, prescription_required } = req.body;
  const sql = `
    UPDATE medicines SET
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      price = COALESCE(?, price),
      stock_quantity = COALESCE(?, stock_quantity),
      image_url = COALESCE(?, image_url),
      category = COALESCE(?, category),
      prescription_required = COALESCE(?, prescription_required)
    WHERE id = ?
  `;
  db.run(sql, [name, description, price, stock_quantity, image_url, category, prescription_required, req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Medicine not found' });
    res.json({ message: 'Medicine updated' });
  });
});

router.delete('/:id', (req, res) => {
  db.run('DELETE FROM medicines WHERE id = ?', [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Medicine not found' });
    res.json({ message: 'Medicine deleted' });
  });
});

function formatMedicine(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price,
    stock_quantity: row.stock_quantity,
    image_url: row.image_url,
    category: row.category,
    prescription_required: !!row.prescription_required,
  };
}

module.exports = router;

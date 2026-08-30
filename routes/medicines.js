const express = require('express');
const router = express.Router();
const { pool } = require('../db');

router.get('/', async (req, res) => {
  try {
    const { category } = req.query;
    let sql = 'SELECT * FROM medicines';
    const params = [];

    if (category) {
      sql += ' WHERE category = $1';
      params.push(category);
    }
    sql += ' ORDER BY name ASC';

    const { rows } = await pool.query(sql, params);
    res.json(rows.map(formatMedicine));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/search', async (req, res) => {
  try {
    const q = req.query.q || '';
    const sql = 'SELECT * FROM medicines WHERE name ILIKE $1 OR description ILIKE $1 ORDER BY name ASC';
    const { rows } = await pool.query(sql, [`%${q}%`]);
    res.json(rows.map(formatMedicine));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/medicines/categories - distinct list of categories currently in use.
// Used by the Android app's Categories tab and the admin panel's medicine
// form, so a brand-new category typed by the admin shows up everywhere as
// soon as a medicine using it is saved.
router.get('/categories', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT category FROM medicines
       WHERE category IS NOT NULL AND TRIM(category) <> ''
       ORDER BY category ASC`
    );
    res.json(rows.map((r) => r.category));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM medicines WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Medicine not found' });
    res.json(formatMedicine(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, description, price, stock_quantity, image_url, category, prescription_required } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({ error: 'name and price are required' });
    }

    const sql = `
      INSERT INTO medicines (name, description, price, stock_quantity, image_url, category, prescription_required)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `;
    const params = [
      name,
      description || '',
      price,
      stock_quantity || 0,
      image_url || '',
      category || '',
      !!prescription_required,
    ];

    const { rows } = await pool.query(sql, params);
    res.status(201).json({ id: rows[0].id, ...req.body });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, description, price, stock_quantity, image_url, category, prescription_required } = req.body;

    const sql = `
      UPDATE medicines SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        price = COALESCE($3, price),
        stock_quantity = COALESCE($4, stock_quantity),
        image_url = COALESCE($5, image_url),
        category = COALESCE($6, category),
        prescription_required = COALESCE($7, prescription_required)
      WHERE id = $8
    `;
    const result = await pool.query(sql, [
      name, description, price, stock_quantity, image_url, category, prescription_required, req.params.id,
    ]);

    if (result.rowCount === 0) return res.status(404).json({ error: 'Medicine not found' });
    res.json({ message: 'Medicine updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM medicines WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Medicine not found' });
    res.json({ message: 'Medicine deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function formatMedicine(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    stock_quantity: row.stock_quantity,
    image_url: row.image_url,
    category: row.category,
    prescription_required: !!row.prescription_required,
  };
}

module.exports = router;

const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { verifyToken } = require('../middleware/auth');

// POST /api/orders - place a delivery order (requires login)
router.post('/', verifyToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { customer_name, phone, delivery_address, items, total_amount } = req.body;

    if (!customer_name || !phone || !delivery_address || !items || !items.length) {
      return res.status(400).json({ error: 'customer_name, phone, delivery_address and items are required' });
    }

    await client.query('BEGIN');

    const insertOrderSql = `
      INSERT INTO orders (user_id, customer_name, phone, delivery_address, total_amount, status)
      VALUES ($1, $2, $3, $4, $5, 'PLACED')
      RETURNING id
    `;
    const orderResult = await client.query(insertOrderSql, [req.userId, customer_name, phone, delivery_address, total_amount]);
    const orderId = orderResult.rows[0].id;

    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (order_id, medicine_id, medicine_name, quantity, price)
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, item.medicine_id, item.medicine_name, item.quantity, item.price]
      );
      await client.query(
        'UPDATE medicines SET stock_quantity = GREATEST(stock_quantity - $1, 0) WHERE id = $2',
        [item.quantity, item.medicine_id]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      id: orderId,
      customer_name,
      phone,
      delivery_address,
      items,
      total_amount,
      status: 'PLACED',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// GET /api/orders/my - order history for the logged-in user
// (must be declared BEFORE /:id so "my" isn't parsed as an id)
router.get('/my', verifyToken, async (req, res) => {
  try {
    const { rows: orders } = await pool.query(
      'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC',
      [req.userId]
    );

    const results = await Promise.all(
      orders.map(async (order) => {
        const { rows: items } = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
        return {
          id: order.id,
          customer_name: order.customer_name,
          phone: order.phone,
          delivery_address: order.delivery_address,
          total_amount: Number(order.total_amount),
          status: order.status,
          created_at: order.created_at,
          items,
        };
      })
    );

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/orders/:id - single order detail (used by admin/status tracking)
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    const order = rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const { rows: items } = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [req.params.id]);

    res.json({
      id: order.id,
      customer_name: order.customer_name,
      phone: order.phone,
      delivery_address: order.delivery_address,
      total_amount: Number(order.total_amount),
      status: order.status,
      created_at: order.created_at,
      items,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/orders - list all orders (admin/shop owner view)
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/orders/:id/status - update delivery status (admin/delivery staff)
router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['PLACED', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
    }

    const result = await pool.query('UPDATE orders SET status = $1 WHERE id = $2', [status, req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Order not found' });
    res.json({ message: 'Order status updated', status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

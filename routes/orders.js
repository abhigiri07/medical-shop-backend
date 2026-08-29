const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { auth } = require('../middleware/adminAuth');

router.post('/', (req, res) => {
  const { customer_name, phone, delivery_address, items, total_amount } = req.body;
  if (!customer_name || !phone || !delivery_address || !items || !items.length) {
    return res.status(400).json({ error: 'customer_name, phone, delivery_address and items are required' });
  }

  const insertOrderSql = `
    INSERT INTO orders (customer_name, phone, delivery_address, total_amount, status)
    VALUES (?, ?, ?, ?, 'PLACED')
  `;

  db.run(insertOrderSql, [customer_name, phone, delivery_address, total_amount], function (err) {
    if (err) return res.status(500).json({ error: err.message });

    const orderId = this.lastID;
    const insertItemSql = `
      INSERT INTO order_items (order_id, medicine_id, medicine_name, quantity, price)
      VALUES (?, ?, ?, ?, ?)
    `;
    const stmt = db.prepare(insertItemSql);

    items.forEach((item) => {
      stmt.run([orderId, item.medicine_id, item.medicine_name, item.quantity, item.price]);
      db.run('UPDATE medicines SET stock_quantity = MAX(stock_quantity - ?, 0) WHERE id = ?', [item.quantity, item.medicine_id]);
    });

    stmt.finalize(() => {
      res.status(201).json({
        id: orderId,
        customer_name,
        phone,
        delivery_address,
        items,
        total_amount,
        status: 'PLACED',
      });
    });
  });
});

router.get('/:id', (req, res) => {
  db.get('SELECT * FROM orders WHERE id = ?', [req.params.id], (err, order) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    db.all('SELECT * FROM order_items WHERE order_id = ?', [req.params.id], (err2, items) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({
        id: order.id,
        customer_name: order.customer_name,
        phone: order.phone,
        delivery_address: order.delivery_address,
        total_amount: order.total_amount,
        status: order.status,
        created_at: order.created_at,
        items,
      });
    });
  });
});

router.get('/', (req, res) => {
  db.all('SELECT * FROM orders ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.put('/:id/status', auth, (req, res) => {
  const { status } = req.body;
  const validStatuses = ['PLACED', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
  }
  db.run('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Order not found' });
    res.json({ message: 'Order status updated', status });
  });
});

module.exports = router;

const express = require('express');
const cors = require('cors');
const { init } = require('./db');

const medicinesRouter = require('./routes/medicines');
const ordersRouter = require('./routes/orders');
const contactRouter = require('./routes/contact');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

init();

app.use('/api/medicines', medicinesRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/contact', contactRouter);

app.get('/', (req, res) => {
  res.json({ message: 'Medical Shop API is running' });
});

app.listen(PORT, () => {
  console.log(`Medical Shop backend running at http://localhost:${PORT}`);
  console.log(`Android emulator should call http://10.0.2.2:${PORT}/`);
});

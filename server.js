require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { init } = require('./db');

const medicinesRouter = require('./routes/medicines');
const ordersRouter = require('./routes/orders');
const contactRouter = require('./routes/contact');
const authRouter = require('./routes/auth');
const profileRouter = require('./routes/profile');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/medicines', medicinesRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/contact', contactRouter);
app.use('/api/auth', authRouter);
app.use('/api/profile', profileRouter);

app.get('/', (req, res) => {
  res.json({ message: 'Medical Shop API is running' });
});

// Wait for the database tables to exist (and sample data to seed) before
// accepting any requests, so the very first request can't race the setup.
init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Medical Shop backend running at http://localhost:${PORT}`);
      console.log(`Android emulator should call http://10.0.2.2:${PORT}/`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err.message);
    process.exit(1);
  });

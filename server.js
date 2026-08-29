const express = require('express');
const { db } = require('./db');
const cors = require('cors');
const { init } = require('./db');

const medicinesRouter = require('./routes/medicines');
const ordersRouter = require('./routes/orders');
const contactRouter = require('./routes/contact');
const { login, auth } = require('./adminAuth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

init();

app.post('/api/admin/login', (req,res) => { const token = login(req.body.email, req.body.password); if (!token) return res.status(401).json({error:'Invalid email or password'}); res.json({token}); });
app.get('/api/admin/stats', auth, (req,res) => {
  const stats = {};
  db.get('SELECT COUNT(*) AS total FROM medicines', (_,m)=>{ stats.totalMedicines=m?.total||0; db.get("SELECT COUNT(*) AS total FROM medicines WHERE stock_quantity <= 10", (_,l)=>{stats.lowStock=l?.total||0; db.get('SELECT COUNT(*) AS total FROM orders', (_,o)=>{stats.totalOrders=o?.total||0; db.get("SELECT COUNT(*) AS total FROM orders WHERE status NOT IN ('DELIVERED','CANCELLED')", (_,p)=>{stats.pendingOrders=p?.total||0; db.all('SELECT * FROM orders ORDER BY created_at DESC LIMIT 5',(_,recent)=>{stats.recentOrders=recent||[]; res.json(stats);});});});});});
});
app.use('/api/medicines', (req,res,next)=>{ if (['POST','PUT','DELETE'].includes(req.method)) return auth(req,res,next); next(); }, medicinesRouter);
app.use('/api/orders', (req,res,next)=>{ if (req.method==='GET' && req.path==='/') return auth(req,res,next); if (req.method==='PUT' && req.path.endsWith('/status')) return auth(req,res,next); next(); }, ordersRouter);
app.use('/api/contact', (req,res,next)=>{ if (req.method==='GET') return auth(req,res,next); next(); }, contactRouter);

app.get('/', (req, res) => {
  res.json({ message: 'Medical Shop API is running' });
});

app.listen(PORT, () => {
  console.log(`Medical Shop backend running at http://localhost:${PORT}`);
  console.log(`Android emulator should call http://10.0.2.2:${PORT}/`);
});

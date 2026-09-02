const { Pool } = require('pg');

// DATABASE_URL comes from your free Postgres host (e.g. Neon, Supabase).
// Locally, put it in backend/.env as DATABASE_URL=postgres://...
// On Render, set it under Dashboard > your service > Environment.
if (!process.env.DATABASE_URL) {
  console.warn(
    'WARNING: DATABASE_URL is not set. Set it in backend/.env (local) ' +
    'or your host\'s Environment settings (production). See README.md.'
  );
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Most free managed Postgres hosts (Neon, Supabase, Render Postgres)
  // require SSL but use certificates that Node won't auto-trust; this is
  // the standard safe-enough setting for that scenario.
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS medicines (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      stock_quantity INTEGER NOT NULL DEFAULT 0,
      image_url TEXT,
      category TEXT,
      prescription_required BOOLEAN DEFAULT FALSE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT,
      password_hash TEXT NOT NULL,
      email_verified BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // One-time codes used for both signup email verification and
  // forgot-password resets. purpose is 'signup' or 'reset'.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS otp_codes (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      purpose TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      delivery_address TEXT NOT NULL,
      total_amount REAL NOT NULL,
      status TEXT DEFAULT 'PLACED',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id),
      medicine_id INTEGER NOT NULL,
      medicine_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS contact_messages (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Safe to run every startup: Postgres supports IF NOT EXISTS on
  // ADD COLUMN directly, unlike SQLite, so no manual check needed.
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id INTEGER`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE`);

  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM medicines');
  if (rows[0].count === 0) {
    const sampleMedicines = [
      ['Paracetamol 500mg', 'Pain reliever and fever reducer, strip of 10 tablets', 25.0, 150, 'https://via.placeholder.com/150?text=Paracetamol', 'Pain Relief', false],
      ['Amoxicillin 250mg', 'Antibiotic capsule, strip of 10', 85.0, 60, 'https://via.placeholder.com/150?text=Amoxicillin', 'Antibiotics', true],
      ['Cetirizine 10mg', 'Antihistamine for allergy relief, strip of 10', 30.0, 200, 'https://via.placeholder.com/150?text=Cetirizine', 'Allergy', false],
      ['Vitamin C 500mg', 'Immunity booster tablets, bottle of 30', 120.0, 90, 'https://via.placeholder.com/150?text=Vitamin+C', 'Vitamins', false],
      ['Cough Syrup 100ml', 'Relieves dry and wet cough', 65.0, 0, 'https://via.placeholder.com/150?text=Cough+Syrup', 'Cold & Cough', false],
      ['Insulin Glargine', 'Long-acting insulin injection, 3ml pen', 450.0, 25, 'https://via.placeholder.com/150?text=Insulin', 'Diabetes Care', true],
      ['ORS Powder', 'Oral rehydration salts, pack of 5 sachets', 20.0, 300, 'https://via.placeholder.com/150?text=ORS', 'First Aid', false],
      ['Antiseptic Liquid 100ml', 'For cuts, wounds and disinfection', 55.0, 110, 'https://via.placeholder.com/150?text=Antiseptic', 'First Aid', false],
    ];

    for (const m of sampleMedicines) {
      await pool.query(
        `INSERT INTO medicines
           (name, description, price, stock_quantity, image_url, category, prescription_required)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        m
      );
    }
    console.log('Seeded sample medicines.');
  }
}

module.exports = { pool, init };

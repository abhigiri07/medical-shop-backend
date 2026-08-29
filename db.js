const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'medical_shop.db');
const db = new sqlite3.Database(dbPath);

function init() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS medicines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        stock_quantity INTEGER NOT NULL DEFAULT 0,
        image_url TEXT,
        category TEXT,
        prescription_required INTEGER DEFAULT 0
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        phone TEXT,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        customer_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        delivery_address TEXT NOT NULL,
        total_amount REAL NOT NULL,
        status TEXT DEFAULT 'PLACED',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        medicine_id INTEGER NOT NULL,
        medicine_name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        price REAL NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders (id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS contact_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Safe migration: older deployments may have an `orders` table from
    // before user_id existed. Add it if missing (no-op if already present).
    db.all('PRAGMA table_info(orders)', (err, columns) => {
      if (err) return;
      const hasUserId = columns.some((c) => c.name === 'user_id');
      if (!hasUserId) {
        db.run('ALTER TABLE orders ADD COLUMN user_id INTEGER', () => {
          console.log('Migrated orders table: added user_id column.');
        });
      }
    });

    db.get('SELECT COUNT(*) as count FROM medicines', (err, row) => {
      if (err) {
        console.error(err);
        return;
      }
      if (row.count === 0) {
        const stmt = db.prepare(`
          INSERT INTO medicines
            (name, description, price, stock_quantity, image_url, category, prescription_required)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        const sampleMedicines = [
          ['Paracetamol 500mg', 'Pain reliever and fever reducer, strip of 10 tablets', 25.0, 150, 'https://via.placeholder.com/150?text=Paracetamol', 'Pain Relief', 0],
          ['Amoxicillin 250mg', 'Antibiotic capsule, strip of 10', 85.0, 60, 'https://via.placeholder.com/150?text=Amoxicillin', 'Antibiotics', 1],
          ['Cetirizine 10mg', 'Antihistamine for allergy relief, strip of 10', 30.0, 200, 'https://via.placeholder.com/150?text=Cetirizine', 'Allergy', 0],
          ['Vitamin C 500mg', 'Immunity booster tablets, bottle of 30', 120.0, 90, 'https://via.placeholder.com/150?text=Vitamin+C', 'Vitamins', 0],
          ['Cough Syrup 100ml', 'Relieves dry and wet cough', 65.0, 0, 'https://via.placeholder.com/150?text=Cough+Syrup', 'Cold & Cough', 0],
          ['Insulin Glargine', 'Long-acting insulin injection, 3ml pen', 450.0, 25, 'https://via.placeholder.com/150?text=Insulin', 'Diabetes Care', 1],
          ['ORS Powder', 'Oral rehydration salts, pack of 5 sachets', 20.0, 300, 'https://via.placeholder.com/150?text=ORS', 'First Aid', 0],
          ['Antiseptic Liquid 100ml', 'For cuts, wounds and disinfection', 55.0, 110, 'https://via.placeholder.com/150?text=Antiseptic', 'First Aid', 0],
        ];

        sampleMedicines.forEach((m) => stmt.run(m));
        stmt.finalize();
        console.log('Seeded sample medicines.');
      }
    });
  });
}

module.exports = { db, init };

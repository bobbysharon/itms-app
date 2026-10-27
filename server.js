require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Admin routes
const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

// Serve static files (frontend)
app.use(express.static(path.join(__dirname, '.')));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Initialize database
async function initDB() {
  try {
    const fs = require('fs');
    const schema = fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8');
    // Split schema into individual statements and execute them one by one
    const statements = schema.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const stmt of statements) {
      try {
        await db.query(stmt + ';');
      } catch (e) {
        // Ignore "already exists" errors
        if (!e.message.includes('already exists')) {
          console.error('Schema statement error:', e.message);
        }
      }
    }
    console.log('Database schema initialized');

    // Seed systemadmin user if not exists
    try {
      const adminCheck = await db.query("SELECT id FROM users WHERE email = 'systemadmin@example.com'");
      if (adminCheck.rows.length === 0) {
        const bcrypt = require('bcryptjs');
        const hash = await bcrypt.hash('Admin@12345', 10);
        await db.query(
          "INSERT INTO users (email, password_hash, emp_no, role) VALUES ($1, $2, $3, $4)",
          ['systemadmin@example.com', hash, 'sysadmin', 'Administrator']
        );
        console.log('System admin user created');
      }
    try {
      const tfCheck = await db.query("SELECT id FROM users WHERE email = 'bobby.sharon@tafaseelbpo.com'");
      if (tfCheck.rows.length === 0) {
        const bcrypt = require('bcryptjs');
        const hash = await bcrypt.hash('Admin@12345', 10);
        await db.query(
          "INSERT INTO users (email, password_hash, emp_no, role) VALUES ($1, $2, $3, $4)",
          ['bobby.sharon@tafaseelbpo.com', hash, 'TF3060', 'Administrator']
        );
        console.log('TF3060 admin user created');
      }
    } catch (e) {
      console.error('Seed tf3060 error:', e.message);
    }

    // Seed default COA if empty
    try {
      const coaCheck = await db.query('SELECT code FROM finance_coa LIMIT 1');
      if (coaCheck.rows.length === 0) {
        const coaRows = [
          ['1110','Cash & Bank','Asset'],['1410','Inventory - Consumables','Asset'],
          ['1430','VAT Input','Asset'],['1510','IT Hardware','Asset'],
          ['1520','Software & Licences','Asset'],['1590','Accumulated Depreciation','Asset'],
          ['2110','Accounts Payable','Liability'],['5110','Staff Costs','Expense'],
          ['5220','Consumables Consumed','Expense'],['5230','Maintenance & AMC','Expense'],
          ['5240','Software & Licences','Expense'],['5290','Other IT Expenses','Expense'],
          ['5410','Depreciation','Expense'],['5510','Disposal Loss','Expense']
        ];
        for (const [code, name, type] of coaRows) {
          await db.query('INSERT INTO finance_coa (code, name, type) VALUES ($1,$2,$3) ON CONFLICT (code) DO NOTHING', [code, name, type]);
        }
        console.log('Default COA seeded');
      }
    } catch (e) {
      console.error('Seed COA error:', e.message);
    }
  } catch (err) {
    console.error('Database initialization error:', err.message);
    console.error(err.stack);
  }
}

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`SMART ITMS server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
});

module.exports = app;

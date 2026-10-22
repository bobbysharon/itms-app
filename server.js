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

// Data routes
const dataRoutes = require('./routes/data');
app.use('/api/data', dataRoutes);

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
    await db.query(schema);
    console.log('Database schema initialized');
  } catch (err) {
    console.error('Database initialization error:', err.message);
  }
}

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`SMART ITMS server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
});

module.exports = app;

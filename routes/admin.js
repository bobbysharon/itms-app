const express = require('express');
const router = express.Router();
const db = require('../config/database');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'smart-itms-secret-change-in-production';

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'Administrator') return res.status(403).json({ error: 'Administrator only' });
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

router.use(authMiddleware);

// Master reset — clears all data, keeps systemadmin user and config
router.post('/master-reset', async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    // Clear all transactional data
    const tables = [
      'tickets', 'hardware', 'software', 'consumables', 'consumable_purchases', 'consumable_issues',
      'purchase_requests', 'purchase_orders', 'grns', 'invoices', 'amcs', 'contracts', 'items',
      'finance_jv', 'finance_expenses', 'finance_payments', 'finance_depruns',
      'audit_log', 'notif_log', 'email_log', 'sso_log', 'failed_logins'
    ];
    for (const t of tables) {
      try { await client.query(`DELETE FROM ${t}`); } catch (e) { /* table may not exist yet */ }
    }
    // Clear all users except systemadmin
    try { await client.query("DELETE FROM users WHERE email != 'systemadmin@tafaseel.ae'"); } catch (e) { /* ignore */ }
    // Clear employees (they will be re-seeded)
    try { await client.query('DELETE FROM employees'); } catch (e) { /* ignore */ }
    // Clear vendors, terms, lists (will be re-seeded)
    try { await client.query('DELETE FROM vendors'); } catch (e) { /* ignore */ }
    try { await client.query('DELETE FROM terms'); } catch (e) { /* ignore */ }
    // Reset finance seen
    try { await client.query('DELETE FROM finance_seen'); } catch (e) { /* ignore */ }
    await client.query('COMMIT');
    res.json({ success: true, message: 'Master reset complete. System admin preserved.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Master reset error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Create login accounts for all employees without one
router.post('/create-accounts', async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('user@1234', 10);
    const employees = await db.query("SELECT no, email, role FROM employees WHERE status = 'Active' AND no NOT IN (SELECT emp_no FROM users WHERE emp_no IS NOT NULL AND emp_no != '')");
    let created = 0;
    for (const emp of employees.rows) {
      const email = emp.email || (emp.no.toLowerCase() + '@tafaseel.ae');
      // Check if user already exists
      const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
      if (existing.rows.length > 0) continue;
      await db.query(
        "INSERT INTO users (email, password_hash, emp_no, role, must_change_pw) VALUES ($1, $2, $3, $4, $5)",
        [email.toLowerCase().trim(), hash, emp.no, 'Requester', true]
      );
      created++;
    }
    res.json({ success: true, created });
  } catch (err) {
    console.error('Create accounts error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

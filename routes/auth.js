const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'smart-itms-secret-change-in-production';

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, empNo: user.emp_no },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({ token, user: { email: user.email, role: user.role, empNo: user.emp_no } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ user: decoded });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// SSO callback (receives token from IdP)
router.post('/sso/callback', async (req, res) => {
  const { code, state } = req.body;
  // In production, exchange code for token with IdP
  // For now, log the attempt
  await db.query(
    'INSERT INTO sso_log (id, event, status, by) VALUES ($1, $2, $3, $4)',
    ['SSO-' + Date.now().toString().slice(-6), 'SSO callback received', 'pending', 'anonymous']
  );
  res.json({ message: 'SSO callback received', code });
});

module.exports = router;

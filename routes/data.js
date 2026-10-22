const express = require('express');
const router = express.Router();
const db = require('../config/database');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'smart-itms-secret-change-in-production';

// Auth middleware
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

router.use(authMiddleware);

// Generic helpers
async function getAll(table, orderBy = 'id') {
  const result = await db.query(`SELECT * FROM ${table} ORDER BY ${orderBy} DESC`);
  return result.rows;
}

async function getById(table, id, idCol = 'id') {
  const result = await db.query(`SELECT * FROM ${table} WHERE ${idCol} = $1`, [id]);
  return result.rows[0] || null;
}

async function deleteById(table, id, idCol = 'id') {
  await db.query(`DELETE FROM ${table} WHERE ${idCol} = $1`, [id]);
}

// Employees
router.get('/employees', async (req, res) => {
  try { res.json(await getAll('employees', 'no')); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/employees', async (req, res) => {
  try {
    const e = req.body;
    await db.query(
      `INSERT INTO employees (no, name, designation, manager, doj, dol, dept, location, email, mobile, tel, ext, status, role)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (no) DO UPDATE SET name=$2, designation=$3, manager=$4, doj=$5, dol=$6, dept=$7, location=$8, email=$9, mobile=$10, tel=$11, ext=$12, status=$13, role=$14, updated_at=NOW()`,
      [e.no, e.name, e.designation, e.manager, e.doj, e.dol, e.dept, e.location, e.email, e.mobile, e.tel, e.ext, e.status || 'Active', e.role]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Tickets
router.get('/tickets', async (req, res) => {
  try { res.json(await getAll('tickets', 'created_at')); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/tickets', async (req, res) => {
  try {
    const r = req.body;
    await db.query(
      `INSERT INTO tickets (id, subject, description, requester, dept, type, mode, category, sub, item, impact, urgency, priority, level, group_name, tech, asset, status, created_at, respond_by, due_by, first_resp, resolved_at, closed_at, resolution, closure, reopened, pending_with, problem, change_ref, solution, desk, manager, manager_name, notes, work, tasks, approvals, hist)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39)
       ON CONFLICT (id) DO UPDATE SET subject=$2, description=$3, requester=$4, dept=$5, type=$6, mode=$7, category=$8, sub=$9, item=$10, impact=$11, urgency=$12, priority=$13, level=$14, group_name=$15, tech=$16, asset=$17, status=$18, respond_by=$20, due_by=$21, first_resp=$22, resolved_at=$23, closed_at=$24, resolution=$25, closure=$26, reopened=$27, pending_with=$28, problem=$29, change_ref=$30, solution=$31, desk=$32, manager=$33, manager_name=$34, notes=$35, work=$36, tasks=$37, approvals=$38, hist=$39`,
      [r.id, r.subject, r.desc, r.requester, r.dept, r.type, r.mode, r.category, r.sub, r.item, r.impact, r.urgency, r.priority, r.level, r.group_name || r.group, r.tech, r.asset, r.status || 'Open', r.created_at || new Date(), r.respond_by, r.due_by, r.first_resp, r.resolved_at, r.closed_at, r.resolution, r.closure, r.reopened || 0, r.pending_with, r.problem, r.change_ref, r.solution, r.desk, r.manager, r.manager_name, JSON.stringify(r.notes || []), JSON.stringify(r.work || []), JSON.stringify(r.tasks || []), JSON.stringify(r.approvals || []), JSON.stringify(r.hist || [])]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/tickets/:id', async (req, res) => {
  try { await deleteById('tickets', req.params.id); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

// Hardware
router.get('/hardware', async (req, res) => {
  try { res.json(await getAll('hardware', 'id')); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/hardware', async (req, res) => {
  try {
    const a = req.body;
    await db.query(
      `INSERT INTO hardware (id, type, subtype, description, comp_name, serial, purchase_date, price, vendor, condition, status, holder, issued_date, remarks)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (id) DO UPDATE SET type=$2, subtype=$3, description=$4, comp_name=$5, serial=$6, purchase_date=$7, price=$8, vendor=$9, condition=$10, status=$11, holder=$12, issued_date=$13, remarks=$14, updated_at=NOW()`,
      [a.id, a.type, a.subtype, a.desc, a.comp_name, a.serial, a.purchase_date, a.price, a.vendor, a.condition, a.status || 'In Stock', a.holder, a.issued_date, a.remarks]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Software
router.get('/software', async (req, res) => {
  try { res.json(await getAll('software', 'id')); } catch (e) { res.status(500).json({ error: e.message }); }
});

// Consumables
router.get('/consumables', async (req, res) => {
  try { res.json(await getAll('consumables', 'id')); } catch (e) { res.status(500).json({ error: e.message }); }
});

// Vendors
router.get('/vendors', async (req, res) => {
  try { res.json(await getAll('vendors', 'id')); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/vendors', async (req, res) => {
  try {
    const v = req.body;
    await db.query(
      `INSERT INTO vendors (id, name, currency, contact, email, phone1, phone2, terms_id, address, city, country)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO UPDATE SET name=$2, currency=$3, contact=$4, email=$5, phone1=$6, phone2=$7, terms_id=$8, address=$9, city=$10, country=$11`,
      [v.id, v.name, v.currency, v.contact, v.email, v.phone1, v.phone2, v.terms_id || v.termsId, v.address, v.city, v.country]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Purchase Orders
router.get('/pos', async (req, res) => {
  try { res.json(await getAll('purchase_orders', 'created_at')); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/pos', async (req, res) => {
  try {
    const p = req.body;
    await db.query(
      `INSERT INTO purchase_orders (id, po_no, vendor, approval, invoice, lines)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (po_no) DO UPDATE SET vendor=$3, approval=$4, invoice=$5, lines=$6`,
      [p.id || p.poNo, p.poNo, p.vendor, p.approval, p.invoice, JSON.stringify(p.lines || [])]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GRNs
router.get('/grns', async (req, res) => {
  try { res.json(await getAll('grns', 'created_at')); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/grns', async (req, res) => {
  try {
    const g = req.body;
    await db.query(
      `INSERT INTO grns (id, grn_no, po_no, date, lines)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (grn_no) DO UPDATE SET po_no=$3, date=$4, lines=$5`,
      [g.id || g.grnNo, g.grnNo, g.poNo, g.date, JSON.stringify(g.lines || [])]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Invoices
router.get('/invoices', async (req, res) => {
  try { res.json(await getAll('invoices', 'created_at')); } catch (e) { res.status(500).json({ error: e.message }); }
});

// AMCs
router.get('/amcs', async (req, res) => {
  try { res.json(await getAll('amcs', 'created_at')); } catch (e) { res.status(500).json({ error: e.message }); }
});

// Contracts
router.get('/contracts', async (req, res) => {
  try { res.json(await getAll('contracts', 'created_at')); } catch (e) { res.status(500).json({ error: e.message }); }
});

// Items
router.get('/items', async (req, res) => {
  try { res.json(await getAll('items', 'id')); } catch (e) { res.status(500).json({ error: e.message }); }
});

// Vendors
router.get('/vendors', async (req, res) => {
  try { res.json(await getAll('vendors', 'id')); } catch (e) { res.status(500).json({ error: e.message }); }
});

// Finance - COA
router.get('/finance/coa', async (req, res) => {
  try { res.json(await getAll('finance_coa', 'code')); } catch (e) { res.status(500).json({ error: e.message }); }
});

// Finance - JV
router.get('/finance/jv', async (req, res) => {
  try { res.json(await getAll('finance_jv', 'created_at')); } catch (e) { res.status(500).json({ error: e.message }); }
});

// Finance - Expenses
router.get('/finance/expenses', async (req, res) => {
  try { res.json(await getAll('finance_expenses', 'at')); } catch (e) { res.status(500).json({ error: e.message }); }
});

// Finance - Payments
router.get('/finance/payments', async (req, res) => {
  try { res.json(await getAll('finance_payments', 'at')); } catch (e) { res.status(500).json({ error: e.message }); }
});

// Finance - Config
router.get('/finance/config', async (req, res) => {
  try {
    const coa = await db.query('SELECT * FROM finance_coa ORDER BY code');
    const catgl = await db.query('SELECT * FROM finance_catgl');
    const emailCfg = await db.query('SELECT * FROM email_config WHERE id = 1');
    const ssoCfg = await db.query('SELECT * FROM sso_config WHERE id = 1');
    res.json({
      coa: coa.rows,
      catgl: catgl.rows,
      emailConfig: emailCfg.rows[0] || null,
      ssoConfig: ssoCfg.rows[0] || null,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Audit log
router.get('/audit', async (req, res) => {
  try { res.json(await getAll('audit_log', 'id')); } catch (e) { res.status(500).json({ error: e.message }); }
});

// Notification log
router.get('/notifications', async (req, res) => {
  try { res.json(await getAll('notif_log', 'at')); } catch (e) { res.status(500).json({ error: e.message }); }
});

// Email log
router.get('/email-log', async (req, res) => {
  try { res.json(await getAll('email_log', 'at')); } catch (e) { res.status(500).json({ error: e.message }); }
});

// Bulk data sync (for initial migration from localStorage)
router.post('/sync', async (req, res) => {
  const { table, data } = req.body;
  if (!table || !Array.isArray(data)) return res.status(400).json({ error: 'Invalid sync data' });
  const allowed = ['employees', 'tickets', 'hardware', 'software', 'consumables', 'vendors', 'purchase_orders', 'grns', 'invoices', 'amcs', 'contracts', 'items'];
  if (!allowed.includes(table)) return res.status(400).json({ error: 'Table not allowed' });
  let count = 0;
  for (const row of data) {
    try {
      // Simple upsert for each table
      if (table === 'employees') {
        await db.query(
          `INSERT INTO employees (no, name, designation, manager, doj, dol, dept, location, email, mobile, tel, ext, status, role) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT (no) DO UPDATE SET name=$2, designation=$3, manager=$4, doj=$5, dol=$6, dept=$7, location=$8, email=$9, mobile=$10, tel=$11, ext=$12, status=$13, role=$14`,
          [row.no, row.name, row.designation, row.manager, row.doj, row.dol, row.dept, row.location, row.email, row.mobile, row.tel, row.ext, row.status || 'Active', row.role]
        );
      }
      count++;
    } catch (e) { /* skip */ }
  }
  res.json({ success: true, synced: count });
});

module.exports = router;

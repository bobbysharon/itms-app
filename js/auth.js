/* ITMS auth + CSV migration (demo-grade local gate — NOT a substitute for server auth).
   - Accounts live in db.users with salted hashes; browser session in sessionStorage.
   - Bootstrap full-admin: bobby.sharon@example.com / Admin@12345 → employee Bobby Sharon.
   - Employees screen: per-row login access + password reset (admin only).
   - CSV: per-module sample download (exact accepted format) + validated upload. */
(function () {
  const ITMS = window.ITMS, L = ITMS.logic, UI = ITMS.ui, S = ITMS.store;
  const pages = (ITMS.pages = ITMS.pages || {});
  const { esc, icon: ic } = UI;
  const db = () => S.db;

  /* ---------- password hashing (local demo gate) ---------- */
  const SALT = 'itms-demo-v1';
  function pwHash(pw, salt) {
    const s = String(salt || '') + '::' + String(pw || '');
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < s.length; i++) { const ch = s.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(16) + (h1 >>> 0).toString(16);
  }

  /* ---------- users store + super-admin bootstrap (self-heals after any reset) ----------
     The super admin (systemadmin@example.com) is NOT an employee record — it lives
     only here and is managed from Administration. Personal staff rows are untouched. */
  const SYSADMIN = 'systemadmin@example.com';
  const ADMIN_EMAILS = ['bobby.sharon@example.com', 'bobby.sharon@esample.com'];
  function ensure() {
    const d = db(); if (!d) return;
    d.users = d.users || [];
    if (d.employees.some((e) => e.no === 'sysadmin')) {
      d.employees = d.employees.filter((e) => e.no !== 'sysadmin');
      L.log('System', 'removed legacy sysadmin staff row (system account needs no employee record)');
    }
    if (!d.users.some((u) => u.email.toLowerCase() === SYSADMIN)) {
      d.users.push({ email: SYSADMIN, hash: pwHash('Admin@12345', SALT), empNo: '', role: 'Administrator', created: L.today() });
    }
    try {
      const roles = (((db() || {}).sdp) || {}).roles || [];
      const adm = roles.find((x) => x.name === 'Administrator');
      if (adm) { adm.active = 'Yes'; adm.perms = adm.perms || []; if (adm.perms.indexOf('admin') < 0) adm.perms.push('admin'); adm.access = null; }
    } catch (e) { /* sdp not ready yet */ }
    (d.employees || []).forEach((e) => {
      if (e.role) return;
      const u = d.users.find((x) => x.empNo === e.no);
      e.role = (u && u.role) || 'Requester';
    });
  }
  const oi = S.init; S.init = function () { oi.apply(S, arguments); try { ensure(); } catch (e) { /* ignore */ } };
  S.subscribe(ensure);

  /* ---------- session ---------- */
  const SES = 'itms.session';
  const getSession = () => { try { return JSON.parse(sessionStorage.getItem(SES)) || null; } catch (e) { return null; } };
  function validSession() {
    if (!db()) return null;
    const s = getSession(); if (!s || !s.email) return null;
    const u = db().users.find((x) => x.email.toLowerCase() === String(s.email).toLowerCase());
    if (!u) return null;
    if (u.empNo && u.empNo !== 'sysadmin') { const e = L.emp(u.empNo); if (!e || e.status !== 'Active') return null; }
    return s;
  }
  function login(email, pw) {
    const u = db().users.find((x) => x.email.toLowerCase() === String(email || '').trim().toLowerCase());
    if (!u || u.hash !== pwHash(pw, SALT)) return { err: 'Invalid email or password.' };
    const e = (u.empNo && u.empNo !== 'sysadmin') ? L.emp(u.empNo) : null;
    if (u.empNo && u.empNo !== 'sysadmin' && (!e || e.status !== 'Active')) return { err: 'This account is disabled. Contact IT.' };
    const s = { empNo: u.empNo || '', role: u.role || 'Administrator', email: u.email, at: new Date().toISOString() };
    try {
      sessionStorage.setItem(SES, JSON.stringify(s));
      localStorage.setItem('itms.user', s.empNo); localStorage.setItem('itms.role', s.role);
    } catch (e2) { /* ignore */ }
    return { ok: s };
  }
  function logout() {
    try { sessionStorage.removeItem(SES); localStorage.removeItem('itms.user'); localStorage.removeItem('itms.role'); } catch (e) { /* ignore */ }
    location.reload();
  }
  ITMS.auth = { session: validSession, login, logout, mfaNeeded, mfaVerify, mfaEnroll, mfaDisable, mfaStatus };
  const canAdmin = () => { try { return ITMS.sdp.can('admin'); } catch (e) { return true; } };

  function refreshGate() {
    const w = document.getElementById('loginwrap'); if (!w) return;
    if (validSession()) { w.style.display = 'none'; }
    else {
      w.style.display = '';
      const em = document.getElementById('li-email'), pw = document.getElementById('li-pass'), er = document.getElementById('li-err');
      if (er) { er.style.display = 'none'; er.textContent = ''; }
      if (pw) pw.value = '';
      setTimeout(() => { const f = em && em.value ? pw : em; if (f) f.focus(); }, 60);
    }
  }
  function tryLogin() {
    const em = document.getElementById('li-email'), pw = document.getElementById('li-pass'), er = document.getElementById('li-err');
    const email = em ? em.value : '', password = pw ? pw.value : '';
    const u = db().users.find((x) => x.email.toLowerCase() === String(email || '').trim().toLowerCase());
    if (u && isLockedOut(email)) { if (er) { er.textContent = 'Account locked due to too many failed attempts. Try again in ' + mfaPolicy().lockoutMinutes + ' minutes.'; er.style.display = ''; } return; }
    const r = login(email, password);
    if (r.ok) {
      if (mfaNeeded(r.ok.email) && !r.ok.mfaOverride) {
        const ov = UI.modal(`<header><span class="gem" style="width:42px;height:42px;border-radius:13px">${ic('shield')}</span><div><h3>Two-step verification</h3><small>Enter the 6-digit code from your authenticator app</small></div><button class="ibtn x" data-x>${ic('x')}</button></header><div class="body" style="text-align:center">
          <p style="color:var(--muted)">Open Google Authenticator or Microsoft Authenticator to get your code.</p>
          <div style="margin:16px 0"><input class="in" id="li-mfa-code" style="text-align:center;font-size:24px;letter-spacing:10px;max-width:240px" maxlength="6" autocomplete="off" placeholder="000000"></div>
        </div><footer><button class="btn" data-mfa-login>${ic('check')}Verify</button> <button class="btn ghost" data-x>Cancel</button></footer>`, 'md');
        ov.addEventListener('click', async (e) => {
          if (e.target.closest('[data-x]')) return UI.close(ov);
          if (e.target.closest('[data-mfa-login]')) {
            const code = document.getElementById('li-mfa-code').value.trim();
            if (await mfaVerify(r.ok.email, code)) {
              r.ok.mfaVerified = true;
              try { sessionStorage.setItem(SES + '.mfa', '1'); } catch (e2) { /* ignore */ }
              UI.close(ov); refreshGate(); UI.toast('Welcome, ' + (L.empName(r.ok.empNo) || r.ok.email));
            } else {
              logFailedLogin(r.ok.email, 'Invalid MFA code');
              UI.toast('Invalid code — try again', 'err');
              const c = document.getElementById('li-mfa-code'); c.value = ''; c.focus();
            }
          }
        });
        setTimeout(() => { const c = document.getElementById('li-mfa-code'); if (c) c.focus(); }, 100);
      } else {
        refreshGate(); UI.toast('Welcome, ' + (L.empName(r.ok.empNo) || r.ok.email));
      }
    }
    else {
      if (u) logFailedLogin(email, 'Invalid password');
      if (er) { er.textContent = r.err; er.style.display = ''; if (pw) { pw.value = ''; pw.focus(); } }
    }
  }
  document.addEventListener('DOMContentLoaded', () => {
    refreshGate();
    const go = document.getElementById('li-go');
    if (go) go.addEventListener('click', tryLogin);
    const pw = document.getElementById('li-pass');
    if (pw) pw.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryLogin(); });
    const lo = document.getElementById('logout');
    if (lo) lo.addEventListener('click', logout);
    const up = document.createElement('input');
    up.type = 'file'; up.accept = '.csv'; up.id = 'csvup'; up.style.display = 'none';
    up.addEventListener('change', onCsvFile);
    document.body.appendChild(up);
  });

  /* ---------- employee login access + password reset (admin only) ---------- */
  const ACC_ROLES = ['Administrator', 'Group Lead', 'Technician', 'Requester', 'Auditor', 'Vendor / External'];
  UI.on('sysadmin.pw', () => {
    try { if (!ITMS.sdp.can('admin')) return UI.toast('Your role cannot change this password', 'err'); } catch (e) { /* open on error */ }
    UI.form({ title: 'System administrator password', sub: 'systemadmin@example.com · super admin', icon: 'key', fields: [{ k: 'pw1', label: 'New password', type: 'password', req: true }, { k: 'pw2', label: 'Confirm password', type: 'password', req: true }], submit: 'Change password', onSubmit: (v) => {
      const pw = String(v.pw1 || '');
      if (pw.length < 8) throw new Error('Password must be at least 8 characters');
      if (pw !== String(v.pw2 || '')) throw new Error('Passwords do not match');
      const u = db().users.find((x) => x.email === 'systemadmin@example.com');
      if (!u) throw new Error('System admin account missing — reload the app');
      u.hash = pwHash(pw, SALT); S.emit(); UI.toast('System admin password changed');
    } });
  });
  UI.on('emp.access', (el) => {
    if (!canAdmin()) return UI.toast('Your role cannot manage logins', 'err');
    const e = L.emp(el.dataset.id); if (!e) return;
    const u = db().users.find((x) => x.empNo === e.no);
    UI.form({
      title: 'Login access — ' + e.name, sub: e.no + (u ? ' · account exists' : ' · no account yet'), icon: 'key',
      fields: [
        { k: 'email', label: 'Login email', req: true, ro: !!u }, { k: 'role', label: 'Access role (login + modules)', type: 'select', options: ACC_ROLES, blank: false },
        { k: 'pw1', label: u ? 'New password (blank = keep)' : 'Password', type: 'password' }, { k: 'pw2', label: 'Confirm password', type: 'password' },
      ],
      values: { email: u ? u.email : (e.email || ''), role: u ? u.role : 'Requester' },
      submit: u ? 'Save / reset' : 'Create login',
      onSubmit: (v) => {
        if (!u && !String(v.email).includes('@')) throw new Error('A valid email is required');
        if (u && v.email.toLowerCase() !== u.email.toLowerCase() && db().users.some((x) => x.email.toLowerCase() === String(v.email).toLowerCase())) throw new Error('Email already used by another account');
        const pw = String(v.pw1 || '');
        if (!u && pw.length < 8) throw new Error('Password must be at least 8 characters');
        if (pw && pw !== String(v.pw2 || '')) throw new Error('Passwords do not match');
        if (pw && pw.length < 8) throw new Error('Password must be at least 8 characters');
        if (u) {
          u.email = String(v.email).trim(); u.role = v.role;
          if (pw) { u.hash = pwHash(pw, SALT); UI.toast('Password reset for ' + e.name); }
          else UI.toast('Login updated');
        } else {
          db().users.push({ email: String(v.email).trim(), hash: pwHash(pw, SALT), empNo: e.no, role: v.role, created: L.today() });
          UI.toast('Login created for ' + e.name);
        }
        e.role = v.role;
        try {
          if ((localStorage.getItem('itms.user') || '') === e.no && ITMS.sdp) ITMS.sdp.setRole(v.role);
          const s = JSON.parse(sessionStorage.getItem('itms.session') || 'null');
          if (s && s.empNo === e.no) { s.role = v.role; sessionStorage.setItem('itms.session', JSON.stringify(s)); }
        } catch (err2) { /* ignore */ }
        S.emit();
      },
    });
  });

  /* ---------- CSV migration ---------- */
  function csvEsc(v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }
  function parseCSV(t) {
    t = String(t || '').replace(/^\uFEFF/, '');
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (q) { if (c === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
      else cur += c;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows.filter((r) => r.some((x) => String(x).trim() !== ''));
  }
  const num = (v, fb) => { const n = parseFloat(v); return isNaN(n) ? (fb || 0) : n; };
  const SCHEMAS = {
    employees: {
      file: 'employees-sample.csv',
      cols: ['no', 'name', 'designation', 'manager', 'doj', 'dol', 'dept', 'location', 'email', 'mobile', 'status', 'role'],
      sample: [
        ['', 'Ahmed Khan', 'IT Support', 'Bobby Sharon', '2024-01-15', '', 'IT', 'Dubai, UAE', 'ahmed.khan@bobbysharon.ae', '971501234567', 'Active', 'Technician'],
        ['', 'Sara Ali', 'HR Officer', '', '2023-06-01', '', 'Human Resources', 'Abu Dhabi, UAE', 'sara.ali@bobbysharon.ae', '971501234568', 'Active', 'Requester'],
      ],
      run(rows) {
        let created = 0, updated = 0; const errors = [];
        const validRoles = (() => { try { return ITMS.sdp.D().roles.map((r) => r.name); } catch (e) { return []; } })();
        rows.forEach((r, i) => {
          try {
            if (!r.name || !r.name.trim()) throw new Error('name is required');
            if (ADMIN_EMAILS.indexOf(String(r.email || '').toLowerCase()) >= 0) throw new Error('reserved admin email — manage it via Login access');
            const data = { name: r.name.trim(), designation: r.designation || '', manager: r.manager || '', doj: r.doj || '', dol: r.dol || '', dept: r.dept || '', location: r.location || '', email: (r.email || '').trim(), mobile: r.mobile || '', status: ['Active', 'Inactive', 'Left'].indexOf(r.status) >= 0 ? r.status : 'Active', role: validRoles.indexOf(r.role) >= 0 ? r.role : 'Requester' };
            let e = (r.no && L.emp(r.no.trim())) || (data.email && db().employees.find((x) => !x.sys && (x.email || '').toLowerCase() === data.email.toLowerCase()));
            if (e) { if (!r.role) delete data.role; L.saveEmployee(data, e.no); updated++; } else { L.saveEmployee(data); created++; }
          } catch (err) { errors.push('Row ' + (i + 2) + ': ' + (err.message || err)); }
        });
        return { created, updated, errors };
      },
    },
    hardware: {
      file: 'hardware-sample.csv',
      cols: ['type', 'desc', 'compName', 'serial', 'purchaseDate', 'price', 'vendor', 'condition', 'status', 'holder', 'remarks'],
      sample: [
        ['Laptop', 'Dell Latitude 5440 i7 16GB', 'LT-1001', 'SN1001', '2024-02-01', '4200', '', 'Good', 'In Stock', '', 'Migration opening'],
        ['Monitor', 'Dell P2422H 24 inch', '', 'SN1002', '2024-02-01', '780', '', 'Good', 'In Stock', '', ''],
      ],
      run(rows) {
        let created = 0, updated = 0; const errors = [];
        rows.forEach((r, i) => {
          try {
            if (!r.desc || !r.desc.trim()) throw new Error('desc is required');
            const data = { type: r.type || 'Desktop', desc: r.desc.trim(), compName: r.compName || '', serial: r.serial || '', purchaseDate: r.purchaseDate || '', price: num(r.price), vendor: r.vendor || '', condition: r.condition || 'Good', status: ['In Stock', 'In Use', 'Under Repair', 'Disposed'].indexOf(r.status) >= 0 ? r.status : 'In Stock', remarks: r.remarks || '' };
            if (r.holder) { const he = L.emp(r.holder.trim()) || db().employees.find((x) => x.name === r.holder.trim()); data.holder = he ? he.no : ''; if (data.holder) data.issuedDate = data.purchaseDate || L.today(); }
            else data.holder = '';
            const ex = r.serial && db().hw.find((a) => a.serial === r.serial.trim());
            if (ex) { if (ex.holder) throw new Error(ex.id + ' is issued — return it before editing via import'); L.saveHW(data, ex.id); updated++; }
            else { L.saveHW(data); created++; }
          } catch (err) { errors.push('Row ' + (i + 2) + ': ' + (err.message || err)); }
        });
        return { created, updated, errors };
      },
    },
    software: {
      file: 'software-sample.csv',
      cols: ['name', 'type', 'subType', 'vendor', 'purchaseDate', 'expiry', 'qty', 'unitPrice', 'currency', 'serialNo'],
      sample: [
        ['Microsoft 365 Business', 'Application Software', 'Cloud-Based', 'SoftLine', '2024-01-01', '2026-12-31', '25', '62', 'AED', ''],
        ['Endpoint AV', 'System Software', 'Perpetual', 'SoftLine', '2023-05-01', '', '50', '90', 'AED', 'KEY-001'],
      ],
      run(rows) {
        let created = 0, updated = 0; const errors = [];
        rows.forEach((r, i) => {
          try {
            if (!r.name || !r.name.trim()) throw new Error('name is required');
            const data = { name: r.name.trim(), type: r.type || 'Application Software', subType: r.subType || 'Perpetual', vendor: r.vendor || '', purchaseDate: r.purchaseDate || '', expiry: r.expiry || '', qty: Math.max(0, Math.floor(num(r.qty))), unitPrice: num(r.unitPrice), currency: r.currency || 'AED', serialNo: r.serialNo || '' };
            const ex = db().sw.find((s) => s.name.toLowerCase() === data.name.toLowerCase());
            if (ex) { if (data.qty < L.swUsed(ex.id)) throw new Error('qty below installed count (' + L.swUsed(ex.id) + ')'); data.purchased = ex.purchased; L.saveSW(data, ex.id); updated++; }
            else L.saveSW(data);
            if (!ex) created++;
          } catch (err) { errors.push('Row ' + (i + 2) + ': ' + (err.message || err)); }
        });
        return { created, updated, errors };
      },
    },
    consumables: {
      file: 'consumables-sample.csv',
      cols: ['type', 'subtype', 'brand', 'model', 'desc', 'uom', 'reorder'],
      sample: [
        ['Ink_Toner', 'Black Toner', 'HP', '305A', 'HP 305A Black Toner', 'Pcs', '4'],
        ['Paper', 'A4 80gsm', 'Double A', 'A4-80', 'A4 Paper 80gsm Ream', 'Ream', '20'],
      ],
      run(rows) {
        let created = 0, updated = 0; const errors = [];
        rows.forEach((r, i) => {
          try {
            if (!r.desc || !r.desc.trim()) throw new Error('desc is required');
            const data = { type: r.type || 'Office_Supplies', subtype: r.subtype || '', brand: r.brand || '', model: r.model || '', desc: r.desc.trim(), uom: r.uom || 'Pcs', reorder: Math.max(0, Math.floor(num(r.reorder))) };
            const ex = db().cons.find((c) => c.desc.toLowerCase() === data.desc.toLowerCase());
            if (ex) { Object.assign(ex, data); S.emit(); updated++; } else { L.addConsumable(data, true); created++; }
          } catch (err) { errors.push('Row ' + (i + 2) + ': ' + (err.message || err)); }
        });
        S.emit();
        return { created, updated, errors };
      },
    },
  };
  UI.on('imp.sample', (el) => {
    const s = SCHEMAS[el.dataset.k]; if (!s) return;
    UI.download(s.file, '﻿' + [s.cols.join(',')].concat(s.sample.map((r) => r.map(csvEsc).join(','))).join('\n'), 'text/csv');
    UI.toast('Sample downloaded — fill it and Upload');
  });
  let pendingKey = '';
  UI.on('imp.upload', (el) => {
    pendingKey = el.dataset.k;
    const f = document.getElementById('csvup');
    if (f) { f.value = ''; f.click(); }
  });
  function onCsvFile(e) {
    const f = e.target.files[0]; if (!f || !pendingKey) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const grid = parseCSV(r.result);
        if (grid.length < 2) throw new Error('Empty file — download the sample first for the exact format.');
        const head = grid[0].map((x) => String(x).trim().toLowerCase());
        const s = SCHEMAS[pendingKey];
        const missing = s.cols.filter((c) => head.indexOf(c) < 0);
        if (missing.length) throw new Error('Missing columns: ' + missing.join(', ') + ' — use the sample file format.');
        const rows = grid.slice(1).map((g) => { const o = {}; s.cols.forEach((c, i) => { o[c] = (g[head.indexOf(c)] || '').trim(); }); return o; });
        const res = s.run(rows);
        S.emit();
        const ov = UI.modal(`<header><div><h3>Import ${esc(pendingKey)}</h3><small>${res.created} new · ${res.updated} updated · ${res.errors.length} skipped</small></div><button class="ibtn x" data-x>${ic('x')}</button></header><div class="body">${res.errors.length ? `<div class="empty" style="text-align:left"><b>Skipped rows</b><br>${res.errors.slice(0, 12).map(esc).join('<br>')}${res.errors.length > 12 ? '<br>…and ' + (res.errors.length - 12) + ' more' : ''}</div>` : '<div class="empty"><b>All rows imported cleanly</b></div>'}</div><footer><button class="btn" data-x>Done</button></footer>`, {});
        ov.addEventListener('click', (ev) => { if (ev.target.closest('[data-x]')) UI.close(ov); });
        if (!res.errors.length) UI.toast(res.created + res.updated + ' record(s) imported');
      } catch (err) { UI.toast(err.message || String(err), 'err'); }
    };
    r.readAsText(f);
  }
  ITMS.auth.csv = { SCHEMAS, parseCSV };

  /* ================= TOTP MFA (Google / Microsoft Authenticator) ================= */
  const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  function b32encode(buf) {
    let bits = 0, value = 0, out = '';
    for (let i = 0; i < buf.length; i++) {
      value = (value << 8) | buf[i]; bits += 8;
      while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
    }
    if (bits > 0) out += B32[(value << (5 - bits)) & 31];
    return out;
  }
  function b32decode(s) {
    s = s.toUpperCase().replace(/[^A-Z2-7]/g, '');
    let bits = 0, value = 0, out = [];
    for (let i = 0; i < s.length; i++) {
      value = (value << 5) | B32.indexOf(s[i]); bits += 5;
      if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
    }
    return new Uint8Array(out);
  }
  async function hmacSha1(key, msg) {
    const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    const s = await crypto.subtle.sign('HMAC', k, msg);
    return new Uint8Array(s);
  }
  async function totp(secretB32, offset) {
    const sec = b32decode(secretB32);
    const t = Math.floor(Date.now() / 1000 / 30) + (offset || 0);
    const buf = new ArrayBuffer(8); const dv = new DataView(buf);
    dv.setUint32(0, Math.floor(t / 4294967296)); dv.setUint32(4, t % 4294967296);
    const h = await hmacSha1(sec, new Uint8Array(buf));
    const o = h[h.length - 1] & 15;
    const code = ((h[o] & 127) << 24 | (h[o + 1] & 255) << 16 | (h[o + 2] & 255) << 8 | (h[o + 3] & 255)) % 1000000;
    return String(code).padStart(6, '0');
  }
  function genSecret() {
    const b = new Uint8Array(20); crypto.getRandomValues(b);
    return b32encode(b);
  }
  function mfaNeeded(email) {
    const u = db().users.find((x) => x.email.toLowerCase() === String(email).toLowerCase());
    return !!(u && u.mfaSecret);
  }
  async function mfaVerify(email, code) {
    const u = db().users.find((x) => x.email.toLowerCase() === String(email).toLowerCase());
    if (!u || !u.mfaSecret) return false;
    for (let o = -1; o <= 1; o++) { if (await totp(u.mfaSecret, o) === String(code).trim()) return true; }
    return false;
  }
  function mfaEnroll(email) {
    const u = db().users.find((x) => x.email.toLowerCase() === String(email).toLowerCase());
    if (!u) return null;
    u.mfaSecret = genSecret(); S.emit();
    return u.mfaSecret;
  }
  function mfaDisable(email) {
    const u = db().users.find((x) => x.email.toLowerCase() === String(email).toLowerCase());
    if (u) { delete u.mfaSecret; S.emit(); }
  }
  function otpauthUri(email, secret) {
    return 'otpauth://totp/SMARTITMS:' + encodeURIComponent(email) + '?secret=' + secret + '&issuer=SMARTITMS&period=30&digits=6';
  }
  function qrDataUri(text) {
    try {
      /* Self-contained QR code generator using a minimal implementation */
      const qr = generateQR(text);
      if (!qr) return '';
      const canvas = document.createElement('canvas');
      const size = qr.modules.length + 8;
      const scale = Math.floor(200 / size);
      canvas.width = size * scale; canvas.height = size * scale;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#000';
      for (let r = 0; r < qr.modules.length; r++) { for (let c = 0; c < qr.modules[r].length; c++) { if (qr.modules[r][c]) ctx.fillRect((c + 4) * scale, (r + 4) * scale, scale, scale); } }
      return canvas.toDataURL();
    } catch (e) { return ''; }
  }
  function generateQR(text) {
    /* Minimal QR Code generator (byte mode, ECC level M, auto version) */
    const data = new TextEncoder().encode(text);
    const capacity = [17, 32, 53, 78, 106, 134, 154, 192, 230, 271];
    let ver = 0; for (let i = 0; i < capacity.length; i++) { if (data.length <= capacity[i]) { ver = i + 1; break; } }
    if (!ver) return null;
    const totalCodewords = [26, 44, 70, 100, 134, 172, 196, 242, 292, 346][ver - 1];
    const eccCodewords = [10, 16, 26, 18, 24, 16, 18, 22, 22, 26][ver - 1];
    const dataCodewords = totalCodewords - eccCodewords;
    const bits = [];
    const pushBits = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); };
    pushBits(4, 4); pushBits(data.length, 8); data.forEach((b) => pushBits(b, 8));
    const capacityBits = dataCodewords * 8;
    if (bits.length < capacityBits) { pushBits(0, 4); while (bits.length % 8) bits.push(0); }
    while (bits.length < capacityBits) { pushBits(0xEC, 8); if (bits.length < capacityBits) pushBits(0x11, 8); }
    const bytes = []; for (let i = 0; i < bits.length; i += 8) { let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; bytes.push(b); }
    const gf = new Array(256).fill(0); let x = 1; for (let i = 0; i < 255; i++) { gf[i] = x; x <<= 1; if (x & 0x100) x ^= 0x11D; } gf[255] = gf[0];
    const gMul = (a, b) => (a === 0 || b === 0) ? 0 : gf[(gf.indexOf(a) + gf.indexOf(b)) % 255];
    const polyMul = (p, q) => { const r = new Array(p.length + q.length - 1).fill(0); p.forEach((a, i) => q.forEach((b, j) => r[i + j] ^= gMul(a, b))); return r; };
    const eccPoly = [1]; for (let i = 0; i < eccCodewords; i++) eccPoly = polyMul(eccPoly, [1, gf[i]]);
    const msgPoly = [...bytes, ...new Array(eccCodewords).fill(0)];
    for (let i = 0; i < bytes.length; i++) { const factor = msgPoly[i]; if (factor !== 0) for (let j = 0; j < eccPoly.length; j++) msgPoly[i + j] ^= gMul(eccPoly[j], factor); }
    const eccBytes = msgPoly.slice(bytes.length);
    const allBytes = [...bytes, ...eccBytes];
    const size = ver * 4 + 17;
    const modules = Array.from({ length: size }, () => new Array(size).fill(false));
    const setF = (r, c, v) => { if (r >= 0 && r < size && c >= 0 && c < size) modules[r][c] = v; };
    const finder = (r, c) => { for (let i = -1; i <= 7; i++) for (let j = -1; j <= 7; j++) { const inOuter = i >= 0 && i <= 6 && j >= 0 && j <= 6; const isRing = inOuter && (i === 0 || i === 6 || j === 0 || j === 6); const isCore = i >= 2 && i <= 4 && j >= 2 && j <= 4; setF(r + i, c + j, isRing || isCore); } };
    finder(0, 0); finder(0, size - 7); finder(size - 7, 0);
    for (let i = 8; i < size - 8; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
    const bitIdx = { i: 0 };
    const nextBit = () => { const byteIdx = Math.floor(bitIdx.i / 8), bitOff = 7 - (bitIdx.i % 8); bitIdx.i++; return (allBytes[byteIdx] >> bitOff) & 1; };
    let upward = true;
    for (let col = size - 1; col > 0; col -= 2) {
      if (col === 6) col = 5;
      for (let row = 0; row < size; row++) {
        const r = upward ? size - 1 - row : row;
        for (const c of [col, col - 1]) {
          if (modules[r][c] !== false) continue;
          const isDark = nextBit() === 1;
          modules[r][c] = isDark;
        }
      }
      upward = !upward;
    }
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) { if (modules[r][c] === false) { const r2 = r + (c % 3 === 0 ? 1 : 0); const c2 = c + (r % 3 === 0 ? 1 : 0); modules[r2 % size][c2 % size] = !modules[r2 % size][c2 % size]; } }
    return { modules };
  }
  function mfaPolicy() { const d = db(); d.mfaPolicy = d.mfaPolicy || { enforcedRoles: ['Administrator', 'Group Lead', 'Technician'], maxFailedAttempts: 5, lockoutMinutes: 15, allowOverride: 'Yes', requireEnrollment: 'Yes' }; return d.mfaPolicy; }
  function logFailedLogin(email, reason) {
    const d = db(); d.failedLogins = d.failedLogins || [];
    d.failedLogins.unshift({ id: 'FL-' + Date.now().toString().slice(-6), at: now(), email, reason: reason || '', by: email });
    if (d.failedLogins.length > 500) d.failedLogins.length = 500;
    S.emit();
  }
  function failedAttempts(email) {
    const d = db(); const cutoff = Date.now() - (mfaPolicy().lockoutMinutes * 60000);
    return (d.failedLogins || []).filter((x) => x.email === email && new Date(x.at).getTime() > cutoff).length;
  }
  function isLockedOut(email) { return failedAttempts(email) >= mfaPolicy().maxFailedAttempts; }
  function mfaOverride(email, reason) {
    if (!canAdmin()) return false;
    const u = db().users.find((x) => x.email.toLowerCase() === String(email).toLowerCase());
    if (!u) return false;
    u.mfaOverride = reason || ''; u.mfaOverrideAt = now(); u.mfaOverrideBy = validSession() ? validSession().email : 'admin';
    S.emit(); return true;
  }
  function mfaRequiredForRole(role) { return mfaPolicy().enforcedRoles.indexOf(role) >= 0; }
  function mfaEnrollmentStatus(email) {
    const u = db().users.find((x) => x.email.toLowerCase() === String(email).toLowerCase());
    if (!u) return 'Unknown';
    if (u.mfaOverride) return 'Overridden';
    if (u.mfaSecret) return 'Enrolled';
    if (mfaRequiredForRole(u.role)) return 'Required — not enrolled';
    return 'Not required';
  }
  function mfaStatus() {
    const users = db().users || [];
    const total = users.length;
    const enrolled = users.filter((u) => u.mfaSecret).length;
    const overridden = users.filter((u) => u.mfaOverride).length;
    const pending = users.filter((u) => !u.mfaSecret && !u.mfaOverride && mfaRequiredForRole(u.role)).length;
    return { total, enrolled, overridden, pending, policy: mfaPolicy() };
  }
  ITMS.auth.mfa = { mfaNeeded, mfaVerify, mfaEnroll, mfaDisable, otpauthUri, qrDataUri, totp, mfaStatus, genSecret, mfaPolicy, mfaOverride, mfaRequiredForRole, mfaEnrollmentStatus, logFailedLogin, failedAttempts, isLockedOut };

  /* ---------- MFA enrollment UI ---------- */
  UI.on('mfa.enroll', async () => {
    const s = validSession(); if (!s) return;
    const secret = mfaEnroll(s.email); if (!secret) return UI.toast('User not found', 'err');
    const uri = otpauthUri(s.email, secret);
    const qr = await qrDataUri(uri);
    const ov = UI.modal(`<header><span class="gem" style="width:42px;height:42px;border-radius:13px">${ic('shield')}</span><div><h3>Set up MFA</h3><small>SMART ITMS — Authenticator app</small></div><button class="ibtn x" data-x>${ic('x')}</button></header><div class="body" style="text-align:center">
      <p>Scan this QR code with Google Authenticator or Microsoft Authenticator.</p>
      ${qr ? `<img src="${qr}" style="width:200px;height:200px;margin:10px auto" alt="QR code">` : '<div class="empty">QR code unavailable — use manual entry</div>'}
      <p style="font-size:12px;color:var(--muted)">Manual entry key: <span class="mono" style="font-size:14px;letter-spacing:2px">${secret}</span></p>
      <div style="margin:16px 0"><label>Enter the 6-digit code to verify<input class="in" id="mfa-verify-code" style="text-align:center;font-size:20px;letter-spacing:8px;max-width:220px" maxlength="6" autocomplete="off"></label></div>
    </div><footer><button class="btn" data-mfa-verify>${ic('check')}Verify & enable</button> <button class="btn ghost" data-x>Cancel</button></footer>`, 'md');
    ov.addEventListener('click', async (e) => {
      if (e.target.closest('[data-x]')) return UI.close(ov);
      if (e.target.closest('[data-mfa-verify]')) {
        const code = document.getElementById('mfa-verify-code').value.trim();
        if (await mfaVerify(s.email, code)) { UI.close(ov); UI.toast('MFA enabled — you will need a code at next login'); }
        else UI.toast('Invalid code — try again', 'err');
      }
    });
  });
  UI.on('mfa.myStatus', async () => {
    const s = validSession(); if (!s) return;
    const needed = mfaNeeded(s.email);
    if (needed) {
      const ov = UI.modal(`<header><div><h3>MFA active</h3><small>Your account is protected with authenticator app</small></div><button class="ibtn x" data-x>${ic('x')}</button></header><div class="body"><p>MFA is enabled. At each login you will be asked for a 6-digit code from your authenticator app.</p><p style="color:var(--muted);font-size:12px">To disable MFA, contact your administrator.</p></div><footer><button class="btn" data-x>Close</button></footer>`, 'md');
      ov.addEventListener('click', (e) => { if (e.target.closest('[data-x]')) UI.close(ov); });
    } else {
      const ov = UI.modal(`<header><div><h3>MFA not set up</h3><small>Enable authenticator app verification</small></div><button class="ibtn x" data-x>${ic('x')}</button></header><div class="body"><p>MFA is not enabled on your account. We recommend enabling it for secure access.</p></div><footer><button class="btn" data-x>Close</button> <button class="btn" data-mfa-enroll>${ic('shield')}Set up MFA</button></footer>`, 'md');
      ov.addEventListener('click', (e) => { if (e.target.closest('[data-x]')) UI.close(ov); if (e.target.closest('[data-mfa-enroll]')) UI.acts['mfa.enroll'](); });
    }
  });
  /* ---------- Admin: MFA management page ---------- */
  UI.on('mfa.admin', () => {
    if (!canAdmin()) return UI.toast('Administrator only', 'err');
    const users = (db().users || []).map((u) => ({ email: u.email, role: u.role || '', mfa: u.mfaSecret ? 'Enabled' : '—' }));
    const st = mfaStatus();
    const ov = UI.modal(`<header><div><h3>MFA management</h3><small>${st.enrolled} of ${st.total} users enrolled</small></div><button class="ibtn x" data-x>${ic('x')}</button></header><div class="body">
      <div class="card"><table class="t"><thead><tr><th>User</th><th>Role</th><th>MFA</th><th></th></tr></thead><tbody>${users.map((u) => `<tr><td>${esc(u.email)}</td><td>${esc(u.role)}</td><td>${u.mfa === 'Enabled' ? P('Published', 'mint') : '—'}</td><td><button class="btn xs" data-mfa-toggle="${esc(u.email)}">${u.mfa === 'Enabled' ? 'Disable' : 'Enroll'}</button></td></tr>`).join('')}</tbody></table></div>
    </div><footer><button class="btn" data-x>Close</button></footer>`, 'lg');
    ov.addEventListener('click', (e) => {
      if (e.target.closest('[data-x]')) return UI.close(ov);
      const t = e.target.closest('[data-mfa-toggle]'); if (t) {
        const em = t.dataset.mfaToggle;
        if (mfaNeeded(em)) { mfaDisable(em); UI.toast('MFA disabled for ' + em); }
        else { const s = mfaEnroll(em); const uri = otpauthUri(em, s); qrDataUri(uri).then((qr) => {
          const ov2 = UI.modal(`<header><div><h3>Enroll MFA — ${esc(em)}</h3></div><button class="ibtn x" data-x>${ic('x')}</button></header><div class="body" style="text-align:center"><p>Share this QR with the user:</p>${qr ? `<img src="${qr}" style="width:180px;height:180px">` : ''}<p class="mono" style="font-size:12px">${s}</p></div><footer><button class="btn" data-x>Done</button></footer>`, 'md');
          ov2.addEventListener('click', (e2) => { if (e2.target.closest('[data-x]')) UI.close(ov2); });
        }); }
        UI.acts['mfa.admin']();
      }
    });
  });
})();

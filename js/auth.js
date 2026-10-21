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
  ITMS.auth = { session: validSession, login, logout };
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
    const r = login(email, password);
    if (r.ok) {
      refreshGate(); UI.toast('Welcome, ' + (L.empName(r.ok.empNo) || r.ok.email));
    }
    else if (er) { er.textContent = r.err; er.style.display = ''; if (pw) { pw.value = ''; pw.focus(); } }
  }
  document.addEventListener('DOMContentLoaded', () => {
    refreshGate();
    const go = document.getElementById('li-go');
    if (go) go.addEventListener('click', tryLogin);
    const pw = document.getElementById('li-pass');
    if (pw) pw.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryLogin(); });
    const lo = document.getElementById('logout');
    if (lo) lo.addEventListener('click', logout);
    const sso = document.getElementById('li-sso');
    if (sso) sso.addEventListener('click', (e) => {
      e.preventDefault();
      const url = ITMS.auth.sso.ssoLoginUrl();
      if (url) { window.location.href = url; }
      else {
        const em = document.getElementById('li-email');
        if (em) em.value = 'systemadmin@example.com';
        UI.toast('SSO not configured. Please configure in Administration → SSO Settings after login.', 'err');
        setTimeout(() => { const pw = document.getElementById('li-pass'); if (pw) pw.focus(); }, 500);
      }
    });
    const up = document.createElement('input');
    up.type = 'file'; up.accept = '.csv'; up.id = 'csvup'; up.style.display = 'none';
    up.addEventListener('change', onCsvFile);
    document.body.appendChild(up);
    try { ITMS.auth.sso.ssoHandleCallback(); } catch (e) { /* ignore */ }
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

  /* ================= SSO / IdP Integration (Keycloak / ADFS / Azure AD / Generic OIDC) ================= */
  function ssoCfg() { const d = db(); d.sso = d.sso || { provider: 'Keycloak', authority: '', clientId: '', clientSecret: '', redirectUri: '', scope: 'openid profile email', enforceMfa: 'Yes', autoProvision: 'Yes' }; return d.sso; }
  function ssoLoginUrl() {
    const c = ssoCfg();
    if (!c.authority || !c.clientId) return '';
    const state = btoa(JSON.stringify({ email: '', ts: Date.now() }));
    const url = c.authority.replace(/\/$/, '') + '/protocol/openid-connect/auth'
      + '?client_id=' + encodeURIComponent(c.clientId)
      + '&redirect_uri=' + encodeURIComponent(c.redirectUri || (location.origin + '/'))
      + '&response_type=code'
      + '&scope=' + encodeURIComponent(c.scope)
      + '&state=' + encodeURIComponent(state);
    return url;
  }
  function ssoHandleCallback() {
    const p = new URLSearchParams(location.search);
    const code = p.get('code'); const state = p.get('state');
    if (!code) return false;
    ssoLog('SSO callback received', 'info');
    /* In Docker/on-premise, exchange code for token via IdP token endpoint */
    const c = ssoCfg();
    if (!c.authority || !c.clientId) return false;
    ssoLog('Exchanging authorization code', 'info');
    /* The actual token exchange requires a backend endpoint in production */
    /* For now, we accept the callback and match by email from the state or prompt */
    UI.toast('SSO callback received — configure token exchange endpoint');
    history.replaceState({}, '', location.pathname);
    return true;
  }
  function ssoLog(event, status) {
    const d = db(); d.ssoLog = d.ssoLog || [];
    d.ssoLog.unshift({ id: 'SSO-' + Date.now().toString().slice(-6), at: now(), event, status: status || 'info', by: validSession() ? validSession().email : 'anonymous' });
    if (d.ssoLog.length > 500) d.ssoLog.length = 500;
    S.emit();
  }
  function ssoParseToken(token) {
    try { const parts = token.split('.'); if (parts.length !== 3) return null; return JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch (e) { return null; }
  }
  function ssoMfaClaim(token) {
    const claims = ssoParseToken(token); if (!claims) return false;
    const amr = claims.amr || claims.acr || [];
    return Array.isArray(amr) ? amr.some((m) => /mfa|otp|totp|2fa/i.test(String(m))) : /mfa|otp|totp|2fa/i.test(String(amr));
  }
  function ssoEnforceMfa() {
    const c = ssoCfg();
    if (c.enforceMfa !== 'Yes') return true;
    /* In production, check the IdP token for MFA claim */
    return true;
  }
  ITMS.auth.sso = { ssoCfg, ssoLoginUrl, ssoHandleCallback, ssoLog, ssoParseToken, ssoMfaClaim, ssoEnforceMfa };

})();

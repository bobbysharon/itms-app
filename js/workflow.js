/* ITMS workflow — masters, asset custody history, onboarding / offboarding, system integrations (AD · biometric · ERP) */
(function () {
  const ITMS = window.ITMS, L = ITMS.logic, UI = ITMS.ui, S = ITMS.store, pages = (ITMS.pages = ITMS.pages || {}), forms = (ITMS.forms = ITMS.forms || {});
  const { esc, icon: ic, pill } = UI; const fmt = (s) => UI.fmtDate(s); const db = () => S.db;
  const opts = (arr, sel) => arr.map((o) => { const v = typeof o === 'object' ? o.v : o, l = typeof o === 'object' ? o.l : o; return `<option value="${esc(v)}" ${String(v) === String(sel) ? 'selected' : ''}>${esc(l)}</option>`; }).join('');
  const ID_RULES = [{ v: 'first.last', l: 'first.last  (john.smith)' }, { v: 'flast', l: 'first initial + last  (jsmith)' }, { v: 'empno', l: 'Employee number  (0001)' }, { v: 'email', l: 'Email address' }];
  const AGREE = 'I understand that I have received the above listed assets and system accounts and that they are to be used solely for company-related duties. I am responsible for maintaining these assets and for keeping my credentials confidential. Upon end of my employment I am required to return all items; the company may withhold final pay until they are returned. I acknowledge that I received the assets in good working condition and I agree to these terms.';

  /* ================= MASTERS (every dropdown is fed from here) ================= */
  const MASTERS = [
    { key: 'departments', title: 'Departments', note: 'Employees → Department', from: () => db().employees.map((e) => e.dept), used: (v) => db().employees.filter((e) => e.dept === v).length, seed: ['IT', 'Finance', 'Human Resources', 'Sales', 'Marketing', 'Administration', 'Procurement', 'Legal', 'Engineering'] },
    { key: 'locations', title: 'Locations / sites', note: 'Employees → Location', from: () => db().employees.map((e) => e.location), used: (v) => db().employees.filter((e) => e.location === v).length, seed: ['Dubai, UAE'] },
    { key: 'designations', title: 'Designations', note: 'Employees → Designation', from: () => db().employees.map((e) => e.designation), used: (v) => db().employees.filter((e) => e.designation === v).length, seed: [] },
    { key: 'brands', title: 'Hardware brands', note: 'Hardware assets → Brand', from: () => db().hw.map((a) => a.brand), used: (v) => db().hw.filter((a) => a.brand === v).length, seed: [] },
    { key: 'osList', title: 'Operating systems', note: 'Hardware assets → OS', from: () => db().hw.map((a) => a.os), used: (v) => db().hw.filter((a) => a.os === v).length, seed: ['Windows 11 Pro', 'Windows 10 Pro', 'macOS', 'Ubuntu Linux', 'Windows Server 2022'] },
    { key: 'systemKinds', title: 'Integration system types', note: 'Integrations → Type', from: () => (db().systems || []).map((s) => s.kind), used: (v) => (db().systems || []).filter((s) => s.kind === v).length, seed: ['Directory', 'Biometric / Access', 'ERP', 'Email & Collaboration', 'Other'] },
  ];
  const DEFAULT_SYSTEMS = [
    { id: 'SYS-01', name: 'Active Directory', kind: 'Directory', idRule: 'first.last', notes: 'Domain account, mailbox, default groups' },
    { id: 'SYS-02', name: 'Biometric / Access Control', kind: 'Biometric / Access', idRule: 'empno', notes: 'Attendance and door-access user' },
    { id: 'SYS-03', name: 'ERP', kind: 'ERP', idRule: 'email', notes: 'ERP user + role' },
  ].map((s) => Object.assign({ mode: 'Simulation', url: '', auth: '', enabled: 'Yes' }, s));
  function migrateSys(s) {
    if (s.tpl) return; const m = s.mode; const b = String(s.auth || '').match(/Bearer\s+(.+)/i);
    if (m === 'Webhook') { s.tpl = 'webhook'; s.cfg = { url: s.url || '', auth: s.auth || '' }; }
    else if (m === 'SCIM 2.0') { s.tpl = 'scim'; s.cfg = { baseUrl: s.url || '', token: b ? b[1] : '' }; }
    else if (m === 'REST API') { s.tpl = 'custom'; s.cfg = { createUrl: s.url || '', createMethod: s.createMethod || 'POST', body: s.body || '', disableUrl: s.disableUrl || '', disableMethod: s.disableMethod || 'PATCH', disableBody: s.disableBody || '', headers: s.auth || '' }; }
    else if (m === 'File / script export') { s.tpl = 'custom-file'; s.cfg = { fileName: s.fileName || '', fileHeader: s.fileHeader || '', body: s.body || '', disableBody: s.disableBody || '' }; }
    else if (m === 'Email request') { s.tpl = 'email'; s.cfg = { to: s.url || '', cc: '', prefix: '[ITMS]', instruction: '' }; }
    else if (m === 'Manual task') { s.tpl = 'manual'; s.cfg = { team: '', instructions: s.notes || '' }; }
    else { s.tpl = 'sim'; s.cfg = {}; }
  }
  function ensure() {
    const d = db(); if (!d) return; d.lists = d.lists || {}; d.seq = d.seq || {}; d.employees = d.employees || [];
    if (!d.systems) d.systems = JSON.parse(JSON.stringify(DEFAULT_SYSTEMS));
    d.systems.forEach(migrateSys);
    ['accounts', 'provLog', 'lifecycle'].forEach((k) => { if (!d[k]) d[k] = []; });
    MASTERS.forEach((m) => { const had = !!d.lists[m.key]; d.lists[m.key] = L.uniq((d.lists[m.key] || []).concat(m.from().filter(Boolean), had ? [] : m.seed)).sort(); });
  }
  const origInit = S.init; S.init = function () { origInit.apply(S, arguments); ensure(); };
  S.subscribe(ensure);
  const M = (k) => () => db().lists[k] || [];

  /* ================= ASSET CUSTODY HISTORY ================= */
  function custody(id) {
    const a = L.hw(id); const mv = db().moves.filter((m) => m.assetId === id).slice().sort((x, y) => (x.date + x.id).localeCompare(y.date + y.id));
    const periods = []; let cur = { kind: 'state', label: 'In Stock', from: a.purchaseDate || (mv[0] && mv[0].date) || L.today(), startDoc: a.grn || '', cond: '', remarks: 'Received into stock' };
    const close = (m, endLabel) => { cur.to = m.date; cur.endDoc = m.doc; cur.endLabel = endLabel; periods.push(cur); };
    mv.forEach((m) => {
      if (m.type === 'Issue') { close(m, 'Issued to ' + L.empName(m.to)); cur = { kind: 'emp', who: m.to, from: m.date, startDoc: m.doc, cond: m.cond, remarks: m.remarks }; }
      else if (m.type === 'Transfer') { close(m, 'Transferred to ' + L.empName(m.to)); cur.endCond = m.cond; cur = { kind: 'emp', who: m.to, from: m.date, startDoc: m.doc, cond: m.cond, remarks: m.remarks, viaTransfer: true }; }
      else if (m.type === 'Return') { close(m, 'Returned → ' + (m.after || 'In Stock')); cur.endCond = m.cond; cur.endRemarks = m.remarks; cur = { kind: 'state', label: m.after || 'In Stock', from: m.date, startDoc: m.doc, cond: m.cond, remarks: m.remarks }; }
      else { close(m, 'Status → ' + m.after); cur = { kind: 'state', label: m.after, from: m.date, startDoc: m.doc, remarks: m.remarks }; }
    });
    periods.push(cur);
    periods.forEach((p) => { p.days = Math.max(0, L.diffDays(p.to || L.today(), p.from)); });
    return periods;
  }
  const docLink = (d) => (d && /^(ISS|RET|TRF)/.test(d) ? `<a class="link mono" data-act="mv.print" data-doc="${esc(d)}">${esc(d)}</a>` : `<span class="mono">${esc(d || '')}</span>`);
  function custodyHtml(a) {
    const ps = custody(a.id); const users = L.uniq(ps.filter((p) => p.kind === 'emp').map((p) => p.who)); const inUse = ps.filter((p) => p.kind === 'emp').reduce((s, p) => s + p.days, 0);
    const rows = ps.map((p, i) => `<tr><td>${i + 1}</td><td>${p.kind === 'emp' ? `<a class="link" data-act="emp.view" data-id="${p.who}"><b>${esc(L.empName(p.who))}</b></a> <small style="color:var(--muted)">${esc((L.emp(p.who) || {}).dept || '')}</small>${p.viaTransfer ? ' <small>(transfer)</small>' : ''}` : pill(p.label)}</td><td>${fmt(p.from)}</td><td>${p.to ? fmt(p.to) : '<span class="pill p-mint">Current</span>'}</td><td class="num">${p.days}</td><td>${docLink(p.startDoc)}</td><td>${p.endDoc ? docLink(p.endDoc) + '<br><small style="color:var(--muted)">' + esc(p.endLabel) + '</small>' : ''}</td><td>${esc(p.cond || '')}${p.endCond && p.endCond !== p.cond ? ' → ' + esc(p.endCond) : ''}</td><td>${esc([p.remarks, p.endRemarks].filter(Boolean).join(' · '))}</td></tr>`).join('');
    const inst = db().installs.filter((i) => i.hwId === a.id);
    return `<div class="mt"><h3 style="font:650 14px var(--head);margin:0 0 8px">Full custody history — who used it, from when to when <span class="pill p-violet">${users.length} user(s)</span> <span class="pill p-blue">${inUse} days in use</span></h3><div style="overflow:auto"><table class="t"><thead><tr><th>#</th><th>Held by / state</th><th>From</th><th>To</th><th class="num">Days</th><th>Started by</th><th>Ended by</th><th>Condition</th><th>Remarks</th></tr></thead><tbody>${rows}</tbody></table></div>${inst.length ? `<small style="color:var(--muted)">Software installed on this device: ${inst.map((i) => esc((L.sw(i.swId) || {}).name)).join(', ')}</small>` : ''}</div>`;
  }
  const lastBody = () => { const o = [...document.querySelectorAll('.ov')].pop(); return o && o.querySelector('.body'); };
  const origHw = UI.acts['hw.view']; UI.on('hw.view', function (el, e) { origHw(el, e); const b = lastBody(); if (b) b.insertAdjacentHTML('beforeend', custodyHtml(L.hw(el.dataset.id))); });

  /* ================= SYSTEM ACCOUNTS (AD / biometric / ERP …) ================= */
  const sysOf = (id) => db().systems.find((s) => s.id === id);
  const activeAcc = (empNo, sid) => db().accounts.find((a) => a.empNo === empNo && a.sysId === sid && a.status !== 'Disabled');
  const liveAccs = (empNo) => db().accounts.filter((a) => a.empNo === empNo && a.status !== 'Disabled');
  const toDisable = (no) => liveAccs(no).filter((a) => a.status !== 'Disable pending');
  const heldBy = (no) => db().hw.filter((a) => a.holder === no);
  const nextEmpNo = () => 'EMP-' + L.pad(db().employees.reduce((m, e) => Math.max(m, parseInt((e.no.split('-')[1] || '0'), 10)), 0) + 1);
  const domain = () => { const c = {}; db().employees.forEach((e) => { const d = (e.email || '').split('@')[1]; if (d) c[d] = (c[d] || 0) + 1; }); return Object.keys(c).sort((a, b) => c[b] - c[a])[0] || 'example.com'; };
  const nameParts = (n) => String(n || '').toLowerCase().replace(/[^a-z\s.-]/g, '').split(/[\s.]+/).filter(Boolean);
  function genId(sys, e) {
    const p = nameParts(e.name); const f = p[0] || 'user', l = p.length > 1 ? p[p.length - 1] : '';
    const dm = sys.cfg && sys.cfg.domain; const email = dm ? (l ? f + '.' + l : f) + '@' + dm : (e.email || (l ? f + '.' + l : f) + '@' + domain());
    const base = { 'first.last': l ? f + '.' + l : f, flast: l ? f[0] + l : f, empno: String(e.no || '').replace(/\D/g, '') || e.no, email }[sys.idRule] || e.no;
    const taken = (x) => db().accounts.some((a) => a.sysId === sys.id && a.accountId === x && a.status !== 'Disabled' && a.empNo !== e.no);
    let id = base, n = 1; while (taken(id)) { n++; id = base.includes('@') ? base.replace('@', n + '@') : base + n; } return id;
  }
  const payload = (e) => ({ no: e.no, name: e.name, email: e.email, department: e.dept, designation: e.designation, manager: e.manager, location: e.location, joinDate: e.doj, leaveDate: e.dol || '', mobile: e.mobile });
  /* ---- connection methods ---- */
  const MODES = ['Simulation', 'Webhook', 'REST API', 'SCIM 2.0', 'File / script export', 'Email request', 'Manual task'];
  const OFFLINE = ['File / script export', 'Email request', 'Manual task'];
  const secrets = (ITMS.secrets = new Map());
  const rndPw = () => { const set = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%&*?']; const r = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n; const c = set.map((x) => x[r(x.length)]); const all = set.join(''); while (c.length < 14) c.push(all[r(all.length)]); return c.sort(() => r(3) - 1).join(''); };
  function vars(e, accountId, remoteId, pw) {
    const p = String(e.name || '').trim().split(/\s+/); const em = e.email || accountId;
    return { accountId, remoteId: remoteId || '', name: e.name, firstName: p[0] || '', lastName: p.length > 1 ? p.slice(1).join(' ') : p[0] || '', email: em, mailNickname: String(accountId).split('@')[0], no: e.no, dept: e.dept, designation: e.designation, manager: e.manager, location: e.location, mobile: e.mobile, doj: e.doj || '', dol: e.dol || '', today: L.today(), tempPassword: pw || '', system: '' };
  }
  const jsonEsc = (v) => JSON.stringify(String(v == null ? '' : v)).slice(1, -1);
  const tpl = (t, v, mode) => String(t || '').replace(/\{\{(\w+)\}\}/g, (m, k) => { const x = v[k] == null ? '' : v[k]; return mode === 'json' ? jsonEsc(x) : mode === 'url' ? encodeURIComponent(x) : mode === 'ps' ? String(x).replace(/["`$]/g, '') : x; });
  const headersOf = (txt) => { const h = {}; String(txt || '').split('\n').forEach((l) => { const i = l.indexOf(':'); if (i > 0) h[l.slice(0, i).trim()] = l.slice(i + 1).trim(); }); return h; };
  const SCIM_C = '{"schemas":["urn:ietf:params:scim:schemas:core:2.0:User"],"userName":"{{accountId}}","externalId":"{{no}}","displayName":"{{name}}","name":{"givenName":"{{firstName}}","familyName":"{{lastName}}"},"emails":[{"value":"{{email}}","primary":true}],"title":"{{designation}}","active":true}';
  const SCIM_D = '{"schemas":["urn:ietf:params:scim:api:messages:2.0:PatchOp"],"Operations":[{"op":"replace","path":"active","value":false}]}';
  async function http(url, method, headers, body) {
    const r = await fetch(url, { method, headers, body: method === 'GET' || method === 'DELETE' ? undefined : body }); let j = null; try { j = await r.clone().json(); } catch (x) { /* no json */ }
    const detail = !r.ok && j ? ' — ' + String((j.error && (j.error.message || j.error)) || j.detail || j.message || '').slice(0, 120) : '';
    return { ok: r.ok, msg: 'HTTP ' + r.status + detail, remoteId: j && (j.id || j.Id) ? String(j.id || j.Id) : '' };
  }
  const CONN = () => ITMS.connectors;
  async function runConnector(def, sys, action, acc, e) {
    const c = sys.cfg || {}; const create = action === 'create';
    if (def.type === 'sim') return { ok: true, msg: 'Simulated' };
    if (['file', 'email', 'manual'].includes(def.type)) return { ok: true, pending: true, msg: create ? 'Awaiting IT action' : 'Disable awaiting IT action' };
    try {
      if (def.type === 'hook') { if (!c.url) return { ok: false, msg: 'Webhook URL not set' }; return await http(c.url, 'POST', Object.assign({ 'Content-Type': 'application/json' }, CONN().hdr(c.auth)), JSON.stringify({ action, system: sys.name, accountId: acc.accountId, employee: payload(e) })); }
      const pw = create ? rndPw() : ''; const v = vars(e, acc.accountId, acc.remoteId, pw); v.system = sys.name;
      const steps = create ? def.create(c, v, acc) : def.disable(c, v, acc); if (!steps || steps.error) return { ok: false, msg: (steps && steps.error) || 'Not supported' };
      let rid = '', last = { ok: true, msg: '' };
      for (const st of steps) { const body = st.body == null ? undefined : typeof st.body === 'string' ? st.body : JSON.stringify(st.body); last = await http(st.url, st.method, Object.assign({ 'Content-Type': st.ct || 'application/json' }, st.headers || {}), body); if (last.remoteId && !rid) rid = last.remoteId; if (!last.ok) return last; }
      if (create && pw) secrets.set(acc.empNo + '|' + sys.name, pw);
      return { ok: true, msg: last.msg, remoteId: rid };
    } catch (err) { return { ok: false, msg: 'Network/CORS error — use a Webhook middleware if the API blocks browsers (' + err.message + ')' }; }
  }
  async function callSystem(sys, action, acc, e) {
    const def = CONN() && CONN().get(sys.tpl); if (def) return runConnector(def, sys, action, acc, e);
    const create = action === 'create'; const mode = sys.mode;
    if (mode === 'Simulation' || (!mode)) return { ok: true, msg: 'Simulated' };
    if (OFFLINE.includes(mode)) return { ok: true, pending: true, msg: create ? 'Awaiting IT action' : 'Disable awaiting IT action' };
    const h = Object.assign({}, headersOf(sys.auth));
    try {
      if (mode === 'Webhook') {
        if (!sys.url) return { ok: false, msg: 'Webhook URL not set' }; h['Content-Type'] = 'application/json';
        const r = await http(sys.url, 'POST', h, JSON.stringify({ action, system: sys.name, accountId: acc.accountId, employee: payload(e) })); return r;
      }
      const base = (sys.url || '').replace(/\/+$/, ''); const pw = create ? rndPw() : ''; const v = vars(e, acc.accountId, acc.remoteId, pw); v.system = sys.name; let url, method, body;
      if (mode === 'SCIM 2.0') { h['Content-Type'] = 'application/scim+json'; if (create) { url = base + '/Users'; method = 'POST'; body = tpl(sys.body || SCIM_C, v, 'json'); } else { if (!acc.remoteId) return { ok: false, msg: 'No SCIM id stored for this account' }; url = base + '/Users/' + encodeURIComponent(acc.remoteId); method = 'PATCH'; body = tpl(sys.disableBody || SCIM_D, v, 'json'); } }
      else { h['Content-Type'] = 'application/json'; if (create) { url = tpl(sys.url, v, 'url'); method = sys.createMethod || 'POST'; body = tpl(sys.body, v, 'json'); } else { const u = sys.disableUrl; if (!u) return { ok: false, msg: 'Disable URL not set' }; url = tpl(u, v, 'url'); method = sys.disableMethod || 'PATCH'; body = tpl(sys.disableBody, v, 'json'); } }
      if (!url || /YOUR-|INSTANCE|company\.com/i.test(url)) return { ok: false, msg: 'Endpoint URL not configured' };
      const r = await http(url, method, h, body); if (create && r.ok && pw) secrets.set(acc.empNo + '|' + sys.name, pw); return r;
    } catch (err) { return { ok: false, msg: 'Network/CORS error — use a Webhook middleware if the API blocks browsers (' + err.message + ')' }; }
  }
  const plog = (empNo, sysId, action, accountId, r) => { db().provLog.unshift({ at: new Date().toISOString(), empNo, sysId, action, accountId, ok: r.ok, msg: r.msg }); if (db().provLog.length > 500) db().provLog.length = 500; };
  async function provision(empNo, sysIds) {
    const e = L.emp(empNo); const out = [];
    for (const sid of sysIds) {
      const sys = sysOf(sid); if (!sys) continue; let acc = activeAcc(empNo, sid); const accountId = acc ? acc.accountId : genId(sys, e);
      const r = await callSystem(sys, 'create', { accountId, remoteId: acc && acc.remoteId, empNo }, e);
      if (!acc) { db().seq.acc = (db().seq.acc || 0) + 1; acc = { id: 'ACC-' + L.pad(db().seq.acc), empNo, sysId: sid, accountId, created: L.today() }; db().accounts.push(acc); }
      acc.status = r.ok ? (r.pending ? 'Pending' : 'Active') : 'Failed'; acc.msg = r.msg; if (r.remoteId) acc.remoteId = r.remoteId; plog(empNo, sid, 'Create', accountId, r); out.push({ sys: sys.name, accountId, ok: r.ok, pending: !!r.pending, msg: r.msg });
    }
    L.log('Access', `${out.filter((x) => x.ok).length}/${out.length} system account(s) created for ${e.name}`, empNo); S.emit(); return out;
  }
  async function deprovision(accIds) {
    const out = [];
    for (const id of accIds) {
      const acc = db().accounts.find((a) => a.id === id); if (!acc) continue; const sys = sysOf(acc.sysId); const e = L.emp(acc.empNo);
      const r = await callSystem(sys, 'disable', acc, e);
      if (r.ok) { if (r.pending) acc.status = 'Disable pending'; else { acc.status = 'Disabled'; acc.disabled = L.today(); } } acc.msg = r.msg; plog(acc.empNo, acc.sysId, 'Disable', acc.accountId, r); out.push({ sys: sys.name, accountId: acc.accountId, ok: r.ok, pending: !!r.pending, msg: r.msg });
    }
    if (out.length) L.log('Access', `${out.filter((x) => x.ok).length}/${out.length} system account(s) disabled`, ''); S.emit(); return out;
  }
  const missingSys = (empNo) => db().systems.filter((s) => s.enabled === 'Yes' && !activeAcc(empNo, s.id));
  const pendingOff = () => db().employees.filter((e) => e.status !== 'Active' && (heldBy(e.no).length || liveAccs(e.no).length));
  ITMS.pendingOffboarding = pendingOff;
  const addEvent = (type, empNo, date, data) => { const k = type === 'Onboarding' ? 'onb' : 'off'; db().seq[k] = (db().seq[k] || 0) + 1; const ev = Object.assign({ id: (k === 'onb' ? 'ONB-' : 'OFF-') + L.pad(db().seq[k]), type, empNo, date, at: new Date().toISOString() }, data); db().lifecycle.unshift(ev); try { const q = (((db().sdp || {}).hr) || { onb: [], offb: [] }); const list = type === 'Onboarding' ? q.onb : q.offb; const p = (list || []).find((x) => x.empNo === empNo && x.status !== 'Completed'); if (p) { p.status = 'Completed'; p.ref = ev.id; } } catch (e) { /* HR link optional */ } S.emit(); return ev; };
  UI.on('hr.accept', (el) => {
    const parts = String(el.dataset.id || '').split(':'); const kind = parts[0], id = parts[1];
    try {
      const q = (((db().sdp || {}).hr) || { onb: [], offb: [] }); const rec = ((kind === 'onb' ? q.onb : q.offb) || []).find((x) => x.id === id);
      if (!rec) return UI.toast('HR request not found', 'err');
      if (rec.status === 'Pending IT') { rec.status = 'Accepted'; S.emit(); }
      if (kind === 'onb') onboard(rec.empNo); else offboard(rec.empNo);
    } catch (e) { UI.toast(e.message || String(e), 'err'); }
  });
  const summary = (res) => { const bad = res.filter((r) => !r.ok).length, pd = res.filter((r) => r.pending).length; return [bad ? `${bad} failed — use Retry on the Integrations page` : '', pd ? `${pd} awaiting IT action (Integrations → Accounts)` : ''].filter(Boolean).join(' · '); };

  /* ================= PRINTABLE ONBOARDING / OFFBOARDING FORMS ================= */
  function metaBlock(e, dateLabel, date) { return `<div class="meta"><div><b>Emp No:</b>${esc(e.no)}</div><div><b>${dateLabel}:</b>${fmt(date)}</div><div><b>Emp name:</b>${esc(e.name)}</div><div><b>Designation:</b>${esc(e.designation)}</div><div><b>Department:</b>${esc(e.dept)}</div><div><b>Reporting manager:</b>${esc(e.manager)}</div><div><b>Location:</b>${esc(e.location)}</div><div><b>Email:</b>${esc(e.email)}</div><div><b>Mobile:</b>${esc(e.mobile)}</div><div><b>Date of joining:</b>${fmt(e.doj)}</div></div>`; }
  const aRow = (id, extra) => { const a = L.hw(id) || {}; return `<tr><td>${esc(id)}</td><td>${esc(a.type)}</td><td>${esc((a.brand || '') + ' ' + (a.model || ''))}</td><td>${esc(a.serial)}</td><td>${esc(extra[0] || a.condition)}</td>${extra[1] != null ? `<td>${esc(extra[1])}</td>` : ''}</tr>`; };
  const accTable = (accs, head, empNo) => { const pw = (a) => secrets.get(empNo + '|' + a.sys); const showPw = accs.some(pw); return `<h2 style="margin:12px 0 4px;font-size:13px">System access ${head}</h2><table><thead><tr><th>System</th><th>Account / user ID</th>${showPw ? '<th>Temporary password</th>' : ''}<th>Status</th></tr></thead><tbody>${accs.map((a) => `<tr><td>${esc(a.sys)}</td><td>${esc(a.accountId)}</td>${showPw ? `<td class="mono">${esc(pw(a) || '')}</td>` : ''}<td>${!a.ok ? 'FAILED — pending IT follow-up' : a.pending ? 'Requested — pending IT action' : head}</td></tr>`).join('') || '<tr><td colspan="3" style="text-align:center;color:#888">None</td></tr>'}</tbody></table>`; };
  forms.lifecycleDoc = function (id) {
    const ev = db().lifecycle.find((x) => x.id === id); if (!ev) return UI.toast('Record not found', 'err'); const e = L.emp(ev.empNo); const on = ev.type === 'Onboarding';
    const title = on ? 'Employee Onboarding & Asset Issuance Form' : 'Employee Offboarding & Asset Return Form';
    const assets = `<h2 style="margin:12px 0 4px;font-size:13px">${on ? 'Assets issued' : 'Assets returned / reassigned'}</h2><table><thead><tr><th>Asset ID</th><th>Type</th><th>Brand / model</th><th>Serial</th><th>Condition</th>${on ? '' : '<th>Disposition</th>'}</tr></thead><tbody>${ev.assets.map((x) => aRow(x.id, on ? [] : [x.cond, x.disp])).join('') || `<tr><td colspan="${on ? 5 : 6}" style="text-align:center;color:#888">No assets</td></tr>`}</tbody></table>`;
    UI.doc(title + ' ' + ev.id, `${UI.docHead(title)}<p style="margin:0 0 6px;color:#555">Reference ${ev.id}</p>${metaBlock(e, on ? 'Date' : 'Last working day', ev.date)}${assets}${accTable(ev.accounts, on ? 'Active' : 'Disabled', ev.empNo)}<p class="agree">${on ? '<b>Asset &amp; access agreement:</b> ' + AGREE : 'I confirm that I have returned all company assets listed above in the stated condition, and I acknowledge that my system accounts have been disabled. IT confirms that returned items were verified at handover.'}</p><div class="sig"><div>Employee signature</div><div>IT department</div><div>${on ? 'Reporting manager / HR' : 'HR / Manager'}</div></div>`);
  };

  /* ================= ONBOARDING WIZARD ================= */
  function onboard(pre) {
    const st = { emp: pre || '', nw: { name: '', designation: '', dept: '', location: (M('locations')() || [])[0] || '', manager: '', doj: L.today(), email: '', mobile: '' }, date: L.today(), pick: new Set(), sys: null, q: '', tf: '' };
    const ov = UI.modal('', { size: 'xl', sticky: true }); const box = ov.querySelector('.modal');
    const subject = () => (st.emp === '__new' ? Object.assign({ no: nextEmpNo() }, st.nw) : L.emp(st.emp));
    const spare = () => db().hw.filter((a) => a.status === 'In Stock');
    function assetList() { let l = spare(); if (st.tf) l = l.filter((a) => a.type === st.tf); if (st.q) { const q = st.q.toLowerCase(); l = l.filter((a) => (a.id + a.desc + a.serial).toLowerCase().includes(q)); } return l.length ? l.map((a) => `<label class="chk"><input type="checkbox" data-a="${a.id}" ${st.pick.has(a.id) ? 'checked' : ''}><span class="mono" style="min-width:118px">${a.id}</span><b>${esc(a.desc)}</b><span style="color:var(--muted);margin-left:auto;font-size:12px">${esc(a.serial)} ${pill(a.condition)}</span></label>`).join('') : '<div class="empty"><b>No spare assets</b>Receive goods or return assets first.</div>'; }
    function sysList() {
      const e = subject(); if (!e || (!e.name && st.emp === '__new')) return '<div class="empty">Select or enter an employee</div>';
      return db().systems.filter((s) => s.enabled === 'Yes').map((s) => { const ex = st.emp === '__new' ? null : activeAcc(e.no, s.id); return `<tr><td><input type="checkbox" data-s="${s.id}" ${ex ? 'disabled' : st.sys.has(s.id) ? 'checked' : ''}></td><td><b>${esc(s.name)}</b><br><small style="color:var(--muted)">${esc(s.kind)}</small></td><td>${pill(s.mode, s.mode === 'Webhook' ? 'blue' : 'violet')}</td><td class="mono">${esc(ex ? ex.accountId : genId(s, e))}</td><td>${ex ? pill('Already active', 'mint') : '<span style="color:var(--muted)">will be created</span>'}</td></tr>`; }).join('') || '<tr><td colspan="5"><div class="empty">No enabled systems — add them under Integrations</div></td></tr>';
    }
    function draw() {
      const emps = db().employees.filter((x) => x.status === 'Active' && !x.sys); const e = subject();
      if (st.sys === null && e) st.sys = new Set(st.emp === '__new' ? db().systems.filter((s) => s.enabled === 'Yes').map((s) => s.id) : missingSys(e.no).map((s) => s.id));
      const nw = st.nw; const fld = (k, label, type) => `<label class="f">${label}<input class="in" data-nw="${k}" type="${type || 'text'}" value="${esc(nw[k])}"></label>`; const sel = (k, label, list) => `<label class="f">${label}<select class="in" data-nw="${k}"><option value="">—</option>${opts(list, nw[k])}</select></label>`;
      box.innerHTML = `<header><span class="gem" style="width:44px;height:44px;background:#10d9a0">${ic('plus')}</span><div><h3>Employee onboarding</h3><small>Create employee → issue assets → register every system ID in one step</small></div><button class="ibtn x" data-x>${ic('x')}</button></header>
      <div class="body"><h3 style="font:650 14px var(--head);margin:0 0 8px">1 · Employee</h3><div class="fgrid c3"><label class="f">Employee *<select class="in" id="oe"><option value="">— select —</option><option value="__new" ${st.emp === '__new' ? 'selected' : ''}>➕ New joiner (create employee now)</option>${opts(emps.map((x) => ({ v: x.no, l: `${x.name} (${x.no}) · ${x.dept}` })), st.emp)}</select></label><label class="f">Start date<input class="in" type="date" id="od" value="${st.date}"></label></div>
      ${st.emp === '__new' ? `<div class="fgrid c3 mt">${fld('name', 'Full name *')}${sel('designation', 'Designation', M('designations')())}${sel('dept', 'Department *', M('departments')())}${sel('location', 'Location', M('locations')())}${sel('manager', 'Reporting manager', db().employees.map((x) => x.name))}${fld('doj', 'Date of joining', 'date')}${fld('email', 'Email (auto if blank)', 'email')}${fld('mobile', 'Mobile', 'tel')}</div>` : ''}
      <h3 style="font:650 14px var(--head);margin:18px 0 8px">2 · Assets to issue <span class="pill p-violet" id="oc">${st.pick.size} selected</span></h3><div class="tbar"><div class="qs"><input class="in" id="oq" value="${esc(st.q)}"></div><select class="in" id="of"><option value="">All types</option>${opts(L.uniq(spare().map((a) => a.type)).sort(), st.tf)}</select></div><div class="pick" id="alist" style="max-height:200px">${assetList()}</div>
      <h3 style="font:650 14px var(--head);margin:18px 0 8px">3 · System accounts — one click registers all</h3><table class="t"><thead><tr><th></th><th>System</th><th>Connector</th><th>Account ID</th><th>Status</th></tr></thead><tbody id="slist">${sysList()}</tbody></table></div>
      <footer><span class="note">A signature form (assets + system IDs) opens when finished.</span><button class="btn ghost" data-x>Cancel</button><button class="btn" id="ogo" style="background:#10d9a0">${ic('check')}Complete onboarding</button></footer>`;
    }
    draw();
    box.addEventListener('click', async (ev) => {
      if (ev.target.closest('[data-x]')) return UI.close(ov);
      const go = ev.target.closest('#ogo'); if (!go) return;
      try {
        if (!st.emp) throw new Error('Select an employee'); if (st.emp === '__new' && (!st.nw.name.trim() || !st.nw.dept)) throw new Error('Name and department are required');
        const ids = [...st.pick]; ids.forEach((id) => { if (L.hw(id).status !== 'In Stock') throw new Error(id + ' is no longer in stock'); });
        let empNo = st.emp;
        if (st.emp === '__new') { const data = Object.assign({ status: 'Active' }, st.nw); data.name = data.name.trim(); if (!data.email) { const p = nameParts(data.name); data.email = (p.length > 1 ? p[0] + '.' + p[p.length - 1] : p[0]) + '@' + domain(); } L.saveEmployee(data); empNo = data.no; }
        go.disabled = true; go.textContent = 'Registering…';
        const doc = ids.length ? L.issueAssets(empNo, ids, st.date, 'Onboarding') : ''; const res = await provision(empNo, [...(st.sys || [])]);
        const rec = addEvent('Onboarding', empNo, st.date, { assets: ids.map((id) => ({ id, doc })), accounts: res });
        UI.close(ov); UI.toast(`Onboarding ${rec.id} complete — ${ids.length} asset(s), ${res.filter((r) => r.ok).length} account(s)` + (summary(res) ? ' · ' + summary(res) : ''), res.some((x) => !x.ok) ? 'err' : undefined); setTimeout(() => forms.lifecycleDoc(rec.id), 150);
      } catch (err) { go.disabled = false; go.innerHTML = ic('check') + 'Complete onboarding'; UI.toast(err.message, 'err'); }
    });
    box.addEventListener('change', (ev) => {
      const i = ev.target;
      if (i.id === 'oe') { st.emp = i.value; st.sys = null; draw(); } else if (i.id === 'od') st.date = i.value; else if (i.id === 'of') { st.tf = i.value; box.querySelector('#alist').innerHTML = assetList(); }
      else if (i.dataset.a) { i.checked ? st.pick.add(i.dataset.a) : st.pick.delete(i.dataset.a); box.querySelector('#oc').textContent = st.pick.size + ' selected'; }
      else if (i.dataset.s) { i.checked ? st.sys.add(i.dataset.s) : st.sys.delete(i.dataset.s); }
      else if (i.dataset.nw) { st.nw[i.dataset.nw] = i.value; box.querySelector('#slist').innerHTML = sysList(); }
    });
    box.addEventListener('input', (ev) => { const i = ev.target; if (i.id === 'oq') { st.q = i.value; box.querySelector('#alist').innerHTML = assetList(); } else if (i.dataset.nw) { st.nw[i.dataset.nw] = i.value; if (['name', 'email'].includes(i.dataset.nw)) box.querySelector('#slist').innerHTML = sysList(); } });
  }

  /* ================= OFFBOARDING WIZARD ================= */
  const DISP = [{ v: 'stock', l: 'Return to spare stock' }, { v: 'repair', l: 'Send to repair' }, { v: 'dispose', l: 'Dispose / write-off' }, { v: 'reassign', l: 'Reassign to another employee' }];
  function offboard(pre) {
    const st = { emp: pre || '', date: L.today(), disp: {}, to: {}, cond: {}, acc: new Set(), rel: true };
    const ov = UI.modal('', { size: 'xl', sticky: true }); const box = ov.querySelector('.modal');
    const pick = () => { st.disp = {}; st.to = {}; st.cond = {}; st.acc = new Set(st.emp ? toDisable(st.emp).map((a) => a.id) : []); };
    if (st.emp) pick();
    function draw() {
      const cand = db().employees.filter((x) => (x.status !== 'Left' || heldBy(x.no).length || liveAccs(x.no).length) && !x.sys); const e = st.emp ? L.emp(st.emp) : null; const held = e ? heldBy(e.no) : []; const accs = e ? toDisable(e.no) : [];
      const targets = db().employees.filter((x) => x.status === 'Active' && !x.sys && x.no !== st.emp).map((x) => ({ v: x.no, l: `${x.name} (${x.no}) · ${x.dept}` }));
      box.innerHTML = `<header><span class="gem" style="width:44px;height:44px;background:#ff5c6c">${ic('undo')}</span><div><h3>Employee offboarding</h3><small>Collect assets (to spare or to a colleague) and disable every system ID in one step</small></div><button class="ibtn x" data-x>${ic('x')}</button></header>
      <div class="body"><div class="fgrid c3"><label class="f">Employee *<select class="in" id="fe"><option value="">— select —</option>${opts(cand.map((x) => ({ v: x.no, l: `${x.name} (${x.no}) · ${heldBy(x.no).length} asset(s), ${liveAccs(x.no).length} account(s)` })), st.emp)}</select></label><label class="f">Last working day<input class="in" type="date" id="fd" value="${st.date}"></label></div>
      ${e ? `<h3 style="font:650 14px var(--head);margin:18px 0 8px">1 · Assets held (${held.length}) — decide where each goes</h3>${held.length ? `<table class="t"><thead><tr><th>Asset</th><th>Description</th><th>Held since</th><th>Condition</th><th>Disposition</th><th>Reassign to</th></tr></thead><tbody>${held.map((a) => { const d = st.disp[a.id] || 'stock'; return `<tr><td class="mono"><a class="link" data-act="hw.view" data-id="${a.id}">${a.id}</a></td><td>${esc(a.desc)}<br><small class="mono" style="color:var(--muted)">${esc(a.serial)}</small></td><td>${fmt(a.issuedDate)}</td><td><select class="in" data-c="${a.id}">${opts(L.CONDITIONS, st.cond[a.id] || a.condition)}</select></td><td><select class="in" data-d="${a.id}">${opts(DISP, d)}</select></td><td>${d === 'reassign' ? `<select class="in" data-t="${a.id}"><option value="">— employee —</option>${opts(targets, st.to[a.id])}</select>` : '<span style="color:var(--muted)">–</span>'}</td></tr>`; }).join('')}</tbody></table>` : '<div class="empty">No assets held</div>'}
      <h3 style="font:650 14px var(--head);margin:18px 0 8px">2 · System accounts to disable (${accs.length})</h3>${accs.length ? `<table class="t"><thead><tr><th></th><th>System</th><th>Account ID</th><th>Created</th><th>Connector</th></tr></thead><tbody>${accs.map((a) => `<tr><td><input type="checkbox" data-ac="${a.id}" ${st.acc.has(a.id) ? 'checked' : ''}></td><td><b>${esc((sysOf(a.sysId) || {}).name)}</b></td><td class="mono">${esc(a.accountId)}</td><td>${fmt(a.created)}</td><td>${pill((sysOf(a.sysId) || {}).mode, 'violet')}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">No registered system accounts for this employee</div>'}
      <label class="chk" style="margin-top:12px"><input type="checkbox" id="frel" ${st.rel ? 'checked' : ''}><span>Release software licences installed for this user (installs on reassigned devices move to the new holder)</span></label>` : ''}</div>
      <footer><span class="note">Employee is marked <b>Left</b>; a clearance form opens for signature.</span><button class="btn ghost" data-x>Cancel</button><button class="btn hot" id="fgo">${ic('check')}Complete offboarding</button></footer>`;
    }
    draw();
    box.addEventListener('click', async (ev) => {
      if (ev.target.closest('[data-x]')) return UI.close(ov); if (ev.target.closest('[data-act="hw.view"]')) return;
      const go = ev.target.closest('#fgo'); if (!go) return;
      try {
        if (!st.emp) throw new Error('Select an employee'); const e = L.emp(st.emp); const held = heldBy(e.no); const groups = {}, re = {};
        held.forEach((a) => { const d = st.disp[a.id] || 'stock'; if (d === 'reassign') { if (!st.to[a.id]) throw new Error('Choose who receives ' + a.id); (re[st.to[a.id]] = re[st.to[a.id]] || []).push(a.id); } else { const status = { stock: 'In Stock', repair: 'Under Repair', dispose: 'Disposed' }[d]; const cond = st.cond[a.id] || a.condition; const k = status + '|' + cond; (groups[k] = groups[k] || { status, cond, ids: [] }).ids.push(a.id); } });
        go.disabled = true; go.textContent = 'Processing…'; const items = []; const newHolder = {};
        Object.values(groups).forEach((g) => { const doc = L.returnAssets(e.no, g.ids, st.date, g.cond, g.status, 'Offboarding', true); g.ids.forEach((id) => items.push({ id, doc, cond: g.cond, disp: { 'In Stock': 'Returned to spare stock', 'Under Repair': 'Sent to repair', Disposed: 'Disposed' }[g.status] })); });
        Object.keys(re).forEach((to) => { const doc = L.transferAssets(e.no, to, re[to], st.date, 'Offboarding reassignment'); re[to].forEach((id) => { newHolder[id] = to; items.push({ id, doc, cond: L.hw(id).condition, disp: 'Reassigned to ' + L.empName(to) }); }); });
        if (st.rel) db().installs = db().installs.filter((i) => { if (i.empNo !== e.no) return true; if (i.hwId && newHolder[i.hwId]) { i.empNo = newHolder[i.hwId]; return true; } return false; });
        e.status = 'Left'; e.dol = st.date; const res = await deprovision([...st.acc]);
        const rec = addEvent('Offboarding', e.no, st.date, { assets: items, accounts: res });
        UI.close(ov); UI.toast(`Offboarding ${rec.id} complete — ${items.length} asset(s), ${res.filter((r) => r.ok).length} account(s) disabled` + (summary(res) ? ' · ' + summary(res) : ''), res.some((x) => !x.ok) ? 'err' : undefined); setTimeout(() => forms.lifecycleDoc(rec.id), 150);
      } catch (err) { go.disabled = false; go.innerHTML = ic('check') + 'Complete offboarding'; UI.toast(err.message, 'err'); }
    });
    box.addEventListener('change', (ev) => {
      const i = ev.target, d = i.dataset;
      if (i.id === 'fe') { st.emp = i.value; pick(); draw(); } else if (i.id === 'fd') st.date = i.value; else if (i.id === 'frel') st.rel = i.checked;
      else if (d.d) { st.disp[d.d] = i.value; draw(); } else if (d.t) st.to[d.t] = i.value; else if (d.c) st.cond[d.c] = i.value; else if (d.ac) { i.checked ? st.acc.add(d.ac) : st.acc.delete(d.ac); }
    });
  }
  UI.on('lc.on', (el) => onboard(el.dataset.emp)); UI.on('lc.off', (el) => offboard(el.dataset.emp));
  UI.on('lc.doc', (el) => forms.lifecycleDoc(el.dataset.id));
  UI.on('lc.pf', (el) => { const v = document.getElementById('pfEmp').value; if (!v) return UI.toast('Select an employee first', 'err'); forms.assetForm(el.dataset.kind, v); });
  UI.on('acc.prov', async (el) => { const e = L.emp(el.dataset.emp); const m = missingSys(e.no); if (!m.length) return UI.toast('All enabled systems already have an active account'); const r = await provision(e.no, m.map((s) => s.id)); UI.toast(`${r.filter((x) => x.ok).length}/${r.length} account(s) created` + (summary(r) ? ' · ' + summary(r) : ''), r.some((x) => !x.ok) ? 'err' : undefined); });
  UI.on('acc.retry', async (el) => { const a = db().accounts.find((x) => x.id === el.dataset.id); const r = await provision(a.empNo, [a.sysId]); UI.toast(r[0].ok ? 'Account created' : r[0].msg, r[0].ok ? undefined : 'err'); });
  UI.on('acc.done', (el) => { const a = db().accounts.find((x) => x.id === el.dataset.id); const dis = a.status === 'Disable pending'; if (dis) { a.status = 'Disabled'; a.disabled = L.today(); } else a.status = 'Active'; a.msg = 'Confirmed by IT'; plog(a.empNo, a.sysId, 'Confirm', a.accountId, { ok: true, msg: a.msg }); L.log('Access', (dis ? 'Disable' : 'Create') + ' confirmed: ' + a.accountId, a.empNo); S.emit(); UI.toast('Marked as done'); });
  UI.on('acc.dis', async (el) => { if (!(await UI.confirm('Disable this system account?', 'Disable', true))) return; const r = await deprovision([el.dataset.id]); UI.toast(r[0].ok ? 'Account disabled' : r[0].msg, r[0].ok ? undefined : 'err'); });
  UI.on('acc.bulk', async () => { const emps = db().employees.filter((e) => e.status === 'Active' && !e.sys && missingSys(e.no).length); if (!emps.length) return UI.toast('Every active employee already has all accounts'); if (!(await UI.confirm(`Register <b>${emps.length}</b> active employee(s) on all enabled systems?`, 'Register all'))) return; let ok = 0, bad = 0; for (const e of emps) (await provision(e.no, missingSys(e.no).map((s) => s.id))).forEach((r) => (r.ok ? ok++ : bad++)); UI.toast(`${ok} account(s) created, ${bad} failed`, bad ? 'err' : undefined); });

  /* employee profile: lifecycle toolbar + system access */
  const origEmp = UI.acts['emp.view'];
  UI.on('emp.view', function (el, e) {
    origEmp(el, e); const b = lastBody(); if (!b) return; const emp = L.emp(el.dataset.id); const accs = db().accounts.filter((a) => a.empNo === emp.no);
    b.insertAdjacentHTML('afterbegin', `<div class="card" style="margin-bottom:14px"><h3 style="margin:0 0 8px;font:650 14px var(--head)">Lifecycle &amp; system access</h3><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><button class="btn sm" style="background:#10d9a0" data-act="lc.on" data-emp="${emp.no}">${ic('plus')}Onboard / assign assets &amp; IDs</button><button class="btn sm hot" data-act="lc.off" data-emp="${emp.no}">${ic('undo')}Offboard</button><button class="btn sm ghost" data-act="acc.prov" data-emp="${emp.no}">${ic('key')}Create missing system IDs</button></div>${accs.length ? `<table class="t"><thead><tr><th>System</th><th>Account ID</th><th>Status</th><th>Created</th><th>Disabled</th><th></th></tr></thead><tbody>${accs.map((a) => `<tr><td>${esc((sysOf(a.sysId) || {}).name)}</td><td class="mono">${esc(a.accountId)}</td><td>${pill(a.status, a.status === 'Active' ? 'mint' : a.status === 'Failed' ? 'coral' : a.status === 'Disabled' ? 'violet' : 'amber')}</td><td>${fmt(a.created)}</td><td>${fmt(a.disabled)}</td><td>${a.status === 'Failed' ? `<button class="btn xs ghost" data-act="acc.retry" data-id="${a.id}">Retry</button>` : /pending/i.test(a.status) ? `<button class="btn xs" data-act="acc.done" data-id="${a.id}">Mark done</button>` : a.status === 'Active' ? `<button class="btn xs ghost" data-act="acc.dis" data-id="${a.id}">Disable</button>` : ''}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">No system accounts registered yet</div>'}</div>`);
  });

  /* ================= PAGES ================= */
  const kpi = (n, label, c) => `<div class="card" style="border-left:4px solid ${c}"><div style="font:700 28px var(--head)">${n}</div><small style="color:var(--muted)">${label}</small></div>`;
  pages.lifecycle = {
    title: 'Onboarding & Offboarding', crumb: 'One workflow: employee → assets → AD · biometric · ERP IDs → signed forms', icon: 'swap', color: '#00a8e8', group: 'Workflow',
    render() {
      const d = db(); const tab = UI.curTab('lifecycle', 'emp'); const pend = pendingOff(); const act = (d.employees || []).filter((e) => e.status === 'Active' && !e.sys); const noAcc = act.filter((e) => missingSys(e.no).length);
      const top = `<div class="grid g3">${kpi(act.length, 'Active employees', '#2f6bff')}${kpi(pend.length, 'Left / inactive still holding assets or IDs', pend.length ? '#ff5c6c' : '#10d9a0')}${kpi(noAcc.length, 'Active employees missing a system ID', noAcc.length ? '#ffb020' : '#10d9a0')}</div>
      <div class="grid g2 mt"><div class="card"><h3><span class="pip" style="--c:#10d9a0"></span>Start a workflow</h3><div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" style="background:#10d9a0" data-act="lc.on">${ic('plus')}Onboard employee</button><button class="btn hot" data-act="lc.off">${ic('undo')}Offboard employee</button></div></div>
      <div class="card"><h3><span class="pip" style="--c:#00c2ff"></span>Print signature forms</h3><div class="tbar"><select class="in" id="pfEmp"><option value="">— select employee —</option>${opts(d.employees.map((e) => ({ v: e.no, l: `${e.name} (${e.no})` })))}</select><button class="btn sm" data-act="lc.pf" data-kind="Issue">${ic('print')}Issuance form</button><button class="btn sm ghost" data-act="lc.pf" data-kind="Return">${ic('print')}Return form</button></div></div></div>`;
      const hrq = (((db().sdp || {}).hr) || { onb: [], offb: [] });
      const hrpend = hrq.onb.filter((x) => x.status !== 'Completed').map((x) => ({ kind: 'onb', id: x.id, empNo: x.empNo, date: x.date, status: x.status })).concat(hrq.offb.filter((x) => x.status !== 'Completed').map((x) => ({ kind: 'offb', id: x.id, empNo: x.empNo, date: x.date, status: x.status })));
      const hrCard = hrpend.length ? `<div class="card mt" style="border-left:4px solid #00a8e8"><h3><span class="pip" style="--c:#00a8e8"></span>HR requests awaiting IT</h3><table class="t"><thead><tr><th>Request</th><th>Type</th><th>Employee</th><th>Start / last day</th><th>Status</th><th></th></tr></thead><tbody>${hrpend.map((x) => `<tr><td class="mono">${x.id}</td><td>${x.kind === 'onb' ? 'Onboarding' : 'Offboarding'}</td><td><b>${esc(L.empName(x.empNo))}</b></td><td>${fmt(x.date)}</td><td>${pill(x.status)}</td><td><button class="btn xs" data-act="hr.accept" data-id="${x.kind}:${x.id}">Accept & complete</button></td></tr>`).join('')}</tbody></table></div>` : '';
      const alert = pend.length ? `<div class="card mt" style="border-left:4px solid #ff5c6c"><h3><span class="pip" style="--c:#ff5c6c"></span>Offboarding pending</h3><table class="t"><thead><tr><th>Employee</th><th>Status</th><th>Assets</th><th>Active IDs</th><th></th></tr></thead><tbody>${pend.map((e) => `<tr><td><b>${esc(e.name)}</b> <small class="mono">${e.no}</small></td><td>${pill(e.status)}</td><td>${heldBy(e.no).length}</td><td>${liveAccs(e.no).length}</td><td><button class="btn xs hot" data-act="lc.off" data-emp="${e.no}">Offboard now</button></td></tr>`).join('')}</tbody></table></div>` : '';
      const tabs = UI.tabs('lifecycle', [{ id: 'emp', label: 'Employees & access', count: d.employees.length }, { id: 'rec', label: 'Onboarding / offboarding records', count: d.lifecycle.length }]);
      const body = tab === 'rec' ? UI.table({ id: 'lcrec', rows: () => d.lifecycle, sort: 'at', dir: -1, text: (r) => [r.id, r.type, L.empName(r.empNo)].join(' '), filters: [{ k: 'type', label: 'Type', options: ['Onboarding', 'Offboarding'] }], cols: [{ k: 'id', label: 'Record', mono: true }, { k: 'type', label: 'Type', render: (r) => pill(r.type, r.type === 'Onboarding' ? 'mint' : 'coral') }, { k: 'date', label: 'Date', render: (r) => fmt(r.date) }, { k: 'emp', label: 'Employee', val: (r) => L.empName(r.empNo), render: (r) => `<a class="link" data-act="emp.view" data-id="${r.empNo}">${esc(L.empName(r.empNo))}</a>` }, { k: 'a', label: 'Assets', num: true, val: (r) => r.assets.length }, { k: 'c', label: 'System IDs', num: true, val: (r) => r.accounts.filter((x) => x.ok).length }], actions: (r) => `<button class="ibtn" title="Print form" data-act="lc.doc" data-id="${r.id}">${ic('print')}</button>` })
        : UI.table({ id: 'lcemp', rows: () => (d.employees || []).filter((e) => !e.sys), sort: 'no', text: (r) => [r.no, r.name, r.dept].join(' '), filters: [{ k: 'status', label: 'Status', options: ['Active', 'Inactive', 'Left'] }, { k: 'dept', label: 'Department', options: () => d.lists.departments }], cols: [{ k: 'no', label: 'Emp No', mono: true }, { k: 'name', label: 'Name', render: (r) => `<a class="link" data-act="emp.view" data-id="${r.no}"><b>${esc(r.name)}</b></a>` }, { k: 'dept', label: 'Department' }, { k: 'status', label: 'Status', render: (r) => pill(r.status) }, { k: 'as', label: 'Assets', num: true, val: (r) => heldBy(r.no).length }, { k: 'ac', label: 'Active IDs', num: true, val: (r) => liveAccs(r.no).length, render: (r) => { const n = liveAccs(r.no).length, t = d.systems.filter((s) => s.enabled === 'Yes').length; return `<span class="pill p-${n >= t ? 'mint' : n ? 'amber' : 'coral'}">${n}/${t}</span>`; } }], actions: (r) => `<button class="ibtn" style="--c:#10d9a0" title="Onboard / assign assets & IDs" data-act="lc.on" data-emp="${r.no}">${ic('plus')}</button><button class="ibtn" style="--c:#ff5c6c" title="Offboard" data-act="lc.off" data-emp="${r.no}">${ic('undo')}</button>` });
      return `${top}${hrCard}${alert}<div class="card mt">${tabs}${body}</div>`;
    },
  };

  const METHODS = [
    ['Webhook', 'Sends one JSON POST to a middleware (Power Automate, n8n, Logic Apps, Azure Function, a small script server) that does the real work.', 'On-prem Active Directory / LDAP, biometric servers, ERPs on your LAN, anything not exposed to the internet', 'A middleware URL that allows CORS'],
    ['REST API', 'Calls the system’s own API directly using your URL, headers and body templates.', 'Entra ID (Graph), Google Workspace, Okta, cloud ERPs, biometric cloud/servers with an API', 'API token, HTTPS and CORS allowed from this site'],
    ['SCIM 2.0', 'Standard user-provisioning API: creates the user, stores the returned id, deactivates on exit.', 'Okta, OneLogin, JumpCloud, SAP IAS, Slack, Zoom, Atlassian, Entra app provisioning', 'SCIM base URL + token'],
    ['File / script export', 'Builds a PowerShell script, CSV or text file from your templates for IT to run or import, then Mark done.', 'On-prem AD (New-ADUser), ZKTeco / Hikvision / eSSL / Suprema CSV import, ERP bulk upload', 'Nothing — works offline'],
    ['Email request', 'Same as export, but also opens an email to the system admin with all pending lines.', 'Vendor-managed systems, ERP admins, service desks (ServiceNow / Jira / Freshservice mailbox)', 'Mail client'],
    ['Manual task', 'Tracked as pending until someone clicks Mark done.', 'Anything without an API or file import', 'Nothing'],
    ['Simulation', 'Only records IDs inside this tool.', 'Training and dry runs', 'Nothing'],
  ];
  const guide = () => `<details class="card" style="margin-bottom:12px"><summary style="cursor:pointer;font:650 14px var(--head)">Connection method guide — what is practically possible from a browser app</summary><div style="overflow:auto;margin-top:10px"><table class="t"><thead><tr><th>Method</th><th>How it works</th><th>Typical systems</th><th>Needs</th></tr></thead><tbody>${METHODS.map((m) => `<tr><td><b>${m[0]}</b></td><td>${m[1]}</td><td>${m[2]}</td><td>${m[3]}</td></tr>`).join('')}</tbody></table></div><small style="color:var(--muted);display:block;margin-top:8px">Browsers cannot reach LDAP, AD, or a LAN device directly, and many vendor APIs block cross-site calls — that is why Webhook and Export exist. Hybrid tip: if Entra Connect syncs your AD to Entra ID, create the user in AD only. Without a connector, any <b>REST / SCIM</b> request that is blocked shows as <b>Failed</b> and can be retried.</small></details>`;

  pages.integrations = {
    title: 'Integrations', crumb: 'Active Directory · biometric devices · ERP — IDs created and disabled from one place', icon: 'link', color: '#00c2ff', group: 'Workflow',
    render() {
      const d = db(); const tab = UI.curTab('integrations', 'sys');
      const tabs = UI.tabs('integrations', [{ id: 'sys', label: 'Systems', count: d.systems.length }, { id: 'acc', label: 'Accounts', count: d.accounts.length }, { id: 'log', label: 'Activity log', count: d.provLog.length }]); let body;
      if (tab === 'sys') body = `${UI.table({ id: 'sys', rows: () => d.systems, sort: 'id', text: (r) => [r.name, r.kind].join(' '), cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'name', label: 'System', render: (r) => `<b>${esc(r.name)}</b>` }, { k: 'kind', label: 'Type' }, { k: 'idRule', label: 'ID format', render: (r) => esc((ID_RULES.find((x) => x.v === r.idRule) || {}).l || r.idRule) }, { k: 'tpl', label: 'Connector', val: (r) => (CONN().get(r.tpl) || {}).name, render: (r) => esc((CONN().get(r.tpl) || {}).name || r.tpl) }, { k: 'mode', label: 'Method', render: (r) => pill(r.mode, ['Webhook', 'REST API', 'SCIM 2.0'].includes(r.mode) ? 'blue' : OFFLINE.includes(r.mode) ? 'amber' : 'violet') }, { k: 'url', label: 'Endpoint', val: (r) => epOf(r), render: (r) => `<small class="mono">${esc(epOf(r))}</small>` }, { k: 'enabled', label: 'In one-click', render: (r) => pill(r.enabled, r.enabled === 'Yes' ? 'mint' : 'amber') }, { k: 'n', label: 'Active IDs', num: true, val: (r) => d.accounts.filter((a) => a.sysId === r.id && a.status === 'Active').length }, { k: 'pn', label: 'Pending', num: true, val: (r) => pendingOf(r.id).length }], actions: (r) => `${(CONN().get(r.tpl) || {}).test ? `<button class="ibtn" style="--c:#10d9a0" title="Test connection" data-act="sys.test" data-id="${r.id}">${ic('refresh')}</button>` : ''}${['File / script export', 'Email request'].includes(r.mode) ? `<button class="ibtn" style="--c:#00c2ff" title="Export pending requests" data-act="sys.export" data-id="${r.id}">${ic('download')}</button>` : ''}<button class="ibtn" data-act="sys.edit" data-id="${r.id}">${ic('edit')}</button>${(typeof ITMS!=='undefined'&&ITMS.canDelete&&ITMS.canDelete())?'<button class="ibtn" style="--c:#ff5c6c" data-act="sys.del" data-id="'+r.id+'" title="Delete (Admin only)">'+ic('trash')+'</button>':''}`, toolbar: `<button class="btn" data-act="sys.new">${ic('plus')}Add system</button><button class="btn ghost" data-act="acc.bulk">${ic('key')}Register all active employees</button>` })}`;
      else if (tab === 'acc') body = UI.table({ id: 'acc', rows: () => d.accounts, sort: 'id', dir: -1, text: (r) => [r.accountId, L.empName(r.empNo), (sysOf(r.sysId) || {}).name].join(' '), filters: [{ k: 'status', label: 'Status', options: ['Active', 'Pending', 'Disable pending', 'Failed', 'Disabled'] }, { k: 'sysId', label: 'System', options: () => d.systems.map((s) => ({ v: s.id, l: s.name })) }], cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'emp', label: 'Employee', val: (r) => L.empName(r.empNo), render: (r) => `<a class="link" data-act="emp.view" data-id="${r.empNo}">${esc(L.empName(r.empNo))}</a>` }, { k: 'sys', label: 'System', val: (r) => (sysOf(r.sysId) || {}).name }, { k: 'accountId', label: 'Account ID', mono: true }, { k: 'status', label: 'Status', render: (r) => pill(r.status, r.status === 'Active' ? 'mint' : r.status === 'Failed' ? 'coral' : r.status === 'Disabled' ? 'violet' : 'amber') }, { k: 'created', label: 'Created', render: (r) => fmt(r.created) }, { k: 'disabled', label: 'Disabled', render: (r) => fmt(r.disabled) }, { k: 'msg', label: 'Result' }], actions: (r) => (r.status === 'Failed' ? `<button class="btn xs ghost" data-act="acc.retry" data-id="${r.id}">Retry</button>` : /pending/i.test(r.status) ? `<button class="btn xs" data-act="acc.done" data-id="${r.id}">Mark done</button>` : r.status === 'Active' ? `<button class="btn xs ghost" data-act="acc.dis" data-id="${r.id}">Disable</button>` : '') });
      else body = UI.table({ id: 'plog', rows: () => d.provLog.map((x, i) => Object.assign({ n: i }, x)), sort: 'n', text: (r) => [r.accountId, L.empName(r.empNo), r.action].join(' '), cols: [{ k: 'at', label: 'When', render: (r) => esc(r.at.replace('T', ' ').slice(0, 16)) }, { k: 'emp', label: 'Employee', val: (r) => L.empName(r.empNo) }, { k: 'sys', label: 'System', val: (r) => (sysOf(r.sysId) || {}).name }, { k: 'action', label: 'Action' }, { k: 'accountId', label: 'Account ID', mono: true }, { k: 'ok', label: 'Result', val: (r) => (r.ok ? 'OK' : 'Failed'), render: (r) => pill(r.ok ? 'OK' : 'Failed', r.ok ? 'mint' : 'coral') }, { k: 'msg', label: 'Detail' }] });
      return `<div class="card">${tabs}${body}</div>`;
    },
  };
  const pendingOf = (sid) => db().accounts.filter((a) => a.sysId === sid && /pending/i.test(a.status));
  const epOf = (r) => { const d = CONN().get(r.tpl); return d && d.endpoint ? d.endpoint(r.cfg || {}) || '' : ''; };
  const connForm = (def) => [{ section: 'System' }, { k: 'name', label: 'System name', req: true }, { k: 'kind', label: 'Type', type: 'select', options: M('systemKinds'), blank: false }, { k: 'idRule', label: 'Account ID format', type: 'select', options: ID_RULES, blank: false }, { k: 'enabled', label: 'Include in one-click registration', type: 'select', options: ['Yes', 'No'], blank: false }]
    .concat(def.fields.length ? [{ section: def.name + ' — connection settings' }].concat(def.fields) : []).concat([{ section: 'Notes' }, { k: 'notes', label: 'Notes', type: 'textarea', full: true }]);
  function openConn(def, sys) {
    const vals = sys ? Object.assign({ name: sys.name, kind: sys.kind, idRule: sys.idRule, enabled: sys.enabled, notes: sys.notes }, def.defaults, sys.cfg) : Object.assign({ name: def.name, kind: def.kind, idRule: def.idRule, enabled: 'Yes' }, def.defaults);
    UI.form({ title: (sys ? 'Edit ' + sys.name : 'Add ' + def.name), sub: def.desc, icon: 'link', fields: connForm(def), values: vals, onSubmit: (v) => {
      const cfg = {}; def.fields.forEach((f) => { cfg[f.k] = v[f.k] == null ? '' : v[f.k]; }); const d = db();
      const base = { name: v.name, kind: v.kind, idRule: v.idRule, enabled: v.enabled, notes: v.notes || '', tpl: def.id, mode: def.mode, cfg }; if (v.kind && !d.lists.systemKinds.includes(v.kind)) d.lists.systemKinds.push(v.kind);
      if (sys) Object.assign(sys, base); else { base.id = 'SYS-' + L.pad(d.systems.reduce((m, x) => Math.max(m, parseInt(x.id.split('-')[1], 10)), 0) + 1, 2); d.systems.push(base); }
      S.emit(); UI.toast(sys ? 'System updated' : 'System added');
    } });
  }
  UI.on('sys.new', () => {
    const ov = UI.modal('', { size: 'xl' }); const box = ov.querySelector('.modal'); const C = CONN();
    box.innerHTML = `<header><span class="gem" style="width:44px;height:44px;background:#00c2ff">${ic('link')}</span><div><h3>Add integration</h3><small>Choose the system type — each one asks only for the settings it really needs</small></div><button class="ibtn x" data-x>${ic('x')}</button></header><div class="body">${C.groups.map((g) => `<h4 style="margin:14px 0 8px">${g}</h4><div class="grid g3">${C.list.filter((x) => x.group === g).map((x) => `<div class="card" style="cursor:pointer" data-conn="${x.id}"><div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:6px"><b>${esc(x.name)}</b>${pill(x.tag, 'violet')}</div><small style="color:var(--muted)">${esc(x.desc)}</small></div>`).join('')}</div>`).join('')}</div>`;
    box.addEventListener('click', (ev) => { if (ev.target.closest('[data-x]')) return UI.close(ov); const c = ev.target.closest('[data-conn]'); if (!c) return; UI.close(ov); setTimeout(() => openConn(C.get(c.dataset.conn)), 60); });
  });
  UI.on('sys.edit', (el) => { const s = sysOf(el.dataset.id); openConn(CONN().get(s.tpl) || CONN().get('custom'), s); });
  UI.on('sys.test', async (el) => {
    const sys = sysOf(el.dataset.id); const st = CONN().get(sys.tpl).test(sys.cfg || {});
    try { const r = await http(st.url, 'GET', Object.assign({ Accept: 'application/json' }, st.headers || {})); UI.toast(`${sys.name}: ${r.ok ? 'connection OK' : 'failed'} (${r.msg})`, r.ok ? undefined : 'err'); } catch (err) { UI.toast(`${sys.name}: network/CORS error — ${err.message}`, 'err'); }
  });
  const dl = (name, text) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); };
  UI.on('sys.export', async (el) => {
    const sys = sysOf(el.dataset.id); const def = CONN().get(sys.tpl); const list = pendingOf(sys.id); if (!list.length) return UI.toast('No pending requests for ' + sys.name); const c = sys.cfg || {};
    const lines = list.map((a) => { const create = a.status === 'Pending'; const v = vars(L.emp(a.empNo), a.accountId, a.remoteId, create ? rndPw() : ''); v.system = sys.name; return def.line(c, create ? 'create' : 'disable', v); }).filter(Boolean);
    const text = (def.header ? def.header(c) + '\n' : '') + lines.join('\n') + '\n'; const fname = def.file(c); dl(fname, text);
    if (def.type === 'email' && c.to) location.href = 'mailto:' + c.to + '?' + (c.cc ? 'cc=' + encodeURIComponent(c.cc) + '&' : '') + 'subject=' + encodeURIComponent((c.prefix || '[ITMS]') + ' ' + sys.name + ' — ' + list.length + ' request(s)') + '&body=' + encodeURIComponent(text.slice(0, 1500) + (text.length > 1500 ? '\n…(full list in the downloaded file)' : ''));
    if (await UI.confirm(`<b>${list.length}</b> request(s) exported to <span class="mono">${esc(fname)}</span>. Mark them as done now? (You can also do it later per account.)`, 'Mark all done')) list.forEach((a) => UI.acts['acc.done']({ dataset: { id: a.id } }));
  });
  UI.on('sys.del', async (el) => { if (!ITMS.canDelete()) return UI.toast('Only Administrator can delete records', 'err'); const s = sysOf(el.dataset.id); if (db().accounts.some((a) => a.sysId === s.id && a.status !== 'Disabled')) return UI.toast('Disable its active accounts first', 'err'); if (await UI.confirm(`Delete <b>${esc(s.name)}</b>?`, 'Delete', true)) { db().systems = db().systems.filter((x) => x.id !== s.id); S.emit(); } });

  pages.masters = {
    title: 'Masters', crumb: 'Single source for every dropdown — edit here and all forms follow', icon: 'tag', color: '#5b8def', group: 'Masters',
    render() {
      const d = db(); const tab = UI.curTab('masters', 'lists');
      const card = (m) => { const vals = d.lists[m.key] || []; return `<div class="card"><h3><span class="pip" style="--c:#ffb020"></span>${m.title}<button class="btn xs" style="margin-left:auto" data-act="ms.edit" data-key="${m.key}">${ic('edit')}Edit</button></h3><small style="color:var(--muted)">Feeds: ${m.note}</small><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">${vals.map((v) => `<span class="pill p-blue">${esc(v)} <small>${m.used(v)}</small></span>`).join('') || '<span style="color:var(--muted)">Empty</span>'}</div></div>`; };
      const listMasters = `<div class="grid g2">${MASTERS.map(card).join('')}</div>`;
      const uomMaster = `<div class="card"><h3><span class="pip" style="--c:#10d9a0"></span>Unit of Measurement (UOM)<button class="btn xs" style="margin-left:auto" data-act="ms.uom">${ic('edit')}Edit</button></h3><small style="color:var(--muted)">Feeds: Consumables → UOM · Purchase Orders → Unit</small><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">${(d.lists.uom || []).map((u) => `<span class="pill p-mint">${esc(u.name || u)} <small>${esc(u.code || '')}</small></span>`).join('') || '<span style="color:var(--muted)">Empty</span>'}</div></div>`;
      const vendorMaster = `<div class="card"><h3><span class="pip" style="--c:#2f6bff"></span>Vendors<button class="btn xs" style="margin-left:auto" data-go="#/vendors">${ic('edit')}Manage</button></h3><small style="color:var(--muted)">Feeds: PR/PO vendor dropdown · AMC vendor · Payment terms</small><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">${d.vendors.map((v) => `<span class="pill p-blue">${esc(v.name)} <small>${esc(v.currency || '')} · ${esc((d.terms.find((t) => t.id === v.termsId) || {}).name || '')}</small></span>`).join('') || '<span style="color:var(--muted)">No vendors</span>'}</div></div>`;
      const assetTypes = `<div class="card"><h3><span class="pip" style="--c:#1d4ed8"></span>Hardware Asset Types<button class="btn xs" style="margin-left:auto" data-act="ms.hwtypes">${ic('edit')}Edit</button></h3><small style="color:var(--muted)">Feeds: Hardware asset type · Subtype · Retention · Prefix</small><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">${(d.lists.hwTypes || []).map((t) => `<span class="pill p-violet">${esc(t.type)} <small>${esc((t.subtypes || []).join(', '))} · ${t.retention}y · ${t.prefix}</small></span>`).join('') || '<span style="color:var(--muted)">Empty</span>'}</div></div>`;
      const swTypes = `<div class="card"><h3><span class="pip" style="--c:#00a8e8"></span>Software Types<button class="btn xs" style="margin-left:auto" data-act="ms.swtypes">${ic('edit')}Edit</button></h3><small style="color:color:var(--muted)">Feeds: Software asset type · Subtype · Prefix</small><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">${(d.lists.swTypes || []).map((t) => `<span class="pill p-cyan">${esc(t.type)} <small>${esc((t.subtypes || []).join(', '))} · ${t.prefix}</small></span>`).join('') || '<span style="color:var(--muted)">Empty</span>'}</div></div>`;
      const consTypes = `<div class="card"><h3><span class="pip" style="--c:#00c2ff"></span>Consumable Types<button class="btn xs" style="margin-left:auto" data-act="ms.constypes">${ic('edit')}Edit</button></h3><small style="color:var(--muted)">Feeds: Consumable type · Subtype</small><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">${(d.lists.consTypes || []).map((t) => `<span class="pill p-mint">${esc(t.type)} <small>${esc((t.subtypes || []).join(', '))}</small></span>`).join('') || '<span style="color:var(--muted)">Empty</span>'}</div></div>`;
      const glMaster = `<div class="card"><h3><span class="pip" style="--c:#ff5c6c"></span>Chart of Accounts (GL)<button class="btn xs" style="margin-left:auto" data-go="#/finance">${ic('edit')}Manage</button></h3><small style="color:var(--muted)">Feeds: Journal vouchers · Budget · Invoices · Payments</small><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">${((d.sdp || {}).fin || {}).coa ? ((d.sdp || {}).fin || {}).coa.map((g) => `<span class="pill p-${g.type === 'Asset' ? 'blue' : g.type === 'Liability' ? 'amber' : g.type === 'Equity' ? 'violet' : g.type === 'Income' ? 'mint' : 'coral'}">${esc(g.code)} ${esc(g.name)}</span>`).join('') : '<span style="color:var(--muted)">No COA — load test data</span>'}</div></div>`;
      const paymentTerms = `<div class="card"><h3><span class="pip" style="--c:#ffb020"></span>Payment Terms<button class="btn xs" style="margin-left:auto" data-act="pt.edit">${ic('edit')}Edit</button></h3><small style="color:color:var(--muted)">Feeds: Vendor payment terms · PO terms</small><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">${(d.terms || []).map((t) => `<span class="pill p-amber">${esc(t.id)} <small>${esc(t.name || '')}</small></span>`).join('') || '<span style="color:color:var(--muted)">Empty</span>'}</div></div>`;
      return `<div class="card">${UI.tabs('masters', [{ id: 'lists', label: 'List Masters' }, { id: 'uom', label: 'UOM' }, { id: 'vendor', label: 'Vendors' }, { id: 'asset', label: 'Asset Types' }, { id: 'gl', label: 'GL Accounts' }, { id: 'terms', label: 'Payment Terms' }])}<div id="masters-body">${tab === 'lists' ? listMasters : tab === 'uom' ? uomMaster : tab === 'vendor' ? vendorMaster : tab === 'asset' ? assetTypes + swTypes + consTypes : tab === 'gl' ? glMaster : paymentTerms}</div></div>`;
    },
    after() {
      const t = document.getElementById('masters-body');
      if (t) t.addEventListener('click', (e) => { const go = e.target.closest('[data-go]'); if (go) location.hash = go.dataset.go; });
    },
  };
  UI.on('ms.edit', (el) => {
    const m = MASTERS.find((x) => x.key === el.dataset.key);
    if (!m) return;
    UI.form({ title: m.title, sub: 'One value per line', icon: 'tag', fields: [{ k: 't', label: 'Values', type: 'textarea', full: true }], values: { t: (db().lists[m.key] || []).join('\n') }, onSubmit: (v) => {
      const nu = L.uniq(v.t.split('\n').map((x) => x.trim()).filter(Boolean)).sort(); const gone = (db().lists[m.key] || []).filter((x) => !nu.includes(x)); const busy = gone.filter((x) => m.used(x));
      if (busy.length) throw new Error(`In use, cannot remove: ${busy.map((x) => `${x} (${m.used(x)})`).join(', ')}`);
      db().lists[m.key] = nu; S.emit(); UI.toast(m.title + ' updated');
    } });
  });
  UI.on('ms.uom', () => {
    UI.form({ title: 'Unit of Measurement', sub: 'One per line: Code — Name', icon: 'tag', fields: [{ k: 't', label: 'UOM values', type: 'textarea', full: true }], values: { t: (db().lists.uom || []).map((u) => `${u.code} — ${u.name}`).join('\n') }, onSubmit: (v) => {
      const nu = v.t.split('\n').map((x) => x.trim()).filter(Boolean).map((x) => { const [code, name] = x.split('—').map((s) => s.trim()); return { code, name: name || code }; });
      db().lists.uom = nu; S.emit(); UI.toast('UOM updated');
    } });
  });
  UI.on('ms.hwtypes', () => {
    UI.form({ title: 'Hardware Asset Types', sub: 'One per line: Type | Prefix | Retention (years) | Subtype1, Subtype2', icon: 'tag', fields: [{ k: 't', label: 'Asset types', type: 'textarea', full: true }], values: { t: (db().lists.hwTypes || []).map((t) => `${t.type} | ${t.prefix} | ${t.retention} | ${(t.subtypes || []).join(', ')}`).join('\n') }, onSubmit: (v) => {
      const nu = v.t.split('\n').map((x) => x.trim()).filter(Boolean).map((x) => { const [type, prefix, retention, subs] = x.split('|').map((s) => s.trim()); return { type, prefix: prefix || 'IT-HW-OTH', retention: +retention || 5, subtypes: subs ? subs.split(',').map((s) => s.trim()).filter(Boolean) : [] }; });
      db().lists.hwTypes = nu; S.emit(); UI.toast('Hardware types updated');
    } });
  });
  UI.on('ms.swtypes', () => {
    UI.form({ title: 'Software Types', sub: 'One per line: Type | Prefix | Subtype1, Subtype2', icon: 'tag', fields: [{ k: 't', label: 'Software types', type: 'textarea', full: true }], values: { t: (db().lists.swTypes || []).map((t) => `${t.type} | ${t.prefix} | ${(t.subtypes || []).join(', ')}`).join('\n') }, onSubmit: (v) => {
      const nu = v.t.split('\n').map((x) => x.trim()).filter(Boolean).map((x) => { const [type, prefix, subs] = x.split('|').map((s) => s.trim()); return { type, prefix: prefix || 'IT-SW-APP', subtypes: subs ? subs.split(',').map((s) => s.trim()).filter(Boolean) : [] }; });
      db().lists.swTypes = nu; S.emit(); UI.toast('Software types updated');
    } });
  });
  UI.on('ms.constypes', () => {
    UI.form({ title: 'Consumable Types', sub: 'One per line: Type | Subtype1, Subtype2', icon: 'tag', fields: [{ k: 't', label: 'Consumable types', type: 'textarea', full: true }], values: { t: (db().lists.consTypes || []).map((t) => `${t.type} | ${(t.subtypes || []).join(', ')}`).join('\n') }, onSubmit: (v) => {
      const nu = v.t.split('\n').map((x) => x.trim()).filter(Boolean).map((x) => { const [type, subs] = x.split('|').map((s) => s.trim()); return { type, subtypes: subs ? subs.split(',').map((s) => s.trim()).filter(Boolean) : [] }; });
      db().lists.consTypes = nu; S.emit(); UI.toast('Consumable types updated');
    } });
  });
  /* ---- End-user quick-add for masters: append-only. Deleting master data is Administrator-only. ---- */
  function masterList(key) { const d = db(); d.lists = d.lists || {}; if (!d.lists[key]) d.lists[key] = []; return d.lists[key]; }
  const noDup = (arr, val, label) => { if (arr.some((x) => String(x).toLowerCase() === String(val).toLowerCase())) throw new Error(`${label} "${val}" already exists`); };
  UI.on('ms.add', (el) => {
    const m = MASTERS.find((x) => x.key === el.dataset.key); if (!m) return;
    UI.form({ title: `Add — ${m.title}`, sub: 'Available to all users · only an Administrator can remove entries', icon: 'plus',
      fields: [{ k: 'v', label: m.title, req: true }],
      onSubmit: (v) => { const val = String(v.v).trim(); if (!val) throw new Error('Enter a value'); const arr = masterList(m.key); noDup(arr, val, m.title); arr.push(val); arr.sort((a, b) => String(a).localeCompare(String(b))); S.emit(); UI.toast(`${m.title}: "${val}" added`); } });
  });
  UI.on('ms.adduom', () => {
    UI.form({ title: 'Add — Unit of Measurement', icon: 'plus', fields: [{ k: 'code', label: 'Code (e.g. PCS)', req: true }, { k: 'name', label: 'Name (e.g. Pieces)', req: true }],
      onSubmit: (v) => { const arr = masterList('uom'); const code = String(v.code).trim(), name = String(v.name).trim(); noDup(arr.map((u) => u.code), code, 'UOM'); arr.push({ code, name }); S.emit(); UI.toast(`UOM ${code} added`); } });
  });
  UI.on('ms.addhwtype', () => {
    UI.form({ title: 'Add — Hardware asset type', icon: 'plus', values: { prefix: 'IT-HW-', retention: 5 }, fields: [{ k: 'type', label: 'Type', req: true }, { k: 'prefix', label: 'ID prefix', req: true }, { k: 'retention', label: 'Retention (years)', type: 'number' }, { k: 'subs', label: 'Subtypes (comma separated)' }],
      onSubmit: (v) => { const arr = masterList('hwTypes'); const type = String(v.type).trim(); noDup(arr.map((t) => t.type), type, 'Type'); arr.push({ type, prefix: String(v.prefix).trim() || 'IT-HW-OTH', retention: +v.retention || 5, subtypes: String(v.subs || '').split(',').map((s) => s.trim()).filter(Boolean) }); S.emit(); UI.toast(`Asset type ${type} added`); } });
  });
  UI.on('ms.addswtype', () => {
    UI.form({ title: 'Add — Software type', icon: 'plus', values: { prefix: 'IT-SW-' }, fields: [{ k: 'type', label: 'Type', req: true }, { k: 'prefix', label: 'ID prefix', req: true }, { k: 'subs', label: 'Subtypes (comma separated)' }],
      onSubmit: (v) => { const arr = masterList('swTypes'); const type = String(v.type).trim(); noDup(arr.map((t) => t.type), type, 'Type'); arr.push({ type, prefix: String(v.prefix).trim() || 'IT-SW-APP', subtypes: String(v.subs || '').split(',').map((s) => s.trim()).filter(Boolean) }); S.emit(); UI.toast(`Software type ${type} added`); } });
  });
  UI.on('ms.addconstype', () => {
    UI.form({ title: 'Add — Consumable type', icon: 'plus', fields: [{ k: 'type', label: 'Type', req: true }, { k: 'subs', label: 'Subtypes (comma separated)' }],
      onSubmit: (v) => { const arr = masterList('consTypes'); const type = String(v.type).trim(); noDup(arr.map((t) => t.type), type, 'Type'); arr.push({ type, subtypes: String(v.subs || '').split(',').map((s) => s.trim()).filter(Boolean) }); S.emit(); UI.toast(`Consumable type ${type} added`); } });
  });
  /* Master picker: opens an add form for any master (list or structured) relevant to the module */
  UI.on('ms.pick', (el) => {
    const entries = [
      ...MASTERS.map((m) => ({ v: m.key, l: m.title })),
      { v: 'uom', l: 'Unit of Measurement' }, { v: 'hwTypes', l: 'Hardware asset types' }, { v: 'swTypes', l: 'Software types' }, { v: 'consTypes', l: 'Consumable types' },
    ];
    const only = (el.dataset.keys || '').split(',').map((s) => s.trim()).filter(Boolean);
    const list = only.length ? entries.filter((e) => only.includes(e.v)) : entries;
    UI.form({ title: 'Add a master value', sub: 'Append a new value to any master — removing master data is Administrator-only', icon: 'plus',
      fields: [{ k: 'key', label: 'Master', type: 'select', options: list, req: true }],
      onSubmit: (v) => {
        const k = v.key;
        const fire = (name, ds) => { if (UI.acts[name]) UI.acts[name]({ dataset: ds || {} }); };
        if (k === 'uom') fire('ms.adduom');
        else if (k === 'hwTypes') fire('ms.addhwtype');
        else if (k === 'swTypes') fire('ms.addswtype');
        else if (k === 'consTypes') fire('ms.addconstype');
        else fire('ms.add', { key: k });
      } });
  });
  ITMS.wf = { custody, genId, provision, deprovision, ensure, MASTERS };
})();

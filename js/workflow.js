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
  function ensure() {
    const d = db(); if (!d) return; d.lists = d.lists || {}; d.seq = d.seq || {};
    if (!d.systems) d.systems = JSON.parse(JSON.stringify(DEFAULT_SYSTEMS));
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
  const heldBy = (no) => db().hw.filter((a) => a.holder === no);
  const nextEmpNo = () => 'EMP-' + L.pad(db().employees.reduce((m, e) => Math.max(m, parseInt((e.no.split('-')[1] || '0'), 10)), 0) + 1);
  const domain = () => { const c = {}; db().employees.forEach((e) => { const d = (e.email || '').split('@')[1]; if (d) c[d] = (c[d] || 0) + 1; }); return Object.keys(c).sort((a, b) => c[b] - c[a])[0] || 'example.com'; };
  const nameParts = (n) => String(n || '').toLowerCase().replace(/[^a-z\s.-]/g, '').split(/[\s.]+/).filter(Boolean);
  function genId(sys, e) {
    const p = nameParts(e.name); const f = p[0] || 'user', l = p.length > 1 ? p[p.length - 1] : '';
    const email = e.email || (l ? f + '.' + l : f) + '@' + domain();
    const base = { 'first.last': l ? f + '.' + l : f, flast: l ? f[0] + l : f, empno: String(e.no || '').replace(/\D/g, '') || e.no, email }[sys.idRule] || e.no;
    const taken = (x) => db().accounts.some((a) => a.sysId === sys.id && a.accountId === x && a.status !== 'Disabled' && a.empNo !== e.no);
    let id = base, n = 1; while (taken(id)) { n++; id = base.includes('@') ? base.replace('@', n + '@') : base + n; } return id;
  }
  const payload = (e) => ({ no: e.no, name: e.name, email: e.email, department: e.dept, designation: e.designation, manager: e.manager, location: e.location, joinDate: e.doj, leaveDate: e.dol || '', mobile: e.mobile });
  async function callSystem(sys, action, accountId, e) {
    if (sys.mode !== 'Webhook' || !sys.url) return { ok: true, msg: 'Simulated' };
    try {
      const h = { 'Content-Type': 'application/json' }; const i = (sys.auth || '').indexOf(':'); if (i > 0) h[sys.auth.slice(0, i).trim()] = sys.auth.slice(i + 1).trim();
      const r = await fetch(sys.url, { method: 'POST', headers: h, body: JSON.stringify({ action, system: sys.name, accountId, employee: payload(e) }) });
      return { ok: r.ok, msg: 'HTTP ' + r.status };
    } catch (err) { return { ok: false, msg: 'Network/CORS error — ' + err.message }; }
  }
  const plog = (empNo, sysId, action, accountId, r) => { db().provLog.unshift({ at: new Date().toISOString(), empNo, sysId, action, accountId, ok: r.ok, msg: r.msg }); if (db().provLog.length > 500) db().provLog.length = 500; };
  async function provision(empNo, sysIds) {
    const e = L.emp(empNo); const out = [];
    for (const sid of sysIds) {
      const sys = sysOf(sid); if (!sys) continue; let acc = activeAcc(empNo, sid); const accountId = acc ? acc.accountId : genId(sys, e);
      const r = await callSystem(sys, 'create', accountId, e);
      if (!acc) { db().seq.acc = (db().seq.acc || 0) + 1; acc = { id: 'ACC-' + L.pad(db().seq.acc), empNo, sysId: sid, accountId, created: L.today() }; db().accounts.push(acc); }
      acc.status = r.ok ? 'Active' : 'Failed'; acc.msg = r.msg; plog(empNo, sid, 'Create', accountId, r); out.push({ sys: sys.name, accountId, ok: r.ok, msg: r.msg });
    }
    L.log('Access', `${out.filter((x) => x.ok).length}/${out.length} system account(s) created for ${e.name}`, empNo); S.emit(); return out;
  }
  async function deprovision(accIds) {
    const out = [];
    for (const id of accIds) {
      const acc = db().accounts.find((a) => a.id === id); if (!acc) continue; const sys = sysOf(acc.sysId); const e = L.emp(acc.empNo);
      const r = await callSystem(sys, 'disable', acc.accountId, e);
      if (r.ok) { acc.status = 'Disabled'; acc.disabled = L.today(); } acc.msg = r.msg; plog(acc.empNo, acc.sysId, 'Disable', acc.accountId, r); out.push({ sys: sys.name, accountId: acc.accountId, ok: r.ok, msg: r.msg });
    }
    if (out.length) L.log('Access', `${out.filter((x) => x.ok).length}/${out.length} system account(s) disabled`, ''); S.emit(); return out;
  }
  const missingSys = (empNo) => db().systems.filter((s) => s.enabled === 'Yes' && !activeAcc(empNo, s.id));
  const pendingOff = () => db().employees.filter((e) => e.status !== 'Active' && (heldBy(e.no).length || liveAccs(e.no).length));
  ITMS.pendingOffboarding = pendingOff;
  const addEvent = (type, empNo, date, data) => { const k = type === 'Onboarding' ? 'onb' : 'off'; db().seq[k] = (db().seq[k] || 0) + 1; const ev = Object.assign({ id: (k === 'onb' ? 'ONB-' : 'OFF-') + L.pad(db().seq[k]), type, empNo, date, at: new Date().toISOString() }, data); db().lifecycle.unshift(ev); S.emit(); return ev; };
  const summary = (res) => { const bad = res.filter((r) => !r.ok); return bad.length ? `${bad.length} system(s) failed — use Retry on the Integrations page` : ''; };

  /* ================= PRINTABLE ONBOARDING / OFFBOARDING FORMS ================= */
  function metaBlock(e, dateLabel, date) { return `<div class="meta"><div><b>Emp No:</b>${esc(e.no)}</div><div><b>${dateLabel}:</b>${fmt(date)}</div><div><b>Emp name:</b>${esc(e.name)}</div><div><b>Designation:</b>${esc(e.designation)}</div><div><b>Department:</b>${esc(e.dept)}</div><div><b>Reporting manager:</b>${esc(e.manager)}</div><div><b>Location:</b>${esc(e.location)}</div><div><b>Email:</b>${esc(e.email)}</div><div><b>Mobile:</b>${esc(e.mobile)}</div><div><b>Date of joining:</b>${fmt(e.doj)}</div></div>`; }
  const aRow = (id, extra) => { const a = L.hw(id) || {}; return `<tr><td>${esc(id)}</td><td>${esc(a.type)}</td><td>${esc((a.brand || '') + ' ' + (a.model || ''))}</td><td>${esc(a.serial)}</td><td>${esc(extra[0] || a.condition)}</td>${extra[1] != null ? `<td>${esc(extra[1])}</td>` : ''}</tr>`; };
  const accTable = (accs, head) => `<h2 style="margin:12px 0 4px;font-size:13px">System access ${head}</h2><table><thead><tr><th>System</th><th>Account / user ID</th><th>Status</th></tr></thead><tbody>${accs.map((a) => `<tr><td>${esc(a.sys)}</td><td>${esc(a.accountId)}</td><td>${a.ok ? head : 'FAILED — pending IT follow-up'}</td></tr>`).join('') || '<tr><td colspan="3" style="text-align:center;color:#888">None</td></tr>'}</tbody></table>`;
  forms.lifecycleDoc = function (id) {
    const ev = db().lifecycle.find((x) => x.id === id); if (!ev) return UI.toast('Record not found', 'err'); const e = L.emp(ev.empNo); const on = ev.type === 'Onboarding';
    const title = on ? 'Employee Onboarding & Asset Issuance Form' : 'Employee Offboarding & Asset Return Form';
    const assets = `<h2 style="margin:12px 0 4px;font-size:13px">${on ? 'Assets issued' : 'Assets returned / reassigned'}</h2><table><thead><tr><th>Asset ID</th><th>Type</th><th>Brand / model</th><th>Serial</th><th>Condition</th>${on ? '' : '<th>Disposition</th>'}</tr></thead><tbody>${ev.assets.map((x) => aRow(x.id, on ? [] : [x.cond, x.disp])).join('') || `<tr><td colspan="${on ? 5 : 6}" style="text-align:center;color:#888">No assets</td></tr>`}</tbody></table>`;
    UI.doc(title + ' ' + ev.id, `${UI.docHead(title)}<p style="margin:0 0 6px;color:#555">Reference ${ev.id}</p>${metaBlock(e, on ? 'Date' : 'Last working day', ev.date)}${assets}${accTable(ev.accounts, on ? 'Active' : 'Disabled')}<p class="agree">${on ? '<b>Asset &amp; access agreement:</b> ' + AGREE : 'I confirm that I have returned all company assets listed above in the stated condition, and I acknowledge that my system accounts have been disabled. IT confirms that returned items were verified at handover.'}</p><div class="sig"><div>Employee signature</div><div>IT department</div><div>${on ? 'Reporting manager / HR' : 'HR / Manager'}</div></div>`);
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
      const emps = db().employees.filter((x) => x.status === 'Active'); const e = subject();
      if (st.sys === null && e) st.sys = new Set(st.emp === '__new' ? db().systems.filter((s) => s.enabled === 'Yes').map((s) => s.id) : missingSys(e.no).map((s) => s.id));
      const nw = st.nw; const fld = (k, label, type) => `<label class="f">${label}<input class="in" data-nw="${k}" type="${type || 'text'}" value="${esc(nw[k])}"></label>`; const sel = (k, label, list) => `<label class="f">${label}<select class="in" data-nw="${k}"><option value="">—</option>${opts(list, nw[k])}</select></label>`;
      box.innerHTML = `<header><span class="gem" style="width:44px;height:44px;background:#10d9a0">${ic('plus')}</span><div><h3>Employee onboarding</h3><small>Create employee → issue assets → register every system ID in one step</small></div><button class="ibtn x" data-x>${ic('x')}</button></header>
      <div class="body"><h3 style="font:650 14px var(--head);margin:0 0 8px">1 · Employee</h3><div class="fgrid c3"><label class="f">Employee *<select class="in" id="oe"><option value="">— select —</option><option value="__new" ${st.emp === '__new' ? 'selected' : ''}>➕ New joiner (create employee now)</option>${opts(emps.map((x) => ({ v: x.no, l: `${x.name} (${x.no}) · ${x.dept}` })), st.emp)}</select></label><label class="f">Start date<input class="in" type="date" id="od" value="${st.date}"></label></div>
      ${st.emp === '__new' ? `<div class="fgrid c3 mt">${fld('name', 'Full name *')}${sel('designation', 'Designation', M('designations')())}${sel('dept', 'Department *', M('departments')())}${sel('location', 'Location', M('locations')())}${sel('manager', 'Reporting manager', db().employees.map((x) => x.name))}${fld('doj', 'Date of joining', 'date')}${fld('email', 'Email (auto if blank)', 'email')}${fld('mobile', 'Mobile', 'tel')}</div>` : ''}
      <h3 style="font:650 14px var(--head);margin:18px 0 8px">2 · Assets to issue <span class="pill p-violet" id="oc">${st.pick.size} selected</span></h3><div class="tbar"><div class="qs"><input class="in" id="oq" placeholder="Filter spare assets…" value="${esc(st.q)}"></div><select class="in" id="of"><option value="">All types</option>${opts(L.uniq(spare().map((a) => a.type)).sort(), st.tf)}</select></div><div class="pick" id="alist" style="max-height:200px">${assetList()}</div>
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
        UI.close(ov); UI.toast(`Onboarding ${rec.id} complete — ${ids.length} asset(s), ${res.filter((r) => r.ok).length} account(s)` + (summary(res) ? ' · ' + summary(res) : ''), summary(res) ? 'err' : undefined); setTimeout(() => forms.lifecycleDoc(rec.id), 150);
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
    const pick = () => { st.disp = {}; st.to = {}; st.cond = {}; st.acc = new Set(st.emp ? liveAccs(st.emp).map((a) => a.id) : []); };
    if (st.emp) pick();
    function draw() {
      const cand = db().employees.filter((x) => x.status !== 'Left' || heldBy(x.no).length || liveAccs(x.no).length); const e = st.emp ? L.emp(st.emp) : null; const held = e ? heldBy(e.no) : []; const accs = e ? liveAccs(e.no) : [];
      const targets = db().employees.filter((x) => x.status === 'Active' && x.no !== st.emp).map((x) => ({ v: x.no, l: `${x.name} (${x.no}) · ${x.dept}` }));
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
        UI.close(ov); UI.toast(`Offboarding ${rec.id} complete — ${items.length} asset(s), ${res.filter((r) => r.ok).length} account(s) disabled` + (summary(res) ? ' · ' + summary(res) : ''), summary(res) ? 'err' : undefined); setTimeout(() => forms.lifecycleDoc(rec.id), 150);
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
  UI.on('acc.prov', async (el) => { const e = L.emp(el.dataset.emp); const m = missingSys(e.no); if (!m.length) return UI.toast('All enabled systems already have an active account'); const r = await provision(e.no, m.map((s) => s.id)); UI.toast(`${r.filter((x) => x.ok).length}/${r.length} account(s) created` + (summary(r) ? ' · ' + summary(r) : ''), summary(r) ? 'err' : undefined); });
  UI.on('acc.retry', async (el) => { const a = db().accounts.find((x) => x.id === el.dataset.id); const r = await provision(a.empNo, [a.sysId]); UI.toast(r[0].ok ? 'Account created' : r[0].msg, r[0].ok ? undefined : 'err'); });
  UI.on('acc.dis', async (el) => { if (!(await UI.confirm('Disable this system account?', 'Disable', true))) return; const r = await deprovision([el.dataset.id]); UI.toast(r[0].ok ? 'Account disabled' : r[0].msg, r[0].ok ? undefined : 'err'); });
  UI.on('acc.bulk', async () => { const emps = db().employees.filter((e) => e.status === 'Active' && missingSys(e.no).length); if (!emps.length) return UI.toast('Every active employee already has all accounts'); if (!(await UI.confirm(`Register <b>${emps.length}</b> active employee(s) on all enabled systems?`, 'Register all'))) return; let ok = 0, bad = 0; for (const e of emps) (await provision(e.no, missingSys(e.no).map((s) => s.id))).forEach((r) => (r.ok ? ok++ : bad++)); UI.toast(`${ok} account(s) created, ${bad} failed`, bad ? 'err' : undefined); });

  /* employee profile: lifecycle toolbar + system access */
  const origEmp = UI.acts['emp.view'];
  UI.on('emp.view', function (el, e) {
    origEmp(el, e); const b = lastBody(); if (!b) return; const emp = L.emp(el.dataset.id); const accs = db().accounts.filter((a) => a.empNo === emp.no);
    b.insertAdjacentHTML('afterbegin', `<div class="card" style="margin-bottom:14px"><h3 style="margin:0 0 8px;font:650 14px var(--head)">Lifecycle &amp; system access</h3><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><button class="btn sm" style="background:#10d9a0" data-act="lc.on" data-emp="${emp.no}">${ic('plus')}Onboard / assign assets &amp; IDs</button><button class="btn sm hot" data-act="lc.off" data-emp="${emp.no}">${ic('undo')}Offboard</button><button class="btn sm ghost" data-act="acc.prov" data-emp="${emp.no}">${ic('key')}Create missing system IDs</button></div>${accs.length ? `<table class="t"><thead><tr><th>System</th><th>Account ID</th><th>Status</th><th>Created</th><th>Disabled</th><th></th></tr></thead><tbody>${accs.map((a) => `<tr><td>${esc((sysOf(a.sysId) || {}).name)}</td><td class="mono">${esc(a.accountId)}</td><td>${pill(a.status, a.status === 'Active' ? 'mint' : a.status === 'Failed' ? 'coral' : 'amber')}</td><td>${fmt(a.created)}</td><td>${fmt(a.disabled)}</td><td>${a.status === 'Failed' ? `<button class="btn xs ghost" data-act="acc.retry" data-id="${a.id}">Retry</button>` : a.status === 'Active' ? `<button class="btn xs ghost" data-act="acc.dis" data-id="${a.id}">Disable</button>` : ''}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">No system accounts registered yet</div>'}</div>`);
  });

  /* ================= PAGES ================= */
  const kpi = (n, label, c) => `<div class="card" style="border-left:4px solid ${c}"><div style="font:700 28px var(--head)">${n}</div><small style="color:var(--muted)">${label}</small></div>`;
  pages.lifecycle = {
    title: 'Onboarding & Offboarding', crumb: 'One workflow: employee → assets → AD · biometric · ERP IDs → signed forms', icon: 'swap', color: '#10d9a0', group: 'Workflow',
    render() {
      const d = db(); const tab = UI.curTab('lifecycle', 'emp'); const pend = pendingOff(); const act = d.employees.filter((e) => e.status === 'Active'); const noAcc = act.filter((e) => missingSys(e.no).length);
      const top = `<div class="grid g3">${kpi(act.length, 'Active employees', '#2f6bff')}${kpi(pend.length, 'Left / inactive still holding assets or IDs', pend.length ? '#ff5c6c' : '#10d9a0')}${kpi(noAcc.length, 'Active employees missing a system ID', noAcc.length ? '#ffb020' : '#10d9a0')}</div>
      <div class="grid g2 mt"><div class="card"><h3><span class="pip" style="--c:#10d9a0"></span>Start a workflow</h3><div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" style="background:#10d9a0" data-act="lc.on">${ic('plus')}Onboard employee</button><button class="btn hot" data-act="lc.off">${ic('undo')}Offboard employee</button></div></div>
      <div class="card"><h3><span class="pip" style="--c:#00c2ff"></span>Print signature forms</h3><div class="tbar"><select class="in" id="pfEmp"><option value="">— select employee —</option>${opts(d.employees.map((e) => ({ v: e.no, l: `${e.name} (${e.no})` })))}</select><button class="btn sm" data-act="lc.pf" data-kind="Issue">${ic('print')}Issuance form</button><button class="btn sm ghost" data-act="lc.pf" data-kind="Return">${ic('print')}Return form</button></div></div></div>`;
      const alert = pend.length ? `<div class="card mt" style="border-left:4px solid #ff5c6c"><h3><span class="pip" style="--c:#ff5c6c"></span>Offboarding pending</h3><table class="t"><thead><tr><th>Employee</th><th>Status</th><th>Assets</th><th>Active IDs</th><th></th></tr></thead><tbody>${pend.map((e) => `<tr><td><b>${esc(e.name)}</b> <small class="mono">${e.no}</small></td><td>${pill(e.status)}</td><td>${heldBy(e.no).length}</td><td>${liveAccs(e.no).length}</td><td><button class="btn xs hot" data-act="lc.off" data-emp="${e.no}">Offboard now</button></td></tr>`).join('')}</tbody></table></div>` : '';
      const tabs = UI.tabs('lifecycle', [{ id: 'emp', label: 'Employees & access', count: d.employees.length }, { id: 'rec', label: 'Onboarding / offboarding records', count: d.lifecycle.length }]);
      const body = tab === 'rec' ? UI.table({ id: 'lcrec', rows: () => d.lifecycle, sort: 'at', dir: -1, text: (r) => [r.id, r.type, L.empName(r.empNo)].join(' '), filters: [{ k: 'type', label: 'Type', options: ['Onboarding', 'Offboarding'] }], cols: [{ k: 'id', label: 'Record', mono: true }, { k: 'type', label: 'Type', render: (r) => pill(r.type, r.type === 'Onboarding' ? 'mint' : 'coral') }, { k: 'date', label: 'Date', render: (r) => fmt(r.date) }, { k: 'emp', label: 'Employee', val: (r) => L.empName(r.empNo), render: (r) => `<a class="link" data-act="emp.view" data-id="${r.empNo}">${esc(L.empName(r.empNo))}</a>` }, { k: 'a', label: 'Assets', num: true, val: (r) => r.assets.length }, { k: 'c', label: 'System IDs', num: true, val: (r) => r.accounts.filter((x) => x.ok).length }], actions: (r) => `<button class="ibtn" title="Print form" data-act="lc.doc" data-id="${r.id}">${ic('print')}</button>` })
        : UI.table({ id: 'lcemp', rows: () => d.employees, sort: 'no', text: (r) => [r.no, r.name, r.dept].join(' '), filters: [{ k: 'status', label: 'Status', options: ['Active', 'Inactive', 'Left'] }, { k: 'dept', label: 'Department', options: () => d.lists.departments }], cols: [{ k: 'no', label: 'Emp No', mono: true }, { k: 'name', label: 'Name', render: (r) => `<a class="link" data-act="emp.view" data-id="${r.no}"><b>${esc(r.name)}</b></a>` }, { k: 'dept', label: 'Department' }, { k: 'status', label: 'Status', render: (r) => pill(r.status) }, { k: 'as', label: 'Assets', num: true, val: (r) => heldBy(r.no).length }, { k: 'ac', label: 'Active IDs', num: true, val: (r) => liveAccs(r.no).length, render: (r) => { const n = liveAccs(r.no).length, t = d.systems.filter((s) => s.enabled === 'Yes').length; return `<span class="pill p-${n >= t ? 'mint' : n ? 'amber' : 'coral'}">${n}/${t}</span>`; } }], actions: (r) => `<button class="ibtn" style="--c:#10d9a0" title="Onboard / assign assets & IDs" data-act="lc.on" data-emp="${r.no}">${ic('plus')}</button><button class="ibtn" style="--c:#ff5c6c" title="Offboard" data-act="lc.off" data-emp="${r.no}">${ic('undo')}</button>` });
      return `${top}${alert}<div class="card mt">${tabs}${body}</div>`;
    },
  };

  const sysFields = () => [{ section: 'System' }, { k: 'name', label: 'System name', req: true }, { k: 'kind', label: 'Type', type: 'select', options: M('systemKinds'), blank: false }, { k: 'idRule', label: 'Account ID format', type: 'select', options: ID_RULES, blank: false }, { k: 'enabled', label: 'Include in one-click registration', type: 'select', options: ['Yes', 'No'], blank: false },
    { section: 'Connector' }, { k: 'mode', label: 'Mode', type: 'select', options: ['Simulation', 'Webhook'], blank: false, hint: 'Simulation records IDs only' }, { k: 'url', label: 'Webhook / API URL', full: true, ph: 'https://middleware.company.com/hooks/ad' }, { k: 'auth', label: 'Auth header', full: true, ph: 'Authorization: Bearer <token>', hint: 'stored in this browser' }, { k: 'notes', label: 'Notes', type: 'textarea', full: true }];
  pages.integrations = {
    title: 'Integrations', crumb: 'Active Directory · biometric devices · ERP — IDs created and disabled from one place', icon: 'link', color: '#00c2ff', group: 'Workflow',
    render() {
      const d = db(); const tab = UI.curTab('integrations', 'sys');
      const tabs = UI.tabs('integrations', [{ id: 'sys', label: 'Systems', count: d.systems.length }, { id: 'acc', label: 'Accounts', count: d.accounts.length }, { id: 'log', label: 'Activity log', count: d.provLog.length }]); let body;
      if (tab === 'sys') body = `<div class="note-box">In <b>Webhook</b> mode each create/disable sends <span class="mono">POST {action:"create|disable", system, accountId, employee:{no,name,email,department,designation,manager,location,joinDate,leaveDate,mobile}}</span> to your URL and expects HTTP 200. Browsers cannot talk to AD or biometric devices directly, so point this at a middleware (n8n, Power Automate, Azure Function, SCIM/LDAP gateway) that allows CORS from this site. Failed calls are flagged and can be retried.</div>${UI.table({ id: 'sys', rows: () => d.systems, sort: 'id', text: (r) => [r.name, r.kind].join(' '), cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'name', label: 'System', render: (r) => `<b>${esc(r.name)}</b>` }, { k: 'kind', label: 'Type' }, { k: 'idRule', label: 'ID format', render: (r) => esc((ID_RULES.find((x) => x.v === r.idRule) || {}).l || r.idRule) }, { k: 'mode', label: 'Mode', render: (r) => pill(r.mode, r.mode === 'Webhook' ? 'blue' : 'violet') }, { k: 'url', label: 'URL', render: (r) => `<small class="mono">${esc(r.url)}</small>` }, { k: 'enabled', label: 'In one-click', render: (r) => pill(r.enabled, r.enabled === 'Yes' ? 'mint' : 'amber') }, { k: 'n', label: 'Active IDs', num: true, val: (r) => d.accounts.filter((a) => a.sysId === r.id && a.status === 'Active').length }], actions: (r) => `<button class="ibtn" data-act="sys.edit" data-id="${r.id}">${ic('edit')}</button><button class="ibtn" style="--c:#ff5c6c" data-act="sys.del" data-id="${r.id}">${ic('trash')}</button>`, toolbar: `<button class="btn" data-act="sys.new">${ic('plus')}Add system</button><button class="btn ghost" data-act="acc.bulk">${ic('key')}Register all active employees</button>` })}`;
      else if (tab === 'acc') body = UI.table({ id: 'acc', rows: () => d.accounts, sort: 'id', dir: -1, text: (r) => [r.accountId, L.empName(r.empNo), (sysOf(r.sysId) || {}).name].join(' '), filters: [{ k: 'status', label: 'Status', options: ['Active', 'Failed', 'Disabled'] }, { k: 'sysId', label: 'System', options: () => d.systems.map((s) => ({ v: s.id, l: s.name })) }], cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'emp', label: 'Employee', val: (r) => L.empName(r.empNo), render: (r) => `<a class="link" data-act="emp.view" data-id="${r.empNo}">${esc(L.empName(r.empNo))}</a>` }, { k: 'sys', label: 'System', val: (r) => (sysOf(r.sysId) || {}).name }, { k: 'accountId', label: 'Account ID', mono: true }, { k: 'status', label: 'Status', render: (r) => pill(r.status, r.status === 'Active' ? 'mint' : r.status === 'Failed' ? 'coral' : 'amber') }, { k: 'created', label: 'Created', render: (r) => fmt(r.created) }, { k: 'disabled', label: 'Disabled', render: (r) => fmt(r.disabled) }, { k: 'msg', label: 'Result' }], actions: (r) => (r.status === 'Failed' ? `<button class="btn xs ghost" data-act="acc.retry" data-id="${r.id}">Retry</button>` : r.status === 'Active' ? `<button class="btn xs ghost" data-act="acc.dis" data-id="${r.id}">Disable</button>` : '') });
      else body = UI.table({ id: 'plog', rows: () => d.provLog.map((x, i) => Object.assign({ n: i }, x)), sort: 'n', text: (r) => [r.accountId, L.empName(r.empNo), r.action].join(' '), cols: [{ k: 'at', label: 'When', render: (r) => esc(r.at.replace('T', ' ').slice(0, 16)) }, { k: 'emp', label: 'Employee', val: (r) => L.empName(r.empNo) }, { k: 'sys', label: 'System', val: (r) => (sysOf(r.sysId) || {}).name }, { k: 'action', label: 'Action' }, { k: 'accountId', label: 'Account ID', mono: true }, { k: 'ok', label: 'Result', val: (r) => (r.ok ? 'OK' : 'Failed'), render: (r) => pill(r.ok ? 'OK' : 'Failed', r.ok ? 'mint' : 'coral') }, { k: 'msg', label: 'Detail' }] });
      return `<div class="card">${tabs}${body}</div>`;
    },
  };
  const saveSys = (v, id) => { if (id) Object.assign(sysOf(id), v); else { v.id = 'SYS-' + L.pad(db().systems.reduce((m, s) => Math.max(m, parseInt(s.id.split('-')[1], 10)), 0) + 1, 2); db().systems.push(v); } S.emit(); };
  UI.on('sys.new', () => UI.form({ title: 'Add integration', icon: 'link', fields: sysFields(), values: { mode: 'Simulation', enabled: 'Yes', idRule: 'first.last', kind: (db().lists.systemKinds || [])[0] }, onSubmit: (v) => { saveSys(v); UI.toast('System added'); } }));
  UI.on('sys.edit', (el) => { const s = sysOf(el.dataset.id); UI.form({ title: 'Edit ' + s.name, icon: 'edit', fields: sysFields(), values: s, onSubmit: (v) => { saveSys(v, s.id); UI.toast('System updated'); } }); });
  UI.on('sys.del', async (el) => { const s = sysOf(el.dataset.id); if (db().accounts.some((a) => a.sysId === s.id && a.status !== 'Disabled')) return UI.toast('Disable its active accounts first', 'err'); if (await UI.confirm(`Delete <b>${esc(s.name)}</b>?`, 'Delete', true)) { db().systems = db().systems.filter((x) => x.id !== s.id); S.emit(); } });

  pages.masters = {
    title: 'Masters', crumb: 'Single source for every dropdown — edit here and all forms follow', icon: 'tag', color: '#ffb020', group: 'Masters',
    render() {
      const d = db(); const card = (m) => { const vals = d.lists[m.key] || []; return `<div class="card"><h3><span class="pip" style="--c:#ffb020"></span>${m.title}<button class="btn xs" style="margin-left:auto" data-act="ms.edit" data-key="${m.key}">${ic('edit')}Edit</button></h3><small style="color:var(--muted)">Feeds: ${m.note}</small><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">${vals.map((v) => `<span class="pill p-blue">${esc(v)} <small>${m.used(v)}</small></span>`).join('') || '<span style="color:var(--muted)">Empty</span>'}</div></div>`; };
      return `<div class="note-box">Numbers show how many records use each value. A value that is in use cannot be removed. Other masters: <a class="link" data-go="#/vendors">Vendors</a>, <a class="link" data-go="#/employees">Employees</a>, and hardware / software / consumable types under <a class="link" data-go="#/settings">Lists &amp; Settings</a>.</div><div class="grid g2 mt">${MASTERS.map(card).join('')}</div>`;
    },
  };
  UI.on('ms.edit', (el) => {
    const m = MASTERS.find((x) => x.key === el.dataset.key);
    UI.form({ title: m.title, sub: 'One value per line', icon: 'tag', fields: [{ k: 't', label: 'Values', type: 'textarea', full: true }], values: { t: (db().lists[m.key] || []).join('\n') }, onSubmit: (v) => {
      const nu = L.uniq(v.t.split('\n').map((x) => x.trim()).filter(Boolean)).sort(); const gone = (db().lists[m.key] || []).filter((x) => !nu.includes(x)); const busy = gone.filter((x) => m.used(x));
      if (busy.length) throw new Error(`In use, cannot remove: ${busy.map((x) => `${x} (${m.used(x)})`).join(', ')}`);
      db().lists[m.key] = nu; S.emit(); UI.toast(m.title + ' updated');
    } });
  });
  ITMS.wf = { custody, genId, provision, deprovision, ensure, MASTERS };
})();

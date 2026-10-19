/* ITMS app shell: router, sidebar, delegated events, global search */
(function () {
  const ITMS = window.ITMS; const L = ITMS.logic; const UI = ITMS.ui; const S = ITMS.store;
  const { esc, icon: ic } = UI;
  ITMS.BUILD = '2026-10-18 · ITIL 4 practices structure';
  try { console.info('%cITMS build ' + ITMS.BUILD, 'color:#2f6bff;font-weight:bold'); } catch (e) { /* ignore */ }
  ITMS.nav = { page: 'dashboard', params: {}, fresh: true };
  const MENU = [
    { id: 'dashboard', single: true },
    { id: 'portal', single: true },
    {
      id: 'itil', title: 'ITIL Practices', icon: 'spark', color: '#2f6bff', sections: [
        { title: 'Service design & catalogue', items: ['catalog', 'cmdb', 'assetmgmt', 'knowledge'] },
        { title: 'Service operations', items: ['sr', 'incidents', 'majorinc', 'problems', 'monitoring', 'portal', 'chat', 'mailticket', 'templates', 'itsm'] },
        { title: 'Change & deployment', items: ['changes', 'releases', 'deployment', 'lifecycles', 'pmtasks'] },
        { title: 'Service assurance', items: ['slm', 'availability', 'continuity', 'security', 'surveys', 'automation'] },
        { title: 'Governance & improvement', items: ['supplier', 'improvement', 'projects'] },
      ],
    },
    {
      id: 'assets', title: 'Assets & Procurement', icon: 'laptop', color: '#1d4ed8', sections: [
        { title: 'Asset register', items: ['hardware', 'movements', 'software', 'consumables', 'loans', 'discovery'] },
        { title: 'Contracts', items: ['amc', 'contracts'] },
        { title: 'Procurement', items: ['requests', 'orders', 'vendors'] },
        { title: 'Item Master', items: ['itemmaster'] },
      ],
    },
    {
      id: 'identity', title: 'People & Identity', icon: 'users', color: '#00a8e8', sections: [
        { title: 'People', items: ['employees', 'lifecycle', 'addirectory', 'roles'] },
      ],
    },
    {
      id: 'hrm', title: 'Human Resources', icon: 'users', color: '#00c2ff', sections: [
        { title: 'HR Operations', items: [
          { id: 'hr', params: { tab: 'staff' }, label: 'Staff directory' },
          { id: 'hr', params: { tab: 'req' }, label: 'On/offboarding requests' },
          { id: 'hr', params: { tab: 'leave' }, label: 'Leave management' },
          { id: 'hr', params: { tab: 'bal' }, label: 'Leave balances' },
          { id: 'hr', params: { tab: 'clear' }, label: 'Exit clearance' },
          { id: 'hr', params: { tab: 'desk' }, label: 'HR desk' },
        ]},
      ],
    },
    {
      id: 'fin', title: 'Finance', icon: 'dollar', color: '#64748b', sections: [
        { title: 'Accounts payable', items: [
          { id: 'finance', params: { tab: 'exp' }, label: 'Expense claims' },
          { id: 'finance', params: { tab: 'pay' }, label: 'Vendor payments' },
          { id: 'finance', params: { tab: 'bills' }, label: 'AP Bills' },
          { id: 'finance', params: { tab: 'invoices' }, label: 'Invoices' },
          { id: 'finance', params: { tab: 'grninv' }, label: 'GRN → invoices' },
        ]},
        { title: 'General ledger', items: [
          { id: 'finance', params: { tab: 'jv' }, label: 'Journal vouchers' },
          { id: 'finance', params: { tab: 'ledger' }, label: 'General ledger' },
          { id: 'finance', params: { tab: 'tb' }, label: 'Trial balance' },
          { id: 'finance', params: { tab: 'recon' }, label: 'Reconciliation' },
        ]},
        { title: 'Setup', items: [
          { id: 'finance', params: { tab: 'coa' }, label: 'Chart of accounts' },
          { id: 'finance', params: { tab: 'links' }, label: 'Linked areas' },
        ]},
      ],
    },
    {
      id: 'govern', title: 'Govern & Compliance', icon: 'shield', color: '#3b82f6', sections: [
        { title: 'Govern', items: ['workflow', 'budget', 'compliance', 'archiving', 'reportsplus', 'scheduler', 'esm'] },
      ],
    },
    {
      id: 'admin', title: 'Administration', icon: 'cog', color: '#5b8def', sections: [
        { title: 'Configure', items: ['masters', 'sites', 'integrations', 'settings', 'itsmadmin', 'emailconfig'] },
      ],
    },
  ];
  const ORDER = MENU.reduce((a, g) => {
    if (g.single) return a.concat(g.id);
    const items = g.sections ? g.sections.flatMap((s) => s.items) : (g.items || []);
    return a.concat(items.map((it) => (typeof it === 'string' ? it : it.id)));
  }, []);
  const NAVKEY = 'itms.nav.v2'; const navState = (() => { try { return JSON.parse(localStorage.getItem(NAVKEY)) || {}; } catch (e) { return {}; } })();
  const saveNav = () => { try { localStorage.setItem(NAVKEY, JSON.stringify(navState)); } catch (e) { /* ignore */ } };

  function badges() {
    const d = S.db; const s = L.stats(); const a = s.alerts; const b = {};
    let openLines = 0; d.prs.forEach((p) => { if (p.status !== 'Cancelled') p.lines.forEach((l) => { if (L.prRemaining(p.prNo, l.line, l.qty) > 0) openLines++; }); });
    if (openLines) b.requests = [openLines, 2];
    const act = d.pos.filter((p) => p.approval === 'Draft' || (p.approval === 'Approved' && L.poReceipt(p) !== 'Received')).length; if (act) b.orders = [act, 2];
    const sw = a.sw30.length + a.swExpired.length; if (sw) b.software = [sw, 1];
    const am = a.amc30.length + a.amcExpired.length; if (am) b.amc = [am, 1];
    if (a.lowStock.length) b.consumables = [a.lowStock.length, 1];
    if (ITMS.hdOverdue) { const n = ITMS.hdOverdue(); if (n) b.tickets = [n, 1]; }
    if (ITMS.pendingOffboarding) { const n = ITMS.pendingOffboarding().length; if (n) b.lifecycle = [n, 2]; }
    if (a.spare.length === 0 && d.hw.length) b.hardware = ['!', 1];
    try {
      if (d.budgets && ITMS.budget) { const yr = new Date().getFullYear(); const p = ITMS.budget.plannedByYear(yr); const a2 = ITMS.budget.actualsByYear(yr); const tp = Object.values(p).reduce((x, y) => x + y, 0); const ta = Object.values(a2).reduce((x, y) => x + y, 0); if (tp && ta > tp) b.budget = ['OVER', 1]; }
      if (d.compliance && d.compliance.active && ITMS.gov) { const rows = ITMS.gov.controlsOf(d.compliance.active); const open = rows.filter((r) => r.status === 'Non-compliant' || r.status === 'Partially compliant').length; const todo = rows.filter((r) => r.status === 'Not assessed').length; if (open) b.compliance = [open, 1]; else if (todo && d.compliance.confirmed) b.compliance = [todo, 2]; }
    } catch (e) { /* badges optional */ }
    return b;
  }
  function renderNav() {
    const b = badges(); const cur = ITMS.nav.page; let h = '';
    const mkHref = (it) => {
      if (typeof it === 'string') return `#/${it}`;
      const q = it.params ? '?' + Object.entries(it.params).map(([k,v]) => k+'='+encodeURIComponent(v)).join('&') : '';
      return `#/${it.id}${q}`;
    };
    const item = (it) => {
      const id = typeof it === 'string' ? it : it.id;
      const label = typeof it === 'string' ? (ITMS.pages[it]?.title || it) : (it.label || it.id);
      const p = ITMS.pages[id] || { title: label, icon: 'grid', color: '#2f6bff' };
      const href = mkHref(it);
      const isOn = location.hash.startsWith('#/' + id) && (!it.params || Object.entries(it.params).every(([k,v]) => ITMS.nav.params[k] === v));
      return `<a href="${href}" title="${esc(p.title)}" class="${isOn ? 'on' : ''}" style="--c:${p.color}"><span class="ni">${ic(p.icon)}</span>${label}${b[id] ? `<span class="bd ${b[id][1] === 2 ? 'b2' : ''}">${b[id][0]}</span>` : ''}</a>`;
    };
    MENU.forEach((g) => {
      if (g.single) { h += item(g.id); return; }
      if (g.id === 'admin') { try { if (ITMS.sdp.effRole() !== 'Administrator') return; } catch (e) { /* show on error */ } }
      const canP = (it) => { try { const id = typeof it === 'string' ? it : it.id; return ITMS.sdp.canPage(id); } catch (e) { return true; } };
      const sections = g.sections || [{ items: g.items || [] }];
      const gItems = sections.flatMap((s) => s.items).filter(canP);
      if (!gItems.length) return;
      const has = gItems.some((it) => {
        const id = typeof it === 'string' ? it : it.id;
        return location.hash.startsWith('#/' + id) && (!it.params || Object.entries(it.params).every(([k,v]) => ITMS.nav.params[k] === v));
      });
      const open = !!navState[g.id];
      const sum = gItems.reduce((n, it) => {
        const id = typeof it === 'string' ? it : it.id;
        return n + (b[id] && typeof b[id][0] === 'number' ? b[id][0] : (b[id] ? 1 : 0));
      }, 0);
      const sub = sections.filter((s) => s.items.some(canP)).map((s) => `<div class="sec-label">${esc(s.title)}</div>${s.items.filter(canP).map(item).join('')}`).join('');
      h += `<div class="grp ${open ? 'open' : ''}" style="--c:${g.color}"><div class="gh ${has ? 'has' : ''}" data-grp="${g.id}" title="${esc(g.title)}"><span class="gi">${ic(g.icon)}</span><span class="gt">${g.title}</span>${sum && !open ? `<span class="bd">${sum}</span>` : ''}<i class="chev"></i></div><div class="sub">${sub}</div></div>`;
    });
    document.getElementById('nav').innerHTML = h + `<div class="navver" title="Deployed code version — quote this when reporting issues">build ${esc(ITMS.BUILD || '?')}</div>`; if (navState._last !== cur) { navState._last = cur; saveNav(); }
    try { document.body.classList.toggle('navmin', !!navState._min); } catch (e) { /* ignore */ }
    const total = Object.keys(b).reduce((s, k) => s + (typeof b[k][0] === 'number' ? b[k][0] : 0), 0);
    const bell = document.getElementById('bellN'); if (bell) { bell.textContent = total; bell.style.display = total ? '' : 'none'; }
  }
  function healthHtml() {
    try {
      const missing = ORDER.filter((id) => id !== 'dashboard' && !ITMS.pages[id]);
      const errs = (window.ITMS_LOAD_ERRORS || []).slice(-8);
      let gate = 'gate code missing';
      try {
        if (ITMS.sdp && ITMS.sdp.canPage) {
          const who = (ITMS.sdp.effRole ? ITMS.sdp.effRole() : '?');
          gate = 'you=' + who + ' · tickets ' + (ITMS.sdp.canPage('tickets') ? 'ALLOWED' : 'BLOCKED') + ' · hr ' + (ITMS.sdp.canPage('hr') ? 'ALLOWED' : 'BLOCKED');
        }
      } catch (e) { gate = 'gate error: ' + e.message; }
      if (!missing.length && !errs.length) return '';
      return `<div class="card" style="border-left:4px solid #ff5c6c;margin-bottom:16px"><h3>Self-check — send this to support</h3>`
        + `<div>Pages registered: <b>${ORDER.length - missing.length - 1} / ${ORDER.length - 1}</b> · ${esc(gate)}</div>`
        + (missing.length ? `<div style="margin-top:6px">Missing screens: <b>${missing.slice(0, 14).map(esc).join(', ')}</b>${missing.length > 14 ? ' …' : ''}</div>` : '')
        + (errs.length ? `<div style="margin-top:6px">Script errors:<br>${errs.map((x) => `<span class="mono">${esc(x)}</span>`).join('<br>')}</div>` : '')
        + `<div style="margin-top:10px"><button class="btn sm" data-diag="1">Deep-check scripts</button></div>`
        + `</div>`;
    } catch (e) { return ''; }
  }
  async function runDiag() {
    const files = ['js/seed.js', 'js/core.js', 'js/ui.js', 'js/pages-1.js', 'js/pages-2.js', 'js/pages-3.js', 'js/pages-4.js', 'js/connectors.js', 'js/workflow.js', 'js/budget.js', 'js/compliance.js', 'js/itsm.js', 'js/sdp-plus.js', 'js/cmdb.js', 'js/itil-practices.js', 'js/reports.js', 'js/auth.js', 'js/testdata.js', 'js/app.js'];
    const rows = [];
    for (const f of files) {
      try {
        const r = await fetch(f, { cache: 'no-store' });
        if (!r.ok) { rows.push([f, 'HTTP ' + r.status + ' (file missing on server)', '']); continue; }
        const t = await r.text();
        try { new Function(t); rows.push([f, 'OK', '']); }
        catch (e) {
          const m = String((e && e.stack) || (e && e.message) || '').match(/:(\d+):(\d+)/);
          const ln = m ? +m[1] : 0;
          const code = ln ? (t.split('\n')[ln - 1] || '').slice(0, 200) : '';
          rows.push([f, 'BROKEN: ' + String((e && e.message) || e), ln ? ('line ' + ln + ': ' + code) : '']);
        }
      } catch (e) { rows.push([f, 'fetch failed: ' + e.message, '']); }
    }
    const ov = UI.modal(`<header><div><h3>Script deep-check</h3><small>Parses every app file exactly as served — send this table to support</small></div><button class="ibtn x" data-x>${ic('x')}</button></header><div class="body"><table class="t"><thead><tr><th>File</th><th>Result</th><th>Detail</th></tr></thead><tbody>${rows.map((x) => `<tr><td class="mono">${x[0]}</td><td>${x[1] === 'OK' ? 'OK' : `<b style="color:#ff5c6c">${esc(x[1])}</b>`}</td><td class="mono" style="white-space:normal;word-break:break-all">${esc(x[2])}</td></tr>`).join('')}</tbody></table></div><footer><button class="btn ghost" data-x>Close</button></footer>`, {});
    ov.addEventListener('click', (e) => { if (e.target.closest('[data-x]')) UI.close(ov); });
  }
  function countUp() {
    document.querySelectorAll('[data-count]').forEach((el) => {
      const raw = el.dataset.count; const n = parseFloat(String(raw).replace(/,/g, '')); if (isNaN(n) || /\//.test(raw)) return; const dec = +el.dataset.dec || 0; const t0 = performance.now();
      const step = (t) => { const k = Math.min(1, (t - t0) / 800); const e = 1 - Math.pow(1 - k, 3); el.textContent = (n * e).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }); if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step);
    });
  }
  let first = true;
  function render() {
    const nav = ITMS.nav; const page = ITMS.pages[nav.page] || ITMS.pages.dashboard; const view = document.getElementById('view'); const sc = view.scrollTop;
    try { view.innerHTML = page.render(); } catch (e) { console.error(e); view.innerHTML = `<div class="card"><div class="empty"><b>Something went wrong rendering this page</b>${esc(e.message)}</div></div>`; }
    if (nav.page === 'dashboard') { try { const hh = healthHtml(); if (hh) view.innerHTML = hh + view.innerHTML; } catch (e) { /* ignore */ } }
    document.getElementById('ptitle').textContent = page.title; document.getElementById('pcrumb').textContent = page.crumb;
    document.title = page.title + ' · ITMS'; renderNav();
    if (page.after) page.after();
    if (nav.fresh) { view.scrollTop = 0; countUp(); } else view.scrollTop = sc;
    nav.fresh = false; first = false;
  }
  function route() {
    const h = location.hash.replace(/^#\/?/, ''); const [p, q] = h.split('?'); ITMS.nav.page = ITMS.pages[p] ? p : 'dashboard';
    try {
      const grp = MENU.find((g) => !g.single && (g.sections ? g.sections.flatMap((s) => s.items) : []).includes(ITMS.nav.page));
      MENU.forEach((g) => { if (!g.single) navState[g.id] = (g === grp); });
      saveNav();
    } catch (e) { /* nav stays as-is */ }
    if (ITMS.nav.page !== 'dashboard' && ITMS.sdp) { try { if (!ITMS.sdp.canPage(ITMS.nav.page)) { UI.toast('Your role has no access to this module', 'err'); ITMS.nav.page = 'dashboard'; } } catch (e) { /* open on error */ } }
    /* Administration module: only Administrator role */
    const adminPages = ['masters', 'sites', 'integrations', 'settings'];
    if (adminPages.indexOf(ITMS.nav.page) >= 0) { try { if (ITMS.sdp.effRole() !== 'Administrator') { UI.toast('Administration module is restricted to Administrator role', 'err'); ITMS.nav.page = 'dashboard'; } } catch (e) { /* open on error */ } }
    ITMS.nav.params = {}; if (q) q.split('&').forEach((kv) => { const [k, v] = kv.split('='); ITMS.nav.params[k] = decodeURIComponent(v || ''); });
    ITMS.nav.fresh = true; document.querySelector('.side').classList.remove('open'); render();
  }
  let rt = null; S.subscribe(() => { clearTimeout(rt); rt = setTimeout(render, 30); });

  /* ---- delegated events ---- */
  document.addEventListener('click', (e) => {
    const t = e.target;
    const gh = t.closest('[data-grp]'); if (gh) { const id = gh.dataset.grp; if (navState._min) { navState._min = false; MENU.forEach((g) => { if (!g.single) navState[g.id] = false; }); navState[id] = true; } else { const was = !!navState[id]; MENU.forEach((g) => { if (!g.single) navState[g.id] = false; }); navState[id] = !was; } saveNav(); renderNav(); return; }
    const nv = t.closest('[data-nav]'); if (nv) { const target = '#/' + nv.dataset.nav; if (location.hash === target) route(); else location.hash = target; return; }
    const act = t.closest('[data-act]');
    if (act) {
      const n = act.dataset.act;
      if (n === 'csv') return UI.csv(act.dataset.id);
      if (UI.acts[n]) { e.preventDefault(); try { UI.acts[n](act, e); } catch (err) { console.error(err); UI.toast(err.message, 'err'); } return; }
    }
    const go = t.closest('[data-go]'); if (go && go.dataset.go) { const target = go.dataset.go; const m = target.match(/^#\/(\w+)/); if (m && ITMS.nav.page === m[1] && location.hash === target) route(); else location.hash = target; return; }
    const tab = t.closest('[data-tab]'); if (tab) { const [p, id] = tab.dataset.tab.split(':'); UI.tab[p] = id; render(); return; }
    const ts = t.closest('[data-ts]'); if (ts) { const x = UI.tbl[ts.dataset.ts].st; if (x.sort === ts.dataset.k) x.dir *= -1; else { x.sort = ts.dataset.k; x.dir = 1; } UI.redrawTable(ts.dataset.ts); return; }
    const tp = t.closest('[data-tp]'); if (tp && !tp.disabled) { UI.tbl[tp.dataset.tp].st.page = +tp.dataset.p; UI.redrawTable(tp.dataset.tp); return; }
    if (t.closest('#ham')) document.querySelector('.side').classList.toggle('open');
    if (t.closest('#navtoggle')) { navState._min = !navState._min; saveNav(); renderNav(); return; }
    if (t.closest('#bell')) { if (document.getElementById('bellpop')) closeBell(); else openBell(); return; }
    if (t.closest('[data-diag]')) { runDiag(); return; }
    if (!t.closest('.search')) document.getElementById('sres').style.display = 'none';
  });
  document.addEventListener('input', (e) => {
    const q = e.target.dataset && e.target.dataset.tq; if (q) { const st = UI.tbl[q].st; st.q = e.target.value; st.page = 1; UI.redrawTable(q); }
  });
  document.addEventListener('change', (e) => {
    const id = e.target.dataset && e.target.dataset.tf; if (id) { const st = UI.tbl[id].st; st.f[e.target.dataset.k] = e.target.value; st.page = 1; UI.redrawTable(id); }
    const df = e.target.dataset && e.target.dataset.tdf; if (df) { const st = UI.tbl[df].st; st.df = e.target.value; st.page = 1; UI.redrawTable(df); }
    const dt = e.target.dataset && e.target.dataset.tdt; if (dt) { const st = UI.tbl[dt].st; st.dt = e.target.value; st.page = 1; UI.redrawTable(dt); }
  });
  // 3D tilt on cards
  document.addEventListener('mousemove', (e) => {
    const c = e.target.closest && e.target.closest('.tilt'); if (!c) return; const r = c.getBoundingClientRect();
    c.style.setProperty('--ry', ((e.clientX - r.left) / r.width - 0.5) * 9 + 'deg'); c.style.setProperty('--rx', (0.5 - (e.clientY - r.top) / r.height) * 9 + 'deg');
  });
  document.addEventListener('mouseout', (e) => { const c = e.target.closest && e.target.closest('.tilt'); if (c && !c.contains(e.relatedTarget)) { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); } });

  /* ---- global search ---- */
  function search(q) {
    q = q.toLowerCase().trim(); const d = S.db; if (q.length < 2) return '';
    const m = (s) => String(s || '').toLowerCase().includes(q); const out = [];
    const grp = (title, rows) => { if (rows.length) out.push(`<h6>${title}</h6>` + rows.slice(0, 5).join('')); };
    grp('Hardware', d.hw.filter((a) => m(a.id) || m(a.desc) || m(a.serial) || m(a.compName)).map((a) => `<a data-act="hw.view" data-id="${a.id}">${ic('laptop')}<span><b>${a.id}</b> ${esc(a.desc)}<br><small>${a.status}${a.holder ? ' · ' + esc(L.empName(a.holder)) : ''}</small></span></a>`));
    grp('Employees', d.employees.filter((e) => m(e.name) || m(e.no) || m(e.email)).map((e) => `<a data-act="emp.view" data-id="${e.no}">${ic('users')}<span><b>${esc(e.name)}</b> ${e.no}<br><small>${esc(e.dept)}</small></span></a>`));
    grp('Purchase orders', d.pos.filter((p) => m(p.poNo) || m(p.vendor) || p.lines.some((l) => m(l.desc))).map((p) => `<a data-act="po.view" data-id="${p.poNo}">${ic('cart')}<span><b>${p.poNo}</b> ${esc(p.vendor)}<br><small>${esc(p.lines[0].desc)}</small></span></a>`));
    grp('Purchase requests', d.prs.filter((p) => m(p.prNo) || p.lines.some((l) => m(l.desc))).map((p) => `<a data-act="pr.view" data-id="${p.prNo}">${ic('filePlus')}<span><b>${p.prNo}</b><br><small>${esc(p.lines[0].desc)}</small></span></a>`));
    grp('Software', d.sw.filter((s) => m(s.name) || m(s.id)).map((s) => `<a data-act="sw.view" data-id="${s.id}">${ic('key')}<span><b>${esc(s.name)}</b> ${s.id}</span></a>`));
    grp('Vendors', d.vendors.filter((v) => m(v.name) || m(v.id)).map((v) => `<a data-act="ven.view" data-id="${v.id}">${ic('truck')}<span><b>${esc(v.name)}</b> ${v.id}</span></a>`));
    return out.join('') || '<div class="empty">No matches</div>';
  }
  /* ---- notification popup ---- */
  function closeBell() { const p = document.getElementById('bellpop'); if (p) p.remove(); }
  function openBell() {
    const d = S.db; const rows = [];
    const add = (n, t, go) => { if (n) rows.push(`<a data-go="${go}" class="alert-row" style="--c:#2f6bff"><b>${n}</b><span>${t}</span></a>`); };
    try {
      const s = L.stats(); const a = s.alerts;
      add(a.lowStock.length, 'Consumables below reorder level', '#/consumables');
      add(a.sw30.length + a.swExpired.length, 'Licences expiring / expired', '#/software');
      add(a.amc30.length + a.amcExpired.length, 'AMC contracts expiring / lapsed', '#/amc');
      let openLines = 0; d.prs.forEach((p) => { if (p.status !== 'Cancelled') p.lines.forEach((l) => { if (L.prRemaining(p.prNo, l.line, l.qty) > 0) openLines++; }); });
      add(openLines, 'PR lines awaiting order', '#/requests');
      if (ITMS.hdOverdue) add(ITMS.hdOverdue(), 'Tickets past SLA', '#/tickets');
      if (d.hd) {
        add(d.hd.requests.filter((r) => (r.status === 'Open' || r.status === 'Assigned') && !r.tech).length, 'Unassigned tickets', '#/tickets');
        add(['requests', 'changes'].reduce((n, k) => n + (d.hd[k] || []).reduce((m, r) => m + ((r.approvals || []).filter((x) => x.status === 'Pending').length), 0), 0), 'Approvals waiting (tickets + changes)', '#/itsm');
        if (ITMS.sdp && ITMS.sdp.D) {
          const sdp = S.db.sdp || {};
          add((sdp.escalations || []).filter((e) => e.status === 'Open').length, 'Open escalations', '#/automation');
          add((sdp.chats || []).filter((c) => c.status === 'Open' && !c.tech).length, 'Chats waiting for agent', '#/chat');
          add((sdp.maint || []).filter((m) => m.status === 'Scheduled' && m.next && m.next < L.today()).length, 'Preventive tasks overdue', '#/pmtasks');
          add((sdp.contracts || []).filter((c) => c.end && L.diffDays(c.end, L.today()) <= 30 && L.diffDays(c.end, L.today()) >= 0).length, 'Contracts expiring within 30 days', '#/contracts');
          add((sdp.loans || []).filter((l) => l.status === 'On loan' && l.dueDate < L.today()).length, 'Asset loans overdue', '#/loans');
        }
      }
      if (ITMS.pendingOffboarding) add(ITMS.pendingOffboarding().length, 'Leavers holding assets / IDs', '#/lifecycle');
    } catch (e) { /* never break boot */ }
    const pop = document.createElement('div'); pop.id = 'bellpop';
    pop.innerHTML = `<div class="bphead">Notifications<small>${rows.length ? rows.length + ' need attention' : 'up to date'}</small><span style="margin-left:auto"></span><button class="ibtn x" data-x>${ic('x')}</button></div><div class="bpbody">${rows.join('') || '<div class="empty"><b>All clear</b>Nothing needs attention.</div>'}</div>`;
    document.body.appendChild(pop);
    pop.addEventListener('click', (e) => { if (e.target.closest('[data-x]') || e.target.closest('[data-go]')) closeBell(); });
  }
  document.addEventListener('mousedown', (e) => { const p = document.getElementById('bellpop'); if (p && !p.contains(e.target) && !(e.target.closest && e.target.closest('#bell'))) closeBell(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeBell(); });
  window.addEventListener('hashchange', closeBell);

  function boot() {
    S.init();
    try { Object.keys(navState).forEach((k) => { if (k !== '_last') delete navState[k]; }); saveNav(); } catch (e) { /* start collapsed */ }
    document.getElementById('sinput').addEventListener('input', (e) => { const r = document.getElementById('sres'); const h = search(e.target.value); r.innerHTML = h; r.style.display = h ? '' : 'none'; });
    document.getElementById('sres').addEventListener('click', () => { document.getElementById('sres').style.display = 'none'; document.getElementById('sinput').value = ''; });
    document.getElementById('today').textContent = UI.fmtDate(L.today());
    window.addEventListener('hashchange', route); route();
  }
  document.addEventListener('DOMContentLoaded', boot);
})();

/* ITMS app shell: router, sidebar, delegated events, global search */
(function () {
  const ITMS = window.ITMS; const L = ITMS.logic; const UI = ITMS.ui; const S = ITMS.store;
  const { esc, icon: ic } = UI;
  ITMS.nav = { page: 'dashboard', params: {}, fresh: true };
  const ORDER = ['dashboard', 'lifecycle', 'integrations', 'itsm', 'requests', 'itil', 'projects', 'kb', 'itsmadmin', 'employees', 'vendors', 'masters', 'requests', 'orders', 'hardware', 'movements', 'software', 'consumables', 'amc', 'settings'];

  function badges() {
    const d = S.db; const s = L.stats(); const a = s.alerts; const b = {};
    let openLines = 0; d.prs.forEach((p) => { if (p.status !== 'Cancelled') p.lines.forEach((l) => { if (L.prRemaining(p.prNo, l.line, l.qty) > 0) openLines++; }); });
    if (openLines) b.requests = [openLines, 2];
    const act = d.pos.filter((p) => p.approval === 'Draft' || (p.approval === 'Approved' && L.poReceipt(p) !== 'Received')).length; if (act) b.orders = [act, 2];
    const sw = a.sw30.length + a.swExpired.length; if (sw) b.software = [sw, 1];
    const am = a.amc30.length + a.amcExpired.length; if (am) b.amc = [am, 1];
    if (a.lowStock.length) b.consumables = [a.lowStock.length, 1];
    if (ITMS.hdOverdue) { const n = ITMS.hdOverdue(); if (n) b.requests = [n, 1]; }
    if (ITMS.pendingOffboarding) { const n = ITMS.pendingOffboarding().length; if (n) b.lifecycle = [n, 2]; }
    if (a.spare.length === 0 && d.hw.length) b.hardware = ['!', 1];
    return b;
  }
  function renderNav() {
    const b = badges(); let last = ''; let h = '';
    ORDER.forEach((id) => {
      const p = ITMS.pages[id]; if (p.group !== last) { h += `<h6>${p.group}</h6>`; last = p.group; }
      h += `<a data-nav="${id}" class="${ITMS.nav.page === id ? 'on' : ''}" style="--c:${p.color}"><span class="ni">${ic(p.icon)}</span>${p.title}${b[id] ? `<span class="bd ${b[id][1] === 2 ? 'b2' : ''}">${b[id][0]}</span>` : ''}</a>`;
    });
    document.getElementById('nav').innerHTML = h;
    const total = Object.keys(b).reduce((s, k) => s + (typeof b[k][0] === 'number' ? b[k][0] : 0), 0);
    const bell = document.getElementById('bellN'); if (bell) { bell.textContent = total; bell.style.display = total ? '' : 'none'; }
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
    document.getElementById('ptitle').textContent = page.title; document.getElementById('pcrumb').textContent = page.crumb;
    document.title = page.title + ' · ITMS'; renderNav();
    if (page.after) page.after();
    if (nav.fresh) { view.scrollTop = 0; countUp(); } else view.scrollTop = sc;
    nav.fresh = false; first = false;
  }
  function route() {
    const h = location.hash.replace(/^#\/?/, ''); const [p, q] = h.split('?'); ITMS.nav.page = ITMS.pages[p] ? p : 'dashboard';
    ITMS.nav.params = {}; if (q) q.split('&').forEach((kv) => { const [k, v] = kv.split('='); ITMS.nav.params[k] = decodeURIComponent(v || ''); });
    ITMS.nav.fresh = true; document.querySelector('.side').classList.remove('open'); render();
  }
  let rt = null; S.subscribe(() => { clearTimeout(rt); rt = setTimeout(render, 30); });

  /* ---- delegated events ---- */
  document.addEventListener('click', (e) => {
    const t = e.target;
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
    if (t.closest('#bell')) { location.hash = '#/dashboard'; }
    if (!t.closest('.search')) document.getElementById('sres').style.display = 'none';
  });
  document.addEventListener('input', (e) => {
    const q = e.target.dataset && e.target.dataset.tq; if (q) { const st = UI.tbl[q].st; st.q = e.target.value; st.page = 1; UI.redrawTable(q); }
  });
  document.addEventListener('change', (e) => {
    const id = e.target.dataset && e.target.dataset.tf; if (id) { const st = UI.tbl[id].st; st.f[e.target.dataset.k] = e.target.value; st.page = 1; UI.redrawTable(id); }
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
  function boot() {
    S.init();
    document.getElementById('sinput').addEventListener('input', (e) => { const r = document.getElementById('sres'); const h = search(e.target.value); r.innerHTML = h; r.style.display = h ? '' : 'none'; });
    document.getElementById('sres').addEventListener('click', () => { document.getElementById('sres').style.display = 'none'; document.getElementById('sinput').value = ''; });
    document.getElementById('today').textContent = UI.fmtDate(L.today());
    window.addEventListener('hashchange', route); route();
  }
  document.addEventListener('DOMContentLoaded', boot);
})();

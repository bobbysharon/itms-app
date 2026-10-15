/* ITMS UI kit: icons, tables, forms, modals, toasts, 3D-style SVG charts, print docs */
(function () {
  const ITMS = window.ITMS;
  const L = ITMS.logic;
  const UI = (ITMS.ui = { tbl: {}, acts: {}, tab: {} });

  /* ---------- helpers ---------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmtDate = (s) => { if (!s) return ''; const [y, m, d] = String(s).slice(0, 10).split('-'); return `${d}-${MON[+m - 1]}-${y}`; };
  const fmtNum = (n, d = 0) => (n == null || n === '' ? '' : Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }));
  const money = (n, cur) => (n == null || n === '' ? '' : (cur ? cur + ' ' : '') + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  Object.assign(UI, { esc, fmtDate, fmtNum, money });

  const PILL = {
    'In Use': 'blue', 'In Stock': 'mint', 'Under Repair': 'amber', Disposed: 'coral', Approved: 'mint', Draft: 'violet', Pending: 'amber', Paid: 'mint', Invoiced: 'blue', Received: 'mint', Partial: 'amber', Open: 'blue',
    Ordered: 'mint', 'Partially Ordered': 'amber', Cancelled: 'grey', Rejected: 'coral', Active: 'mint', Inactive: 'grey', Left: 'coral', Expired: 'coral', Compliant: 'mint', 'Non-Compliant': 'coral', Yes: 'coral', No: 'mint',
    New: 'cyan', Good: 'mint', Fair: 'amber', Average: 'amber', Poor: 'coral', Issue: 'blue', Return: 'mint', Transfer: 'violet', Status: 'grey', Renewal: 'amber', Closed: 'grey', Terminated: 'coral', Low: 'coral', OK: 'mint', Expiring: 'amber',
  };
  const pill = (t, cls) => (t === '' || t == null ? '' : `<span class="pill p-${cls || PILL[t] || 'violet'}">${esc(t)}</span>`);
  UI.pill = pill;

  /* ---------- icons ---------- */
  const P = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><circle cx="17.5" cy="9" r="2.6"/><path d="M17 14.6c2.4.1 4 1.6 4.5 4.4"/>',
    truck: '<path d="M2 6h11v10H2zM13 9h4.5L21 12.5V16h-8"/><circle cx="7" cy="17.5" r="2"/><circle cx="17" cy="17.5" r="2"/>',
    filePlus: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 11v6M9 14h6"/>',
    cart: '<path d="M3 4h2.5l2 11h10l2-8H7"/><circle cx="9" cy="19" r="1.6"/><circle cx="17" cy="19" r="1.6"/>',
    laptop: '<rect x="4" y="5" width="16" height="11" rx="2"/><path d="M2 19h20"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3M14 9l2 2"/>',
    shield: '<path d="M12 3l8 3v5.5c0 4.6-3.2 8.3-8 9.5-4.8-1.2-8-4.9-8-9.5V6z"/><path d="M8.5 12l2.5 2.5L16 9.5"/>',
    box: '<path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5L12 12l8.5-4.5M12 12v9"/>',
    swap: '<path d="M4 8h14M14 4l4 4-4 4"/><path d="M20 16H6M10 12l-4 4 4 4"/>',
    cog: '<circle cx="12" cy="12" r="3"/><path d="M19.4 14a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V20a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H4a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H10a1.7 1.7 0 0 0 1-1.5V4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V10a1.7 1.7 0 0 0 1.5 1H20a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>', bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z"/><path d="M10 21a2 2 0 0 0 4 0"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>', trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
    print: '<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3"/><rect x="7" y="14" width="10" height="7" rx="1"/>', eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', download: '<path d="M12 4v11M7.5 11L12 15.5 16.5 11M4 20h16"/>', upload: '<path d="M12 16V5M7.5 9L12 4.5 16.5 9M4 20h16"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>', link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', refresh: '<path d="M20 11a8 8 0 0 0-14.5-4M4 4v4h4M4 13a8 8 0 0 0 14.5 4M20 20v-4h-4"/>', alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.1"/>',
    cal: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>', wrench: '<path d="M14.5 6.5a4 4 0 0 0 5 5L13 18l-3-3 6.5-6.5zM10 15l-5.5 5.5"/>', trend: '<path d="M3 17l6-6 4 4 8-9"/><path d="M15 6h6v6"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>', cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>', undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', dollar: '<path d="M12 3v18M16 7.5c-.5-1.5-2-2.5-4-2.5-2.3 0-4 1.2-4 3s1.5 2.5 4 3 4 1.2 4 3-1.7 3-4 3c-2 0-3.6-1-4-2.5"/>',
  };
  UI.icon = (n, cls) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" class="${cls || ''}">${P[n] || ''}</svg>`;
  const ic = UI.icon;

  /* ---------- modal / toast / confirm ---------- */
  const stack = [];
  UI.modal = function (html, o) {
    o = o || {};
    const ov = document.createElement('div'); ov.className = 'ov';
    ov.innerHTML = `<div class="modal ${o.size || ''}" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(ov); stack.push(ov);
    ov.addEventListener('mousedown', (e) => { if (e.target === ov && !o.sticky) UI.close(ov); });
    ov._onClose = o.onClose; return ov;
  };
  UI.close = function (ov) { ov = ov || stack[stack.length - 1]; if (!ov) return; const i = stack.indexOf(ov); if (i >= 0) stack.splice(i, 1); ov.remove(); if (ov._onClose) ov._onClose(); };
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && stack.length) UI.close(); });
  UI.toast = function (msg, kind) {
    let box = document.getElementById('toasts'); if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
    const t = document.createElement('div'); t.className = 'toast ' + (kind || 'ok'); t.innerHTML = esc(msg); box.appendChild(t);
    setTimeout(() => { t.style.transition = '.4s'; t.style.opacity = 0; t.style.transform = 'translateX(30px)'; setTimeout(() => t.remove(), 400); }, kind === 'err' ? 6000 : 3200);
  };
  UI.confirm = function (msg, okText, danger) {
    return new Promise((res) => {
      const ov = UI.modal(`<header><div><h3>Please confirm</h3></div></header><div class="body">${msg}</div><footer><button class="btn ghost" data-r="0">Cancel</button><button class="btn ${danger ? 'hot' : ''}" data-r="1">${esc(okText || 'Confirm')}</button></footer>`, { size: 'sm', sticky: true });
      ov.addEventListener('click', (e) => { const b = e.target.closest('[data-r]'); if (b) { UI.close(ov); res(b.dataset.r === '1'); } });
    });
  };
  UI.run = function (fn, okMsg) { try { const r = fn(); if (okMsg) UI.toast(okMsg); return r === undefined ? true : r; } catch (e) { UI.toast(e.message || String(e), 'err'); return false; } };

  /* ---------- generic table ---------- */
  UI.table = function (def) {
    const prev = UI.tbl[def.id]; const st = prev ? prev.st : { q: '', sort: def.sort || null, dir: def.dir || 1, page: 1, f: {} };
    UI.tbl[def.id] = { def, st };
    const filters = (def.filters || []).map((f) => `<select class="in" data-tf="${def.id}" data-k="${f.k}"><option value="">${esc(f.label)}: All</option>${(typeof f.options === 'function' ? f.options() : f.options).map((o) => `<option ${st.f[f.k] === String(o) ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`).join('');
    return `<div class="tbar"><div class="qs">${ic('search')}<input class="in" placeholder="Search…" value="${esc(st.q)}" data-tq="${def.id}"></div>${filters}<span class="grow"></span>${def.toolbar || ''}<button class="btn ghost sm" data-act="csv" data-id="${def.id}">${ic('download')}CSV</button></div><div id="tb-${def.id}">${UI.tableBody(def.id)}</div>`;
  };
  function filtered(id) {
    const { def, st } = UI.tbl[id]; let rows = def.rows();
    (def.filters || []).forEach((f) => { const v = st.f[f.k]; if (v) rows = rows.filter((r) => String(f.get ? f.get(r) : r[f.k]) === v); });
    if (st.q) { const q = st.q.toLowerCase(); rows = rows.filter((r) => (def.text ? def.text(r) : JSON.stringify(r)).toLowerCase().includes(q)); }
    if (st.sort) { const c = def.cols.find((x) => x.k === st.sort); if (c) { const g = c.val || ((r) => r[c.k]); rows = rows.slice().sort((a, b) => { let x = g(a), y = g(b); if (x == null) x = ''; if (y == null) y = ''; return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * st.dir; }); } }
    return rows;
  }
  UI.tableBody = function (id) {
    const { def, st } = UI.tbl[id]; const rows = filtered(id); const ps = def.pageSize || 15; const pages = Math.max(1, Math.ceil(rows.length / ps)); if (st.page > pages) st.page = pages;
    const slice = rows.slice((st.page - 1) * ps, st.page * ps);
    const th = def.cols.map((c) => `<th class="${c.num ? 'num' : ''} ${c.nosort ? 'nosort' : ''}" ${c.nosort ? '' : `data-ts="${id}" data-k="${c.k}"`}>${esc(c.label)}${st.sort === c.k ? `<span class="ar">${st.dir > 0 ? '▲' : '▼'}</span>` : ''}</th>`).join('') + (def.actions ? '<th class="nosort"></th>' : '');
    const body = slice.map((r) => `<tr>${def.cols.map((c) => `<td class="${c.num ? 'num' : ''} ${c.mono ? 'mono' : ''}">${c.render ? c.render(r) : esc(r[c.k] == null ? '' : r[c.k])}</td>`).join('')}${def.actions ? `<td class="act"><div class="row-actions">${def.actions(r)}</div></td>` : ''}</tr>`).join('');
    const foot = def.foot ? `<tfoot>${def.foot(rows)}</tfoot>` : '';
    let pg = '';
    if (pages > 1) { const a = []; for (let i = 1; i <= pages; i++) if (i === 1 || i === pages || Math.abs(i - st.page) <= 2) a.push(i); let last = 0; pg = `<button data-tp="${id}" data-p="${st.page - 1}" ${st.page === 1 ? 'disabled' : ''}>‹</button>` + a.map((i) => { const s = (i - last > 1 ? '<span>…</span>' : '') + `<button data-tp="${id}" data-p="${i}" class="${i === st.page ? 'on' : ''}">${i}</button>`; last = i; return s; }).join('') + `<button data-tp="${id}" data-p="${st.page + 1}" ${st.page === pages ? 'disabled' : ''}>›</button>`; }
    return `<div class="twrap"><table class="t"><thead><tr>${th}</tr></thead><tbody>${body || ''}</tbody>${foot}</table>${rows.length ? '' : `<div class="empty"><b>${esc(def.emptyTitle || 'Nothing here yet')}</b>${esc(def.empty || 'No records match.')}</div>`}</div><div class="pager"><span>${rows.length} record${rows.length === 1 ? '' : 's'}</span><div class="pg">${pg}</div></div>`;
  };
  UI.redrawTable = (id) => { const el = document.getElementById('tb-' + id); if (el) el.innerHTML = UI.tableBody(id); };
  UI.csv = function (id) {
    const { def } = UI.tbl[id]; const rows = filtered(id); const cols = def.cols.filter((c) => !c.nocsv);
    const cell = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const txt = (c, r) => (c.csv ? c.csv(r) : c.val ? c.val(r) : r[c.k]);
    const out = [cols.map((c) => cell(c.label)).join(',')].concat(rows.map((r) => cols.map((c) => cell(txt(c, r))).join(','))).join('\n');
    UI.download(id + '.csv', '﻿' + out, 'text/csv');
  };
  UI.download = function (name, content, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], { type: type || 'text/plain' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); };

  /* ---------- generic form ---------- */
  function optsOf(f, vals) { const o = typeof f.options === 'function' ? f.options(vals) : f.options || []; return o.map((x) => (typeof x === 'object' ? x : { v: x, l: x })); }
  function fieldHtml(f, vals) {
    if (f.section) return `<div class="sec">${esc(f.section)}</div>`;
    const v = vals[f.k] == null ? '' : vals[f.k]; const req = f.req ? '<span class="req">*</span>' : ''; const cls = 'f' + (f.full ? ' full' : '');
    const lab = `${esc(f.label)} ${req}${f.hint ? ` <small>${esc(f.hint)}</small>` : ''}`;
    if (f.type === 'select') { const os = optsOf(f, vals); return `<label class="${cls}">${lab}<select class="in" name="${f.k}" ${f.ro ? 'disabled' : ''}>${f.blank === false ? '' : '<option value="">—</option>'}${os.map((o) => `<option value="${esc(o.v)}" ${String(o.v) === String(v) ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select></label>`; }
    if (f.type === 'textarea') return `<label class="${cls}">${lab}<textarea class="in" name="${f.k}" ${f.ro ? 'readonly' : ''}>${esc(v)}</textarea></label>`;
    if (f.type === 'multi') { const os = optsOf(f, vals); const sel = new Set(vals[f.k] || []); return `<div class="${cls}" style="display:flex;flex-direction:column;gap:5px"><span style="font-size:11.5px;font-weight:650;color:var(--ink2)">${lab}</span><input class="in" placeholder="Filter list…" data-mf="${f.k}"><div class="pick" data-multi="${f.k}">${os.map((o) => `<label class="chk" data-t="${esc(o.l.toLowerCase())}"><input type="checkbox" value="${esc(o.v)}" ${sel.has(o.v) ? 'checked' : ''}>${esc(o.l)}</label>`).join('') || '<div class="empty">No options</div>'}</div></div>`; }
    return `<label class="${cls}">${lab}<input class="in" name="${f.k}" type="${f.type || 'text'}" value="${esc(v)}" ${f.step ? `step="${f.step}"` : ''} ${f.min != null ? `min="${f.min}"` : ''} ${f.ro ? 'readonly' : ''} placeholder="${esc(f.ph || '')}"></label>`;
  }
  UI.form = function (o) {
    const vals = Object.assign({}, o.values || {});
    const ov = UI.modal(`<header><span class="gem" style="width:38px;height:38px;border-radius:13px">${ic(o.icon || 'edit')}</span><div><h3>${esc(o.title)}</h3>${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</div><button class="ibtn x" data-x>${ic('x')}</button></header><form><div class="body">${o.intro ? `<div class="note-box">${o.intro}</div>` : ''}<div class="fgrid ${o.cols === 3 ? 'c3' : ''}" id="ff">${o.fields.map((f) => fieldHtml(f, vals)).join('')}</div>${o.extra || ''}</div><footer>${o.note ? `<span class="note">${o.note}</span>` : ''}<button type="button" class="btn ghost" data-x>Cancel</button><button class="btn ${o.btnClass || ''}" type="submit">${ic(o.btnIcon || 'check')}${esc(o.submit || 'Save')}</button></footer></form>`, { size: o.size || 'md', sticky: true });
    const form = ov.querySelector('form');
    const read = () => { const out = Object.assign({}, vals); o.fields.forEach((f) => { if (f.section) return; if (f.type === 'multi') out[f.k] = [...form.querySelectorAll(`[data-multi="${f.k}"] input:checked`)].map((i) => i.value); else { const el = form.elements[f.k]; if (el) out[f.k] = f.type === 'number' ? el.value : el.value; } }); return out; };
    const api = {
      set(k, v) { const el = form.elements[k]; if (el) el.value = v; vals[k] = v; },
      get: read, form, ov,
      refresh() { const cur = read(); o.fields.forEach((f) => { if (f.type === 'select' && typeof f.options === 'function') { const el = form.elements[f.k]; const old = cur[f.k]; el.innerHTML = (f.blank === false ? '' : '<option value="">—</option>') + optsOf(f, cur).map((x) => `<option value="${esc(x.v)}">${esc(x.l)}</option>`).join(''); el.value = optsOf(f, cur).some((x) => String(x.v) === String(old)) ? old : (f.blank === false && el.options[0] ? el.options[0].value : ''); } }); },
    };
    form.addEventListener('change', (e) => { const n = e.target.name; if (!n) return; const cur = read(); Object.assign(vals, cur); if (o.deps && o.deps[n]) { api.refresh(); } if (o.onChange) o.onChange(read(), api, n); });
    form.addEventListener('input', (e) => { if (o.onInput) o.onInput(read(), api, e.target.name); });
    ov.addEventListener('input', (e) => { const mf = e.target.dataset.mf; if (mf) { const q = e.target.value.toLowerCase(); ov.querySelectorAll(`[data-multi="${mf}"] .chk`).forEach((c) => (c.style.display = c.dataset.t.includes(q) ? '' : 'none')); } });
    ov.addEventListener('click', (e) => { if (e.target.closest('[data-x]')) UI.close(ov); });
    form.addEventListener('submit', (e) => {
      e.preventDefault(); const v = read();
      for (const f of o.fields) if (f.req && !f.section && (v[f.k] == null || v[f.k] === '' || (Array.isArray(v[f.k]) && !v[f.k].length))) { UI.toast(`${f.label} is required`, 'err'); const el = form.elements[f.k]; if (el && el.focus) el.focus(); return; }
      try { const r = o.onSubmit(v, api); if (r !== false) UI.close(ov); } catch (err) { UI.toast(err.message || String(err), 'err'); }
    });
    if (o.onOpen) o.onOpen(api);
    const first = form.querySelector('input:not([readonly]),select'); if (first) setTimeout(() => first.focus(), 60);
    return api;
  };

  /* ---------- print / document preview ---------- */
  UI.doc = function (title, html) {
    const ov = UI.modal(`<header><span class="gem" style="width:38px;height:38px;border-radius:13px">${ic('print')}</span><div><h3>${esc(title)}</h3><small>Print-ready form — use Print → Save as PDF if needed</small></div><button class="btn sm" data-print style="margin-left:auto">${ic('print')}Print</button><button class="ibtn" data-x>${ic('x')}</button></header><div class="body" style="padding:0;background:#e9ecfb"><div class="doc" style="max-width:820px;margin:16px auto;box-shadow:0 20px 50px -20px rgba(0,0,0,.4)">${html}</div></div>`, { size: 'xl' });
    ov.addEventListener('click', (e) => { if (e.target.closest('[data-x]')) UI.close(ov); if (e.target.closest('[data-print]')) { let r = document.getElementById('print-root'); if (!r) { r = document.createElement('div'); r.id = 'print-root'; document.body.appendChild(r); } r.innerHTML = `<div class="doc">${html}</div>`; window.print(); } });
  };
  UI.docHead = function (title) {
    const c = ITMS.store.db.company;
    return `<div class="dh"><div class="logo">${c.logo ? `<img src="${c.logo}">` : 'LOGO'}</div><div style="flex:1"><h1>${esc(c.name)}</h1><div class="co">${esc(c.address)}</div></div><h2>${esc(title)}</h2></div>`;
  };
  const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  function words(n) { if (n < 20) return ONES[n]; if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : ''); if (n < 1000) return ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + words(n % 100) : ''); for (const [d, w] of [[1e9, 'Billion'], [1e6, 'Million'], [1e3, 'Thousand']]) if (n >= d) return words(Math.floor(n / d)) + ' ' + w + (n % d ? ' ' + words(n % d) : ''); return ''; }
  UI.amountWords = function (amt, cur) {
    const major = Math.floor(amt + 1e-9); const minor = Math.round((amt - major) * 100); const names = { AED: ['Dirhams', 'Fils'], USD: ['Dollars', 'Cents'], EUR: ['Euros', 'Cents'], GBP: ['Pounds', 'Pence'], SAR: ['Riyals', 'Halalas'], INR: ['Rupees', 'Paise'] }[cur] || [cur, 'Subunits'];
    return (words(major) || 'Zero') + ' ' + names[0] + (minor ? ' and ' + words(minor) + ' ' + names[1] : '') + ' Only';
  };

  /* ---------- charts (inline SVG, 3D-ish) ---------- */
  const PAL = ['#2f6bff', '#00a8e8', '#1d4ed8', '#00c2ff', '#3b82f6', '#10d9a0', '#ffb020', '#ff5c6c'];
  UI.PAL = PAL;
  let cid = 0;
  const shade = (hex, p) => { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; const f = (c) => Math.max(0, Math.min(255, Math.round(c + (p < 0 ? c * p : (255 - c) * p)))); return '#' + ((1 << 24) | (f(r) << 16) | (f(g) << 8) | f(b)).toString(16).slice(1); };
  UI.shade = shade;
  UI.donut = function (items, o) {
    o = o || {}; const id = 'd' + ++cid; const S = o.size || 230, R = S * 0.36, r = S * 0.215, cx = S / 2, cy = S / 2 - 6; const tot = items.reduce((s, x) => s + x.value, 0) || 1;
    let a0 = -Math.PI / 2; const arcs = (dy, dark) => items.map((it, i) => {
      if (!it.value) return ''; const c = it.color || PAL[i % PAL.length]; let a1 = a0 + (it.value / tot) * Math.PI * 2; if (it.value === tot) a1 -= 0.0001;
      const p = (rad, a) => [cx + rad * Math.cos(a), cy + dy + rad * Math.sin(a)]; const [x1, y1] = p(R, a0), [x2, y2] = p(R, a1), [x3, y3] = p(r, a1), [x4, y4] = p(r, a0); const lg = a1 - a0 > Math.PI ? 1 : 0;
      const d = `M${x1} ${y1} A${R} ${R} 0 ${lg} 1 ${x2} ${y2} L${x3} ${y3} A${r} ${r} 0 ${lg} 0 ${x4} ${y4}Z`; const m = a0; a0 = a1;
      return `<path d="${d}" fill="${dark ? shade(c, -0.38) : `url(#${id}g${i})`}" ${dark ? '' : `class="seg" data-i="${i}" stroke="#fff" stroke-width="2.5" style="filter:drop-shadow(0 0 7px ${c}88)"`}><title>${esc(it.label)}: ${it.value}</title></path>`;
    }).join('');
    const defs = items.map((it, i) => { const c = it.color || PAL[i % PAL.length]; return `<linearGradient id="${id}g${i}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${shade(c, .35)}"/><stop offset="1" stop-color="${c}"/></linearGradient>`; }).join('');
    const a = arcs(0); a0 = -Math.PI / 2; const sh = [10, 7, 4].map((d) => arcs(d, true)); // layered extrusion
    a0 = -Math.PI / 2; const top = arcs(0);
    return `<svg viewBox="0 0 ${S} ${S + 12}" width="100%" style="max-width:${S}px;display:block;margin:auto"><defs>${defs}<radialGradient id="${id}h" cx=".35" cy=".25"><stop offset="0" stop-color="#fff" stop-opacity=".7"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><ellipse cx="${cx}" cy="${S - 4}" rx="${R * 0.95}" ry="${R * 0.16}" fill="rgba(60,40,180,.18)" style="filter:blur(6px)"/>${sh.join('')}${top}<circle cx="${cx}" cy="${cy}" r="${r - 2}" fill="#fff" opacity=".96"/><circle cx="${cx}" cy="${cy}" r="${r - 2}" fill="url(#${id}h)"/><text x="${cx}" y="${cy + 2}" text-anchor="middle" font-size="${S * 0.15}" font-weight="700" fill="#181c3a" font-family="Space Grotesk, Inter, sans-serif">${esc(o.big != null ? o.big : tot)}</text><text x="${cx}" y="${cy + S * 0.075 + 6}" text-anchor="middle" font-size="${S * 0.052}" fill="#7077a1" font-weight="600">${esc(o.small || 'Total')}</text></svg>` + UI.legend(items);
  };
  UI.legend = (items) => `<div class="legend">${items.map((it, i) => `<span><i style="--c:${it.color || PAL[i % PAL.length]}"></i>${esc(it.label)} <b>${it.value}</b></span>`).join('')}</div>`;
  UI.bars3d = function (items, o) {
    o = o || {}; const id = 'b' + ++cid; const W = o.w || 560, H = o.h || 250, pl = 34, pb = 54, pt = 18, n = items.length || 1; const max = Math.max(1, ...items.map((i) => i.value)) * 1.12; const bw = Math.min(46, ((W - pl - 10) / n) * 0.52), gap = (W - pl - 10) / n, d = Math.min(11, bw * 0.34);
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => { const y = pt + (H - pb - pt) * (1 - t); return `<line x1="${pl}" x2="${W}" y1="${y}" y2="${y}" stroke="#2f6bff" stroke-opacity=".1"/><text x="${pl - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="#9aa0c6">${Math.round(max * t)}</text>`; }).join('');
    const bars = items.map((it, i) => {
      const c = it.color || PAL[i % PAL.length]; const h = Math.max(it.value ? 4 : 0, (it.value / max) * (H - pb - pt)); const x = pl + i * gap + (gap - bw) / 2 - d / 2, y = H - pb - h;
      return `<g class="bar3" style="cursor:${it.href ? 'pointer' : 'default'}" ${it.href ? `data-go="${it.href}"` : ''}><defs><linearGradient id="${id}f${i}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${shade(c, .3)}"/><stop offset="1" stop-color="${c}"/></linearGradient></defs>
      <rect x="${x}" y="${y}" width="${bw}" height="${h}" fill="url(#${id}f${i})" style="filter:drop-shadow(0 6px 8px ${c}55)"/><polygon points="${x},${y} ${x + d},${y - d} ${x + bw + d},${y - d} ${x + bw},${y}" fill="${shade(c, .55)}"/><polygon points="${x + bw},${y} ${x + bw + d},${y - d} ${x + bw + d},${y + h - d} ${x + bw},${y + h}" fill="${shade(c, -.28)}"/>
      <text x="${x + bw / 2 + d / 2}" y="${y - d - 5}" text-anchor="middle" font-size="11" font-weight="700" fill="#3a4170">${it.value}</text>
      <text x="${x + bw / 2}" y="${H - pb + 16}" text-anchor="end" font-size="10.5" fill="#5a6190" transform="rotate(-32 ${x + bw / 2} ${H - pb + 16})">${esc(it.label.replace('_', ' '))}</text><title>${esc(it.label)}: ${it.value}</title></g>`;
    }).join('');
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block">${ticks}${bars}</svg>`;
  };
  UI.stackBars = function (rows, keys, colors) {
    // rows: [{label, vals:{k:n}, total}] horizontal stacked glossy bars
    const max = Math.max(1, ...rows.map((r) => r.total));
    return rows.map((r) => `<div style="display:grid;grid-template-columns:118px 1fr 34px;gap:10px;align-items:center;margin:7px 0;cursor:pointer" data-go="${r.href || ''}"><span style="font-size:12.5px;font-weight:600;color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.label.replace('_', ' '))}</span><div class="bar3" style="display:flex;width:${Math.max(6, (r.total / max) * 100)}%;background:#ecebfb">${keys.map((k, i) => (r.vals[k] ? `<i style="--c:${colors[i]};width:${(r.vals[k] / r.total) * 100}%;border-radius:0;box-shadow:0 -3px 4px rgba(0,0,0,.14) inset,0 2px 0 rgba(255,255,255,.5) inset" title="${k}: ${r.vals[k]}"></i>` : '')).join('')}</div><b style="font-size:12.5px">${r.total}</b></div>`).join('');
  };
  UI.area = function (items, o) {
    o = o || {}; const id = 'a' + ++cid; const W = 560, H = 210, pl = 44, pb = 30, pt = 14; if (!items.length) return '<div class="empty">No data</div>'; const max = Math.max(1, ...items.map((i) => i.value)) * 1.1; const step = items.length > 1 ? (W - pl - 14) / (items.length - 1) : 0;
    const pts = items.map((it, i) => [pl + i * step + (items.length === 1 ? (W - pl) / 2 : 0), pt + (H - pb - pt) * (1 - it.value / max)]);
    const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' '); const area = line + ` L${pts[pts.length - 1][0]} ${H - pb} L${pts[0][0]} ${H - pb}Z`;
    const grid = [0, .5, 1].map((t) => { const y = pt + (H - pb - pt) * (1 - t); return `<line x1="${pl}" x2="${W}" y1="${y}" y2="${y}" stroke="#2f6bff" stroke-opacity=".12" stroke-dasharray="4 4"/><text x="${pl - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="#9aa0c6">${fmtNum(max * t / (o.div || 1), 0)}${o.suffix || ''}</text>`; }).join('');
    return `<svg viewBox="0 0 ${W} ${H}" width="100%"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f6bff" stop-opacity=".45"/><stop offset="1" stop-color="#00c2ff" stop-opacity="0"/></linearGradient><linearGradient id="${id}l" x1="0" x2="1"><stop offset="0" stop-color="#2f6bff"/><stop offset="1" stop-color="#00c2ff"/></linearGradient></defs>${grid}<path d="${area}" fill="url(#${id})"/><path d="${line}" fill="none" stroke="url(#${id}l)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>${pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="5" fill="#fff" stroke="#2f6bff" stroke-width="3"><title>${items[i].label}: ${money(items[i].value)}</title></circle><text x="${p[0]}" y="${H - 10}" text-anchor="middle" font-size="10" fill="#7077a1">${items[i].label.slice(2)}</text>`).join('')}</svg>`;
  };
  UI.ring = function (pct, color, label) {
    const R = 26, C = 2 * Math.PI * R; const id = 'r' + ++cid; pct = Math.max(0, Math.min(100, pct));
    return `<svg viewBox="0 0 70 70" width="64" height="64"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${shade(color, .3)}"/><stop offset="1" stop-color="${color}"/></linearGradient></defs><circle cx="35" cy="35" r="${R}" fill="none" stroke="#ecebfb" stroke-width="9"/><circle cx="35" cy="35" r="${R}" fill="none" stroke="url(#${id})" stroke-width="9" stroke-linecap="round" stroke-dasharray="${(C * pct) / 100} ${C}" transform="rotate(-90 35 35)" style="filter:drop-shadow(0 0 5px ${color})"/><text x="35" y="39" text-anchor="middle" font-size="13" font-weight="700" fill="#181c3a" font-family="Space Grotesk">${label != null ? label : Math.round(pct) + '%'}</text></svg>`;
  };

  /* ---------- action registry ---------- */
  UI.on = (name, fn) => { UI.acts[name] = fn; };
})();

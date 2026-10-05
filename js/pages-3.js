/* Pages 3: Hardware assets, Asset movements (issue/return/transfer + forms), Software */
(function () {
  const ITMS = window.ITMS; const L = ITMS.logic; const UI = ITMS.ui; const S = ITMS.store;
  const { esc, fmtDate, fmtNum, money, pill, icon: ic } = UI;
  const pages = ITMS.pages; const db = () => S.db;
  const forms = (ITMS.forms = ITMS.forms || {});
  const sel = (name, opts, val, extra) => `<select class="in" name="${name}" ${extra || ''}>${opts.map((o) => { const v = typeof o === 'object' ? o.v : o; const l = typeof o === 'object' ? o.l : o; return `<option value="${esc(v)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}</select>`;
  const pf = (UI.pf = UI.pf || {});
  const P = () => (ITMS.nav && ITMS.nav.params) || {};
  const fresh = () => ITMS.nav && ITMS.nav.fresh;
  const preset = (id, map) => { if (!fresh()) return; const p = P(); const st = (UI.tbl[id] = UI.tbl[id] || { st: { q: '', sort: null, dir: 1, page: 1, f: {} } }).st; st.f = {}; st.q = ''; st.page = 1; Object.keys(map).forEach((k) => { if (p[map[k]]) st.f[k] = p[map[k]]; }); };
  UI.preset = preset;
  const empOpts = (only) => db().employees.filter((e) => (only ? only(e) : e.status === 'Active')).map((e) => ({ v: e.no, l: `${e.name} (${e.no}) — ${e.dept}` }));
  const wd = (d) => (d == null ? null : d);

  /* ===================== HARDWARE ASSETS ===================== */
  const warrantyPill = (a) => { if (!a.warranty) return ''; const d = L.daysTo(a.warranty); return `${fmtDate(a.warranty)} ${d < 0 ? pill('Expired', 'coral') : d <= 30 ? pill(d + 'd', 'amber') : ''}`; };
  pages.hardware = {
    title: 'Hardware Assets', crumb: 'Single asset register — created by goods receipts, issued through movements', icon: 'laptop', color: '#7a4dff', group: 'Inventory',
    render() {
      const d = db(); preset('hw', { type: 'type', status: 'status', condition: 'condition' });
      if (fresh()) pf.hw = { warranty: P().warranty, retention: P().retention };
      const F = pf.hw || {};
      const rows = () => d.hw.filter((a) => (!F.warranty || (F.warranty === 'expiring' ? a.warranty && L.daysTo(a.warranty) >= 0 && L.daysTo(a.warranty) <= 30 && a.status !== 'Disposed' : a.warranty && L.daysTo(a.warranty) < 0 && a.status !== 'Disposed')) && (!F.retention || (a.status !== 'Disposed' && L.usage(a).over)));
      const chips = (F.warranty ? `<span class="pill p-amber">Warranty ${F.warranty}</span>` : '') + (F.retention ? '<span class="pill p-blue">Past retention</span>' : '');
      return `<div class="card">${chips ? `<div style="margin-bottom:10px">${chips} <a class="link" data-go="#/hardware">clear</a></div>` : ''}${UI.table({
        id: 'hw', rows, sort: 'id', text: (a) => [a.id, a.type, a.subtype, a.desc, a.brand, a.model, a.serial, L.empName(a.holder), a.poNo, a.compName, a.ip].join(' '),
        filters: [{ k: 'type', label: 'Type', options: () => d.lists.hwTypes.map((t) => t.type) }, { k: 'status', label: 'Status', options: L.HW_STATUS }, { k: 'condition', label: 'Condition', options: L.CONDITIONS }],
        cols: [
          { k: 'id', label: 'Asset ID', mono: true, render: (a) => `<a class="link" data-act="hw.view" data-id="${a.id}">${a.id}</a>` }, { k: 'type', label: 'Type', render: (a) => esc(a.type.replace('_', ' ')) }, { k: 'subtype', label: 'Subtype' }, { k: 'desc', label: 'Description', render: (a) => `<b>${esc(a.desc)}</b>` },
          { k: 'serial', label: 'Serial', mono: true }, { k: 'status', label: 'Status', render: (a) => pill(a.status) }, { k: 'condition', label: 'Condition', render: (a) => pill(a.condition) },
          { k: 'holder', label: 'Assigned to', val: (a) => L.empName(a.holder), render: (a) => (a.holder ? `<a class="link" data-act="emp.view" data-id="${a.holder}">${esc(L.empName(a.holder))}</a>` : '<span style="color:var(--muted)">—</span>') },
          { k: 'purchaseDate', label: 'Purchased', render: (a) => fmtDate(a.purchaseDate) }, { k: 'warranty', label: 'Warranty', render: warrantyPill, csv: (a) => a.warranty }, { k: 'poNo', label: 'PO', mono: true },
        ],
        actions: (a) => `<button class="ibtn" title="View" data-act="hw.view" data-id="${a.id}">${ic('eye')}</button>${a.status === 'In Stock' ? `<button class="ibtn" style="--c:#2f6bff" title="Issue" data-act="mv.new" data-type="Issue" data-asset="${a.id}">${ic('swap')}</button>` : ''}${a.status === 'In Use' ? `<button class="ibtn" style="--c:#10d9a0" title="Return" data-act="mv.new" data-type="Return" data-emp="${a.holder}" data-asset="${a.id}">${ic('undo')}</button>` : ''}<button class="ibtn" title="Edit" data-act="hw.edit" data-id="${a.id}">${ic('edit')}</button>`,
        toolbar: `<button class="btn ghost" data-act="mv.new" data-type="Issue">${ic('swap')}Issue / Return / Transfer</button><button class="btn" data-act="hw.new">${ic('plus')}Opening asset</button>`,
        empty: 'Receive goods against an approved PO (Purchase Orders → Receive) to create assets, or add an opening asset.',
      })}</div>`;
    },
  };
  const hwFields = (isNew) => [
    { section: 'Identity' }, { k: 'type', label: 'Asset type', type: 'select', options: () => db().lists.hwTypes.map((t) => t.type), req: true, ro: !isNew, blank: false }, { k: 'subtype', label: 'Subtype', type: 'select', options: (v) => (L.typeCfg(v.type) || { subtypes: [] }).subtypes }, { k: 'desc', label: 'Item description', req: true, full: true },
    { k: 'brand', label: 'Brand' }, { k: 'model', label: 'Model' }, { k: 'serial', label: 'Serial number' }, { k: 'condition', label: 'Condition', type: 'select', options: L.CONDITIONS, blank: false },
    { section: 'Purchase & lifecycle' }, { k: 'purchaseDate', label: 'Purchase date', type: 'date' }, { k: 'warranty', label: 'Warranty expiry', type: 'date' }, { k: 'vendor', label: 'Vendor', type: 'select', options: () => db().vendors.map((v) => v.name) }, { k: 'life', label: 'Expected life (years)', type: 'number', step: '1', min: 1 }, { k: 'price', label: 'Unit price', type: 'number', step: '0.01' },
    { section: 'Technical details' }, { k: 'compName', label: 'Computer name' }, { k: 'ip', label: 'IP address' }, { k: 'cpu', label: 'Processor' }, { k: 'ram', label: 'RAM' }, { k: 'hdd', label: 'HDD / SSD' }, { k: 'os', label: 'Operating system' }, { k: 'osDate', label: 'System install date', type: 'date' }, { k: 'screen', label: 'Screen size' },
    { section: 'Maintenance cover (also set via AMC contracts)' }, { k: 'amcStart', label: 'AMC start', type: 'date' }, { k: 'amcEnd', label: 'AMC end', type: 'date' },
  ];
  UI.on('hw.new', () => UI.form({ title: 'Add opening asset', sub: 'For assets that existed before this system — new purchases come in through a GRN', icon: 'laptop', size: 'lg', fields: hwFields(true), deps: { type: 1 }, values: { type: 'Laptop', condition: 'Good', purchaseDate: L.today(), life: 3, price: 0 }, onChange: (v, api, n) => { if (n === 'type') api.set('life', (L.typeCfg(v.type) || {}).retention || 5); }, onSubmit: (v) => { v.life = +v.life || 5; v.price = +v.price || 0; if (!v.warranty && v.purchaseDate) v.warranty = L.addDays(v.purchaseDate, 365); const a = L.saveHW(v); UI.toast(a.id + ' added to stock'); } }));
  UI.on('hw.edit', (el) => { const a = L.hw(el.dataset.id); UI.form({ title: 'Edit ' + a.id, sub: a.desc, icon: 'edit', size: 'lg', fields: hwFields(false), deps: { type: 1 }, values: a, onSubmit: (v) => { v.life = +v.life || 5; v.price = +v.price || 0; L.saveHW(v, a.id); UI.toast('Asset updated'); } }); });
  UI.on('hw.del', async (el) => { if (await UI.confirm(`Delete asset <b>${el.dataset.id}</b> and its history?`, 'Delete', true)) UI.run(() => L.deleteHW(el.dataset.id), 'Asset deleted'); });
  UI.on('hw.state', async (el) => { const { id, st } = el.dataset; const msg = st === 'Disposed' ? 'Dispose of this asset? It will be removed from active inventory (history is kept).' : `Set ${id} to <b>${st}</b>?`; if (await UI.confirm(msg, 'Yes', st === 'Disposed')) UI.run(() => L.setAssetState(id, st), `${id} → ${st}`); });
  UI.on('hw.view', (el) => {
    const a = L.hw(el.dataset.id); const u = L.usage(a); const inst = db().installs.filter((i) => i.hwId === a.id); const mv = db().moves.filter((m) => m.assetId === a.id).sort((x, y) => (y.date + y.id).localeCompare(x.date + x.id)); const amcs = db().amcs.filter((c) => c.assets.includes(a.id));
    const kv = (rows) => `<dl class="kv">${rows.map((r) => `<dt>${r[0]}</dt><dd>${r[1] == null || r[1] === '' ? '<span style="color:var(--muted)">–</span>' : r[1]}</dd>`).join('')}</dl>`;
    const ov = UI.modal(`<header><span class="gem" style="width:48px;height:48px">${ic('laptop')}</span><div><h3>${a.id}</h3><small>${esc(a.desc)} · ${esc(a.type)} / ${esc(a.subtype)}</small></div><span style="margin-left:auto;display:flex;gap:6px">${pill(a.status)}${pill(a.condition)}</span><button class="ibtn" data-x>${ic('x')}</button></header>
    <div class="body"><div class="grid g3">
      <div><h3 style="font:650 13px var(--head);margin:0 0 8px;color:var(--violet)">SPECIFICATION</h3>${kv([['Brand / Model', esc(a.brand + ' ' + a.model)], ['Serial', esc(a.serial)], ['Computer name', esc(a.compName)], ['IP', esc(a.ip)], ['Processor', esc(a.cpu)], ['RAM / HDD', esc([a.ram, a.hdd].filter(Boolean).join(' / '))], ['OS', esc(a.os)], ['OS installed', fmtDate(a.osDate)], ['Screen', esc(a.screen)]])}</div>
      <div><h3 style="font:650 13px var(--head);margin:0 0 8px;color:var(--violet)">PROCUREMENT &amp; COVER</h3>${kv([['Vendor', esc(a.vendor)], ['PO / line', a.poNo ? `<a class="link" data-act="po.view" data-id="${a.poNo}">${a.poNo}</a> · ${a.poLine}` : ''], ['PR ref', esc(a.prRef)], ['GRN', esc(a.grn)], ['Purchased', fmtDate(a.purchaseDate)], ['Unit price', a.price ? money(a.price, a.currency) : ''], ['Warranty', warrantyPill(a)], ['AMC', a.amcEnd ? fmtDate(a.amcStart) + ' → ' + fmtDate(a.amcEnd) : ''], ['AMC contract', amcs.map((c) => c.id).join(', ')]])}</div>
      <div><h3 style="font:650 13px var(--head);margin:0 0 8px;color:var(--violet)">CUSTODY &amp; LIFECYCLE</h3>${kv([['Assigned to', a.holder ? `<a class="link" data-act="emp.view" data-id="${a.holder}">${esc(L.empName(a.holder))}</a>` : ''], ['Issued on', fmtDate(a.issuedDate)], ['Days in service', u.days + ' (' + u.years + ' yrs)'], ['Expected life', u.life + ' yrs'], ['End of life', fmtDate(u.end)], ['Days to replace', u.left], ['Retention period', u.over ? pill('Over', 'coral') : pill('Within', 'mint')]])}</div></div>
    <div class="grid g2 mt"><div><h3 style="font:650 14px var(--head);margin:0 0 8px">Movement history</h3>${mv.length ? `<ul class="timeline">${mv.map((m) => `<li style="--c:${{ Issue: '#2f6bff', Return: '#10d9a0', Transfer: '#ff3d9a', Status: '#ffb020' }[m.type]}"><b>${m.type}</b> ${m.type === 'Issue' ? '→ ' + esc(L.empName(m.to)) : m.type === 'Return' ? '← ' + esc(L.empName(m.from)) + (m.after && m.after !== 'In Stock' ? ' (' + m.after + ')' : '') : m.type === 'Transfer' ? esc(L.empName(m.from)) + ' → ' + esc(L.empName(m.to)) : esc(m.after || m.remarks)}<small>${fmtDate(m.date)} · ${esc(m.doc)}${m.remarks ? ' · ' + esc(m.remarks) : ''}</small></li>`).join('')}</ul>` : '<div class="empty">No movements yet</div>'}</div>
    <div><h3 style="font:650 14px var(--head);margin:0 0 8px">Installed software (${inst.length})</h3>${inst.length ? `<table class="t"><thead><tr><th>Software</th><th>User</th><th>Date</th></tr></thead><tbody>${inst.map((i) => `<tr><td>${esc((L.sw(i.swId) || {}).name)}</td><td>${esc(L.empName(i.empNo))}</td><td>${fmtDate(i.date)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">None</div>'}${['Laptop', 'Desktop', 'Server'].includes(a.type) && a.holder ? `<button class="btn sm ghost mt" data-act="sw.install" data-hw="${a.id}" data-emp="${a.holder}">${ic('plus')}Install software</button>` : ''}</div></div></div>
    <footer>${a.status === 'In Stock' ? `<button class="btn" data-act="mv.new" data-type="Issue" data-asset="${a.id}">${ic('swap')}Issue</button>` : ''}${a.status === 'In Use' ? `<button class="btn mint" data-act="mv.new" data-type="Return" data-emp="${a.holder}" data-asset="${a.id}">${ic('undo')}Return</button><button class="btn" data-act="mv.new" data-type="Transfer" data-emp="${a.holder}" data-asset="${a.id}">${ic('swap')}Transfer</button>` : ''}
    ${a.status !== 'Under Repair' && a.status !== 'Disposed' ? `<button class="btn ghost" data-act="hw.state" data-id="${a.id}" data-st="Under Repair">${ic('wrench')}Send to repair</button>` : ''}${a.status === 'Under Repair' ? `<button class="btn ghost" data-act="hw.state" data-id="${a.id}" data-st="In Stock">Repaired → In Stock</button>` : ''}${a.status !== 'Disposed' ? `<button class="btn ghost" data-act="hw.state" data-id="${a.id}" data-st="Disposed">Dispose</button>` : `<button class="btn ghost" data-act="hw.state" data-id="${a.id}" data-st="In Stock">Reinstate</button>`}
    <button class="btn ghost" data-act="hw.edit" data-id="${a.id}">${ic('edit')}Edit</button><button class="btn hot" data-act="hw.del" data-id="${a.id}">${ic('trash')}</button></footer>`, { size: 'xl' });
    ov.addEventListener('click', (e) => { const x = e.target.closest('[data-act]'); if (e.target.closest('[data-x]') || x) UI.close(ov); });
  });

  /* ===================== MOVEMENTS ===================== */
  function moveDays() {
    const days = {}; const open = {};
    db().moves.filter((m) => m.type !== 'Status').slice().sort((a, b) => (a.date + a.id).localeCompare(b.date + b.id)).forEach((m) => {
      if (m.type === 'Issue') open[m.assetId] = m.date;
      else { if (open[m.assetId]) days[m.id] = Math.max(0, L.diffDays(m.date, open[m.assetId])); open[m.assetId] = m.type === 'Transfer' ? m.date : null; }
    });
    return days;
  }
  pages.movements = {
    title: 'Asset Movements', crumb: 'Issue · Return · Transfer — one workflow that keeps stock, custody and forms in sync', icon: 'swap', color: '#ff3d9a', group: 'Inventory',
    render() {
      const d = db(); const tab = UI.curTab('movements', 'log'); let body;
      const btns = `<button class="btn" data-act="mv.new" data-type="Issue">${ic('swap')}Issue</button><button class="btn mint" data-act="mv.new" data-type="Return">${ic('undo')}Return</button><button class="btn hot" data-act="mv.new" data-type="Transfer">${ic('swap')}Transfer</button>`;
      if (tab === 'log') {
        const dd = moveDays();
        body = UI.table({
          id: 'mv', rows: () => d.moves.filter((m) => m.type !== 'Status' || true), sort: 'date', dir: -1, text: (m) => [m.doc, m.type, m.assetId, (L.hw(m.assetId) || {}).desc, L.empName(m.from), L.empName(m.to)].join(' '),
          filters: [{ k: 'type', label: 'Movement', options: ['Issue', 'Return', 'Transfer', 'Status'] }],
          cols: [
            { k: 'date', label: 'Date', render: (m) => fmtDate(m.date) }, { k: 'doc', label: 'Document', mono: true, render: (m) => (m.type === 'Status' ? esc(m.doc) : `<a class="link" data-act="mv.print" data-doc="${m.doc}">${esc(m.doc)}</a>`) }, { k: 'type', label: 'Movement', render: (m) => pill(m.type) },
            { k: 'assetId', label: 'Asset ID', mono: true, render: (m) => `<a class="link" data-act="hw.view" data-id="${m.assetId}">${m.assetId}</a>` }, { k: 'what', label: 'Asset', val: (m) => (L.hw(m.assetId) || {}).desc, render: (m) => esc((L.hw(m.assetId) || {}).desc || '') },
            { k: 'from', label: 'From', val: (m) => L.empName(m.from), render: (m) => esc(L.empName(m.from)) || '–' }, { k: 'to', label: 'To', val: (m) => L.empName(m.to), render: (m) => esc(L.empName(m.to)) || (m.after ? pill(m.after) : '–') },
            { k: 'cond', label: 'Condition', render: (m) => pill(m.cond) }, { k: 'days', label: 'Days used', num: true, val: (m) => dd[m.id] || 0, render: (m) => (dd[m.id] != null ? dd[m.id] : '') }, { k: 'remarks', label: 'Remarks' },
          ],
          toolbar: btns,
        });
      } else {
        body = UI.table({
          id: 'life', rows: () => d.hw.filter((a) => a.status !== 'Disposed').map((a) => Object.assign({ a }, L.usage(a))), sort: 'left', text: (r) => [r.a.id, r.a.desc, r.a.type].join(' '),
          filters: [{ k: 'ret', label: 'Retention', options: ['Over', 'Within'], get: (r) => (r.over ? 'Over' : 'Within') }, { k: 'type', label: 'Type', options: () => d.lists.hwTypes.map((t) => t.type), get: (r) => r.a.type }],
          cols: [{ k: 'id', label: 'Asset ID', mono: true, val: (r) => r.a.id, render: (r) => `<a class="link" data-act="hw.view" data-id="${r.a.id}">${r.a.id}</a>` }, { k: 'type', label: 'Type', val: (r) => r.a.type, render: (r) => esc(r.a.type) }, { k: 'sub', label: 'Subtype', val: (r) => r.a.subtype, render: (r) => esc(r.a.subtype) }, { k: 'pd', label: 'Purchase date', val: (r) => r.a.purchaseDate, render: (r) => fmtDate(r.a.purchaseDate) },
            { k: 'holder', label: 'Held by', val: (r) => L.empName(r.a.holder), render: (r) => esc(L.empName(r.a.holder)) || '–' }, { k: 'days', label: 'Total days used', num: true }, { k: 'life', label: 'Expected life (yrs)', num: true }, { k: 'years', label: 'Years used', num: true }, { k: 'end', label: 'Asset end date', render: (r) => fmtDate(r.end) }, { k: 'left', label: 'Days to replace', num: true }, { k: 'over', label: 'Retention over?', val: (r) => (r.over ? 1 : 0), render: (r) => pill(r.over ? 'Yes' : 'No') }],
          emptyTitle: 'No active assets',
        });
      }
      return `${UI.tabs('movements', [{ id: 'log', label: 'Movement log', count: d.moves.length }, { id: 'life', label: 'Lifecycle & replacement' }])}<div class="card">${body}</div>`;
    },
  };

  /* ---- movement wizard ---- */
  UI.on('mv.new', (el) => wizard(el && el.dataset ? el.dataset : {}));
  function wizard(o) {
    const st = { type: o.type || 'Issue', emp: o.emp || '', to: '', pick: new Set(o.asset ? [o.asset] : []), date: L.today(), cond: '', after: 'In Stock', remarks: '', q: '', tf: '' };
    if (st.type === 'Issue' && o.emp) st.emp = o.emp;
    const ov = UI.modal('', { size: 'lg', sticky: true }); const box = ov.querySelector('.modal');
    const holders = () => L.uniq(db().hw.filter((a) => a.holder).map((a) => a.holder));
    function assets() {
      if (st.type === 'Issue') return db().hw.filter((a) => a.status === 'In Stock');
      return db().hw.filter((a) => a.holder && a.holder === st.emp);
    }
    function draw() {
      const col = { Issue: '#2f6bff', Return: '#10d9a0', Transfer: '#ff3d9a' }[st.type];
      let list = assets(); const types = L.uniq(list.map((a) => a.type)).sort();
      if (st.tf) list = list.filter((a) => a.type === st.tf); if (st.q) { const q = st.q.toLowerCase(); list = list.filter((a) => (a.id + a.desc + a.serial).toLowerCase().includes(q)); }
      const empSel = st.type === 'Issue' ? empOpts() : empOpts((e) => holders().includes(e.no));
      box.innerHTML = `<header><span class="gem" style="width:44px;height:44px;background:${col}">${ic('swap')}</span><div><h3>Asset ${st.type}</h3><small>${st.type === 'Issue' ? 'In Stock → In Use · only spare assets are listed' : st.type === 'Return' ? 'In Use → back to stock (or repair / disposal)' : 'Move custody from one employee to another'}</small></div><button class="ibtn x" data-x>${ic('x')}</button></header>
      <div class="body"><div class="tabs">${['Issue', 'Return', 'Transfer'].map((t) => `<a data-t="${t}" class="${t === st.type ? 'on' : ''}">${t}</a>`).join('')}</div>
      <div class="fgrid c3"><label class="f">${st.type === 'Issue' ? 'Issue to' : st.type === 'Return' ? 'Returned by' : 'From employee'} *<select class="in" id="we"><option value="">— select employee —</option>${empSel.map((e) => `<option value="${e.v}" ${e.v === st.emp ? 'selected' : ''}>${esc(e.l)}</option>`).join('')}</select></label>
      ${st.type === 'Transfer' ? `<label class="f">To employee *<select class="in" id="wt"><option value="">— select employee —</option>${empOpts((e) => e.status === 'Active' && e.no !== st.emp).map((e) => `<option value="${e.v}" ${e.v === st.to ? 'selected' : ''}>${esc(e.l)}</option>`).join('')}</select></label>` : ''}
      <label class="f">Date<input class="in" type="date" id="wd" value="${st.date}"></label>
      ${st.type === 'Return' ? `<label class="f">Condition on return<select class="in" id="wc"><option value="">(unchanged)</option>${L.CONDITIONS.map((c) => `<option ${c === st.cond ? 'selected' : ''}>${c}</option>`).join('')}</select></label><label class="f">Send to<select class="in" id="wa">${['In Stock', 'Under Repair', 'Disposed'].map((c) => `<option ${c === st.after ? 'selected' : ''}>${c}</option>`).join('')}</select></label>` : ''}
      <label class="f ${st.type === 'Return' ? '' : 'full'}">Remarks<input class="in" id="wr" value="${esc(st.remarks)}" placeholder="optional"></label></div>
      <div class="tbar mt"><div class="qs"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg><input class="in" id="wq" placeholder="Filter assets…" value="${esc(st.q)}"></div><select class="in" id="wtf"><option value="">All types</option>${types.map((t) => `<option ${t === st.tf ? 'selected' : ''}>${t}</option>`).join('')}</select><span class="grow"></span><span class="pill p-violet" id="wc2">${st.pick.size} selected</span></div>
      <div class="pick" style="max-height:260px">${list.length ? list.map((a) => `<label class="chk"><input type="checkbox" value="${a.id}" ${st.pick.has(a.id) ? 'checked' : ''}><span class="mono" style="min-width:118px">${a.id}</span><b>${esc(a.desc)}</b><span style="color:var(--muted);margin-left:auto;font-size:12px">${esc(a.serial)} ${pill(a.condition)}</span></label>`).join('') : `<div class="empty"><b>${st.type === 'Issue' ? 'No spare assets' : st.emp ? 'This employee holds no assets' : 'Select an employee'}</b>${st.type === 'Issue' ? 'Receive goods or return assets first.' : ''}</div>`}</div></div>
      <footer><span class="note">A printable ${st.type === 'Transfer' ? 'transfer' : st.type.toLowerCase()} form opens after you confirm.</span><button class="btn ghost" data-x>Cancel</button><button class="btn" id="wgo" style="background:${col}">${ic('check')}Confirm ${st.type}</button></footer>`;
    }
    draw();
    box.addEventListener('click', (e) => {
      if (e.target.closest('[data-x]')) return UI.close(ov);
      const t = e.target.closest('[data-t]'); if (t) { st.type = t.dataset.t; st.pick = new Set(); st.tf = ''; if (st.type === 'Issue') st.emp = o.emp || ''; else if (!holders().includes(st.emp)) st.emp = ''; draw(); }
      if (e.target.closest('#wgo')) {
        const ids = [...st.pick]; if (!st.emp) return UI.toast('Select an employee', 'err'); if (!ids.length) return UI.toast('Tick at least one asset', 'err');
        const date = box.querySelector('#wd').value; const rem = box.querySelector('#wr').value; let doc;
        try {
          if (st.type === 'Issue') doc = L.issueAssets(st.emp, ids, date, rem);
          else if (st.type === 'Return') doc = L.returnAssets(st.emp, ids, date, box.querySelector('#wc').value, box.querySelector('#wa').value, rem);
          else { if (!st.to) return UI.toast('Select the receiving employee', 'err'); doc = L.transferAssets(st.emp, st.to, ids, date, rem); }
        } catch (err) { return UI.toast(err.message, 'err'); }
        UI.close(ov); UI.toast(`${st.type} ${doc} posted for ${ids.length} asset(s)`); setTimeout(() => forms.moveDoc(doc), 150);
      }
    });
    box.addEventListener('change', (e) => {
      const i = e.target;
      if (i.id === 'we') { st.emp = i.value; st.pick = new Set(); st.tf = ''; draw(); }
      else if (i.id === 'wt') st.to = i.value; else if (i.id === 'wd') st.date = i.value; else if (i.id === 'wc') st.cond = i.value; else if (i.id === 'wa') st.after = i.value; else if (i.id === 'wtf') { st.tf = i.value; draw(); }
      else if (i.type === 'checkbox' && i.value) { i.checked ? st.pick.add(i.value) : st.pick.delete(i.value); box.querySelector('#wc2').textContent = st.pick.size + ' selected'; }
    });
    box.addEventListener('input', (e) => { if (e.target.id === 'wr') st.remarks = e.target.value; if (e.target.id === 'wq') { st.q = e.target.value; const pos = e.target.selectionStart; draw(); const n = box.querySelector('#wq'); n.focus(); n.setSelectionRange(pos, pos); } });
  }

  /* ---- printable forms (Asset Issuance / Return / Transfer) ---- */
  const AGREE = 'I understand that I have received the above listed assets and that they are to be used solely for company-related duties. I also understand that I am responsible for maintaining these assets. I understand that upon end of my employment, I am mandated to return these items to the company. In the absence of this return, the company has the right to withhold my final pay until the return of these assets. By signing this agreement, I acknowledge that I have received these assets from the company in good working condition and I agree to the terms and conditions.';
  function empBlock(e) { return `<div class="meta"><div><b>Emp No:</b>${esc(e.no)}</div><div><b>Date:</b>${fmtDate(L.today())}</div><div><b>Emp name:</b>${esc(e.name)}</div><div><b>Designation:</b>${esc(e.designation)}</div><div><b>Reporting manager:</b>${esc(e.manager)}</div><div><b>Date of joining:</b>${fmtDate(e.doj)}</div><div><b>Department:</b>${esc(e.dept)}</div><div><b>Location:</b>${esc(e.location)}</div><div><b>Email:</b>${esc(e.email)}</div><div><b>Mobile:</b>${esc(e.mobile)}</div><div><b>Telephone ext:</b>${esc(e.ext)}</div></div>`; }
  const assetRows = (ids) => ids.map((id) => L.hw(id)).filter(Boolean).map((a) => `<tr><td>${a.id}</td><td>${esc(a.type)}</td><td>${esc(a.subtype)}</td><td>${esc(a.brand)}</td><td>${esc(a.model)}</td><td>${esc(a.serial)}</td><td>${esc(a.condition)}</td></tr>`).join('');
  const assetTable = (ids) => `<h2 style="margin:12px 0 4px;font-size:13px">Asset description</h2><table><thead><tr><th>Asset ID</th><th>Type</th><th>Subtype</th><th>Brand</th><th>Model</th><th>Serial</th><th>Condition</th></tr></thead><tbody>${assetRows(ids) || '<tr><td colspan="7" style="text-align:center;color:#888">No assets</td></tr>'}</tbody></table>`;
  forms.assetForm = function (kind, empNo) { // on-demand form for everything an employee currently holds
    const e = L.emp(empNo); const ids = db().hw.filter((a) => a.holder === empNo).map((a) => a.id);
    UI.doc(kind === 'Return' ? 'Asset Return Form' : 'Asset Issuance Form', `${UI.docHead(kind === 'Return' ? 'Asset Return Form' : 'Asset Issuance Form')}<p style="margin:0 0 6px;color:#555">${kind === 'Return' ? 'Employee asset return / clearance' : 'New employee IT onboarding form'}</p>${empBlock(e)}${assetTable(ids)}${kind === 'Return' ? '<p class="agree">I confirm that I have returned the above listed assets to the IT department. Condition has been verified at handover.</p>' : `<p class="agree"><b>Asset Agreement:</b> ${AGREE}</p>`}<div class="sig"><div>Employee signature</div><div>IT department</div><div>Line manager</div></div>`);
  };
  forms.moveDoc = function (doc) {
    const ms = db().moves.filter((m) => m.doc === doc); if (!ms.length) return UI.toast('Document not found', 'err'); const m0 = ms[0]; const ids = ms.map((m) => m.assetId);
    if (m0.type === 'Transfer') {
      const f = L.emp(m0.from), t = L.emp(m0.to);
      return UI.doc('Asset Transfer ' + doc, `${UI.docHead('Asset Transfer Form')}<div class="meta"><div><b>Document:</b>${doc}</div><div><b>Date:</b>${fmtDate(m0.date)}</div><div><b>From:</b>${esc(f.name)} (${f.no})</div><div><b>To:</b>${esc(t.name)} (${t.no})</div><div><b>From dept:</b>${esc(f.dept)}</div><div><b>To dept:</b>${esc(t.dept)}</div></div>${assetTable(ids)}<p class="agree">${m0.remarks ? '<b>Remarks:</b> ' + esc(m0.remarks) + '<br>' : ''}The receiving employee acknowledges receipt of the above assets in the stated condition and accepts responsibility for them.</p><div class="sig"><div>Released by</div><div>Received by</div><div>IT department</div></div>`);
    }
    const e = L.emp(m0.type === 'Issue' ? m0.to : m0.from);
    UI.doc((m0.type === 'Issue' ? 'Asset Issuance ' : 'Asset Return ') + doc, `${UI.docHead(m0.type === 'Issue' ? 'Asset Issuance Form' : 'Asset Return Form')}<p style="margin:0 0 6px;color:#555">Document ${doc} · ${fmtDate(m0.date)}</p>${empBlock(e)}${assetTable(ids)}${m0.type === 'Issue' ? `<p class="agree"><b>Asset Agreement:</b> ${AGREE}</p>` : `<p class="agree">I confirm that I have returned the above listed assets to the IT department.${m0.after && m0.after !== 'In Stock' ? ' Assets routed to: <b>' + esc(m0.after) + '</b>.' : ''}</p>`}${m0.remarks ? `<p><b>Remarks:</b> ${esc(m0.remarks)}</p>` : ''}<div class="sig"><div>Employee signature</div><div>IT department</div><div>Line manager</div></div>`);
  };
  UI.on('mv.print', (el) => forms.moveDoc(el.dataset.doc));

  /* ===================== SOFTWARE ===================== */
  const swFields = () => [
    { section: 'Licence' }, { k: 'name', label: 'Software name', req: true }, { k: 'type', label: 'Software type', type: 'select', options: () => db().lists.swTypes.map((t) => t.type), blank: false }, { k: 'subType', label: 'Subscription type', type: 'select', options: () => db().lists.subscriptionTypes }, { k: 'serialNo', label: 'Serial no. / passcode' },
    { section: 'Dates & quantity' }, { k: 'purchaseDate', label: 'Purchase date', type: 'date' }, { k: 'expiry', label: 'Expiry date', type: 'date', hint: '(blank = perpetual)' }, { k: 'qty', label: 'Licence quantity', type: 'number', min: 0, req: true }, { k: 'lastOrder', label: 'Date of last order', type: 'date' },
    { section: 'Commercial' }, { k: 'vendor', label: 'Vendor', type: 'select', options: () => db().vendors.map((v) => v.name) }, { k: 'website', label: 'Website' }, { k: 'unitPrice', label: 'Unit price', type: 'number', step: '0.01' }, { k: 'currency', label: 'Currency', type: 'select', options: ['AED', 'USD', 'EUR', 'GBP', 'SAR', 'INR'], blank: false },
  ];
  const expState = (i) => (i.expired ? 'Expired' : i.expiring ? 'Expiring' : i.days == null ? 'No expiry' : 'OK');
  pages.software = {
    title: 'Software Licences', crumb: 'Licence register and installations — remaining count updates with every install', icon: 'key', color: '#ff3d9a', group: 'Inventory',
    render() {
      const d = db(); const tab = UI.curTab('software', 'lic'); preset('sw', { type: 'type' });
      if (fresh() && P().exp) { UI.tbl.sw.st.f.exp = 'x'; }
      let body;
      if (tab === 'lic') {
        const F = fresh() && P().exp ? true : false; if (fresh()) pf.sw = { exp: !!P().exp };
        body = UI.table({
          id: 'sw', rows: () => d.sw.filter((s) => !(pf.sw || {}).exp || expState(L.swInfo(s)) === 'Expired' || expState(L.swInfo(s)) === 'Expiring'), sort: 'id', text: (s) => [s.id, s.name, s.vendor, s.type].join(' '),
          filters: [{ k: 'type', label: 'Type', options: () => d.lists.swTypes.map((t) => t.type) }, { k: 'subType', label: 'Subscription', options: () => d.lists.subscriptionTypes }, { k: 'state', label: 'Expiry', options: ['Expired', 'Expiring', 'OK', 'No expiry'], get: (s) => expState(L.swInfo(s)) }, { k: 'vendor', label: 'Vendor', options: () => L.uniq(d.sw.map((s) => s.vendor)).sort() }],
          cols: [
            { k: 'id', label: 'Software ID', mono: true, render: (s) => `<a class="link" data-act="sw.view" data-id="${s.id}">${s.id}</a>` }, { k: 'name', label: 'Software', render: (s) => `<b>${esc(s.name)}</b>` }, { k: 'type', label: 'Type' }, { k: 'subType', label: 'Subscription' }, { k: 'purchaseDate', label: 'Purchased', render: (s) => fmtDate(s.purchaseDate) },
            { k: 'expiry', label: 'Expiry', render: (s) => fmtDate(s.expiry) || '<span style="color:var(--muted)">perpetual</span>' }, { k: 'days', label: 'Days left', num: true, val: (s) => { const x = L.swInfo(s).days; return x == null ? 99999 : x; }, render: (s) => { const i = L.swInfo(s); return i.days == null ? '' : i.expired ? pill('Expired', 'coral') : i.expiring ? pill(i.days + ' d', 'amber') : i.days; } },
            { k: 'qty', label: 'Licences', num: true }, { k: 'used', label: 'Used', num: true, val: (s) => L.swInfo(s).used }, { k: 'rem', label: 'Remaining', val: (s) => L.swInfo(s).remaining, render: (s) => { const i = L.swInfo(s); const pc = s.qty ? (i.used / s.qty) * 100 : 0; return `<div style="min-width:90px"><b>${i.remaining}</b><div class="bar3" style="height:7px;margin-top:3px"><i style="--c:${pc > 90 ? '#ff5c6c' : '#7a4dff'};width:${pc}%"></i></div></div>`; } },
            { k: 'vendor', label: 'Vendor' }, { k: 'unitPrice', label: 'Unit price', num: true, render: (s) => fmtNum(s.unitPrice, 2) }, { k: 'value', label: 'Total value', num: true, val: (s) => L.swInfo(s).value, render: (s) => fmtNum(L.swInfo(s).value, 2) },
          ],
          actions: (s) => `<button class="ibtn" style="--c:#10d9a0" title="Install" data-act="sw.install" data-sw="${s.id}">${ic('plus')}</button><button class="ibtn" style="--c:#ffb020" title="Renew" data-act="sw.renew" data-id="${s.id}">${ic('refresh')}</button><button class="ibtn" title="Edit" data-act="sw.edit" data-id="${s.id}">${ic('edit')}</button><button class="ibtn" style="--c:#ff5c6c" title="Delete" data-act="sw.del" data-id="${s.id}">${ic('trash')}</button>`,
          toolbar: `<button class="btn mint" data-act="sw.install">${ic('plus')}Install software</button><button class="btn" data-act="sw.new">${ic('plus')}Add licence</button>`,
          foot: (rows) => `<tr><td colspan="7">Totals</td><td class="num">${rows.reduce((a, s) => a + s.qty, 0)}</td><td class="num">${rows.reduce((a, s) => a + L.swInfo(s).used, 0)}</td><td class="num">${rows.reduce((a, s) => a + L.swInfo(s).remaining, 0)}</td><td></td><td></td><td class="num">${fmtNum(rows.reduce((a, s) => a + L.swInfo(s).value, 0), 2)}</td><td></td></tr>`,
        });
        body = ((pf.sw || {}).exp ? `<div style="margin-bottom:10px"><span class="pill p-amber">Expiring / expired only</span> <a class="link" data-go="#/software">clear</a></div>` : '') + body;
      } else {
        body = UI.table({
          id: 'ins', rows: () => d.installs, sort: 'date', dir: -1, text: (i) => [(L.sw(i.swId) || {}).name, L.empName(i.empNo), i.hwId, i.swId].join(' '),
          cols: [{ k: 'id', label: 'Install ID', mono: true }, { k: 'swId', label: 'Software ID', mono: true }, { k: 'name', label: 'Software', val: (i) => (L.sw(i.swId) || {}).name, render: (i) => `<b>${esc((L.sw(i.swId) || {}).name)}</b>` }, { k: 'emp', label: 'Employee', val: (i) => L.empName(i.empNo), render: (i) => `<a class="link" data-act="emp.view" data-id="${i.empNo}">${esc(L.empName(i.empNo))}</a>` }, { k: 'empNo', label: 'Emp No', mono: true }, { k: 'hwId', label: 'Device', mono: true, render: (i) => (i.hwId ? `<a class="link" data-act="hw.view" data-id="${i.hwId}">${i.hwId}</a>` : '–') }, { k: 'date', label: 'Installed', render: (i) => fmtDate(i.date) }, { k: 'qty', label: 'Qty used', num: true }, { k: 'rem', label: 'Qty remaining', num: true, val: (i) => L.swInfo(L.sw(i.swId) || { id: '', qty: 0 }).remaining }, { k: 'exp', label: 'Expiry', val: (i) => (L.sw(i.swId) || {}).expiry, render: (i) => fmtDate((L.sw(i.swId) || {}).expiry) }],
          actions: (i) => `<button class="ibtn" style="--c:#ff5c6c" title="Uninstall (frees the licence)" data-act="sw.uninstall" data-id="${i.id}">${ic('x')}</button>`,
          toolbar: `<button class="btn mint" data-act="sw.install">${ic('plus')}Install software</button>`, empty: 'Install a licence on an employee device to start tracking usage.',
        });
      }
      return `${UI.tabs('software', [{ id: 'lic', label: 'Licences', count: d.sw.length }, { id: 'ins', label: 'Installations', count: d.installs.length }])}<div class="card">${body}</div>`;
    },
  };
  UI.on('sw.new', () => UI.form({ title: 'Add software licence', sub: 'Opening balance — purchases normally arrive via GRN', icon: 'key', size: 'lg', fields: swFields(), values: { type: 'Application Software', subType: 'Perpetual', purchaseDate: L.today(), qty: 1, currency: 'AED', unitPrice: 0 }, onSubmit: (v) => { v.qty = +v.qty || 0; v.unitPrice = +v.unitPrice || 0; v.purchased = v.qty; const s = L.saveSW(v); UI.toast(s.id + ' added'); } }));
  UI.on('sw.edit', (el) => { const s = L.sw(el.dataset.id); UI.form({ title: 'Edit ' + s.name, sub: s.id, icon: 'edit', size: 'lg', fields: swFields(), values: s, onSubmit: (v) => { v.qty = +v.qty || 0; if (v.qty < L.swUsed(s.id)) throw new Error(`Cannot go below ${L.swUsed(s.id)} — that many are installed.`); v.unitPrice = +v.unitPrice || 0; L.saveSW(v, s.id); UI.toast('Licence updated'); } }); });
  UI.on('sw.del', async (el) => { if (await UI.confirm('Delete this licence record?', 'Delete', true)) UI.run(() => L.deleteSW(el.dataset.id), 'Deleted'); });
  UI.on('sw.renew', (el) => { const s = L.sw(el.dataset.id); UI.form({ title: 'Renew ' + s.name, icon: 'refresh', size: 'sm', fields: [{ k: 'expiry', label: 'New expiry date', type: 'date', req: true }, { k: 'add', label: 'Additional licences', type: 'number', min: 0 }], values: { expiry: L.addYears(s.expiry && L.daysTo(s.expiry) > 0 ? s.expiry : L.today(), 1), add: 0 }, onSubmit: (v) => { L.renewSW(s.id, v.expiry, +v.add || 0); UI.toast('Licence renewed'); } }); });
  UI.on('sw.uninstall', async (el) => { if (await UI.confirm('Uninstall — the licence returns to the available pool.', 'Uninstall', true)) { L.uninstallSW(el.dataset.id); UI.toast('Uninstalled'); } });
  UI.on('sw.view', (el) => {
    const s = L.sw(el.dataset.id); const i = L.swInfo(s); const ins = db().installs.filter((x) => x.swId === s.id);
    const ov = UI.modal(`<header><span class="gem" style="width:46px;height:46px;background:var(--grad-hot)">${ic('key')}</span><div><h3>${esc(s.name)}</h3><small>${s.id} · ${esc(s.type)} · ${esc(s.subType)}</small></div><span style="margin-left:auto">${pill(expState(i))}</span><button class="ibtn" data-x>${ic('x')}</button></header><div class="body"><div class="grid g2"><dl class="kv"><dt>Vendor</dt><dd>${esc(s.vendor)}</dd><dt>Purchased</dt><dd>${fmtDate(s.purchaseDate)}</dd><dt>Expiry</dt><dd>${fmtDate(s.expiry) || 'Perpetual'} ${i.days != null ? '(' + i.days + ' days)' : ''}</dd><dt>Serial / passcode</dt><dd class="mono">${esc(s.serialNo) || '–'}</dd><dt>Unit price</dt><dd>${money(s.unitPrice, s.currency)}</dd><dt>Total value</dt><dd>${money(i.value, s.currency)}</dd><dt>Source PO</dt><dd>${s.poNo ? `<a class="link" data-act="po.view" data-id="${s.poNo}">${s.poNo}</a>` : '–'}</dd></dl><div style="text-align:center">${UI.ring(s.qty ? (i.used / s.qty) * 100 : 0, '#ff3d9a')}<div style="font-weight:700;margin-top:6px">${i.used} used · ${i.remaining} remaining · ${s.qty} total</div></div></div>
    <h3 style="margin:16px 0 8px;font:650 14px var(--head)">Installations</h3>${ins.length ? `<table class="t"><thead><tr><th>Employee</th><th>Device</th><th>Date</th><th></th></tr></thead><tbody>${ins.map((x) => `<tr><td>${esc(L.empName(x.empNo))}</td><td class="mono">${x.hwId || '–'}</td><td>${fmtDate(x.date)}</td><td><button class="btn xs ghost" data-act="sw.uninstall" data-id="${x.id}">Uninstall</button></td></tr>`).join('')}</tbody></table>` : '<div class="empty">Not installed anywhere yet</div>'}</div>
    <footer><button class="btn mint" data-act="sw.install" data-sw="${s.id}">${ic('plus')}Install</button><button class="btn ghost" data-act="sw.renew" data-id="${s.id}">${ic('refresh')}Renew</button><button class="btn ghost" data-act="sw.edit" data-id="${s.id}">${ic('edit')}Edit</button></footer>`, { size: 'lg' });
    ov.addEventListener('click', (e) => { if (e.target.closest('[data-x]') || e.target.closest('[data-act]')) UI.close(ov); });
  });
  UI.on('sw.install', (el) => {
    const d = db(); const o = el && el.dataset ? el.dataset : {};
    const lic = () => d.sw.filter((s) => { const i = L.swInfo(s); return i.remaining > 0 && !i.expired; }).map((s) => ({ v: s.id, l: `${s.name} — ${L.swInfo(s).remaining} left` }));
    if (!lic().length) return UI.toast('No licences with free seats. Purchase or renew first.', 'warn');
    UI.form({
      title: 'Install software', sub: 'Consumes one licence from the pool', icon: 'key', size: 'md', deps: { empNo: 1 },
      fields: [{ k: 'swId', label: 'Software licence', type: 'select', options: lic, req: true, full: true, blank: false }, { k: 'empNo', label: 'Employee', type: 'select', options: () => empOpts(), req: true }, { k: 'hwId', label: 'Device (asset held by employee)', type: 'select', options: (v) => d.hw.filter((a) => a.holder === v.empNo && ['Laptop', 'Desktop', 'Server', 'Phone'].includes(a.type)).map((a) => ({ v: a.id, l: `${a.id} — ${a.desc}` })) }, { k: 'date', label: 'Installed on', type: 'date' }, { k: 'qty', label: 'Seats', type: 'number', min: 1 }],
      values: { swId: o.sw || '', empNo: o.emp || '', hwId: o.hw || '', date: L.today(), qty: 1 }, onSubmit: (v) => { L.installSW(v.swId, v.empNo, v.hwId, v.date, Math.max(1, +v.qty || 1)); UI.toast('Installed — licence count updated'); },
      onOpen: (api) => { if (o.sw) api.set('swId', o.sw); if (o.emp) { api.set('empNo', o.emp); api.refresh(); if (o.hw) api.set('hwId', o.hw); } },
    });
  });
})();

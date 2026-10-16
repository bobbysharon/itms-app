/* Pages 1: Dashboard, Employees, Vendors */
(function () {
  const ITMS = window.ITMS; const L = ITMS.logic; const UI = ITMS.ui; const S = ITMS.store;
  const { esc, fmtDate, fmtNum, money, pill, icon: ic } = UI;
  const pages = (ITMS.pages = ITMS.pages || {});
  const db = () => S.db;
  const tabs = (page, list) => `<div class="tabs">${list.map((t) => `<a data-tab="${page}:${t.id}" class="${(UI.tab[page] || list[0].id) === t.id ? 'on' : ''}">${t.label}${t.count != null ? `<small>${t.count}</small>` : ''}</a>`).join('')}</div>`;
  const curTab = (page, first) => UI.tab[page] || first;
  UI.tabs = tabs; UI.curTab = curTab;
  const go = (h) => `data-go="${h}"`;
  UI.go = go;

  /* ===================== DASHBOARD ===================== */
  pages.dashboard = {
    title: 'Dashboard', crumb: 'Live command centre — every figure is computed from your modules', icon: 'grid', color: '#2f6bff', group: 'Overview',
    render() {
      const s = L.stats(); const k = s.kpi; const d = db(); const a = s.alerts;
      const kp = (icon, val, label, sub, c, g, href, dec) => `<div class="card kpi tilt glow" style="--c:${c};--g:${g}" ${go(href)}><div class="gem">${ic(icon)}</div><div><div class="v" data-count="${val}" ${dec ? 'data-dec="2"' : ''}>${val}</div><div class="l">${label}</div><div class="s">${sub}</div></div></div>`;
      const lowN = a.lowStock.length;
      const alertRow = (n, title, sub, c, href) => `<div class="alert-row" style="--c:${c}" ${go(href)}><b>${n}</b><span>${title}<small>${sub}</small></span></div>`;
      const hwRows = s.byType.filter((r) => r.total || true);
      const statusItems = s.status.map((x, i) => ({ label: x.label, value: x.value, color: ['#10d9a0', '#2f6bff', '#ffb020', '#ff5c6c'][i] }));
      const typeBars = s.byType.filter((r) => r.total).map((r, i) => ({ label: r.type, value: r.total, color: UI.PAL[i % 8], href: `#/hardware?type=${r.type}` }));
      const stack = s.byType.filter((r) => r.total).map((r) => ({ label: r.type, total: r.total, vals: { 'In Use': r.inUse, 'In Stock': r.inStock, 'Under Repair': r.repair, Disposed: r.disposed }, href: `#/hardware?type=${r.type}` }));
      const swPct = k.licences ? (k.licUsed / k.licences) * 100 : 0;
      const pl = s.pipeline;
      const maxHeat = Math.max(1, ...s.dist.map((r) => Math.max(...Object.values(r.counts))));
      const heat = `<div class="heat" style="grid-template-columns:120px repeat(${s.distTypes.length + 1},1fr)"><span></span>${s.distTypes.map((t) => `<span class="hh">${t.replace('_', ' ').slice(0, 7)}</span>`).join('')}<span class="hh">Total</span>${s.dist.filter((r) => r.total).map((r) => `<span class="hl">${esc(r.dept)}</span>${s.distTypes.map((t) => `<span class="hc" style="--a:${r.counts[t] / maxHeat}">${r.counts[t] || ''}</span>`).join('')}<span class="hc" style="--a:0;background:#ece9ff;color:#5a3df0">${r.total}</span>`).join('')}</div>`;
      const topSpare = a.spare.slice(0, 6);
      const act = d.log.slice(0, 7).map((x) => `<li style="--c:${{ PR: '#2f6bff', PO: '#2f6bff', GRN: '#10d9a0', Issue: '#00c2ff', Return: '#ffb020', Transfer: '#1d4ed8' }[x.kind] || '#2f6bff'}"><b>${esc(x.text)}</b><small>${esc(x.kind)} · ${new Date(x.at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</small></li>`).join('');
      return `
      <div class="hero"><div class="gem" style="width:64px;height:64px;border-radius:21px;background:rgba(255,255,255,.22)">${ic('cpu')}</div><div><h1>IT Service &amp; Asset Control Tower</h1><p>${esc(d.company.name)} · ${esc(d.company.address)} · ${fmtDate(L.today())}</p></div>
        <div class="hbtns"><button class="btn" data-act="rq.new">${ic('plus')}New request</button><button class="btn" data-act="pr.new">${ic('plus')}New PR</button><button class="btn" data-act="po.convert">${ic('link')}PR → PO</button><button class="btn" data-act="mv.new" data-type="Issue">${ic('swap')}Issue Asset</button></div></div>
      <div class="grid g4">
        ${kp('laptop', k.assets, 'Hardware assets', `${k.active} active · ${k.disposed} disposed`, '#2f6bff', 'linear-gradient(135deg,#2f6bff,#7aa5ff)', '#/hardware')}
        ${kp('users', k.inUse, 'In use', `${k.employees} active employees`, '#2f6bff', 'linear-gradient(135deg,#2f6bff,#00c2ff)', '#/hardware?status=In Use')}
        ${kp('box', k.inStock, 'In stock (spare)', 'ready to issue', '#10d9a0', 'linear-gradient(135deg,#10d9a0,#00c2ff)', '#/hardware?status=In Stock')}
        ${kp('wrench', k.repair, 'Under repair', 'needs attention', '#ffb020', 'linear-gradient(135deg,#ffb020,#00a8e8)', '#/hardware?status=Under Repair')}
        ${kp('key', k.licUsed + '/' + k.licences, 'Licences used', Math.round(swPct) + '% utilisation', '#1d4ed8', 'linear-gradient(135deg,#1d4ed8,#00a8e8)', '#/software')}
        ${kp('filePlus', pl.prOpen, 'Open purchase requests', 'awaiting PO', '#00a8e8', 'linear-gradient(135deg,#00a8e8,#2f6bff)', '#/requests')}
        ${kp('cart', pl.poDraft + pl.poApproved, 'POs to action', `${pl.poDraft} draft · ${pl.poApproved} awaiting goods`, '#3b82f6', 'linear-gradient(135deg,#3b82f6,#1d4ed8)', '#/orders')}
        ${kp('dollar', fmtNum(k.spend), 'PO value (incl. VAT)', d.company.currency + ' · ' + pl.unpaid + ' unpaid', '#ff5c6c', 'linear-gradient(135deg,#ff5c6c,#ffb020)', '#/orders')}
      </div>
      <div class="grid g-main mt">
        <div class="card glow" style="--c:#2f6bff"><h3><span class="pip"></span>Hardware assets by type &amp; status<span class="tag">click a bar to drill in</span></h3>${UI.stackBars(stack, ['In Use', 'In Stock', 'Under Repair', 'Disposed'], ['#2f6bff', '#10d9a0', '#ffb020', '#ff5c6c'])}
          <div class="legend">${['In Use|#2f6bff', 'In Stock|#10d9a0', 'Under Repair|#ffb020', 'Disposed|#ff5c6c'].map((x) => `<span><i style="--c:${x.split('|')[1]}"></i>${x.split('|')[0]}</span>`).join('')}</div></div>
        <div class="card glow" style="--c:#1d4ed8"><h3><span class="pip"></span>Attention centre<span class="tag">auto-generated</span></h3>
          ${alertRow(a.warranty30.length, 'Warranty expiring ≤ 30 days', 'hardware', '#ffb020', '#/hardware?warranty=expiring')}
          ${alertRow(a.sw30.length + a.swExpired.length, 'Licences expiring / expired', `${a.sw30.length} expiring · ${a.swExpired.length} expired`, '#1d4ed8', '#/software?exp=1')}
          ${alertRow(a.amc30.length + a.amcExpired.length, 'AMC contracts due', `${a.amc30.length} expiring · ${a.amcExpired.length} lapsed`, '#2f6bff', '#/amc')}
          ${alertRow(lowN, 'Consumables at / below reorder level', 'raise a purchase request', '#ff5c6c', '#/consumables?low=1')}
          ${alertRow(a.retention.length, 'Assets past retention period', 'plan replacement', '#2f6bff', '#/hardware?retention=1')}
        </div>
      </div>
      <div class="grid g3 mt">
        <div class="card glow" style="--c:#10d9a0"><h3><span class="pip"></span>Asset status</h3>${UI.donut(statusItems, { big: k.assets, small: 'assets' })}</div>
        <div class="card glow" style="--c:#2f6bff"><h3><span class="pip"></span>Assets by type</h3>${UI.bars3d(typeBars, { w: 520, h: 270 })}</div>
        <div class="card glow" style="--c:#00c2ff"><h3><span class="pip"></span>Procurement pipeline</h3>
          <div class="flow" style="flex-wrap:wrap">${[['Open PR', pl.prOpen, '#2f6bff', '#/requests'], ['Draft PO', pl.poDraft, '#3b82f6', '#/orders'], ['Awaiting goods', pl.poApproved, '#ffb020', '#/orders'], ['Received', pl.poReceived, '#10d9a0', '#/orders'], ['Paid', pl.paid, '#00a8e8', '#/orders']].map((x) => `<div class="st" style="--c:${x[2]}" ${go(x[3])}><b>${x[1]}</b><span>${x[0]}</span></div>`).join('')}</div>
          <h3 style="margin-top:12px"><span class="pip" style="--c:#1d4ed8"></span>PO value by month<span class="tag">${d.company.currency}</span></h3>${UI.area(s.months, { div: 1000, suffix: 'k' })}</div>
      </div>
      <div class="grid g-main2 mt">
        <div class="card"><h3><span class="pip" style="--c:#2f6bff"></span>Hardware assets summary</h3>
          <div class="twrap" style="max-height:340px"><table class="t"><thead><tr><th>Asset type</th><th class="num">Total</th><th class="num">In use</th><th class="num">In stock</th><th class="num">Repair</th><th class="num">Disposed</th><th class="num">Warranty this month</th><th class="num">Warranty expired</th></tr></thead><tbody>
          ${hwRows.map((r) => `<tr style="cursor:pointer" ${go('#/hardware?type=' + r.type)}><td><b>${esc(r.type.replace('_', ' '))}</b></td><td class="num">${r.total}</td><td class="num">${r.inUse}</td><td class="num">${r.inStock}</td><td class="num">${r.repair}</td><td class="num">${r.disposed}</td><td class="num">${r.warrantyMonth || '–'}</td><td class="num">${r.warrantyExpired || '–'}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td>Total</td><td class="num">${s.byType.reduce((x, r) => x + r.total, 0)}</td><td class="num">${s.byType.reduce((x, r) => x + r.inUse, 0)}</td><td class="num">${s.byType.reduce((x, r) => x + r.inStock, 0)}</td><td class="num">${s.byType.reduce((x, r) => x + r.repair, 0)}</td><td class="num">${s.byType.reduce((x, r) => x + r.disposed, 0)}</td><td class="num">${s.byType.reduce((x, r) => x + r.warrantyMonth, 0)}</td><td class="num">${s.byType.reduce((x, r) => x + r.warrantyExpired, 0)}</td></tr></tfoot></table></div></div>
        <div class="card"><h3><span class="pip" style="--c:#1d4ed8"></span>Software licences summary<div style="margin-left:auto">${UI.ring(swPct, '#1d4ed8')}</div></h3>
          <div class="twrap" style="max-height:340px"><table class="t"><thead><tr><th>Software type</th><th class="num">Total</th><th class="num">Used</th><th class="num">Available</th><th class="num">Exp. ≤30d</th><th class="num">Expired</th></tr></thead><tbody>
          ${s.swByType.map((r) => `<tr style="cursor:pointer" ${go('#/software?type=' + r.type)}><td><b>${esc(r.type)}</b></td><td class="num">${r.total}</td><td class="num">${r.used}</td><td class="num">${r.available}</td><td class="num">${r.exp30 || '–'}</td><td class="num">${r.expired || '–'}</td></tr>`).join('')}</tbody></table></div></div>
      </div>
      <div class="grid g-main mt">
        <div class="card"><h3><span class="pip" style="--c:#2f6bff"></span>Asset distribution by department<span class="tag">issued assets</span></h3><div style="overflow:auto">${heat}</div></div>
        <div class="card"><h3><span class="pip" style="--c:#10d9a0"></span>Consumables summary</h3>
          ${s.consRows.length ? s.consRows.map((r, i) => `<div style="margin:9px 0;cursor:pointer" ${go('#/consumables')}><div style="display:flex;justify-content:space-between;font-size:12.5px;font-weight:600"><span>${esc(r.type.replace('_', ' '))} ${r.low ? pill('Low', 'coral') : ''}</span><span>${r.available} left of ${r.purchased}</span></div><div class="bar3"><i style="--c:${r.low ? '#ff5c6c' : UI.PAL[i % 8]};width:${r.purchased ? (r.available / r.purchased) * 100 : 0}%"></i></div></div>`).join('') : '<div class="empty">No consumables recorded yet</div>'}</div>
      </div>
      <div class="grid g2 mt">
        <div class="card"><h3><span class="pip" style="--c:#10d9a0"></span>Spare stock — ready to issue<span class="tag">${a.spare.length} total</span></h3>
          ${topSpare.length ? `<table class="t"><thead><tr><th>Asset ID</th><th>Type</th><th>Description</th><th></th></tr></thead><tbody>${topSpare.map((x) => `<tr><td class="mono">${x.id}</td><td>${esc(x.type)}</td><td>${esc(x.desc)}</td><td><button class="btn xs" data-act="mv.new" data-type="Issue" data-asset="${x.id}">Issue</button></td></tr>`).join('')}</tbody></table>` : '<div class="empty">No spare assets</div>'}</div>
        <div class="card"><h3><span class="pip" style="--c:#00c2ff"></span>Live activity</h3><ul class="timeline" style="padding-left:22px;margin-left:8px">${act || '<div class="empty">No activity yet</div>'}</ul></div>
      </div>`;
    },
  };

  /* ===================== EMPLOYEES ===================== */
  const empFields = () => [
    { section: 'Employee' }, { k: 'name', label: 'Employee name', req: true }, { k: 'designation', label: 'Designation', type: 'select', options: () => db().lists.designations || [] }, { k: 'dept', label: 'Department', type: 'select', options: () => db().lists.departments || [], req: true },
    { k: 'manager', label: 'Reporting manager', type: 'select', options: () => db().employees.map((e) => e.name) }, { k: 'location', label: 'Location', type: 'select', options: () => db().lists.locations || [] }, { k: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive', 'Left'], blank: false }, { k: 'role', label: 'Access role', type: 'select', options: () => { try { return ITMS.sdp.D().roles.map((r) => r.name); } catch (e) { return ['Administrator', 'Group Lead', 'Technician', 'Requester', 'Auditor', 'Vendor / External']; } } },
    { section: 'Dates & contact' }, { k: 'doj', label: 'Date of joining', type: 'date' }, { k: 'dol', label: 'Date of leaving', type: 'date' }, { k: 'email', label: 'Email', type: 'email' }, { k: 'mobile', label: 'Mobile', type: 'tel' }, { k: 'tel', label: 'Telephone', type: 'tel' }, { k: 'ext', label: 'Extension' },
  ];
  const heldBy = (no) => db().hw.filter((a) => a.holder === no);
  forms.empFields = empFields;
  pages.employees = {
    title: 'Employees', crumb: 'Employee master — the owner of every issued asset, licence install and consumable', icon: 'users', color: '#2f6bff', group: 'Masters',
    render() {
      const d = db();
      return `<div class="card">${UI.table({
        id: 'emp', rows: () => d.employees.filter((e) => !e.sys), text: (r) => [r.no, r.name, r.designation, r.dept, r.location, r.email].join(' '), sort: 'no',
        filters: [{ k: 'dept', label: 'Department', options: () => L.uniq(d.employees.map((e) => e.dept)).sort() }, { k: 'status', label: 'Status', options: ['Active', 'Inactive', 'Left'] }, { k: 'location', label: 'Location', options: () => L.uniq(d.employees.map((e) => e.location)).sort() }],
        cols: [
          { k: 'no', label: 'Emp No', mono: true, render: (r) => `<a class="link" data-act="emp.view" data-id="${r.no}">${r.no}</a>` }, { k: 'name', label: 'Name', render: (r) => `<b>${esc(r.name)}</b>` }, { k: 'designation', label: 'Designation' }, { k: 'dept', label: 'Department' }, { k: 'role', label: 'Access role', render: (r) => esc(r.role || '—') },
          { k: 'manager', label: 'Manager' }, { k: 'location', label: 'Location' }, { k: 'email', label: 'Email' }, { k: 'ext', label: 'Ext' }, { k: 'doj', label: 'Joined', render: (r) => fmtDate(r.doj) },
          { k: 'assets', label: 'Assets', num: true, val: (r) => heldBy(r.no).length, render: (r) => { const n = heldBy(r.no).length; return n ? `<span class="pill p-blue">${n}</span>` : '–'; } },
          { k: 'status', label: 'Status', render: (r) => pill(r.status) },
        ],
        actions: (r) => `<button class="ibtn" title="Profile" data-act="emp.view" data-id="${r.no}">${ic('eye')}</button><button class="ibtn" style="--c:#00c2ff" title="Asset issuance form" data-act="emp.form" data-kind="issue" data-id="${r.no}">${ic('print')}</button><button class="ibtn" style="--c:#10d9a0" title="Onboard / assign assets & IDs" data-act="lc.on" data-emp="${r.no}">${ic('plus')}</button><button class="ibtn" style="--c:#ff9a3d" title="Offboard / return assets" data-act="lc.off" data-emp="${r.no}">${ic('undo')}</button><button class="ibtn" style="--c:#1d4ed8" title="Login access / reset password" data-act="emp.access" data-id="${r.no}">${ic('key')}</button><button class="ibtn" title="Edit" data-act="emp.edit" data-id="${r.no}">${ic('edit')}</button><button class="ibtn" style="--c:#ff5c6c" title="Delete" data-act="emp.del" data-id="${r.no}">${ic('trash')}</button>`,
        toolbar: `<button class="btn" data-act="emp.new">${ic('plus')}Add employee</button> <button class="btn ghost sm" data-act="imp.sample" data-k="employees">Sample CSV</button> <button class="btn ghost sm" data-act="imp.upload" data-k="employees">Upload CSV</button>`,
      })}</div>`;
    },
  };
  UI.on('emp.new', () => UI.form({ title: 'New employee', icon: 'users', fields: empFields(), values: { status: 'Active', location: 'Dubai, UAE', doj: L.today(), role: 'Requester' }, onSubmit: (v) => { L.saveEmployee(v); UI.toast('Employee added'); } }));
  UI.on('emp.edit', (el) => { const e = L.emp(el.dataset.id); UI.form({ title: 'Edit ' + e.name, sub: e.no, icon: 'edit', fields: empFields(), values: e, onSubmit: (v) => { L.saveEmployee(v, e.no); try { const u = db().users.find((x) => x.empNo === e.no); if (u && v.role) u.role = v.role; if ((localStorage.getItem('itms.user') || '') === e.no && v.role && ITMS.sdp) ITMS.sdp.setRole(v.role); const s = JSON.parse(sessionStorage.getItem('itms.session') || 'null'); if (s && s.empNo === e.no && v.role) { s.role = v.role; sessionStorage.setItem('itms.session', JSON.stringify(s)); } } catch (err2) { /* ignore */ } UI.toast('Employee updated'); } }); });
  UI.on('emp.del', async (el) => { const e = L.emp(el.dataset.id); if (await UI.confirm(`Delete <b>${esc(e.name)}</b>?`, 'Delete', true)) UI.run(() => L.deleteEmployee(e.no), 'Employee deleted'); });
  UI.on('emp.view', (el) => {
    const e = L.emp(el.dataset.id); const held = heldBy(e.no); const inst = db().installs.filter((i) => i.empNo === e.no); const ci = db().consIssue.filter((i) => i.empNo === e.no);
    const ov = UI.modal(`<header><span class="gem" style="width:46px;height:46px">${ic('users')}</span><div><h3>${esc(e.name)}</h3><small>${e.no} · ${esc(e.designation)} · ${esc(e.dept)}</small></div><span style="margin-left:auto">${pill(e.status)}</span><button class="ibtn" data-x>${ic('x')}</button></header>
    <div class="body"><div class="grid g2"><dl class="kv"><dt>Manager</dt><dd>${esc(e.manager) || '–'}</dd><dt>Location</dt><dd>${esc(e.location)}</dd><dt>Email</dt><dd>${esc(e.email)}</dd><dt>Mobile</dt><dd>${esc(e.mobile)}</dd><dt>Telephone / Ext</dt><dd>${esc(e.tel)} / ${esc(e.ext)}</dd><dt>Joined</dt><dd>${fmtDate(e.doj)}</dd></dl>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-content:flex-start;justify-content:flex-end"><button class="btn sm" data-act="mv.new" data-type="Issue" data-emp="${e.no}">${ic('swap')}Issue asset</button><button class="btn sm ghost" data-act="emp.form" data-kind="issue" data-id="${e.no}">${ic('print')}Issuance form</button><button class="btn sm ghost" data-act="emp.form" data-kind="return" data-id="${e.no}">${ic('print')}Return / clearance form</button></div></div>
    <h3 style="margin:18px 0 8px;font:650 14px var(--head)">Assets held (${held.length})</h3>${held.length ? `<table class="t"><thead><tr><th>Asset</th><th>Type</th><th>Description</th><th>Serial</th><th>Since</th><th></th></tr></thead><tbody>${held.map((a) => `<tr><td class="mono"><a class="link" data-act="hw.view" data-id="${a.id}">${a.id}</a></td><td>${esc(a.type)}</td><td>${esc(a.desc)}</td><td class="mono">${esc(a.serial)}</td><td>${fmtDate(a.issuedDate)}</td><td><button class="btn xs ghost" data-act="mv.new" data-type="Return" data-emp="${e.no}" data-asset="${a.id}">Return</button> <button class="btn xs ghost" data-act="mv.new" data-type="Transfer" data-emp="${e.no}" data-asset="${a.id}">Transfer</button></td></tr>`).join('')}</tbody></table>` : '<div class="empty">No assets issued</div>'}
    <h3 style="margin:18px 0 8px;font:650 14px var(--head)">Software installed (${inst.length})</h3>${inst.length ? `<table class="t"><thead><tr><th>Software</th><th>Device</th><th>Installed</th></tr></thead><tbody>${inst.map((i) => `<tr><td>${esc((L.sw(i.swId) || {}).name)}</td><td class="mono">${i.hwId || '–'}</td><td>${fmtDate(i.date)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">None</div>'}
    <h3 style="margin:18px 0 8px;font:650 14px var(--head)">Consumables received (${ci.length})</h3>${ci.length ? `<table class="t"><thead><tr><th>Date</th><th>Item</th><th class="num">Qty</th></tr></thead><tbody>${ci.map((i) => `<tr><td>${fmtDate(i.date)}</td><td>${esc((L.cons(i.itemId) || {}).desc)}</td><td class="num">${i.qty}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">None</div>'}</div>`, { size: 'lg' });
    ov.addEventListener('click', (x) => { if (x.target.closest('[data-x]')) UI.close(ov); if (x.target.closest('[data-act]') && !x.target.closest('[data-act="hw.view"]')) UI.close(ov); });
  });
  UI.on('emp.form', (el) => ITMS.forms.assetForm(el.dataset.kind === 'return' ? 'Return' : 'Issue', el.dataset.id));

  /* ===================== VENDORS ===================== */
  const YN = ['Yes', 'No'];
  const venFields = () => [
    { section: 'Vendor' }, { k: 'name', label: 'Vendor name', req: true }, { k: 'currency', label: 'Currency', type: 'select', options: ['AED', 'USD', 'EUR', 'GBP', 'SAR', 'INR'], blank: false }, { k: 'contact', label: 'Contact name' }, { k: 'email', label: 'Email', type: 'email' },
    { section: 'Phones' }, { k: 'phone1', label: 'Phone 1' }, { k: 'phone2', label: 'Phone 2' }, { k: 'phone3', label: 'Phone 3' }, { k: 'phone4', label: 'Phone 4' }, { k: 'fax', label: 'Fax' },
    { section: 'Address' }, { k: 'address', label: 'Mailing address', full: true }, { k: 'city', label: 'City' }, { k: 'state', label: 'State' }, { k: 'zip', label: 'Zip' }, { k: 'country', label: 'Country' },
    { section: 'Commercial' }, { k: 'termsId', label: 'Payment terms', type: 'select', options: () => db().terms.map((t) => t.id) }, { k: 'returnPolicy', label: 'Return policy' },
    { section: 'Security & compliance' }, { k: 'nesa', label: 'NESA compliance', type: 'select', options: YN }, { k: 'compliance', label: 'Compliance status', type: 'select', options: ['Compliant', 'Non-Compliant', 'Pending'] }, { k: 'certs', label: 'Security certifications' },
    { k: 'cyber', label: 'Cybersecurity policy provided', type: 'select', options: YN }, { k: 'dataProt', label: 'Data protection policy provided', type: 'select', options: YN }, { k: 'risk', label: 'Risk assessment provided', type: 'select', options: YN }, { k: 'training', label: 'Security training provided', type: 'select', options: YN }, { k: 'incident', label: 'Incident response plan provided', type: 'select', options: YN }, { k: 'access', label: 'Access control policy provided', type: 'select', options: YN }, { k: 'encryption', label: 'Data encryption policy provided', type: 'select', options: YN },
  ];
  const fullAddr = (v) => [v.address, v.city, v.state, v.zip, v.country].filter(Boolean).join(', ');
  UI.fullAddr = fullAddr;
  const vSpend = (v) => db().pos.filter((p) => p.vendor === v.name && p.approval !== 'Cancelled').reduce((s, p) => s + L.poTotals(p).incl, 0);
  pages.vendors = {
    title: 'Vendors', crumb: 'Vendor master with payment terms and security-compliance posture', icon: 'truck', color: '#00a8e8', group: 'Masters',
    render() {
      const d = db();
      return `<div class="card">${UI.table({
        id: 'ven', rows: () => d.vendors, text: (r) => [r.id, r.name, r.contact, r.email, r.city, r.country].join(' '), sort: 'id',
        filters: [{ k: 'compliance', label: 'Compliance', options: ['Compliant', 'Non-Compliant', 'Pending'] }, { k: 'country', label: 'Country', options: () => L.uniq(d.vendors.map((v) => v.country)).sort() }, { k: 'termsId', label: 'Terms', options: () => d.terms.map((t) => t.id) }],
        cols: [
          { k: 'id', label: 'ID', mono: true, render: (r) => `<a class="link" data-act="ven.view" data-id="${r.id}">${r.id}</a>` }, { k: 'name', label: 'Vendor', render: (r) => `<b>${esc(r.name)}</b>` }, { k: 'currency', label: 'Cur' }, { k: 'contact', label: 'Contact' }, { k: 'email', label: 'Email' }, { k: 'phone1', label: 'Phone' },
          { k: 'city', label: 'City' }, { k: 'termsId', label: 'Terms' }, { k: 'certs', label: 'Certification' }, { k: 'compliance', label: 'Compliance', render: (r) => pill(r.compliance) },
          { k: 'pos', label: 'POs', num: true, val: (r) => d.pos.filter((p) => p.vendor === r.name).length }, { k: 'spend', label: 'Spend', num: true, val: vSpend, render: (r) => fmtNum(vSpend(r), 0) },
        ],
        actions: (r) => `<button class="ibtn" data-act="ven.view" data-id="${r.id}" title="View">${ic('eye')}</button><button class="ibtn" data-act="ven.edit" data-id="${r.id}" title="Edit">${ic('edit')}</button><button class="ibtn" style="--c:#ff5c6c" data-act="ven.del" data-id="${r.id}" title="Delete">${ic('trash')}</button>`,
        toolbar: `<button class="btn" data-act="ven.new">${ic('plus')}Add vendor</button>`,
      })}</div>`;
    },
  };
  const venSave = (v, id) => { v.fullAddress = fullAddr(v); L.saveVendor(v, id); };
  UI.on('ven.new', () => UI.form({ title: 'New vendor', icon: 'truck', size: 'lg', fields: venFields(), values: { currency: 'AED', country: 'UAE', nesa: 'No', compliance: 'Pending' }, onSubmit: (v) => { venSave(v); UI.toast('Vendor added'); } }));
  UI.on('ven.edit', (el) => { const v = db().vendors.find((x) => x.id === el.dataset.id); UI.form({ title: 'Edit ' + v.name, sub: v.id, icon: 'edit', size: 'lg', fields: venFields(), values: v, onSubmit: (x) => { venSave(x, v.id); UI.toast('Vendor updated'); } }); });
  UI.on('ven.del', async (el) => { const v = db().vendors.find((x) => x.id === el.dataset.id); if (await UI.confirm(`Delete vendor <b>${esc(v.name)}</b>?`, 'Delete', true)) UI.run(() => L.deleteVendor(v.id), 'Vendor deleted'); });
  UI.on('ven.view', (el) => {
    const v = db().vendors.find((x) => x.id === el.dataset.id); const t = L.term(v.termsId) || {}; const pos = db().pos.filter((p) => p.vendor === v.name);
    const sec = [['Cybersecurity policy', v.cyber], ['Data protection policy', v.dataProt], ['Risk assessment', v.risk], ['Security training', v.training], ['Incident response plan', v.incident], ['Access control policy', v.access], ['Data encryption policy', v.encryption]];
    const ov = UI.modal(`<header><span class="gem" style="width:46px;height:46px">${ic('truck')}</span><div><h3>${esc(v.name)}</h3><small>${v.id} · ${esc(v.city)}, ${esc(v.country)}</small></div><span style="margin-left:auto">${pill(v.compliance)}</span><button class="ibtn" data-x>${ic('x')}</button></header><div class="body"><div class="grid g2">
    <dl class="kv"><dt>Contact</dt><dd>${esc(v.contact)}</dd><dt>Email</dt><dd>${esc(v.email)}</dd><dt>Phones</dt><dd>${[v.phone1, v.phone2, v.phone3, v.phone4].filter(Boolean).join(' · ')}</dd><dt>Fax</dt><dd>${esc(v.fax)}</dd><dt>Address</dt><dd>${esc(fullAddr(v))}</dd><dt>Currency</dt><dd>${esc(v.currency)}</dd><dt>Payment terms</dt><dd>${esc(v.termsId)} — <span style="font-weight:450">${esc(t.desc || '')}</span></dd><dt>Return policy</dt><dd>${esc(v.returnPolicy)}</dd></dl>
    <div><h3 style="font:650 13px var(--head);margin:0 0 8px">Security posture · ${esc(v.certs || 'no certification')}</h3>${sec.map((x) => `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed var(--line)"><span>${x[0]}</span>${pill(x[1] === 'Yes' ? 'Yes' : 'No', x[1] === 'Yes' ? 'mint' : 'coral').replace('>Yes<', '>Provided<').replace('>No<', '>Missing<')}</div>`).join('')}</div></div>
    <h3 style="margin:18px 0 8px;font:650 14px var(--head)">Purchase orders (${pos.length}) · ${money(vSpend(v), v.currency)}</h3>${pos.length ? `<table class="t"><thead><tr><th>PO</th><th>Date</th><th>Items</th><th class="num">Total</th><th>Status</th></tr></thead><tbody>${pos.map((p) => `<tr><td><a class="link" data-act="po.view" data-id="${p.poNo}">${p.poNo}</a></td><td>${fmtDate(p.date)}</td><td>${esc(p.lines.map((l) => l.desc).join(', '))}</td><td class="num">${fmtNum(L.poTotals(p).incl, 2)}</td><td>${pill(L.poReceipt(p))}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">No orders yet</div>'}</div>`, { size: 'lg' });
    ov.addEventListener('click', (x) => { if (x.target.closest('[data-x]')) UI.close(ov); });
  });
})();

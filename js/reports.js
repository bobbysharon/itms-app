/* ITMS canned reports — 6 families, 41 reports. Rendered with the standard table
   (search, sort, filters, CSV export free). Family tabs + report picker. */
(function () {
  const ITMS = window.ITMS, L = ITMS.logic, UI = ITMS.ui, S = ITMS.store;
  const pages = (ITMS.pages = ITMS.pages || {});
  const { esc, icon: ic, pill, fmtDate, fmtNum, money } = UI;
  const db = () => S.db;
  const D = () => { try { return db().sdp || {}; } catch (e) { return {}; } };
  const P = (t, c) => pill(t || '—', c || undefined);
  const C = { blue: '#2f6bff', mint: '#10d9a0', amber: '#ffb020', coral: '#ff5c6c' };

  /* ---------- shared builders ---------- */
  const A = () => db().hw.map((a) => Object.assign({ who: a.holder ? L.empName(a.holder) : 'Unassigned' }, a));
  const WST = (a) => a.type === 'Desktop' || a.type === 'Laptop';
  const covered = () => { const s = new Set(); (db().amcs || []).forEach((c) => (c.assets || []).forEach((id) => s.add(id))); ((D() || {}).contracts || []).forEach((c) => (c.assets || []).forEach((id) => s.add(id))); return s; };
  const countBy = (rows, kf) => { const m = {}; rows.forEach((r) => { const k = kf(r) || '—'; m[k] = (m[k] || 0) + 1; }); return Object.keys(m).sort().map((k) => ({ k, n: m[k] })); };
  const mon = (s) => (s || '').slice(0, 7);
  const prod = (a) => ((a.brand ? a.brand + ' ' : '') + (a.model || a.desc || '')).trim() || a.desc;
  const poCC = (p) => {
    if (p.costCenter) return p.costCenter;
    for (const l of (p.lines || [])) {
      const m = String(l.prRef || '').match(/^(.*)-(\d+)$/);
      if (m) { const pr = L.pr(m[1]); if (pr && pr.dept) return pr.dept + ' (from PR)'; }
    }
    return '—';
  };
  const U = () => {
    const amc = (db().amcs || []).map((c) => ({ id: c.id, title: c.title, vendor: ((db().vendors.find((v) => v.id === c.vendorId) || {}).name || ''), type: 'AMC', start: c.start, end: c.end, value: +c.cost || 0, status: L.amcInfo(c).status }));
    const oth = (((D() || {}).contracts) || []).map((c) => ({ id: c.id, title: c.title, vendor: c.vendor || '', type: c.type || 'Contract', start: c.start, end: c.end, value: +c.value || 0, status: c.end && L.diffDays(c.end, L.today()) < 0 && c.status === 'Active' ? 'Expired' : c.status }));
    return amc.concat(oth);
  };

  /* shared columns */
  const cId = { k: 'id', label: 'Asset ID', mono: true };
  const cDesc = { k: 'desc', label: 'Description', render: (r) => `<b>${esc(r.desc)}</b>` };
  const cType = { k: 'type', label: 'Product Type' };
  const cProd = { k: 'prod', label: 'Product', val: (r) => prod(r), render: (r) => esc(prod(r)) };
  const cWho = { k: 'who', label: 'Requester / Holder' };
  const cVend = { k: 'vendor', label: 'Vendor' };
  const cPurch = { k: 'purchaseDate', label: 'Acquired', render: (r) => fmtDate(r.purchaseDate) };
  const cWarr = { k: 'warranty', label: 'Expiry', render: (r) => fmtDate(r.warranty) || '—' };

  /* ---------- families ---------- */
  const FAM = [
    {
      id: 'assets', label: 'General', reports: [
        { id: 'apt', t: 'Assets by Product Type', cols: [{ k: 'k', label: 'Product Type' }, { k: 'n', label: 'Assets', num: true }], rows: () => countBy(A(), (a) => a.type) },
        { id: 'ap', t: 'Assets by Product', cols: [{ k: 'k', label: 'Product' }, { k: 'n', label: 'Assets', num: true }], rows: () => countBy(A(), prod) },
        { id: 'aacq', t: 'Assets by Acquisition Date', cols: [{ k: 'k', label: 'Month acquired' }, { k: 'n', label: 'Assets', num: true }, { k: 'v', label: 'Value', num: true, render: (r) => fmtNum(r.v, 2) }], rows: () => { const m = {}; A().forEach((a) => { const k = mon(a.purchaseDate) || '—'; m[k] = m[k] || { k, n: 0, v: 0 }; m[k].n++; m[k].v += +a.price || 0; }); return Object.keys(m).sort().map((k) => m[k]); } },
        { id: 'aexp', t: 'Assets by Expiry Date', cols: [cId, cDesc, cWarr, { k: 'left', label: 'Days left', num: true, val: (r) => (r.warranty ? L.diffDays(r.warranty, L.today()) : 99999), render: (r) => (r.warranty ? (L.diffDays(r.warranty, L.today()) < 0 ? P('Expired', 'coral') : P(L.diffDays(r.warranty, L.today()) + 'd', L.diffDays(r.warranty, L.today()) <= 30 ? 'amber' : 'mint')) : '—') }, cType], rows: () => A().filter((a) => a.warranty), sort: 'warranty' },
        { id: 'areq', t: 'Assets by Requester', cols: [{ k: 'k', label: 'Requester' }, { k: 'n', label: 'Assets', num: true }], rows: () => countBy(A(), (a) => a.who) },
        { id: 'uapt', t: 'Unassigned Assets by Product Type', cols: [{ k: 'k', label: 'Product Type' }, { k: 'n', label: 'Unassigned', num: true }], rows: () => countBy(A().filter((a) => !a.holder), (a) => a.type) },
        { id: 'uap', t: 'Unassigned Assets by Product', cols: [cId, cDesc, cType, cPurch], rows: () => A().filter((a) => !a.holder), sort: 'id' },
        { id: 'ncpt', t: 'Assets not in Contract (by Product Type)', cols: [{ k: 'k', label: 'Product Type' }, { k: 'n', label: 'Not covered', num: true }], rows: () => { const c = covered(); return countBy(A().filter((a) => !c.has(a.id)), (a) => a.type); } },
        { id: 'ncp', t: 'Assets not in Contract (by Product)', cols: [cId, cDesc, cProd, cVend], rows: () => { const c = covered(); return A().filter((a) => !c.has(a.id)); }, sort: 'id' },
        { id: 'fvpt', t: 'Assets from Vendor (by Product Type)', cols: [{ k: 'vendor', label: 'Vendor' }, { k: 'type', label: 'Product Type' }, { k: 'n', label: 'Assets', num: true }], filters: [{ k: 'vendor', label: 'Vendor', options: () => L.uniq(A().map((a) => a.vendor || '—')).sort() }], rows: () => { const m = {}; A().forEach((a) => { const k = (a.vendor || '—') + 'ￜ' + a.type; m[k] = m[k] || { vendor: a.vendor || '—', type: a.type, n: 0 }; m[k].n++; }); return Object.keys(m).sort().map((k) => m[k]); } },
        { id: 'fvp', t: 'Assets from Vendor (by Product)', cols: [{ k: 'vendor', label: 'Vendor' }, { k: 'prod', label: 'Product', val: (r) => prod(r), render: (r) => esc(prod(r)) }, { k: 'n', label: 'Assets', num: true }], filters: [{ k: 'vendor', label: 'Vendor', options: () => L.uniq(A().map((a) => a.vendor || '—')).sort() }], rows: () => { const m = {}; A().forEach((a) => { const k = (a.vendor || '—') + 'ￜ' + prod(a); m[k] = m[k] || { vendor: a.vendor || '—', prod: prod(a), n: 0 }; m[k].n++; }); return Object.keys(m).sort().map((k) => m[k]); } },
      ],
    },
    {
      id: 'soft', label: 'Software', reports: [
        { id: 'scat', t: 'Software by Category', cols: [{ k: 'k', label: 'Category' }, { k: 't', label: 'Titles', num: true }, { k: 'q', label: 'Licences', num: true }, { k: 'u', label: 'Installed', num: true }], rows: () => { const m = {}; db().sw.forEach((s) => { const k = s.type || '—'; m[k] = m[k] || { k, t: 0, q: 0, u: 0 }; m[k].t++; m[k].q += +s.qty || 0; m[k].u += L.swUsed(s.id); }); return Object.keys(m).sort().map((k) => m[k]); } },
        { id: 'pvi', t: 'Purchased vs Installed Software', cols: [{ k: 'name', label: 'Software', render: (r) => `<b>${esc(r.name)}</b>` }, { k: 'qty', label: 'Purchased', num: true }, { k: 'used', label: 'Installed', num: true, val: (r) => L.swUsed(r.id) }, { k: 'rem', label: 'Remaining', num: true, val: (r) => L.swInfo(r).remaining }, { k: 'st', label: 'State', render: (r) => { const i = L.swInfo(r); return i.expired ? P('Expired', 'coral') : i.remaining <= 0 ? P('Fully used', 'amber') : P('Available', 'mint'); } }], rows: () => db().sw, sort: 'name' },
        { id: 'smfr', t: 'Software by Manufacturer', cols: [{ k: 'k', label: 'Manufacturer' }, { k: 't', label: 'Titles', num: true }, { k: 'q', label: 'Licences', num: true }, { k: 'v', label: 'Value', num: true, render: (r) => fmtNum(r.v, 2) }], rows: () => { const m = {}; db().sw.forEach((s) => { const k = s.vendor || '—'; m[k] = m[k] || { k, t: 0, q: 0, v: 0 }; m[k].t++; m[k].q += +s.qty || 0; m[k].v += L.swInfo(s).value; }); return Object.keys(m).sort().map((k) => m[k]); } },
        { id: 'cal', t: 'CAL Purchased vs Installed', cols: [{ k: 'name', label: 'CAL Suite', render: (r) => `<b>${esc(r.name)}</b>` }, { k: 'subType', label: 'Licence type' }, { k: 'qty', label: 'Purchased', num: true }, { k: 'used', label: 'Installed', num: true, val: (r) => L.swUsed(r.id) }, { k: 'rem', label: 'Remaining', num: true, val: (r) => L.swInfo(r).remaining }], rows: () => db().sw.filter((s) => /cal/i.test(s.name + ' ' + (s.subType || ''))), sort: 'name', empty: 'No CAL-type licences found (name or licence type containing “CAL”).' },
      ],
    },
    {
      id: 'ws', label: 'Workstations', reports: [
        { id: 'wos', t: 'Workstations by OS', cols: [{ k: 'k', label: 'Operating system' }, { k: 'n', label: 'Workstations', num: true }], rows: () => countBy(A().filter(WST), (a) => a.os || '—') },
        { id: 'wmfr', t: 'Workstations by Manufacturer', cols: [{ k: 'k', label: 'Manufacturer' }, { k: 'n', label: 'Workstations', num: true }], rows: () => countBy(A().filter(WST), (a) => a.brand || '—') },
        { id: 'wdom', t: 'Workstations by Domain', cols: [{ k: 'k', label: 'Domain' }, { k: 'n', label: 'Workstations', num: true }], rows: () => countBy(A().filter(WST), (a) => a.domain || '—') },
        { id: 'wnet', t: 'Workstations by Network', cols: [{ k: 'k', label: 'Network' }, { k: 'n', label: 'Workstations', num: true }], rows: () => countBy(A().filter(WST), (a) => a.network || '—') },
        { id: 'uwdom', t: 'Unassigned Workstations by Domain', cols: [cId, cDesc, { k: 'domain', label: 'Domain' }, { k: 'os', label: 'OS' }], rows: () => A().filter((a) => WST(a) && !a.holder), sort: 'id' },
        { id: 'uwnet', t: 'Unassigned Workstations by Network', cols: [cId, cDesc, { k: 'network', label: 'Network' }, { k: 'os', label: 'OS' }], rows: () => A().filter((a) => WST(a) && !a.holder), sort: 'id' },
        { id: 'osdom', t: 'OS Count by Domain', cols: [{ k: 'domain', label: 'Domain' }, { k: 'os', label: 'OS' }, { k: 'n', label: 'Count', num: true }], rows: () => { const m = {}; A().filter(WST).forEach((a) => { const k = (a.domain || '—') + 'ￜ' + (a.os || '—'); m[k] = m[k] || { domain: a.domain || '—', os: a.os || '—', n: 0 }; m[k].n++; }); return Object.keys(m).sort().map((k) => m[k]); } },
        { id: 'osnet', t: 'OS Count by Network', cols: [{ k: 'network', label: 'Network' }, { k: 'os', label: 'OS' }, { k: 'n', label: 'Count', num: true }], rows: () => { const m = {}; A().filter(WST).forEach((a) => { const k = (a.network || '—') + 'ￜ' + (a.os || '—'); m[k] = m[k] || { network: a.network || '—', os: a.os || '—', n: 0 }; m[k].n++; }); return Object.keys(m).sort().map((k) => m[k]); } },
        { id: 'modom', t: 'Model Count by Domain', cols: [{ k: 'domain', label: 'Domain' }, { k: 'model', label: 'Model' }, { k: 'n', label: 'Count', num: true }], rows: () => { const m = {}; A().filter(WST).forEach((a) => { const md = a.model || a.desc; const k = (a.domain || '—') + 'ￜ' + md; m[k] = m[k] || { domain: a.domain || '—', model: md, n: 0 }; m[k].n++; }); return Object.keys(m).sort().map((k) => m[k]); } },
        { id: 'monet', t: 'Model Count by Network', cols: [{ k: 'network', label: 'Network' }, { k: 'model', label: 'Model' }, { k: 'n', label: 'Count', num: true }], rows: () => { const m = {}; A().filter(WST).forEach((a) => { const md = a.model || a.desc; const k = (a.network || '—') + 'ￜ' + md; m[k] = m[k] || { network: a.network || '—', model: md, n: 0 }; m[k].n++; }); return Object.keys(m).sort().map((k) => m[k]); } },
        { id: 'mfdom', t: 'Manufacturer Count by Domain', cols: [{ k: 'domain', label: 'Domain' }, { k: 'brand', label: 'Manufacturer' }, { k: 'n', label: 'Count', num: true }], rows: () => { const m = {}; A().filter(WST).forEach((a) => { const k = (a.domain || '—') + 'ￜ' + (a.brand || '—'); m[k] = m[k] || { domain: a.domain || '—', brand: a.brand || '—', n: 0 }; m[k].n++; }); return Object.keys(m).sort().map((k) => m[k]); } },
        { id: 'mfnet', t: 'Manufacturer Count by Network', cols: [{ k: 'network', label: 'Network' }, { k: 'brand', label: 'Manufacturer' }, { k: 'n', label: 'Count', num: true }], rows: () => { const m = {}; A().filter(WST).forEach((a) => { const k = (a.network || '—') + 'ￜ' + (a.brand || '—'); m[k] = m[k] || { network: a.network || '—', brand: a.brand || '—', n: 0 }; m[k].n++; }); return Object.keys(m).sort().map((k) => m[k]); } },
      ],
    },
    {
      id: 'audit', label: 'Audit', reports: [
        { id: 'aws', t: 'Audit History by Workstation', cols: [{ k: 'date', label: 'Date', render: (r) => fmtDate(r.date) }, { k: 'assetId', label: 'Workstation', mono: true }, { k: 'type', label: 'Movement' }, { k: 'ft', label: 'From → To', render: (r) => esc([r.from && L.empName(r.from), r.to && L.empName(r.to)].filter(Boolean).join(' → ') || '—') }, { k: 'cond', label: 'Condition' }, { k: 'doc', label: 'Document', mono: true }, { k: 'remarks', label: 'Remarks' }], filters: [{ k: 'assetId', label: 'Workstation', options: () => L.uniq(db().moves.map((m) => m.assetId)).sort() }, { k: 'type', label: 'Movement', options: ['Issue', 'Return', 'Transfer', 'Status'] }], rows: () => db().moves.slice().sort((a, b) => String(a.date).localeCompare(String(b.date))), sort: 'date' },
        { id: 'atl', t: 'Audit History by Time Line', cols: [{ k: 'date', label: 'Date', render: (r) => fmtDate(r.date) }, { k: 'assetId', label: 'Asset', mono: true }, { k: 'type', label: 'Movement' }, { k: 'ft', label: 'From → To', render: (r) => esc([r.from && L.empName(r.from), r.to && L.empName(r.to)].filter(Boolean).join(' → ') || (r.after || '—')) }, { k: 'remarks', label: 'Remarks' }], rows: () => db().moves.slice().sort((a, b) => String(a.date).localeCompare(String(b.date))), sort: 'date' },
        { id: 'ach', t: 'Audit History by Changes', cols: [{ k: 'date', label: 'Date', render: (r) => fmtDate(r.date) }, { k: 'assetId', label: 'Asset', mono: true }, { k: 'type', label: 'Change' }, { k: 'after', label: 'New state' }, { k: 'cond', label: 'Condition' }, { k: 'doc', label: 'Document', mono: true }, { k: 'remarks', label: 'Remarks' }], filters: [{ k: 'type', label: 'Change', options: ['Issue', 'Return', 'Transfer', 'Status'] }], rows: () => db().moves.filter((m) => m.type === 'Status').slice().sort((a, b) => String(b.date).localeCompare(String(a.date))), sort: 'date', dir: -1 },
      ],
    },
    {
      id: 'po', label: 'Purchase', reports: [
        { id: 'pven', t: 'Purchase Orders by Vendor', cols: [{ k: 'k', label: 'Vendor' }, { k: 'n', label: 'Orders', num: true }, { k: 'v', label: 'Value', num: true, render: (r) => fmtNum(r.v, 2) }], rows: () => { const m = {}; db().pos.forEach((p) => { if (p.approval === 'Cancelled') return; const k = p.vendor || '—'; m[k] = m[k] || { k, n: 0, v: 0 }; m[k].n++; m[k].v += L.poTotals(p).incl; }); return Object.keys(m).sort().map((k) => m[k]); } },
        { id: 'pord', t: 'Purchase Orders by Ordered Date', cols: [{ k: 'k', label: 'Month ordered' }, { k: 'n', label: 'Orders', num: true }, { k: 'v', label: 'Value', num: true, render: (r) => fmtNum(r.v, 2) }], rows: () => { const m = {}; db().pos.forEach((p) => { if (p.approval === 'Cancelled') return; const k = mon(p.date) || '—'; m[k] = m[k] || { k, n: 0, v: 0 }; m[k].n++; m[k].v += L.poTotals(p).incl; }); return Object.keys(m).sort().map((k) => m[k]); } },
        { id: 'preq', t: 'Purchase Orders by Required Date', cols: [{ k: 'poNo', label: 'PO', mono: true }, { k: 'vendor', label: 'Vendor' }, { k: 'date', label: 'Ordered', render: (r) => fmtDate(r.date) }, { k: 'delivery', label: 'Required', render: (r) => fmtDate(r.delivery) || '—' }, { k: 'approval', label: 'Status', render: (r) => P(r.approval === 'Approved' ? 'Published' : r.approval === 'Cancelled' ? 'Expired' : 'Draft') }], rows: () => db().pos.slice().sort((a, b) => String(a.delivery || '9999').localeCompare(String(b.delivery || '9999'))), sort: 'delivery' },
        { id: 'psta', t: 'Purchase Orders by Status', cols: [{ k: 'k', label: 'Status' }, { k: 'n', label: 'Orders', num: true }], rows: () => countBy(db().pos, (p) => p.approval === 'Cancelled' ? 'Cancelled' : L.poReceipt(p)) },
        { id: 'pcc', t: 'Purchase Orders by Cost Center', cols: [{ k: 'k', label: 'Cost center' }, { k: 'n', label: 'Orders', num: true }, { k: 'v', label: 'Value', num: true, render: (r) => fmtNum(r.v, 2) }], rows: () => { const m = {}; db().pos.forEach((p) => { if (p.approval === 'Cancelled') return; const k = poCC(p); m[k] = m[k] || { k, n: 0, v: 0 }; m[k].n++; m[k].v += L.poTotals(p).incl; }); return Object.keys(m).sort().map((k) => m[k]); } },
      ],
    },
    {
      id: 'ctr', label: 'Contracts', reports: [
        { id: 'cact', t: 'Active Contracts', cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'title', label: 'Contract', render: (r) => `<b>${esc(r.title)}</b>` }, { k: 'vendor', label: 'Vendor' }, { k: 'end', label: 'Ends', render: (r) => fmtDate(r.end) }, { k: 'value', label: 'Value', num: true, render: (r) => fmtNum(r.value, 2) }], rows: () => U().filter((c) => c.status === 'Active'), sort: 'end' },
        { id: 'cmax', t: 'Contracts by Max Value', cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'title', label: 'Contract', render: (r) => `<b>${esc(r.title)}</b>` }, { k: 'vendor', label: 'Vendor' }, { k: 'value', label: 'Value', num: true, render: (r) => fmtNum(r.value, 2) }, { k: 'status', label: 'Status', render: (r) => P(r.status === 'Active' ? 'Published' : r.status === 'Expired' ? 'Expired' : 'Draft') }], rows: () => U().slice().sort((a, b) => b.value - a.value) },
        { id: 'csta', t: 'Contracts by Status', cols: [{ k: 'k', label: 'Status' }, { k: 'n', label: 'Contracts', num: true }], rows: () => countBy(U(), (c) => c.status) },
        { id: 'cven', t: 'Contracts by Vendor', cols: [{ k: 'k', label: 'Vendor' }, { k: 'n', label: 'Contracts', num: true }, { k: 'v', label: 'Value', num: true, render: (r) => fmtNum(r.v, 2) }], rows: () => { const m = {}; U().forEach((c) => { const k = c.vendor || '—'; m[k] = m[k] || { k, n: 0, v: 0 }; m[k].n++; m[k].v += c.value; }); return Object.keys(m).sort().map((k) => m[k]); } },
        { id: 'cexp', t: 'Expired Contracts', cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'title', label: 'Contract', render: (r) => `<b>${esc(r.title)}</b>` }, { k: 'vendor', label: 'Vendor' }, { k: 'end', label: 'Ended', render: (r) => fmtDate(r.end) }, { k: 'value', label: 'Value', num: true, render: (r) => fmtNum(r.value, 2) }], rows: () => U().filter((c) => c.status === 'Expired'), sort: 'end' },
        { id: 'ctot', t: 'Contracts by Total Price', cols: [{ k: 'k', label: 'Contract type' }, { k: 'n', label: 'Contracts', num: true }, { k: 'v', label: 'Total price', num: true, render: (r) => fmtNum(r.v, 2) }], rows: () => { const m = {}; U().forEach((c) => { const k = c.type || 'Contract'; m[k] = m[k] || { k, n: 0, v: 0 }; m[k].n++; m[k].v += c.value; }); return Object.keys(m).sort().map((k) => m[k]); } },
      ],
    },
  ];
  const repOf = (fam, id) => (FAM.find((f) => f.id === fam) || FAM[0]).reports.find((r) => r.id === id) || (FAM.find((f) => f.id === fam) || FAM[0]).reports[0];

  pages.reportsplus = {
    title: 'Advanced Reports', crumb: '41 canned reports — assets · software · workstations · audit · purchase · contracts', icon: 'receipt', color: '#2f6bff',
    render() {
      const fam = UI.curTab('reportsplus', 'assets');
      const F = FAM.find((f) => f.id === fam) || FAM[0];
      const sel = (UI.tab.rrep && F.reports.some((r) => r.id === UI.tab.rrep)) ? UI.tab.rrep : F.reports[0].id;
      UI.tab.rrep = sel;
      const R = repOf(F.id, sel);
      return `<div class="card">${UI.tabs('reportsplus', FAM.map((f) => ({ id: f.id, label: f.label })))}<div style="margin-bottom:12px"><label>Report <select class="in" id="repsel" style="max-width:420px;display:inline-block">${F.reports.map((r) => `<option value="${r.id}" ${r.id === sel ? 'selected' : ''}>${esc(r.t)}</option>`).join('')}</select> <b style="margin-left:8px">${R.rows().length}</b> <small style="color:var(--muted)">rows</small></label></div>${UI.table(Object.assign({ id: 'canned', rows: R.rows, sort: (R.cols[0] || {}).k || null, text: (r) => JSON.stringify(r) }, R.cols ? { cols: R.cols } : {}, R.filters ? { filters: R.filters } : {}, R.sort ? { sort: R.sort } : {}, R.dir ? { dir: R.dir } : {}, R.empty ? { empty: R.empty } : {}, { toolbar: `<span style="color:var(--muted);font-size:12.5px">${esc(R.t)}</span>` }))}</div>`;
    },
    after() {
      const s = document.getElementById('repsel');
      if (s) s.addEventListener('change', () => { UI.tab.rrep = s.value; S.emit(); });
    },
  };
})();

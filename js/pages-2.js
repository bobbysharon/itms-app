/* Pages 2: Purchase Requests, Purchase Orders (convert, receive, print) */
(function () {
  const ITMS = window.ITMS; const L = ITMS.logic; const UI = ITMS.ui; const S = ITMS.store;
  const { esc, fmtDate, fmtNum, money, pill, icon: ic } = UI;
  const pages = ITMS.pages; const db = () => S.db;
  const uoms = () => { const u = db().lists.uom.map((x) => x.name); return u.includes('Pieces') ? u : ['Pieces'].concat(u); };
  const vendorNames = () => db().vendors.map((v) => v.name).sort();
  const sel = (name, opts, val, extra) => `<select class="in" name="${name}" ${extra || ''}>${opts.map((o) => { const v = typeof o === 'object' ? o.v : o; const l = typeof o === 'object' ? o.l : o; return `<option value="${esc(v)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}</select>`;

  /* ======================= PURCHASE REQUESTS ======================= */
  const prTotals = (p) => ({ qty: p.lines.reduce((s, l) => s + l.qty, 0), ord: p.lines.reduce((s, l) => s + Math.min(l.qty, L.orderedQty(p.prNo, l.line)), 0) });
  pages.requests = {
    title: 'Purchase Requests', crumb: 'Raise requests, then convert selected lines to Purchase Orders — no re-typing', icon: 'filePlus', color: '#00a8e8', group: 'Procurement',
    render() {
      const d = db(); const tab = UI.curTab('requests', 'pr');
      const openLines = [];
      d.prs.forEach((p) => { if (p.status === 'Cancelled') return; p.lines.forEach((l) => { const rem = L.prRemaining(p.prNo, l.line, l.qty); if (rem > 0) openLines.push({ p, l, rem }); }); });
      let body;
      if (tab === 'pr') {
        body = UI.table({
          id: 'pr', rows: () => d.prs, sort: 'prNo', dir: -1, text: (r) => [r.prNo, r.requester, L.empName(r.requester), r.lines.map((l) => l.desc + ' ' + l.vendor).join(' ')].join(' '),
          filters: [{ k: 'st', label: 'Status', options: ['Open', 'Partially Ordered', 'Ordered', 'Cancelled'], get: (r) => L.prStatus(r) }, { k: 'type', label: 'Item type', options: L.ITEM_TYPES, get: (r) => r.lines[0] && r.lines[0].itemType }],
          cols: [
            { k: 'prNo', label: 'PR No', mono: true, render: (r) => `<a class="link" data-act="pr.view" data-id="${r.prNo}">${r.prNo}</a>` }, { k: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
            { k: 'req', label: 'Requested by', val: (r) => L.empName(r.requester), render: (r) => esc(L.empName(r.requester)) || '–' },
            { k: 'items', label: 'Items', val: (r) => r.lines.map((l) => l.desc).join(', '), render: (r) => `${esc(r.lines[0].desc)}${r.lines.length > 1 ? ` <span class="pill p-violet">+${r.lines.length - 1}</span>` : ''}` },
            { k: 'vendors', label: 'Vendor(s)', val: (r) => L.uniq(r.lines.map((l) => l.vendor)).join(', '), render: (r) => { const v = L.uniq(r.lines.map((l) => l.vendor)); return esc(v[0] || '') + (v.length > 1 ? ` <span class="pill p-grey">+${v.length - 1}</span>` : ''); } },
            { k: 'qty', label: 'Qty', num: true, val: (r) => prTotals(r).qty }, { k: 'ord', label: 'Ordered', num: true, val: (r) => prTotals(r).ord },
            { k: 'st', label: 'Status', val: (r) => L.prStatus(r), render: (r) => pill(L.prStatus(r)) },
          ],
          actions: (r) => { const st = L.prStatus(r); return `<button class="ibtn" title="View / print" data-act="pr.view" data-id="${r.prNo}">${ic('eye')}</button>${st === 'Open' || st === 'Partially Ordered' ? `<button class="ibtn" style="--c:#10d9a0" title="Convert to PO" data-act="po.convert" data-pr="${r.prNo}">${ic('link')}</button>` : ''}<button class="ibtn" title="Edit" data-act="pr.edit" data-id="${r.prNo}">${ic('edit')}</button><button class="ibtn" style="--c:#ff5c6c" title="Delete" data-act="pr.del" data-id="${r.prNo}">${ic('trash')}</button>`; },
          toolbar: `<button class="btn mint" data-act="po.convert">${ic('link')}Convert to PO</button><button class="btn" data-act="pr.new">${ic('plus')}New PR</button>`,
        });
      } else {
        body = UI.table({
          id: 'prl', rows: () => openLines.map((x) => ({ prNo: x.p.prNo, line: x.l.line, date: x.p.date, itemType: x.l.itemType, vendor: x.l.vendor, desc: x.l.desc, unit: x.l.unit, qty: x.l.qty, ordered: x.l.qty - x.rem, rem: x.rem })), sort: 'prNo', text: (r) => [r.prNo, r.desc, r.vendor].join(' '),
          filters: [{ k: 'itemType', label: 'Item type', options: L.ITEM_TYPES }, { k: 'vendor', label: 'Vendor', options: vendorNames }],
          cols: [{ k: 'prNo', label: 'PR No', mono: true, render: (r) => `<a class="link" data-act="pr.view" data-id="${r.prNo}">${r.prNo}</a>` }, { k: 'line', label: 'Line', num: true }, { k: 'date', label: 'Date', render: (r) => fmtDate(r.date) }, { k: 'itemType', label: 'Type' }, { k: 'vendor', label: 'Vendor' }, { k: 'desc', label: 'Description', render: (r) => `<b>${esc(r.desc)}</b>` }, { k: 'unit', label: 'Unit' }, { k: 'qty', label: 'Requested', num: true }, { k: 'ordered', label: 'Ordered', num: true }, { k: 'rem', label: 'Remaining', num: true, render: (r) => `<b style="color:var(--violet)">${r.rem}</b>` }],
          actions: (r) => `<button class="btn xs mint" data-act="po.convert" data-pr="${r.prNo}" data-line="${r.line}">${ic('link')}Convert</button>`,
          toolbar: `<button class="btn mint" data-act="po.convert">${ic('link')}Convert to PO</button>`, emptyTitle: 'All caught up', empty: 'Every requested line has been ordered.',
        });
      }
      return `${UI.tabs('requests', [{ id: 'pr', label: 'Purchase Requests', count: d.prs.length }, { id: 'lines', label: 'Open lines to order', count: openLines.length }])}<div class="card">${body}</div>`;
    },
  };

  function prEditor(pr) {
    const d = db(); const edit = !!pr; const p = pr || { date: L.today(), requester: '', dept: 'IT', notes: '', lines: [{ line: 0, itemType: 'Hardware', vendor: '', desc: '', unit: 'Pieces', qty: 1, notes: '' }] };
    const lineRow = (l) => { const ord = l.line ? L.orderedQty(p.prNo, l.line) : 0; return `<tr data-line="${l.line || 0}" data-ord="${ord}"><td class="mono">${l.line || 'new'}</td><td>${sel('itemType', L.ITEM_TYPES, l.itemType)}</td><td>${sel('vendor', [{ v: '', l: '— select —' }].concat(vendorNames()), l.vendor)}</td><td><input class="in" name="desc" value="${esc(l.desc)}" list="dl-items"></td><td>${sel('unit', uoms(), l.unit)}</td><td style="width:84px"><input class="in" type="number" min="${Math.max(1, ord)}" name="qty" value="${l.qty}"></td><td><input class="in" name="notes" value="${esc(l.notes)}"></td><td>${ord ? `<span class="pill p-mint" title="Already on a PO">${ord} ordered</span>` : `<button type="button" class="ibtn" data-rm>${ic('x')}</button>`}</td></tr>`; };
    const known = L.uniq(d.prs.flatMap((x) => x.lines.map((l) => l.desc))).sort();
    const ov = UI.modal(`<header><span class="gem" style="width:40px;height:40px;border-radius:14px">${ic('filePlus')}</span><div><h3>${edit ? 'Edit ' + p.prNo : 'New Purchase Request'}</h3><small>Lines can have different vendors — conversion creates one PO per vendor</small></div><button class="ibtn x" data-x>${ic('x')}</button></header>
    <form><div class="body"><datalist id="dl-items">${known.map((k) => `<option value="${esc(k)}">`).join('')}</datalist><div class="fgrid c3"><label class="f">Request date<input class="in" type="date" name="date" value="${p.date}" required></label>
    <label class="f">Requested by${sel('requester', [{ v: '', l: '— optional —' }].concat(d.employees.filter((e) => e.status === 'Active' && !e.sys).map((e) => ({ v: e.no, l: e.name + ' (' + e.no + ')' }))), p.requester)}</label><label class="f">Department<input class="in" name="dept" value="${esc(p.dept || '')}"></label><label class="f full">Notes<input class="in" name="notes" value="${esc(p.notes || '')}"></label></div>
    <div class="twrap mt" style="max-height:340px"><table class="t wizard-lines"><thead><tr><th class="nosort">#</th><th class="nosort">Type</th><th class="nosort">Vendor *</th><th class="nosort">Description *</th><th class="nosort">Unit</th><th class="nosort">Qty</th><th class="nosort">Notes / specifications</th><th class="nosort"></th></tr></thead><tbody id="prl">${p.lines.map(lineRow).join('')}</tbody></table></div><button type="button" class="btn ghost sm mt" data-add>${ic('plus')}Add line</button></div>
    <footer><button type="button" class="btn ghost" data-x>Cancel</button><button class="btn" type="submit">${ic('check')}${edit ? 'Save changes' : 'Create PR'}</button></footer></form>`, { size: 'xl', sticky: true });
    ov.addEventListener('click', (e) => {
      if (e.target.closest('[data-x]')) UI.close(ov);
      if (e.target.closest('[data-add]')) ov.querySelector('#prl').insertAdjacentHTML('beforeend', lineRow({ line: 0, itemType: 'Hardware', vendor: '', desc: '', unit: 'Pieces', qty: 1, notes: '' }));
      const rm = e.target.closest('[data-rm]'); if (rm) { const tb = ov.querySelector('#prl'); if (tb.children.length > 1) rm.closest('tr').remove(); else UI.toast('A PR needs at least one line', 'err'); }
    });
    ov.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault(); const f = e.target;
      const lines = [...ov.querySelectorAll('#prl tr')].map((tr) => { const g = (n) => tr.querySelector(`[name="${n}"]`).value; return { line: +tr.dataset.line || 0, itemType: g('itemType'), vendor: g('vendor'), desc: g('desc').trim(), unit: g('unit'), qty: Math.floor(+g('qty')), notes: g('notes') }; });
      for (const l of lines) { if (!l.desc) return UI.toast('Every line needs a description', 'err'); if (!l.vendor) return UI.toast(`Select a vendor for "${l.desc}"`, 'err'); if (!(l.qty > 0)) return UI.toast('Quantity must be at least 1', 'err'); }
      UI.run(() => { L.savePR({ date: f.date.value, requester: f.requester.value, dept: f.dept.value, notes: f.notes.value, lines }, edit ? p.prNo : null); UI.close(ov); }, edit ? 'PR updated' : 'PR created');
    });
  }
  UI.on('pr.new', () => prEditor());
  UI.on('pr.edit', (el) => prEditor(L.pr(el.dataset.id)));
  UI.on('pr.del', async (el) => { if (await UI.confirm(`Delete <b>${esc(el.dataset.id)}</b>?`, 'Delete', true)) UI.run(() => L.deletePR(el.dataset.id), 'PR deleted'); });
  UI.on('pr.cancel', async (el) => { if (await UI.confirm('Cancel this request?', 'Cancel PR', true)) { const p = L.pr(el.dataset.id); p.status = 'Cancelled'; S.emit(); UI.toast('PR cancelled'); } });
  UI.on('pr.view', (el) => {
    const p = L.pr(el.dataset.id); const st = L.prStatus(p); const vendors = L.uniq(p.lines.map((l) => l.vendor));
    const ov = UI.modal(`<header><span class="gem" style="width:44px;height:44px">${ic('filePlus')}</span><div><h3>${p.prNo}</h3><small>${fmtDate(p.date)} · ${esc(L.empName(p.requester) || 'no requester')}</small></div><span style="margin-left:auto">${pill(st)}</span><button class="ibtn" data-x>${ic('x')}</button></header>
    <div class="body"><table class="t"><thead><tr><th>Line</th><th>Type</th><th>Vendor</th><th>Description</th><th>Unit</th><th class="num">Requested</th><th class="num">Ordered</th><th class="num">Remaining</th><th>PO(s)</th></tr></thead><tbody>${p.lines.map((l) => { const key = L.prLineKey(p.prNo, l.line); const pos = db().pos.filter((x) => x.lines.some((y) => y.prRef === key)).map((x) => `<a class="link" data-act="po.view" data-id="${x.poNo}">${x.poNo}</a>`).join(', '); const o = L.orderedQty(p.prNo, l.line); return `<tr><td>${l.line}</td><td>${l.itemType}</td><td>${esc(l.vendor)}</td><td><b>${esc(l.desc)}</b><br><small>${esc(l.notes)}</small></td><td>${esc(l.unit)}</td><td class="num">${l.qty}</td><td class="num">${o}</td><td class="num"><b>${Math.max(0, l.qty - o)}</b></td><td>${pos || '–'}</td></tr>`; }).join('')}</tbody></table>
    <div class="mt">${vendors.map((v) => `<button class="btn xs ghost" data-act="pr.print" data-id="${p.prNo}" data-vendor="${esc(v)}">${ic('print')}${esc(v)}</button>`).join(' ')}</div></div>
    <footer>${st === 'Open' || st === 'Partially Ordered' ? `<button class="btn mint" data-act="po.convert" data-pr="${p.prNo}">${ic('link')}Convert to PO</button>` : ''}<button class="btn ghost" data-act="pr.edit" data-id="${p.prNo}">${ic('edit')}Edit</button>${st === 'Open' ? `<button class="btn ghost" data-act="pr.cancel" data-id="${p.prNo}">Cancel PR</button>` : ''}</footer>`, { size: 'xl' });
    ov.addEventListener('click', (e) => { if (e.target.closest('[data-x]') || (e.target.closest('[data-act]') && !e.target.closest('[data-act="pr.print"],[data-act="po.view"]'))) UI.close(ov); });
  });
  UI.on('pr.print', (el) => {
    const p = L.pr(el.dataset.id); const vn = el.dataset.vendor; const v = L.vendor(vn) || {}; const co = db().company; const lines = p.lines.filter((l) => l.vendor === vn);
    UI.doc('Purchase Request ' + p.prNo, `${UI.docHead('Purchase Request')}<div class="meta"><div><b>PR Number:</b>${p.prNo}</div><div><b>Request date:</b>${fmtDate(p.date)}</div><div><b>Ship to:</b>${esc(co.name)}</div><div><b>Ship-to address:</b>${esc(co.address)}</div><div><b>Vendor:</b>${esc(vn)}</div><div><b>Vendor address:</b>${esc(UI.fullAddr(v))}</div><div><b>Contact name:</b>${esc(v.contact)}</div><div><b>Contact email:</b>${esc(v.email)}</div><div><b>Contact phone:</b>${esc([v.phone1, v.phone2].filter(Boolean).join(' / '))}</div></div>
    <p><b>Subject:</b> Request for Quotation / Purchase of Goods and Services</p><p>Dear ${esc(v.contact || 'Sir / Madam')},<br>Kindly provide your best quotation, with delivery lead time and warranty terms, for the items listed below.</p>
    <table><thead><tr><th>Line No</th><th>Item Description</th><th>Unit</th><th class="r">Quantity</th><th>Notes / Specifications</th></tr></thead><tbody>${lines.map((l) => `<tr><td>${p.prNo}-${l.line}</td><td>${esc(l.desc)}</td><td>${esc(l.unit)}</td><td class="r">${l.qty}</td><td>${esc(l.notes)}</td></tr>`).join('')}</tbody></table><div class="sig"><div>Requested by</div><div>Approved by</div><div>Signature</div></div>`);
  });

  /* ======================= CONVERT PR → PO ======================= */
  UI.on('po.convert', (el) => {
    const d = db(); const onlyPr = el && el.dataset ? el.dataset.pr : ''; const onlyLine = el && el.dataset && el.dataset.line ? +el.dataset.line : 0;
    const rows = [];
    d.prs.forEach((p) => { if (p.status === 'Cancelled' || (onlyPr && p.prNo !== onlyPr)) return; p.lines.forEach((l) => { const rem = L.prRemaining(p.prNo, l.line, l.qty); if (rem > 0 && (!onlyLine || l.line === onlyLine)) rows.push({ p, l, rem, key: p.prNo + '|' + l.line, price: L.lastPrice(l.desc) }); }); });
    if (!rows.length) return UI.toast('No open PR lines to convert — everything is already ordered.', 'warn');
    const vendors = L.uniq(rows.map((r) => r.l.vendor)).sort(); const prs = L.uniq(rows.map((r) => r.p.prNo));
    const pre = !!onlyPr;
    const ov = UI.modal(`<header><span class="gem" style="width:44px;height:44px;background:var(--grad-mint)">${ic('link')}</span><div><h3>Convert Purchase Request → Purchase Order</h3><small>Everything is mapped automatically — tick lines, adjust quantity if you need a partial order</small></div><button class="ibtn x" data-x>${ic('x')}</button></header>
    <div class="body"><div class="tbar"><div class="qs"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg><input class="in" id="cq"></div>
    <select class="in" id="cp"><option value="">All PRs</option>${prs.map((x) => `<option>${x}</option>`).join('')}</select><select class="in" id="cv"><option value="">All vendors</option>${vendors.map((x) => `<option>${esc(x)}</option>`).join('')}</select><span class="grow"></span><button type="button" class="btn ghost sm" id="sa">Select visible</button><button type="button" class="btn ghost sm" id="sn">Clear</button></div>
    <div class="twrap" style="max-height:48vh"><table class="t wizard-lines"><thead><tr><th class="nosort" style="width:34px"></th><th class="nosort">PR / Line</th><th class="nosort">Vendor</th><th class="nosort">Item</th><th class="nosort num">Requested</th><th class="nosort num">Ordered</th><th class="nosort num">Remaining</th><th class="nosort" style="width:100px">Order qty</th><th class="nosort" style="width:118px">Unit price</th></tr></thead><tbody id="cb">
    ${rows.map((r) => `<tr data-k="${r.key}" data-t="${esc((r.p.prNo + ' ' + r.l.desc + ' ' + r.l.vendor).toLowerCase())}" data-pr="${r.p.prNo}" data-v="${esc(r.l.vendor)}"><td><input type="checkbox" class="ck" ${pre ? 'checked' : ''} style="accent-color:#2f6bff;width:17px;height:17px"></td><td class="mono">${r.p.prNo}-${r.l.line}</td><td>${esc(r.l.vendor)}</td><td><b>${esc(r.l.desc)}</b> <span class="pill p-grey">${r.l.itemType}</span></td><td class="num">${r.l.qty}</td><td class="num">${r.l.qty - r.rem}</td><td class="num"><b>${r.rem}</b></td><td><input class="in qty" type="number" min="1" max="${r.rem}" value="${r.rem}"></td><td><input class="in price" type="number" min="0" step="0.01" value="${r.price || ''}"></td></tr>`).join('')}</tbody></table></div></div>
    <footer><span class="note" id="cs">0 lines selected</span><label class="chk" style="margin-right:6px"><input type="checkbox" id="aa"> Approve immediately</label><button class="btn ghost" data-x>Cancel</button><button class="btn mint" id="go">${ic('check')}Create PO(s)</button></footer>`, { size: 'xl', sticky: true });
    const $ = (s) => ov.querySelector(s); const trs = () => [...ov.querySelectorAll('#cb tr')];
    const upd = () => { const sel = trs().filter((t) => t.querySelector('.ck').checked); const vs = new Set(sel.map((t) => t.dataset.v)); $('#cs').textContent = `${sel.length} line(s) selected → ${vs.size} PO(s) will be created`; };
    const filt = () => { const q = $('#cq').value.toLowerCase(), p = $('#cp').value, v = $('#cv').value; trs().forEach((t) => { t.style.display = (!q || t.dataset.t.includes(q)) && (!p || t.dataset.pr === p) && (!v || t.dataset.v === v) ? '' : 'none'; }); };
    ov.addEventListener('input', (e) => { if (['cq'].includes(e.target.id)) filt(); if (e.target.classList.contains('qty')) { const t = e.target.closest('tr'); t.querySelector('.ck').checked = true; const mx = +e.target.max; if (+e.target.value > mx) e.target.value = mx; upd(); } if (e.target.classList.contains('price')) e.target.closest('tr').querySelector('.ck').checked = true, upd(); });
    ov.addEventListener('change', (e) => { if (e.target.id === 'cp' || e.target.id === 'cv') filt(); if (e.target.classList.contains('ck')) upd(); });
    ov.addEventListener('click', (e) => {
      if (e.target.closest('[data-x]')) UI.close(ov);
      if (e.target.closest('#sa')) { trs().forEach((t) => { if (t.style.display !== 'none') t.querySelector('.ck').checked = true; }); upd(); }
      if (e.target.closest('#sn')) { trs().forEach((t) => (t.querySelector('.ck').checked = false)); upd(); }
      if (e.target.closest('#go')) {
        const sel = trs().filter((t) => t.querySelector('.ck').checked).map((t) => { const [prNo, line] = t.dataset.k.split('|'); return { prNo, line: +line, qty: t.querySelector('.qty').value, price: t.querySelector('.price').value }; });
        if (!sel.length) return UI.toast('Tick at least one line', 'err');
        const made = UI.run(() => L.createPOsFromPR(sel, { autoApprove: $('#aa').checked }));
        if (made) { UI.close(ov); UI.toast(`Created ${made.length} PO(s): ${made.slice(0, 3).join(', ')}${made.length > 3 ? '…' : ''}`); if (made.length === 1) setTimeout(() => UI.acts['po.view']({ dataset: { id: made[0] } }), 200); else { UI.tab.orders = 'po'; location.hash = '#/orders'; } }
      }
    });
    upd();
  });

  /* ======================= PURCHASE ORDERS ======================= */
  const poLabel = (p) => L.uniq(p.lines.map((l) => l.desc))[0] + (p.lines.length > 1 ? ` +${p.lines.length - 1}` : '');
  pages.orders = {
    title: 'Purchase Orders', crumb: 'Approve → receive goods (GRN) → stock updates automatically', icon: 'cart', color: '#3b82f6', group: 'Procurement',
    render() {
      const d = db(); const tab = UI.curTab('orders', 'po'); let body;
      const invCount = (((d.sdp || {}).fin) || {}).invoices || []).length;
      if (tab === 'po') {
        body = UI.table({
          id: 'po', rows: () => d.pos, sort: 'poNo', dir: -1, text: (r) => [r.poNo, r.vendor, r.lines.map((l) => l.desc + ' ' + l.prRef).join(' ')].join(' '),
          filters: [{ k: 'approval', label: 'Approval', options: ['Draft', 'Approved', 'Rejected', 'Cancelled'] }, { k: 'rc', label: 'Goods', options: ['Pending', 'Partial', 'Received'], get: (r) => L.poReceipt(r) }, { k: 'invoice', label: 'Invoice', options: ['Pending', 'Invoiced', 'Paid'] }, { k: 'vendor', label: 'Vendor', options: vendorNames }],
          cols: [
            { k: 'poNo', label: 'PO No', mono: true, render: (r) => `<a class="link" data-act="po.view" data-id="${r.poNo}">${r.poNo}</a>` }, { k: 'date', label: 'Date', render: (r) => fmtDate(r.date) }, { k: 'vendor', label: 'Vendor' },
            { k: 'items', label: 'Items', val: (r) => poLabel(r), render: (r) => esc(poLabel(r)) }, { k: 'qty', label: 'Qty', num: true, val: (r) => r.lines.reduce((s, l) => s + l.qty, 0) },
            { k: 'total', label: 'Total incl. VAT', num: true, val: (r) => L.poTotals(r).incl, render: (r) => `${r.currency} ${fmtNum(L.poTotals(r).incl, 2)}` },
            { k: 'approval', label: 'Approval', render: (r) => pill(r.approval) }, { k: 'rc', label: 'Goods', val: (r) => L.poReceipt(r), render: (r) => pill(L.poReceipt(r)) }, { k: 'invoice', label: 'Invoice', render: (r) => pill(r.invoice) },
          ],
          actions: (r) => { const rc = L.poReceipt(r); return `<button class="ibtn" title="View / print" data-act="po.view" data-id="${r.poNo}">${ic('eye')}</button>${r.approval === 'Draft' ? `<button class="ibtn" style="--c:#10d9a0" title="Approve" data-act="po.approve" data-id="${r.poNo}">${ic('check')}</button>` : ''}${r.approval === 'Approved' && rc !== 'Received' ? `<button class="ibtn" style="--c:#00c2ff" title="Receive goods (GRN)" data-act="po.receive" data-id="${r.poNo}">${ic('receipt')}</button>` : ''}<button class="ibtn" title="Edit" data-act="po.edit" data-id="${r.poNo}">${ic('edit')}</button>`; },
          toolbar: `<button class="btn mint" data-act="po.convert">${ic('link')}Convert PR → PO</button>`,
        });
      } else if (tab === 'grn') {
        body = UI.table({
          id: 'grn', rows: () => d.grns.slice(), sort: 'grnNo', dir: -1, text: (r) => [r.grnNo, r.poNo, r.lines.map((l) => l.desc).join(' ')].join(' '),
          cols: [{ k: 'grnNo', label: 'GRN No', mono: true, render: (r) => `<b>${r.grnNo}</b>` }, { k: 'date', label: 'Date', render: (r) => fmtDate(r.date) }, { k: 'poNo', label: 'PO No', mono: true, render: (r) => `<a class="link" data-act="po.view" data-id="${r.poNo}">${r.poNo}</a>` }, { k: 'vendor', label: 'Vendor', val: (r) => (L.po(r.poNo) || {}).vendor }, { k: 'items', label: 'Items received', val: (r) => r.lines.map((l) => l.desc).join(', '), render: (r) => esc(r.lines.map((l) => `${l.qty} × ${l.desc}`).join('; ')) }, { k: 'qty', label: 'Qty', num: true, val: (r) => r.lines.reduce((s, l) => s + l.qty, 0) }],
          actions: (r) => `<button class="ibtn" title="Print GRN" data-act="grn.print" data-id="${r.grnNo}">${ic('print')}</button> <button class="btn xs" data-act="grn.generateInvoice" data-id="${r.grnNo}">${ic('receipt')}Invoice</button>`, empty: 'Receive goods against an approved PO to create a GRN.',
        });
      } else if (tab === 'inv') {
        const invs = (((d.sdp || {}).fin) || {}).invoices || [];
        body = UI.table({
          id: 'inv', rows: () => invs.slice(), sort: 'date', dir: -1, text: (r) => [r.id, r.poNo, r.vendor].join(' '),
          cols: [
            { k: 'id', label: 'Invoice No', mono: true, render: (r) => `<b>${r.id}</b>` },
            { k: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
            { k: 'poNo', label: 'PO No', mono: true, render: (r) => `<a class="link" data-act="po.view" data-id="${r.poNo}">${r.poNo}</a>` },
            { k: 'grnNo', label: 'GRN No', mono: true, render: (r) => esc(r.grnNo || '—') },
            { k: 'vendor', label: 'Vendor' },
            { k: 'total', label: 'Total', num: true, render: (r) => `${r.currency} ${fmtNum(r.total, 2)}` },
            { k: 'status', label: 'Status', render: (r) => pill(r.status) },
          ],
          actions: (r) => `<button class="ibtn" title="View" data-act="inv.view" data-id="${r.id}">${ic('eye')}</button><button class="ibtn" title="Print" data-act="inv.print" data-id="${r.id}">${ic('print')}</button>`,
          empty: 'No invoices yet — generate one from a PO or GRN.',
        });
      }
      return `${UI.tabs('orders', [{ id: 'po', label: 'Purchase Orders', count: d.pos.length }, { id: 'grn', label: 'Goods Receipts (GRN)', count: d.grns.length }, { id: 'inv', label: 'Invoices', count: invCount }])}<div class="card">${body}</div>`;
    },
  };
  UI.on('po.approve', async (el) => {
    const p = L.po(el.dataset.id); const zero = p.lines.filter((l) => !(l.price > 0));
    if (zero.length && !(await UI.confirm(`${zero.length} line(s) have no unit price yet. Approve anyway? (You can still edit prices later.)`, 'Approve'))) return;
    UI.run(() => L.setPOApproval(p.poNo, 'Approved'), 'PO approved');
  });
  UI.on('po.cancel', async (el) => { if (await UI.confirm('Cancel this PO? Quantities return to the PR.', 'Cancel PO', true)) UI.run(() => L.setPOApproval(el.dataset.id, 'Cancelled'), 'PO cancelled'); });
  UI.on('po.paid', (el) => { const p = L.po(el.dataset.id); p.invoice = 'Paid'; S.emit(); UI.toast('Marked as paid'); });
  UI.on('po.del', async (el) => { if (await UI.confirm('Delete this PO?', 'Delete', true)) UI.run(() => L.deletePO(el.dataset.id), 'PO deleted'); });

  UI.on('po.view', (el) => {
    const p = L.po(el.dataset.id); const t = L.poTotals(p); const rc = L.poReceipt(p); const grns = db().grns.filter((g) => g.poNo === p.poNo);
    const ov = UI.modal(`<header><span class="gem" style="width:44px;height:44px;background:var(--grad)">${ic('cart')}</span><div><h3>${p.poNo}</h3><small>${esc(p.vendor)} · ${fmtDate(p.date)} · ${esc((L.term(p.paymentTerms) || {}).id || 'no terms')}</small></div><span style="margin-left:auto;display:flex;gap:6px">${pill(p.approval)}${pill(rc)}${pill(p.invoice)}</span><button class="ibtn" data-x>${ic('x')}</button></header>
    <div class="body"><table class="t"><thead><tr><th>Line</th><th>PR ref</th><th>Type</th><th>Class</th><th>Description</th><th class="num">Unit price</th><th class="num">Qty</th><th class="num">Received</th><th class="num">Total</th></tr></thead><tbody>${p.lines.map((l) => `<tr><td>${l.line}</td><td class="mono">${esc(l.prRef)}</td><td>${l.itemType}</td><td>${esc(l.assetType)}${l.subtype ? ' · ' + esc(l.subtype) : ''}</td><td><b>${esc(l.desc)}</b></td><td class="num">${fmtNum(l.price, 2)}</td><td class="num">${l.qty}</td><td class="num">${pill(String(l.received || 0) + '/' + l.qty, (l.received || 0) >= l.qty ? 'mint' : l.received ? 'amber' : 'grey')}</td><td class="num">${fmtNum(L.lineTotals(p, l).total, 2)}</td></tr>`).join('')}</tbody></table>
    <div style="display:flex;justify-content:flex-end;margin-top:12px"><dl class="kv" style="grid-template-columns:150px 140px;text-align:right"><dt>Sub total</dt><dd>${fmtNum(t.excl, 2)}</dd><dt>VAT ${db().company.vat}% ${p.vatIncl === 'Yes' ? '(included)' : ''}</dt><dd>${fmtNum(t.vat, 2)}</dd><dt style="color:var(--ink)">Total ${esc(p.currency)}</dt><dd style="font-size:17px;color:var(--violet)">${fmtNum(t.incl, 2)}</dd></dl></div>
    ${grns.length ? `<div class="note-box mt"><b>Goods receipts:</b> ${grns.map((g) => `<a class="link" data-act="grn.print" data-id="${g.grnNo}">${g.grnNo}</a> (${fmtDate(g.date)})`).join(' · ')}</div>` : ''}${(() => { const fj = ((((db().sdp || {}).fin) || {}).jv || []).filter((e) => e.ref === p.poNo || grns.some((g) => e.ref === g.grnNo)); return fj.length ? `<div class="mt"><b>Finance trail:</b> ${fj.map((e) => `<a class="link" data-act="jv.view" data-id="${e.id}">${e.id}</a> (${esc(e.type)} ${fmtNum(e.total, 2)})`).join(' · ')}</div>` : ''; })()}</div>
    <footer><button class="btn ghost" data-act="po.print" data-id="${p.poNo}">${ic('print')}Print PO</button>${p.approval === 'Draft' ? `<button class="btn mint" data-act="po.approve" data-id="${p.poNo}">${ic('check')}Approve</button>` : ''}${p.approval === 'Approved' && rc !== 'Received' ? `<button class="btn" data-act="po.receive" data-id="${p.poNo}">${ic('receipt')}Receive goods</button>` : ''}${p.approval === 'Approved' && p.invoice !== 'Paid' ? `<button class="btn ghost" data-act="po.paid" data-id="${p.poNo}">Mark paid</button>` : ''}<button class="btn ghost" data-act="po.edit" data-id="${p.poNo}">${ic('edit')}Edit</button>${rc === 'Pending' && p.approval !== 'Cancelled' ? `<button class="btn ghost" data-act="po.cancel" data-id="${p.poNo}">Cancel</button><button class="btn hot" data-act="po.del" data-id="${p.poNo}">${ic('trash')}</button>` : ''}${p.approval === 'Approved' && grns.length && p.invoice === 'Pending' ? `<button class="btn" style="background:#1d4ed8" data-act="po.generateInvoice" data-id="${p.poNo}">${ic('receipt')}Generate Invoice</button>` : ''}</footer>`, { size: 'xl' });
    ov.addEventListener('click', (e) => { const a = e.target.closest('[data-act]'); if (e.target.closest('[data-x]') || (a && !['po.print', 'grn.print', 'jv.view', 'po.generateInvoice', 'grn.generateInvoice'].includes(a.dataset.act))) UI.close(ov); });
  });

  UI.on('po.print', (el) => {
    const p = L.po(el.dataset.id); const v = L.vendor(p.vendor) || {}; const co = db().company; const t = L.poTotals(p);
    UI.doc('Purchase Order ' + p.poNo, `${UI.docHead('Purchase Order')}<div class="meta"><div><b>PO Number:</b>${p.poNo}</div><div><b>Order date:</b>${fmtDate(p.date)}</div><div><b>Payment terms:</b>${esc(p.paymentTerms)}</div><div><b>Currency:</b>${esc(p.currency)}</div><div><b>Ship to:</b>${esc(co.name)}</div><div><b>Ship-to address:</b>${esc(co.address)}</div><div><b>Vendor:</b>${esc(p.vendor)}</div><div><b>Vendor address:</b>${esc(UI.fullAddr(v))}</div><div><b>Contact name:</b>${esc(v.contact)}</div><div><b>Contact email:</b>${esc(v.email)}</div><div><b>Contact phone:</b>${esc([v.phone1, v.phone2].filter(Boolean).join(' / '))}</div></div>
    <h2 style="margin:12px 0 4px;font-size:13px">Item details</h2><table><thead><tr><th>PO Line No</th><th>Item Description</th><th class="r">Price per Unit</th><th class="r">Total Quantity</th><th class="r">Total Price</th></tr></thead><tbody>${p.lines.map((l) => `<tr><td>${p.poNo}-${l.line}</td><td>${esc(l.desc)}</td><td class="r">${fmtNum(l.price, 2)}</td><td class="r">${l.qty}</td><td class="r">${fmtNum(L.lineTotals(p, l).total, 2)}</td></tr>`).join('')}
    <tr><td colspan="4" class="r"><b>Sub Total</b></td><td class="r">${fmtNum(p.vatIncl === 'Yes' ? t.total : t.excl, 2)}</td></tr><tr><td colspan="4" class="r"><b>Is VAT included</b></td><td class="r">${p.vatIncl}</td></tr><tr><td colspan="4" class="r"><b>VAT amount (${db().company.vat}%)</b></td><td class="r">${p.vatIncl === 'Yes' ? '0.00' : fmtNum(t.vat, 2)}</td></tr><tr><td colspan="4" class="r"><b>Total</b></td><td class="r"><b>${fmtNum(t.incl, 2)}</b></td></tr></tbody></table>
    <p class="words">${UI.amountWords(t.incl, p.currency)}</p><div class="sig"><div>Prepared by</div><div>Approved by</div><div>Vendor acceptance</div></div>`);
  });
  UI.on('grn.print', (el) => {
    const g = db().grns.find((x) => x.grnNo === el.dataset.id); const p = L.po(g.poNo) || {};
    UI.doc('GRN ' + g.grnNo, `${UI.docHead('Goods Receipt Note')}<div class="meta"><div><b>GRN number:</b>${g.grnNo}</div><div><b>Date:</b>${fmtDate(g.date)}</div><div><b>PO number:</b>${g.poNo}</div><div><b>Vendor:</b>${esc(p.vendor)}</div></div><table><thead><tr><th>Line</th><th>Description</th><th class="r">Qty received</th></tr></thead><tbody>${g.lines.map((l) => `<tr><td>${l.line}</td><td>${esc(l.desc)}</td><td class="r">${l.qty}</td></tr>`).join('')}</tbody></table><div class="sig"><div>Received by (IT)</div><div>Store keeper</div><div>Approved by</div></div>`);
  });

  /* ---- receive goods ---- */
  UI.on('po.receive', (el) => {
    const p = L.po(el.dataset.id); const lines = p.lines.filter((l) => l.qty - (l.received || 0) > 0);
    const eff = { Hardware: (n) => `${n} hardware asset record(s) in <b>In Stock</b>`, Software: (n) => `+${n} licence(s) in the software register`, Consumable: (n) => `+${n} unit(s) of consumable stock` };
    const ov = UI.modal(`<header><span class="gem" style="width:44px;height:44px;background:var(--grad-mint)">${ic('receipt')}</span><div><h3>Receive goods — ${p.poNo}</h3><small>${esc(p.vendor)} · posting a GRN updates stock automatically</small></div><button class="ibtn x" data-x>${ic('x')}</button></header>
    <div class="body"><label class="f" style="max-width:240px;margin-bottom:12px">GRN / delivery date<input class="in" type="date" id="gd" value="${L.today()}"></label>
    <div class="twrap" style="max-height:46vh"><table class="t wizard-lines"><thead><tr><th class="nosort">Line</th><th class="nosort">Item</th><th class="nosort num">Ordered</th><th class="nosort num">Outstanding</th><th class="nosort" style="width:100px">Receive now</th><th class="nosort">Serial numbers <small>(optional, one per line)</small></th><th class="nosort">Stock effect</th></tr></thead><tbody>
    ${lines.map((l) => { const o = l.qty - (l.received || 0); return `<tr data-line="${l.line}" data-type="${l.itemType}"><td>${l.line}</td><td><b>${esc(l.desc)}</b><br><small>${esc(l.assetType)}</small></td><td class="num">${l.qty}</td><td class="num">${o}</td><td><input class="in rq" type="number" min="0" max="${o}" value="${o}"></td><td>${l.itemType === 'Consumable' ? '' : `<textarea class="in sr" rows="1"></textarea>`}</td><td class="fx" style="font-size:12px">${eff[l.itemType](o)}</td></tr>`; }).join('')}</tbody></table></div></div>
    <footer><button class="btn ghost" data-x>Cancel</button><button class="btn mint" id="rg">${ic('check')}Post GRN</button></footer>`, { size: 'xl', sticky: true });
    ov.addEventListener('input', (e) => { if (e.target.classList.contains('rq')) { const tr = e.target.closest('tr'); const mx = +e.target.max; if (+e.target.value > mx) e.target.value = mx; tr.querySelector('.fx').innerHTML = eff[tr.dataset.type](+e.target.value || 0); } });
    ov.addEventListener('click', (e) => {
      if (e.target.closest('[data-x]')) UI.close(ov);
      if (e.target.closest('#rg')) {
        const items = [...ov.querySelectorAll('tbody tr')].map((tr) => ({ line: +tr.dataset.line, qty: tr.querySelector('.rq').value, serials: tr.querySelector('.sr') ? tr.querySelector('.sr').value : '' })).filter((x) => +x.qty > 0);
        const r = UI.run(() => L.receivePO(p.poNo, items, { date: ov.querySelector('#gd').value }));
        if (r) { UI.close(ov); const c = r.created; UI.toast(`${r.grn.grnNo} posted — ${c.hw.length} asset(s), ${c.sw.length} licence line(s), ${c.cons.length} consumable line(s) added to stock`); }
      }
    });
  });

  /* ---- edit PO ---- */
  UI.on('po.edit', (el) => {
    const p = L.po(el.dataset.id); const d = db();
    const clsOpts = (l) => (l.itemType === 'Hardware' ? d.lists.hwTypes.map((t) => t.type) : l.itemType === 'Software' ? d.lists.swTypes.map((t) => t.type) : d.lists.consTypes.map((t) => t.type));
    const subOpts = (l, cls) => (l.itemType === 'Hardware' ? (L.typeCfg(cls) || { subtypes: [] }).subtypes : l.itemType === 'Software' ? d.lists.subscriptionTypes : (d.lists.consTypes.find((t) => t.type === cls) || { subtypes: [] }).subtypes);
    const row = (l) => `<tr data-line="${l.line}" data-it="${l.itemType}"><td>${l.line}</td><td><b>${esc(l.desc)}</b><br><small class="mono">${esc(l.prRef)}</small></td><td>${sel('assetType', clsOpts(l), l.assetType, (l.received ? 'disabled' : ''))}</td><td>${sel('subtype', [''].concat(subOpts(l, l.assetType)), l.subtype, (l.received ? 'disabled' : ''))}</td><td><input class="in" type="number" step="0.01" min="0" name="price" value="${l.price}"></td><td><input class="in" type="number" min="${Math.max(1, l.received || 0)}" name="qty" value="${l.qty}"></td><td class="num tt">0.00</td></tr>`;
    const ov = UI.modal(`<header><span class="gem" style="width:40px;height:40px;border-radius:14px">${ic('edit')}</span><div><h3>Edit ${p.poNo}</h3><small>${esc(p.vendor)} · quantities cannot exceed the PR's remaining quantity</small></div><button class="ibtn x" data-x>${ic('x')}</button></header>
    <form><div class="body"><div class="fgrid c3"><label class="f">Order date<input class="in" type="date" name="date" value="${p.date}"></label><label class="f">VAT included in prices?${sel('vatIncl', ['No', 'Yes'], p.vatIncl)}</label><label class="f">Payment terms${sel('paymentTerms', d.terms.map((t) => t.id), p.paymentTerms)}</label>
    <label class="f">Expected delivery<input class="in" type="date" name="delivery" value="${p.delivery || ''}"></label><label class="f">Approval${sel('approval', ['Draft', 'Approved', 'Rejected'].concat(p.approval === 'Cancelled' ? ['Cancelled'] : []), p.approval)}</label><label class="f">Invoice status${sel('invoice', ['Pending', 'Invoiced', 'Paid'], p.invoice)}</label><label class="f">Cost center<input class="in" name="costCenter" value="${esc(p.costCenter || '')}"></label>
    <label class="f">AMC included?${sel('amcAvail', ['No', 'Yes'], p.amcAvail)}</label><label class="f">AMC start<input class="in" type="date" name="amcStart" value="${p.amcStart || ''}"></label><label class="f">AMC end<input class="in" type="date" name="amcEnd" value="${p.amcEnd || ''}"></label><label class="f full">Notes<input class="in" name="notes" value="${esc(p.notes || '')}"></label></div>
    <div class="twrap mt" style="max-height:320px"><table class="t wizard-lines"><thead><tr><th class="nosort">#</th><th class="nosort">Item</th><th class="nosort">Class</th><th class="nosort">Subtype</th><th class="nosort">Unit price</th><th class="nosort">Qty</th><th class="nosort num">Line total</th></tr></thead><tbody id="pel">${p.lines.map(row).join('')}</tbody></table></div><div id="pt" style="text-align:right;margin-top:10px;font-weight:700"></div></div>
    <footer><button type="button" class="btn ghost" data-x>Cancel</button><button class="btn" type="submit">${ic('check')}Save</button></footer></form>`, { size: 'xl', sticky: true });
    const calc = () => { let tot = 0; ov.querySelectorAll('#pel tr').forEach((tr) => { const t = (+tr.querySelector('[name=price]').value || 0) * (+tr.querySelector('[name=qty]').value || 0); tr.querySelector('.tt').textContent = fmtNum(t, 2); tot += t; }); ov.querySelector('#pt').textContent = 'Lines total: ' + p.currency + ' ' + fmtNum(tot, 2) + ' (' + (ov.querySelector('[name=vatIncl]').value === 'Yes' ? 'VAT included' : '+ VAT ' + db().company.vat + '%') + ')'; };
    ov.addEventListener('input', calc); ov.addEventListener('change', (e) => { if (e.target.name === 'assetType') { const tr = e.target.closest('tr'); const l = { itemType: tr.dataset.it }; const s = tr.querySelector('[name=subtype]'); s.innerHTML = [''].concat(subOpts(l, e.target.value)).map((o) => `<option>${esc(o)}</option>`).join(''); } calc(); });
    ov.addEventListener('click', (e) => { if (e.target.closest('[data-x]')) UI.close(ov); });
    ov.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault(); const f = e.target;
      const lines = p.lines.map((l) => { const tr = ov.querySelector(`#pel tr[data-line="${l.line}"]`); return Object.assign({}, l, { assetType: tr.querySelector('[name=assetType]').value, subtype: tr.querySelector('[name=subtype]').value, price: +tr.querySelector('[name=price]').value || 0, qty: Math.floor(+tr.querySelector('[name=qty]').value) }); });
      for (const l of lines) if (!(l.qty > 0)) return UI.toast('Quantity must be at least 1', 'err');
      const data = { date: f.date.value, vatIncl: f.vatIncl.value, paymentTerms: f.paymentTerms.value, delivery: f.delivery.value, approval: f.approval.value, invoice: f.invoice.value, costCenter: f.costCenter.value, amcAvail: f.amcAvail.value, amcStart: f.amcStart.value, amcEnd: f.amcEnd.value, notes: f.notes.value, lines };
      // quantity guard against the PR
      for (const l of lines) { const old = p.lines.find((x) => x.line === l.line); const m = l.prRef.match(/^(.*)-(\d+)$/); const rem = L.prRemaining(m[1], +m[2], (L.pr(m[1]).lines.find((x) => x.line === +m[2]) || { qty: 0 }).qty); if (l.qty - old.qty > rem) return UI.toast(`Line ${l.line}: only ${rem} more can be ordered from the PR`, 'err'); }
      UI.run(() => { L.savePO(data, p.poNo); UI.close(ov); }, 'PO updated');
    });
    calc();
  });
})();

/* ITMS core — data store + business rules (stock linkage lives here) */
(function () {
  const ITMS = (window.ITMS = window.ITMS || {});
  const KEY = 'itms.db.v1';

  /* ---------- tiny utils ---------- */
  const pad = (n, l = 4) => String(n).padStart(l, '0');
  const parse = (s) => { if (!s) return null; const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
  const iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1, 2) + '-' + pad(d.getDate(), 2);
  const today = () => iso(new Date());
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const addYears = (s, n) => { const d = parse(s); d.setFullYear(d.getFullYear() + n); return iso(d); };
  const diffDays = (a, b) => Math.round((parse(a) - parse(b)) / 864e5);
  const daysTo = (s) => (s ? diffDays(s, today()) : null);
  const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
  const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const uniq = (a) => [...new Set(a)];

  /* ---------- store ---------- */
  let db = null;
  let timer = null;
  const subs = [];
  const store = {
    get db() { return db; },
    subscribe(fn) { subs.push(fn); },
    save() {
      clearTimeout(timer);
      timer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { console.warn('save failed', e); } }, 120);
    },
    emit() { store.save(); subs.forEach((f) => f()); },
    init() {
      try { const raw = localStorage.getItem(KEY); if (raw) { db = JSON.parse(raw); if (db && db.company && db.company.name !== 'BOBBY SHARON') { db.company.name = 'BOBBY SHARON'; store.save(); } return; } } catch (e) { /* ignore */ }
      db = logic.build('sample');
      store.save();
    },
    reset(mode) { db = logic.build(mode); store.emit(); },
    export() { return JSON.stringify(db, null, 2); },
    import(json) { const d = JSON.parse(json); if (!d.employees || !d.hw) throw new Error('Not an ITMS backup file'); db = d; store.emit(); },
  };

  /* ---------- constants ---------- */
  const HW_STATUS = ['In Stock', 'In Use', 'Under Repair', 'Disposed'];
  const CONDITIONS = ['New', 'Good', 'Fair', 'Average', 'Poor'];
  const ITEM_TYPES = ['Hardware', 'Software', 'Consumable'];

  /* ---------- sequences / ids ---------- */
  function seq(name) { db.seq[name] = (db.seq[name] || 0) + 1; return db.seq[name]; }
  function nextHwId(type) {
    const t = db.lists.hwTypes.find((x) => x.type === type);
    const prefix = t ? t.prefix : 'IT-HW-OTH';
    return prefix + '-' + pad(seq('hw:' + prefix));
  }
  function nextSwId(type) {
    const t = db.lists.swTypes.find((x) => x.type === type);
    const prefix = t ? t.prefix : 'IT-SW-APP';
    return prefix + '-' + pad(seq('sw:' + prefix));
  }
  function docNo(prefix) { const d = new Date(); return prefix + '-' + pad(d.getMonth() + 1, 2) + '-' + d.getFullYear() + '-' + pad(seq(prefix)); }

  /* ---------- lookups ---------- */
  const emp = (no) => db.employees.find((e) => e.no === no);
  const empName = (no) => (emp(no) || {}).name || '';
  const vendor = (name) => db.vendors.find((v) => v.name === name);
  const po = (no) => db.pos.find((p) => p.poNo === no);
  const pr = (no) => db.prs.find((p) => p.prNo === no);
  const hw = (id) => db.hw.find((a) => a.id === id);
  const sw = (id) => db.sw.find((a) => a.id === id);
  const term = (id) => db.terms.find((t) => t.id === id);
  const cons = (id) => db.cons.find((c) => c.id === id);
  const typeCfg = (t) => db.lists.hwTypes.find((x) => x.type === t);

  function log(kind, text, ref) {
    db.log.unshift({ at: new Date().toISOString(), kind, text, ref: ref || '' });
    if (db.log.length > 300) db.log.length = 300;
  }

  /* ---------- guessing (auto-mapping PR description -> asset class) ---------- */
  const HW_KEYS = [
    ['Security_Device', /firewall|asa\b|fortinet|palo alto|intrusion|camera|biometric|access control/i],
    ['Network_Device', /router|switch|access point|uap|wifi|wi-fi|gateway|load balancer|big-ip|modem|controller/i],
    ['Laptop', /laptop|elitebook|thinkpad|macbook|surface|ipad|tablet|chromebook/i],
    ['Desktop', /desktop|optiplex|imac|\bnuc\b|workstation|precision|all.in.one|thin client/i],
    ['Monitor', /monitor|display|\binch\b|c34h|ultrawide|\blg \d/i],
    ['Phone', /phone|yealink|polycom|avaya|trio|handset|voip/i],
    ['Printer', /printer|laserjet|designjet|inkjet|officejet|\bmfc\b|plotter|deskjet/i],
    ['Server', /server|poweredge|proliant|thinksystem|vsphere|blade/i],
    ['UPS', /\bups\b|eaton|apc\b|cyberpower|galaxy|5p1500/i],
    ['Storage', /\bnas\b|ssd|\bhdd\b|hard drive|external drive|storage|msa\b|tape|diskstation|synology|veeam|\bsan\b|disk/i],
    ['Test_Equipment', /multimeter|oscilloscope|keysight|fluke|tektronix|analyzer|tester|e3631/i],
    ['Peripheral', /mouse|keyboard|webcam|brio|dock|wd19|headset|projector|benq|scanner|camera|speaker|adapter/i],
  ];
  function guessHw(desc) {
    let type = 'Peripheral';
    for (const [t, rx] of HW_KEYS) if (rx.test(desc)) { type = t; break; }
    const cfg = typeCfg(type);
    const d = desc.toLowerCase();
    let sub = '';
    if (cfg) {
      sub = cfg.subtypes.find((s) => s.toLowerCase() !== 'others' && s.toLowerCase().trim() && d.includes(s.toLowerCase().trim())) || '';
      if (!sub) sub = cfg.subtypes.find((s) => /^others?$/i.test(s)) || cfg.subtypes[0] || '';
    }
    return { assetType: type, subtype: sub };
  }
  function guessSw(desc) {
    let type = 'Application Software';
    if (/antivirus|security|firewall|intrusion|database|operating system|\bos\b|identity|log management|patch|endpoint|data loss|network monitoring|mobile device|dbms/i.test(desc)) type = 'System Software';
    else if (/code|version control|continuous|container|orchestration|testing|configuration management|editor|developer|git/i.test(desc)) type = 'Programming Software';
    else if (/backup|utility|vulnerability|scanner|cleanup|compress/i.test(desc)) type = 'Utility Software';
    let sub = 'Perpetual';
    if (/cloud|365|subscription|saas|zoom|slack|adobe|analytics|marketing|crm|management system|seo|social/i.test(desc)) sub = 'Cloud-Based';
    if (/version control|continuous integration|containerization|orchestration|testing framework/i.test(desc)) sub = 'Open Source Software';
    return { assetType: type, subtype: sub };
  }
  function guessCons(desc) {
    const map = [['Ink_Toner', /toner|ink|cartridge|drum/i], ['Cables', /cable|hdmi|usb|ethernet/i], ['Batteries', /batter/i], ['Cleaning_Supplies', /clean|wipe|spray|cloth/i], ['Paper', /paper/i], ['Storage_Media', /flash|usb drive|dvd|cd-r/i], ['Labels', /label/i], ['Office_Supplies', /pen|marker|staple|clip|tape/i]];
    for (const [t, rx] of map) if (rx.test(desc)) return { assetType: t, subtype: '' };
    return { assetType: 'Office_Supplies', subtype: '' };
  }
  function guess(itemType, desc) {
    if (itemType === 'Software') return guessSw(desc);
    if (itemType === 'Consumable') return guessCons(desc);
    return guessHw(desc);
  }
  function lastPrice(desc) {
    for (let i = db.pos.length - 1; i >= 0; i--) {
      const l = db.pos[i].lines.find((x) => x.desc.toLowerCase() === desc.toLowerCase() && x.price > 0);
      if (l) return l.price;
    }
    return 0;
  }

  /* ---------- PR ---------- */
  function prLineKey(prNo, line) { return prNo + '-' + line; }
  function orderedQty(prNo, line) {
    const key = prLineKey(prNo, line);
    let q = 0;
    db.pos.forEach((p) => { if (p.approval === 'Cancelled') return; p.lines.forEach((l) => { if (l.prRef === key) q += l.qty; }); });
    return q;
  }
  function prRemaining(prNo, line, qty) { return Math.max(0, qty - orderedQty(prNo, line)); }
  function prStatus(p) {
    if (p.status === 'Cancelled') return 'Cancelled';
    const tot = p.lines.reduce((s, l) => s + l.qty, 0);
    const ord = p.lines.reduce((s, l) => s + Math.min(l.qty, orderedQty(p.prNo, l.line)), 0);
    if (ord <= 0) return 'Open';
    if (ord < tot) return 'Partially Ordered';
    return 'Ordered';
  }
  function savePR(data, existingNo) {
    let p;
    if (existingNo) { p = pr(existingNo); Object.assign(p, data); }
    else {
      const d = new Date();
      p = Object.assign({ prNo: 'PR-' + pad(d.getMonth() + 1, 2) + '-' + d.getFullYear() + '-' + pad(seq('pr')), status: 'Open' }, data);
      db.prs.push(p); log('PR', 'Purchase request ' + p.prNo + ' created', p.prNo);
    }
    let mx = p.lines.reduce((m, l) => Math.max(m, l.line || 0), 0);
    p.lines.forEach((l) => { if (!l.line) l.line = ++mx; }); // line numbers are stable: POs reference them
    store.emit(); return p;
  }
  function deletePR(no) {
    const p = pr(no);
    if (p.lines.some((l) => orderedQty(no, l.line) > 0)) throw new Error('This PR already has Purchase Orders — cancel those first.');
    db.prs = db.prs.filter((x) => x.prNo !== no); log('PR', 'Purchase request ' + no + ' deleted'); store.emit();
  }

  /* ---------- PO ---------- */
  function lineTotals(p, l) {
    const rate = num(db.company.vat) / 100;
    const gross = round2(num(l.price) * num(l.qty));
    if (p.vatIncl === 'Yes') { const ex = round2(gross / (1 + rate)); return { total: gross, excl: ex, vat: round2(gross - ex), incl: gross }; }
    const vat = round2(gross * rate); return { total: gross, excl: gross, vat, incl: round2(gross + vat) };
  }
  function poTotals(p) {
    const t = { excl: 0, vat: 0, incl: 0, total: 0 };
    p.lines.forEach((l) => { const x = lineTotals(p, l); t.excl += x.excl; t.vat += x.vat; t.incl += x.incl; t.total += x.total; });
    Object.keys(t).forEach((k) => (t[k] = round2(t[k])));
    return t;
  }
  function poReceipt(p) {
    const tot = p.lines.reduce((s, l) => s + l.qty, 0);
    const rec = p.lines.reduce((s, l) => s + (l.received || 0), 0);
    if (p.approval === 'Cancelled') return 'Cancelled';
    if (rec <= 0) return 'Pending';
    return rec >= tot ? 'Received' : 'Partial';
  }
  function createPOsFromPR(selections, opts) {
    // selections: [{prNo,line,qty,price}] -> one PO per vendor
    opts = opts || {};
    const by = {};
    selections.forEach((s) => {
      const p = pr(s.prNo); const l = p.lines.find((x) => x.line === s.line);
      const rem = prRemaining(s.prNo, s.line, l.qty);
      const q = Math.floor(num(s.qty));
      if (q <= 0) return;
      if (q > rem) throw new Error(`${s.prNo} line ${s.line}: quantity ${q} exceeds remaining ${rem}.`);
      if (!l.vendor) throw new Error(`${s.prNo} line ${s.line} has no vendor — edit the PR first.`);
      (by[l.vendor] = by[l.vendor] || []).push({ p, l, q, price: s.price });
    });
    const made = [];
    Object.keys(by).forEach((vname) => {
      const v = vendor(vname) || {};
      const d = new Date();
      const poNo = 'PO-' + pad(d.getMonth() + 1, 2) + '-' + d.getFullYear() + '-' + pad(seq('po'));
      const lines = by[vname].map((x, i) => {
        const g = guess(x.l.itemType, x.l.desc);
        return { line: i + 1, prRef: prLineKey(x.p.prNo, x.l.line), itemType: x.l.itemType, assetType: g.assetType, subtype: g.subtype, desc: x.l.desc, price: x.price != null && x.price !== '' ? num(x.price) : lastPrice(x.l.desc), qty: x.q, received: 0 };
      });
      const o = { poNo, date: today(), vendor: vname, currency: v.currency || db.company.currency, vatIncl: 'No', approval: opts.autoApprove ? 'Approved' : 'Draft', invoice: 'Pending', delivery: '', paymentTerms: v.termsId || '', amcAvail: 'No', amcStart: '', amcEnd: '', notes: '', lines };
      db.pos.push(o); made.push(poNo);
      log('PO', `PO ${poNo} created from ${[...new Set(by[vname].map((x) => x.p.prNo))].join(', ')} (${lines.length} line${lines.length > 1 ? 's' : ''})`, poNo);
    });
    store.emit(); return made;
  }
  function savePO(data, existingNo) {
    const p = po(existingNo);
    const done = p.lines.some((l) => l.received > 0);
    Object.assign(p, data);
    p.lines.forEach((l, i) => { l.line = i + 1; l.received = l.received || 0; });
    if (done) p.lines.forEach((l) => { if (l.qty < l.received) l.qty = l.received; });
    store.emit(); return p;
  }
  function setPOApproval(no, status) {
    const p = po(no);
    if (status === 'Cancelled' && p.lines.some((l) => l.received > 0)) throw new Error('Cannot cancel — goods already received.');
    p.approval = status; log('PO', `PO ${no} ${status.toLowerCase()}`, no); store.emit();
  }
  function deletePO(no) {
    const p = po(no);
    if (p.lines.some((l) => l.received > 0)) throw new Error('Goods were received against this PO, it cannot be deleted.');
    db.pos = db.pos.filter((x) => x.poNo !== no); log('PO', 'PO ' + no + ' deleted'); store.emit();
  }

  /* ---------- GRN: the single entry point that creates stock ---------- */
  function receivePO(poNo, items, opts) {
    opts = opts || {};
    const p = po(poNo);
    if (p.approval !== 'Approved') throw new Error('PO must be Approved before goods can be received.');
    const date = opts.date || today();
    const grnNo = 'GRN-' + parse(date).getFullYear() + '-' + pad(seq('grn'));
    const grn = { grnNo, poNo, date, lines: [], by: opts.by || '' };
    const created = { hw: [], sw: [], cons: [] };
    items.forEach((it) => {
      const l = p.lines.find((x) => x.line === it.line);
      const q = Math.floor(num(it.qty));
      if (!l || q <= 0) return;
      if (q > l.qty - (l.received || 0)) throw new Error(`Line ${l.line}: receiving ${q} is more than outstanding ${l.qty - (l.received || 0)}.`);
      l.received = (l.received || 0) + q;
      grn.lines.push({ line: l.line, desc: l.desc, qty: q });
      const serials = (it.serials || '').split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
      if (l.itemType === 'Hardware') {
        for (let i = 0; i < q; i++) {
          const parts = l.desc.split(' ');
          const a = {
            id: nextHwId(l.assetType), poNo, poLine: l.line, prRef: l.prRef, grn: grnNo, vendor: p.vendor, type: l.assetType, subtype: l.subtype, desc: l.desc,
            status: 'In Stock', condition: 'New', purchaseDate: date, brand: parts[0] || '', model: parts.slice(1).join(' '), serial: serials[i] || '', ip: '', compName: '', cpu: '', ram: '', hdd: '', os: '', osDate: '', screen: '',
            amcStart: p.amcAvail === 'Yes' ? p.amcStart : '', amcEnd: p.amcAvail === 'Yes' ? p.amcEnd : '', warranty: addDays(date, num(db.company.warrantyDays) || 365), holder: '', issuedDate: '', price: l.price, currency: p.currency, life: (typeCfg(l.assetType) || {}).retention || 5,
          };
          db.hw.push(a); created.hw.push(a.id);
        }
      } else if (l.itemType === 'Software') {
        let lic = db.sw.find((s) => s.name.toLowerCase() === l.desc.toLowerCase() && s.vendor === p.vendor);
        const perpetual = !/cloud|subscription/i.test(l.subtype || '');
        if (!lic) {
          lic = { id: nextSwId(l.assetType), name: l.desc, type: l.assetType, subType: l.subtype || 'Perpetual', purchaseDate: date, expiry: perpetual ? '' : addDays(date, 365), serialNo: serials[0] || '', qty: 0, lastOrder: date, vendor: p.vendor, website: '', unitPrice: l.price, currency: p.currency, purchased: 0, poNo };
          db.sw.push(lic);
        } else { lic.lastOrder = date; lic.unitPrice = l.price || lic.unitPrice; lic.poNo = poNo; if (lic.expiry && !perpetual && daysTo(lic.expiry) < 365) lic.expiry = addDays(date, 365); }
        lic.qty += q; lic.purchased += q; created.sw.push(lic.id);
      } else {
        const g = guessCons(l.desc);
        let item = db.cons.find((c) => c.desc.toLowerCase() === l.desc.toLowerCase());
        if (!item) item = addConsumable({ type: l.assetType || g.assetType, subtype: l.subtype || '', brand: '', model: '', desc: l.desc, uom: l.unit || 'PCS', reorder: 5 }, true);
        addConsPurchase({ date, itemId: item.id, qty: q, price: l.price, vat: num(db.company.vat), vendor: p.vendor, poNo }, true);
        created.cons.push(item.id);
      }
    });
    if (!grn.lines.length) throw new Error('Nothing to receive — enter at least one quantity.');
    db.grns.push(grn); if (!p.delivery) p.delivery = date;
    log('GRN', `${grnNo}: received ${grn.lines.reduce((s, x) => s + x.qty, 0)} item(s) against ${poNo}`, poNo);
    if (!opts.silent) store.emit();
    return { grn, created };
  }

  /* ---------- hardware movements ---------- */
  function addMove(m) {
    const row = Object.assign({ id: 'M' + pad(seq('move'), 5), at: Date.now() }, m);
    db.moves.push(row); return row;
  }
  function assertHw(id) { const a = hw(id); if (!a) throw new Error('Asset not found: ' + id); return a; }
  function issueAssets(empNo, ids, date, remarks, silent) {
    const doc = docNo('ISS');
    ids.forEach((id) => {
      const a = assertHw(id);
      if (a.status !== 'In Stock') throw new Error(`${id} is ${a.status} — only In Stock assets can be issued.`);
      a.status = 'In Use'; a.holder = empNo; a.issuedDate = date;
      addMove({ doc, type: 'Issue', date, assetId: id, from: '', to: empNo, cond: a.condition, remarks });
    });
    log('Issue', `${ids.length} asset(s) issued to ${empName(empNo)}`, doc);
    if (!silent) store.emit(); return doc;
  }
  function returnAssets(empNo, ids, date, cond, newStatus, remarks, silent) {
    const doc = docNo('RET');
    ids.forEach((id) => {
      const a = assertHw(id);
      if (a.holder !== empNo) throw new Error(`${id} is not held by ${empName(empNo)}.`);
      a.status = newStatus || 'In Stock'; a.holder = ''; a.issuedDate = ''; if (cond) a.condition = cond;
      addMove({ doc, type: 'Return', date, assetId: id, from: empNo, to: '', cond: a.condition, remarks, after: a.status });
    });
    log('Return', `${ids.length} asset(s) returned by ${empName(empNo)}`, doc);
    if (!silent) store.emit(); return doc;
  }
  function transferAssets(fromNo, toNo, ids, date, remarks) {
    if (fromNo === toNo) throw new Error('From and To employee cannot be the same.');
    const doc = docNo('TRF');
    ids.forEach((id) => {
      const a = assertHw(id);
      if (a.holder !== fromNo) throw new Error(`${id} is not held by ${empName(fromNo)}.`);
      a.holder = toNo; a.issuedDate = date;
      addMove({ doc, type: 'Transfer', date, assetId: id, from: fromNo, to: toNo, cond: a.condition, remarks });
    });
    log('Transfer', `${ids.length} asset(s) transferred ${empName(fromNo)} → ${empName(toNo)}`, doc);
    store.emit(); return doc;
  }
  function setAssetState(id, status, remarks) {
    const a = assertHw(id);
    if (a.status === status) return;
    if (a.holder) { returnAssets(a.holder, [id], today(), a.condition, status, remarks || 'Status change', true); }
    else { addMove({ doc: docNo('STS'), type: 'Status', date: today(), assetId: id, from: '', to: '', cond: a.condition, remarks: remarks || status, after: status }); a.status = status; }
    if (status === 'Disposed') { db.installs = db.installs.filter((i) => i.hwId !== id); }
    log('Asset', `${id} set to ${status}`, id); store.emit();
  }
  function saveHW(data, id) {
    if (id) { Object.assign(assertHw(id), data); store.emit(); return hw(id); }
    const a = Object.assign({ status: 'In Stock', condition: 'New', holder: '', issuedDate: '', poNo: '', poLine: '', prRef: '', grn: '', vendor: '', life: (typeCfg(data.type) || {}).retention || 5, price: 0, currency: db.company.currency }, data);
    a.id = nextHwId(a.type); db.hw.push(a); log('Asset', `${a.id} added to stock (opening entry)`, a.id); store.emit(); return a;
  }
  function deleteHW(id) {
    const a = assertHw(id);
    if (a.holder) throw new Error('Asset is currently issued — return it first.');
    db.hw = db.hw.filter((x) => x.id !== id); db.moves = db.moves.filter((m) => m.assetId !== id); db.installs = db.installs.filter((i) => i.hwId !== id);
    db.amcs.forEach((c) => { c.assets = c.assets.filter((x) => x !== id); });
    log('Asset', id + ' deleted'); store.emit();
  }
  function usage(a) {
    const mv = db.moves.filter((m) => m.assetId === a.id && m.type !== 'Status').sort((x, y) => (x.date + x.id).localeCompare(y.date + y.id));
    let closed = 0, openFrom = null;
    mv.forEach((m) => {
      if (m.type === 'Issue') openFrom = m.date;
      else if (m.type === 'Transfer') { if (openFrom) closed += Math.max(0, diffDays(m.date, openFrom)); openFrom = m.date; }
      else if (m.type === 'Return') { if (openFrom) closed += Math.max(0, diffDays(m.date, openFrom)); openFrom = null; }
    });
    const days = closed + (openFrom ? Math.max(0, diffDays(today(), openFrom)) : 0);
    const life = num(a.life) || (typeCfg(a.type) || {}).retention || 5;
    const end = a.purchaseDate ? addDays(a.purchaseDate, Math.round(life * 365)) : '';
    const left = end ? Math.max(0, daysTo(end)) : null;
    return { days, years: round2(days / 365), life, end, left, over: end ? daysTo(end) < 0 : false };
  }

  /* ---------- software ---------- */
  const swUsed = (id) => db.installs.filter((i) => i.swId === id).reduce((s, i) => s + num(i.qty), 0);
  function swInfo(s) {
    const used = swUsed(s.id); const days = s.expiry ? daysTo(s.expiry) : null;
    return { used, remaining: s.qty - used, days, expiring: days != null && days > 0 && days <= 30, expired: days != null && days < 0, value: round2(num(s.unitPrice) * num(s.purchased || s.qty)) };
  }
  function saveSW(data, id) {
    if (id) { Object.assign(sw(id), data); store.emit(); return sw(id); }
    const s = Object.assign({ purchased: num(data.qty), lastOrder: data.purchaseDate, poNo: '' }, data); s.id = nextSwId(s.type); db.sw.push(s); log('Software', `${s.id} ${s.name} added`, s.id); store.emit(); return s;
  }
  function deleteSW(id) {
    if (swUsed(id) > 0) throw new Error('Licence has active installations — uninstall them first.');
    db.sw = db.sw.filter((x) => x.id !== id); store.emit();
  }
  function installSW(swId, empNo, hwId, date, qty) {
    const s = sw(swId); const info = swInfo(s); qty = qty || 1;
    if (info.expired) throw new Error('Licence is expired — renew it first.');
    if (info.remaining < qty) throw new Error(`Only ${info.remaining} licence(s) remaining for ${s.name}.`);
    if (db.installs.some((i) => i.swId === swId && i.hwId === hwId && hwId)) throw new Error('Already installed on that device.');
    const i = { id: 'INS' + pad(seq('ins')), swId, empNo, hwId, date, qty };
    db.installs.push(i); log('Install', `${s.name} installed${hwId ? ' on ' + hwId : ''} for ${empName(empNo) || '—'}`, swId); store.emit(); return i;
  }
  function uninstallSW(id) { db.installs = db.installs.filter((i) => i.id !== id); store.emit(); }
  function renewSW(id, newExpiry, addQty) {
    const s = sw(id); s.expiry = newExpiry; s.lastOrder = today(); if (addQty > 0) { s.qty += addQty; s.purchased += addQty; } log('Software', `${s.name} renewed to ${newExpiry}`, id); store.emit();
  }

  /* ---------- consumables ---------- */
  function consTotals(id) {
    const purchased = db.consPurch.filter((p) => p.itemId === id).reduce((s, p) => s + num(p.qty), 0);
    const used = db.consIssue.filter((p) => p.itemId === id).reduce((s, p) => s + num(p.qty), 0);
    return { purchased, used, available: purchased - used };
  }
  function addConsumable(data, silent) {
    const c = Object.assign({}, data); c.id = 'CON-' + pad(seq('con')); db.cons.push(c);
    if (!silent) { log('Consumable', `${c.desc} added to master`, c.id); store.emit(); } return c;
  }
  function addConsPurchase(d, silent) {
    const c = cons(d.itemId); if (!c) throw new Error('Select a consumable item.');
    const q = num(d.qty); if (q <= 0) throw new Error('Quantity must be greater than 0.');
    const total = round2(num(d.price) * q * (1 + num(d.vat) / 100));
    const row = { id: 'CP-' + pad(seq('cp')), date: d.date, itemId: d.itemId, qty: q, price: num(d.price), vat: num(d.vat), total, vendor: d.vendor || '', poNo: d.poNo || '' };
    db.consPurch.push(row); if (!silent) { log('Consumable', `Purchased ${q} × ${c.desc}`, row.id); store.emit(); } return row;
  }
  function addConsIssue(d, silent) {
    const c = cons(d.itemId); if (!c) throw new Error('Select a consumable item.');
    const q = num(d.qty); const t = consTotals(c.id);
    if (q <= 0) throw new Error('Quantity must be greater than 0.');
    if (q > t.available) throw new Error(`Only ${t.available} ${c.uom} of "${c.desc}" available in stock.`);
    const e = emp(d.empNo) || {};
    const row = { id: 'CI-' + pad(seq('ci')), date: d.date, itemId: d.itemId, empNo: d.empNo, dept: e.dept || d.dept || '', qty: q, remarks: d.remarks || '' };
    db.consIssue.push(row); if (!silent) { log('Consumable', `Issued ${q} × ${c.desc} to ${e.name || '—'}`, row.id); store.emit(); } return row;
  }

  /* ---------- AMC ---------- */
  function amcInfo(c) {
    const days = c.end ? daysTo(c.end) : null;
    const dur = c.start && c.end ? Math.round(diffDays(c.end, c.start) / 30.4) : 0;
    let status = c.status;
    if (days != null && days < 0) status = 'Expired';
    return { days, expiring: days != null && days > 0 && days <= 30, duration: dur, status };
  }
  function saveAMC(data, id) {
    let c;
    if (id) { c = db.amcs.find((x) => x.id === id); Object.assign(c, data); } else { c = Object.assign({}, data); c.id = 'AMC-' + pad(seq('amc')); db.amcs.push(c); log('AMC', `Contract ${c.id} ${c.title} created`, c.id); }
    c.assets.forEach((aid) => { const a = hw(aid); if (a) { a.amcStart = c.start; a.amcEnd = c.end; } });
    store.emit(); return c;
  }
  function deleteAMC(id) { db.amcs = db.amcs.filter((c) => c.id !== id); store.emit(); }

  /* ---------- masters ---------- */
  function saveEmployee(data, no) {
    if (no) { Object.assign(emp(no), data); } else {
      const n = db.employees.reduce((m, e) => Math.max(m, parseInt((e.no.split('-')[1] || '0'), 10)), 0) + 1;
      data.no = 'EMP-' + pad(n); db.employees.push(data); log('Employee', `${data.name} added`, data.no);
    }
    store.emit();
  }
  function deleteEmployee(no) {
    if (db.hw.some((a) => a.holder === no)) throw new Error('Employee still holds assets — return or transfer them first.');
    db.employees = db.employees.filter((e) => e.no !== no); store.emit();
  }
  function saveVendor(data, id) {
    if (id) { const v = db.vendors.find((x) => x.id === id); const old = v.name; Object.assign(v, data);
      if (old !== v.name) { db.pos.forEach((p) => { if (p.vendor === old) p.vendor = v.name; }); db.prs.forEach((p) => p.lines.forEach((l) => { if (l.vendor === old) l.vendor = v.name; })); db.hw.forEach((a) => { if (a.vendor === old) a.vendor = v.name; }); db.sw.forEach((a) => { if (a.vendor === old) a.vendor = v.name; }); }
    } else {
      const n = db.vendors.reduce((m, e) => Math.max(m, parseInt((e.id.split('-')[1] || '0'), 10)), 0) + 1;
      data.id = 'VEN-' + pad(n); db.vendors.push(data); log('Vendor', `${data.name} added`, data.id);
    }
    store.emit();
  }
  function deleteVendor(id) {
    const v = db.vendors.find((x) => x.id === id);
    if (db.pos.some((p) => p.vendor === v.name) || db.prs.some((p) => p.lines.some((l) => l.vendor === v.name))) throw new Error('Vendor is used in PR/PO records and cannot be deleted.');
    db.vendors = db.vendors.filter((x) => x.id !== id); store.emit();
  }

  /* ---------- aggregate stats (dashboard) ---------- */
  function stats() {
    const T = today();
    const hwTypes = db.lists.hwTypes.map((t) => t.type);
    const byType = hwTypes.map((t) => {
      const rows = db.hw.filter((a) => a.type === t);
      const c = (s) => rows.filter((a) => a.status === s).length;
      const wExp = rows.filter((a) => a.warranty && a.warranty.slice(0, 7) === T.slice(0, 7) && daysTo(a.warranty) >= 0).length;
      const wExpired = rows.filter((a) => a.warranty && daysTo(a.warranty) < 0).length;
      return { type: t, total: rows.length, inUse: c('In Use'), inStock: c('In Stock'), repair: c('Under Repair'), disposed: c('Disposed'), warrantyMonth: wExp, warrantyExpired: wExpired };
    });
    const status = HW_STATUS.map((s) => ({ label: s, value: db.hw.filter((a) => a.status === s).length }));
    const cond = CONDITIONS.map((s) => ({ label: s, value: db.hw.filter((a) => a.condition === s && a.status !== 'Disposed').length }));
    const swByType = db.lists.swTypes.map((t) => {
      const rows = db.sw.filter((s) => s.type === t.type); let tot = 0, used = 0, exp30 = 0, expd = 0;
      rows.forEach((s) => { const i = swInfo(s); tot += s.qty; used += i.used; if (i.expiring) exp30++; if (i.expired) expd++; });
      return { type: t.type, total: tot, used, available: tot - used, exp30, expired: expd };
    });
    const depts = uniq(db.employees.map((e) => e.dept)).filter(Boolean).sort();
    const distTypes = ['Desktop', 'Laptop', 'Monitor', 'Phone', 'Printer', 'Peripheral', 'Network_Device', 'Server'];
    const dist = depts.map((d) => {
      const row = { dept: d, counts: {}, total: 0 };
      distTypes.forEach((t) => (row.counts[t] = 0));
      db.hw.forEach((a) => { if (a.holder && (emp(a.holder) || {}).dept === d) { row.total++; if (row.counts[a.type] != null) row.counts[a.type]++; } });
      return row;
    });
    const consRows = db.lists.consTypes.map((t) => {
      let p = 0, u = 0, low = 0;
      db.cons.filter((c) => c.type === t.type).forEach((c) => { const x = consTotals(c.id); p += x.purchased; u += x.used; if (x.available <= num(c.reorder)) low++; });
      return { type: t.type, purchased: p, used: u, available: p - u, low };
    }).filter((r) => r.purchased || r.used);
    const spendByMonth = {};
    db.pos.forEach((p) => { if (p.approval === 'Cancelled') return; const k = p.date.slice(0, 7); spendByMonth[k] = (spendByMonth[k] || 0) + poTotals(p).incl; });
    const months = Object.keys(spendByMonth).sort().slice(-12);
    const open = db.prs.filter((p) => ['Open', 'Partially Ordered'].includes(prStatus(p))).length;
    const pipeline = {
      prOpen: open,
      poDraft: db.pos.filter((p) => p.approval === 'Draft').length,
      poApproved: db.pos.filter((p) => p.approval === 'Approved' && poReceipt(p) !== 'Received').length,
      poReceived: db.pos.filter((p) => poReceipt(p) === 'Received').length,
      paid: db.pos.filter((p) => p.invoice === 'Paid').length,
      unpaid: db.pos.filter((p) => p.approval === 'Approved' && p.invoice !== 'Paid').length,
    };
    const alerts = {
      warranty30: db.hw.filter((a) => a.status !== 'Disposed' && a.warranty && daysTo(a.warranty) >= 0 && daysTo(a.warranty) <= 30),
      warrantyExpired: db.hw.filter((a) => a.status !== 'Disposed' && a.warranty && daysTo(a.warranty) < 0),
      sw30: db.sw.filter((s) => swInfo(s).expiring),
      swExpired: db.sw.filter((s) => swInfo(s).expired),
      amc30: db.amcs.filter((c) => amcInfo(c).expiring),
      amcExpired: db.amcs.filter((c) => amcInfo(c).days != null && amcInfo(c).days < 0),
      lowStock: db.cons.filter((c) => consTotals(c.id).available <= num(c.reorder)),
      retention: db.hw.filter((a) => a.status !== 'Disposed' && usage(a).over),
      spare: db.hw.filter((a) => a.status === 'In Stock'),
    };
    return {
      byType, status, cond, swByType, dist, distTypes, consRows, months: months.map((m) => ({ label: m, value: round2(spendByMonth[m]) })), pipeline, alerts,
      kpi: {
        assets: db.hw.length, active: db.hw.filter((a) => a.status !== 'Disposed').length, inUse: status[1].value, inStock: status[0].value, repair: status[2].value, disposed: status[3].value,
        licences: db.sw.reduce((s, x) => s + x.qty, 0), licUsed: db.sw.reduce((s, x) => s + swUsed(x.id), 0),
        spend: round2(db.pos.filter((p) => p.approval !== 'Cancelled' && p.approval !== 'Rejected').reduce((s, p) => s + poTotals(p).incl, 0)),
        employees: db.employees.filter((e) => e.status === 'Active').length, vendors: db.vendors.length, amcActive: db.amcs.filter((c) => amcInfo(c).status === 'Active').length,
      },
    };
  }

  /* ---------- data builder (workbook seed + optional sample stock) ---------- */
  function build(mode) {
    const S = clone(window.SEED);
    db = {
      v: 1, company: { name: 'BOBBY SHARON', address: 'DUBAI, UAE', vat: 5, currency: 'AED', warrantyDays: 365, logo: '' }, seq: {},
      employees: [], vendors: [], terms: [], lists: S.lists, prs: [], pos: [], grns: [], hw: [], sw: [], installs: [], amcs: [], cons: [], consPurch: [], consIssue: [], moves: [], log: [],
    };
    if (mode === 'empty') { db.lists = S.lists; db.terms = S.terms; return db; }
    db.employees = S.employees; db.vendors = S.vendors; db.terms = S.terms;
    S.prs.forEach((p) => { p.lines.forEach((l) => { l.itemType = l.itemType || 'Hardware'; }); });
    db.prs = S.prs; db.pos = S.pos.map((p) => Object.assign(p, { currency: (vendor(p.vendor) || {}).currency || 'AED', paymentTerms: (vendor(p.vendor) || {}).termsId || '', amcAvail: 'No', amcStart: '', amcEnd: '', notes: '', lines: p.lines.map((l) => Object.assign(l, { received: 0 })) }));
    db.seq.pr = db.prs.length; db.seq.po = db.pos.length;
    if (mode === 'workbook') return db;
    // sample: receive every approved PO that carries a GRN in the workbook, then create realistic movements
    db.pos.forEach((p) => { if (p.approval === 'Approved') receivePO(p.poNo, p.lines.map((l) => ({ line: l.line, qty: l.qty })), { date: p.delivery || p.date, silent: true }); });
    const lap = db.hw.find((a) => a.prRef === 'PR-04-2025-0001-2'); if (lap) { lap.status = 'Disposed'; addMove({ doc: 'STS-SEED', type: 'Status', date: lap.purchaseDate, assetId: lap.id, from: '', to: '', cond: lap.condition, remarks: 'Disposed (workbook)', after: 'Disposed' }); }
    const emps = db.employees.filter((e) => e.status === 'Active');
    const itEmps = emps.filter((e) => e.dept === 'IT'); const pool = itEmps.length ? itEmps : emps;
    const personal = ['Laptop', 'Desktop', 'Monitor', 'Phone', 'Peripheral', 'Printer'];
    let k = 0, j = 0;
    db.hw.forEach((a, idx) => {
      if (a.status === 'Disposed') return;
      if (a.prRef === 'PR-04-2025-0001-1') return; // workbook says In Stock
      if (idx % 23 === 7) { a.status = 'Under Repair'; a.condition = 'Poor'; addMove({ doc: 'STS-SEED', type: 'Status', date: addDays(a.purchaseDate, 120), assetId: a.id, from: '', to: '', cond: 'Poor', remarks: 'Sent for repair', after: 'Under Repair' }); return; }
      if (idx % 5 === 4) return; // keep as spare
      const to = personal.includes(a.type) ? emps[k++ % emps.length] : pool[j++ % pool.length];
      issueAssets(to.no, [a.id], addDays(a.purchaseDate, 3), 'Initial allocation', true);
      a.condition = ['Good', 'Good', 'Good', 'Fair', 'Average', 'New'][idx % 6];
    });
    // a few transfers to show history
    db.hw.filter((a) => a.status === 'In Use' && personal.includes(a.type)).slice(0, 6).forEach((a, i) => {
      const to = emps[(emps.findIndex((e) => e.no === a.holder) + 7 + i) % emps.length];
      if (to && to.no !== a.holder) { const m = db.moves.filter((x) => x.assetId === a.id).pop(); const d = addDays(m.date, 200 + i * 15); const from = a.holder; a.holder = to.no; a.issuedDate = d; addMove({ doc: 'TRF-SEED' + i, type: 'Transfer', date: d, assetId: a.id, from, to: to.no, cond: a.condition, remarks: 'Role change' }); }
    });
    // software installs on laptops/desktops
    const laps = db.hw.filter((a) => a.holder && ['Laptop', 'Desktop'].includes(a.type));
    db.sw.slice(0, 14).forEach((s, i) => { for (let n = 0; n < Math.min(1 + (i % 3), laps.length); n++) { const h = laps[(i * 3 + n) % laps.length]; try { installSW(s.id, h.holder, h.id, addDays(h.purchaseDate, 6), 1); } catch (e) { /* skip */ } } });
    db.sw.forEach((s) => { if (/Slack|Zoom|Microsoft|Antivirus/i.test(s.name)) { s.qty += 20; s.purchased += 20; } });
    // consumables
    const T = today();
    const items = [['Ink_Toner', 'Black Ink Cartridge', 'HP', '305A', 'HP 305A Black Toner', 'PCS', 4, 12, 78], ['Ink_Toner', 'Color Ink Cartridge', 'Canon', 'CL-541', 'Canon CL-541 Colour Ink', 'PCS', 3, 6, 64], ['Cables', 'USB Cable', 'Anker', 'A8012', 'USB-C Cable 1m', 'PCS', 10, 60, 9], ['Cables', 'Ethernet Cable', 'Cat6', 'UTP', 'Cat6 Patch Cable 2m', 'PCS', 15, 80, 7], ['Batteries', 'AA Batteries', 'Duracell', 'AA', 'AA Alkaline Battery Pack', 'PACK', 5, 20, 18], ['Paper', 'A4 Paper', 'Double A', 'A4-80', 'A4 Paper 80gsm Ream', 'REAM', 20, 100, 17], ['Cleaning_Supplies', 'Screen Cleaning Wipes', 'Generic', 'SCW', 'Screen Cleaning Wipes', 'PACK', 5, 15, 12], ['Storage_Media', 'USB Flash Drives', 'SanDisk', 'Cruzer 64', 'SanDisk 64GB USB Flash Drive', 'PCS', 8, 25, 28]];
    items.forEach((x, i) => {
      const c = addConsumable({ type: x[0], subtype: x[1], brand: x[2], model: x[3], desc: x[4], uom: x[5], reorder: x[6] }, true);
      addConsPurchase({ date: addDays(T, -120 - i * 3), itemId: c.id, qty: x[7], price: x[8], vat: 5, vendor: db.vendors[i % db.vendors.length].name }, true);
      const used = i === 0 ? 10 : i === 5 ? 78 : Math.floor(x[7] * 0.45);
      for (let n = 0; n < 3; n++) addConsIssue({ date: addDays(T, -60 + n * 12), itemId: c.id, empNo: emps[(i * 5 + n) % emps.length].no, qty: Math.max(1, Math.floor(used / 3)), remarks: 'Sample issue' }, true);
    });
    // AMC contracts on infrastructure
    const infra = db.hw.filter((a) => ['Server', 'Storage', 'Network_Device', 'UPS'].includes(a.type) && a.status !== 'Disposed');
    const mk = (title, start, end, vi, ids, cost, freq, sla) => { const v = db.vendors[vi]; saveAMC({ title, assets: ids.map((a) => a.id), vendorId: v.id, contact: v.contact, email: v.email, phone: v.phone1, start, end, sla, coverage: 'Preventive maintenance, parts & labour, remote support', exclusions: 'Physical damage, consumables', cost, freq, terms: v.termsId, invoice: '', link: '', status: 'Active', notes: 'Sample contract' }); };
    if (infra.length > 6) {
      mk('Server & Storage AMC', addDays(T, -335), addDays(T, 26), 1, infra.filter((a) => ['Server', 'Storage'].includes(a.type)).slice(0, 4), 18000, 'Quarterly', '4-hour response, 8x5');
      mk('Network Devices AMC', addDays(T, -165), addDays(T, 200), 3, infra.filter((a) => a.type === 'Network_Device').slice(0, 5), 9500, 'Annual', 'Next business day');
      mk('UPS Maintenance AMC', addDays(T, -380), addDays(T, -15), 5, infra.filter((a) => a.type === 'UPS').slice(0, 3), 4200, 'Half-Yearly', 'Quarterly visit');
    }
    log('System', 'Sample data loaded from ITSM_2026 workbook');
    return db;
  }

  const logic = (ITMS.logic = {
    HW_STATUS, CONDITIONS, ITEM_TYPES, pad, parse, iso, today, addDays, addYears, diffDays, daysTo, num, round2, uniq,
    emp, empName, vendor, po, pr, hw, sw, term, cons, typeCfg, build, stats, log,
    prLineKey, orderedQty, prRemaining, prStatus, savePR, deletePR, lineTotals, poTotals, poReceipt, createPOsFromPR, savePO, setPOApproval, deletePO, receivePO, guess, lastPrice,
    issueAssets, returnAssets, transferAssets, setAssetState, saveHW, deleteHW, usage, swUsed, swInfo, saveSW, deleteSW, installSW, uninstallSW, renewSW,
    consTotals, addConsumable, addConsPurchase, addConsIssue, amcInfo, saveAMC, deleteAMC, saveEmployee, deleteEmployee, saveVendor, deleteVendor,
  });
  ITMS.store = store;
})();

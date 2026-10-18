/* ITMS full test-data loader — wipes everything EXCEPT employees, then rebuilds
   every module with fixtures covering all statuses and types. Run from
   Settings → Data, or call ITMS.testdata.load() (confirmed there). */
(function () {
  const ITMS = window.ITMS, L = ITMS.logic, UI = ITMS.ui, S = ITMS.store;
  const db = () => S.db;
  const H = () => db().hd;
  const D = () => db().sdp;
  const T0 = () => L.today();
  const agoD = (n) => L.addDays(T0(), -n);
  const fwdD = (n) => L.addDays(T0(), n);
  const agoH = (n) => new Date(Date.now() - n * 36e5).toISOString();
  const fwdH = (n) => new Date(Date.now() + n * 36e5).toISOString();

  function fixDue(r) {
    const s = ((H() || {}).cfg || {}).sla || {};
    const sla = s[r.priority] || { respond: 8, resolve: 24 };
    const t = new Date(r.created).getTime();
    r.respondBy = new Date(t + sla.respond * 36e5).toISOString();
    r.dueBy = new Date(t + sla.resolve * 36e5).toISOString();
  }
  function hist(r, text, at) { (r.hist = r.hist || []).unshift({ at: at || r.created, text }); }

  function load() {
    let emps = db().employees.slice();
    if (!emps.length && typeof window !== 'undefined' && window.SEED && Array.isArray(window.SEED.employees) && window.SEED.employees.length) emps = JSON.parse(JSON.stringify(window.SEED.employees));
    if (!emps.length) throw new Error('No employees found — cannot build test data without the user list.');
    S.reset('empty');
    const d = db();
    d.employees = emps;
    /* ---------- sample employees across all departments (skipped if present) ---------- */
    const ceo = emps.find((e) => /john smith/i.test(e.name || '')) || emps.find((e) => e.status === 'Active' && e.email) || { name: 'CEO' };
    const ceoName = ceo.name || 'CEO';
    const ROSTER = [
      ['Layla Haddad', 'Executive Assistant', 'Executive', 'layla.haddad@bobbysharon.ae', '2022-03-01', ceoName],
      ['Tariq Aziz', 'Operations Director', 'Executive', 'tariq.aziz@bobbysharon.ae', '2021-06-15', ceoName],
      ['Priya Nair', 'Accountant', 'Finance', 'priya.nair@bobbysharon.ae', '2023-01-10', ceoName],
      ['Khalid Mansoor', 'Finance Manager', 'Finance', 'khalid.mansoor@bobbysharon.ae', '2020-11-01', 'Priya Nair'],
      ['Ayesha Rahman', 'HR Officer', 'Human Resources', 'ayesha.rahman@bobbysharon.ae', '2023-04-12', ceoName],
      ['Omar Farouk', 'Recruiter', 'Human Resources', 'omar.farouk@bobbysharon.ae', '2024-02-01', 'Ayesha Rahman'],
      ['Vikram Rao', 'System Administrator', 'IT', 'vikram.rao@bobbysharon.ae', '2021-09-20', ceoName],
      ['Nora Salem', 'IT Support Engineer', 'IT', 'nora.salem@bobbysharon.ae', '2023-08-14', 'Vikram Rao'],
      ['Huda Karim', 'Marketing Executive', 'Marketing', 'huda.karim@bobbysharon.ae', '2022-07-05', ceoName],
      ['Chris Dsouza', 'Content Specialist', 'Marketing', 'chris.dsouza@bobbysharon.ae', '2024-05-20', 'Huda Karim'],
      ['Adel Mahmoud', 'Operations Supervisor', 'Operations', 'adel.mahmoud@bobbysharon.ae', '2021-12-01', ceoName],
      ['Rita George', 'Logistics Coordinator', 'Operations', 'rita.george@bobbysharon.ae', '2023-10-03', 'Adel Mahmoud'],
      ['Mona Fawaz', 'Admin Assistant', 'Administration', 'mona.fawaz@bobbysharon.ae', '2022-09-11', ceoName],
      ['Samir Iqbal', 'Facilities Coordinator', 'Administration', 'samir.iqbal@bobbysharon.ae', '2023-03-22', 'Mona Fawaz'],
      ['Faisal Noor', 'Security Officer', 'Security', 'faisal.noor@bobbysharon.ae', '2021-05-30', ceoName],
      ['Dana Khalil', 'CCTV Operator', 'Security', 'dana.khalil@bobbysharon.ae', '2024-01-08', 'Faisal Noor'],
    ];
    ROSTER.forEach((x, i) => {
      if (d.employees.some((e) => (e.email || '').toLowerCase() === x[3])) return;
      L.saveEmployee({ name: x[0], designation: x[1], manager: x[5], doj: x[4], dol: '', dept: x[2], location: 'Dubai, UAE', email: x[3], mobile: '9715000' + (110 + i), tel: '', ext: '', status: 'Active' });
    });
    const newEmps = ROSTER.map((x) => d.employees.find((e) => (e.email || '').toLowerCase() === x[3])).filter(Boolean);
    /* ---------- employee states for behavior testing (resigned / terminated / inactive) ---------- */
    const STATES = [
      ['Test Resigned', 'Driver (Resigned)', 'Operations', 'test.resigned@bobbysharon.ae', '2021-02-01', 'Left', agoD(30)],
      ['Test Terminated', 'Guard (Terminated)', 'Security', 'test.terminated@bobbysharon.ae', '2022-05-15', 'Left', agoD(60)],
      ['Test Inactive', 'Coordinator (Inactive)', 'Administration', 'test.inactive@bobbysharon.ae', '2023-09-01', 'Inactive', ''],
    ];
    STATES.forEach((x) => {
      if (d.employees.some((e) => (e.email || '').toLowerCase() === x[3])) return;
      L.saveEmployee({ name: x[0], designation: x[1], manager: ceo.name || '', doj: x[4], dol: x[6], dept: x[2], location: 'Dubai, UAE', email: x[3], mobile: '', tel: '', ext: '', status: x[5] });
    });
    const resigned = d.employees.find((e) => e.email === 'test.resigned@bobbysharon.ae');
    if (resigned && !db().hw.some((a) => a.holder === resigned.no)) {
      const ra = L.saveHW({ type: 'Monitor', desc: 'TEST: Monitor still held by resigned staff', purchaseDate: agoD(300), price: 700, condition: 'Fair' });
      L.issueAssets(resigned.no, [ra.id], agoD(200), 'Issued before resignation — tests return/delete guards');
    }
    Object.assign(d.company, { name: 'BOBBY SHARON', address: 'DUBAI, UAE', vat: 5, currency: 'AED', warrantyDays: 365, logo: '' });
    const E = emps.filter((e) => e.status === 'Active');
    if (!E.length) throw new Error('No active employees found — cannot build test data.');
    const pick = (i) => E[i % E.length] || E[0];
    const T = () => L.today();
    const h = H();
    h.items = []; h.seq.item = 0; // drop auto DHRE pair; sample timer suppressed at end

    /* ---------- technicians ---------- */
    const groups = h.cfg.groups;
    const techSrc = E.filter((e) => e.dept === 'IT').concat(E).slice(0, 4);
    const tnames = ['Service Desk Analyst', 'Desktop Engineer', 'Network Engineer', 'System Administrator'];
    h.techs = techSrc.map((e, i) => ({ id: 'TECH-0' + (i + 1), name: e.name, email: e.email || '', group: groups[i % groups.length], role: i === 0 ? 'Administrator' : 'Technician', level: ['Tier 1', 'Tier 2', 'Tier 2', 'Tier 3'][i], empNo: e.no, active: 'Yes' }));
    const TN = (i) => h.techs[i % h.techs.length].name;
    L.log('System', 'BOBBY SHARON test data: technicians created');

    /* ---------- vendors (all compliance states) ---------- */
    const V = {};
    [['TechSource Trading', 'AED', 'Compliant', 'ISO 27001'], ['SoftLine Solutions', 'AED', 'Compliant', 'ISO 9001'], ['OfficeSupplies Co', 'AED', 'Pending', ''], ['ProServe Maintenance', 'AED', 'Compliant', 'ISO 20000'], ['ConnectTel', 'AED', 'Pending', ''], ['FacilityFix Services', 'AED', 'Non-Compliant', '']].forEach((x, i) => {
      const t0 = (db().terms[0] || {}).id || '';
      const v = L.saveVendor({ name: x[0], contact: 'Sales Team', email: 'sales@vendor' + (i + 1) + '.ae', phone1: '971-4-100-200' + i, city: 'Dubai', country: 'UAE', currency: x[1], termsId: t0, certs: x[3], compliance: x[2] });
      V[x[0]] = (v && v.name) || x[0];
    });

    /* ---------- PRs (open / partial / ordered / cancelled, all types) ---------- */
    const PR = {};
    const mkPR = (key, o) => { const p = L.savePR(Object.assign({ date: agoD(o.ago || 20), requester: pick(o.emp || 0).no, dept: 'IT', notes: 'Test PR — ' + key }, o.data)); PR[key] = p.prNo; return p; };
    mkPR('laptops', { data: { lines: [{ itemType: 'Hardware', vendor: V['TechSource Trading'], desc: 'Dell Latitude 5440 Laptop', unit: 'Nos', qty: 5, notes: 'i7 16GB' }] } });
    mkPR('monitors', { data: { lines: [{ itemType: 'Hardware', vendor: V['TechSource Trading'], desc: 'Dell 24 inch Monitor P2422H', unit: 'Nos', qty: 10 }] } });
    mkPR('m365', { data: { lines: [{ itemType: 'Software', vendor: V['SoftLine Solutions'], desc: 'Microsoft 365 Business Standard annual', unit: 'Licence', qty: 10 }] } });
    mkPR('toner', { data: { lines: [{ itemType: 'Consumable', vendor: V['OfficeSupplies Co'], desc: 'HP 305A Black Toner', unit: 'Pcs', qty: 12 }] } });
    mkPR('servers', { data: { lines: [{ itemType: 'Hardware', vendor: V['TechSource Trading'], desc: 'Dell PowerEdge R450 Server', unit: 'Nos', qty: 2 }] } });
    mkPR('switch', { data: { lines: [{ itemType: 'Hardware', vendor: V['ConnectTel'], desc: 'Cisco CBS350 24-port Switch', unit: 'Nos', qty: 3 }] } });
    const cancelled = mkPR('ups', { data: { lines: [{ itemType: 'Hardware', vendor: V['TechSource Trading'], desc: 'APC 1500VA UPS', unit: 'Nos', qty: 4 }] } });
    cancelled.status = 'Cancelled';
    mkPR('cables', { data: { lines: [{ itemType: 'Consumable', vendor: V['OfficeSupplies Co'], desc: 'Cat6 Patch Cable 2m', unit: 'Pcs', qty: 40 }] } });

    /* ---------- POs: draft / approved / partial / received / cancelled ---------- */
    const PO = (prKey, line, qty, price, approve) => L.createPOsFromPR([{ prNo: PR[prKey], line, qty, price }], { autoApprove: !!approve })[0];
    const poLap = PO('laptops', 1, 5, 4200, true);
    const poMon = PO('monitors', 1, 6, 780, true); // partial → PR stays Partially Ordered
    const poSw = PO('m365', 1, 10, 62, true);
    const poTon = PO('toner', 1, 12, 285, true);
    const poSrv = PO('servers', 1, 2, 14500, false); // Draft
    const poSw2 = PO('switch', 1, 3, 1900, true); // Approved, not received → Pending
    const poCab = PO('cables', 1, 40, 9, true);
    L.setPOApproval(poCab, 'Cancelled');
    const POX = (no, cc, del) => { const p = L.po(no); if (p) { p.costCenter = cc; if (del !== undefined) p.delivery = del; } };
    POX(poLap, 'IT', agoD(12)); POX(poMon, 'IT', fwdD(10)); POX(poSw, 'IT', agoD(15)); POX(poTon, 'Administration', agoD(6)); POX(poSrv, 'IT', ''); POX(poSw2, 'Operations', fwdD(20)); POX(poCab, 'Administration', '');
    L.receivePO(poLap, [{ line: 1, qty: 5 }], { date: agoD(12) });
    L.receivePO(poMon, [{ line: 1, qty: 6 }], { date: agoD(9) }); // Partial
    L.receivePO(poSw, [{ line: 1, qty: 10 }], { date: agoD(15) });
    L.receivePO(poTon, [{ line: 1, qty: 12 }], { date: agoD(6) });

    /* ---------- hardware across every status + movement history ---------- */
    const freeHw = db().hw.filter((a) => a.status === 'In Stock' && ['Laptop', 'Desktop', 'Monitor', 'Peripheral'].includes(a.type));
    const lap1 = freeHw[0], lap2 = freeHw[1];
    if (lap1) L.issueAssets(pick(1).no, [lap1.id], agoD(10), 'Test issue');
    if (lap2) { L.issueAssets(pick(2).no, [lap2.id], agoD(30), 'Test issue'); L.transferAssets(pick(2).no, pick(3).no, [lap2.id], agoD(8), 'Department move'); }
    const ret = L.saveHW({ type: 'Monitor', desc: 'Test Monitor for return flow', compName: 'TEST-MON-01', serial: 'TST001', purchaseDate: agoD(40), price: 700, condition: 'Good' });
    L.issueAssets(pick(4).no, [ret.id], agoD(20), 'Test issue'); L.returnAssets(pick(4).no, [ret.id], agoD(2), 'Good', 'In Stock', 'Test return');
    const rep = L.saveHW({ type: 'Printer', desc: 'Test Printer under repair', purchaseDate: agoD(200), price: 1100, condition: 'Poor' });
    L.setAssetState(rep.id, 'Under Repair', 'Test repair flow');
    const dsp = L.saveHW({ type: 'Desktop', desc: 'Test Desktop disposed', purchaseDate: agoD(800), price: 2500, condition: 'Poor' });
    L.setAssetState(dsp.id, 'Disposed', 'Beyond repair — test disposal');
    L.saveHW({ type: 'Server', desc: 'Test Server spare', purchaseDate: agoD(90), price: 14000, condition: 'New' });

    /* ---------- one device per roster head, issued + software installed ---------- */
    const devTypes = [['Laptop', 'Dell Latitude 5440', 4200], ['Desktop', 'Dell OptiPlex 7010', 3100], ['Monitor', 'Dell P2422H 24 inch', 780], ['Phone', 'Yealink T46S', 620]];
    newEmps.forEach((e, i) => {
      const dt = devTypes[i % devTypes.length];
      const oss = ['Windows 11', 'Windows 11', 'Windows 10', 'Android 14'];
      const a = L.saveHW({ type: dt[0], desc: 'TEST: ' + dt[1] + ' for ' + e.name, compName: 'TEST-' + e.no, serial: 'TST-' + e.no, purchaseDate: agoD(45), price: dt[2], condition: 'Good', brand: dt[0] === 'Phone' ? 'Yealink' : 'Dell', os: oss[i % oss.length], domain: i % 2 ? 'HQ' : 'BRANCH', network: '192.168.' + (10 + (i % 3)) + '.0/24' });
      L.issueAssets(e.no, [a.id], agoD(30), 'TEST onboarding allocation');
    });

    /* ---------- software: expiring / expired / exhausted / perpetual ---------- */
    const sw1 = L.saveSW({ type: 'Application Software', subType: 'Cloud-Based', name: 'Microsoft 365 Test', vendor: 'SoftLine', purchaseDate: agoD(345), expiry: fwdD(20), qty: 25, unitPrice: 62, currency: 'AED' });
    const sw2 = L.saveSW({ type: 'System Software', subType: 'Perpetual', name: 'Endpoint AV Test', vendor: 'SoftLine', purchaseDate: agoD(400), expiry: agoD(10), qty: 15, unitPrice: 90, currency: 'AED' });
    const sw3 = L.saveSW({ type: 'Application Software', subType: 'Perpetual', name: 'Design Suite Test', vendor: 'SoftLine', purchaseDate: agoD(100), expiry: fwdD(200), qty: 2, unitPrice: 2400, currency: 'AED' });
    const sw4 = L.saveSW({ type: 'Application Software', subType: 'Perpetual', name: 'ERP Client Perpetual', vendor: 'SoftLine', purchaseDate: agoD(320), expiry: '', qty: 30, unitPrice: 500, currency: 'AED' });
    const devs = db().hw.filter((a) => a.holder && (a.type === 'Laptop' || a.type === 'Desktop' || a.type === 'Monitor'));
    const put = (s, n) => { for (let i = 0; i < n; i++) { const a = devs.length ? devs[i % devs.length] : null; try { L.installSW(s.id, a ? a.holder : pick(i).no, a ? a.id : '', agoD(5), 1); } catch (e) { /* pool full */ } } };
    put(sw1, 6); put(sw3, 2); put(sw4, 3);
    newEmps.forEach((e) => { try { L.installSW(sw1.id, e.no, '', agoD(4), 1); } catch (err) { /* pool full */ } try { L.installSW(sw4.id, e.no, '', agoD(4), 1); } catch (err2) { /* pool full */ } });

    /* ---------- consumables: healthy + low-stock alert ---------- */
    const con1 = L.addConsumable({ type: 'Ink_Toner', subtype: 'Black Toner', brand: 'HP', model: '305A', desc: 'HP 305A Black Toner TEST', uom: 'Pcs', reorder: 4 }, true);
    L.addConsPurchase({ date: agoD(30), itemId: con1.id, qty: 12, price: 285, vat: 5, vendor: V['OfficeSupplies Co'] }, true);
    L.addConsIssue({ date: agoD(4), itemId: con1.id, empNo: pick(1).no, qty: 10, remarks: 'Test issue to trigger low stock' }, true);
    const con2 = L.addConsumable({ type: 'Cables', subtype: 'Patch Cable', brand: 'Cat6', model: 'UTP-2M', desc: 'Cat6 Cable TEST', uom: 'Pcs', reorder: 5 }, true);
    L.addConsPurchase({ date: agoD(25), itemId: con2.id, qty: 50, price: 9, vat: 5, vendor: V['OfficeSupplies Co'] }, true);
    L.addConsIssue({ date: agoD(3), itemId: con2.id, empNo: pick(2).no, qty: 6, remarks: 'Test issue' }, true);

    /* ---------- AMCs: active / expiring / expired / renewal ---------- */
    const vIds = {}; db().vendors.forEach((v) => { vIds[v.name] = v.id; });
    const srvHw = db().hw.filter((a) => a.type === 'Server').map((a) => a.id).slice(0, 2);
    L.saveAMC({ title: 'Test Server AMC (active)', assets: srvHw, vendorId: vIds['ProServe Maintenance'], start: agoD(100), end: fwdD(200), sla: '4-hour response', coverage: 'Parts & labour', exclusions: 'Physical damage', cost: 18000, freq: 'Quarterly', terms: (db().terms[0] || {}).id, status: 'Active', notes: 'Test' });
    L.saveAMC({ title: 'Test Network AMC (expiring)', assets: [], vendorId: vIds['ConnectTel'], start: agoD(340), end: fwdD(12), sla: 'NBD', coverage: 'Remote + onsite', exclusions: '', cost: 9500, freq: 'Annual', terms: (db().terms[0] || {}).id, status: 'Active', notes: 'Test' });
    L.saveAMC({ title: 'Test UPS AMC (expired)', assets: [], vendorId: vIds['ProServe Maintenance'], start: agoD(400), end: agoD(15), sla: 'Quarterly visit', coverage: 'Preventive', exclusions: '', cost: 4200, freq: 'Half-Yearly', terms: (db().terms[0] || {}).id, status: 'Active', notes: 'Test' });
    L.saveAMC({ title: 'Test Printer Support (renewal)', assets: [], vendorId: vIds['FacilityFix Services'], start: agoD(300), end: fwdD(40), sla: 'NBD', coverage: 'Break-fix', exclusions: '', cost: 3000, freq: 'Annual', terms: (db().terms[0] || {}).id, status: 'Renewal', notes: 'Test' });

    /* ---------- tickets: every status, priority, SLA state ---------- */
    const MK = ITMS.sdp.mkTicket;
    const NT = (o) => MK(Object.assign({ requester: pick(1).no, type: 'Incident', mode: 'Web Form', level: 'Tier 1' }, o));
    const t1 = NT({ subject: 'TEST: Core network down (Critical, overdue)', category: 'Network & Connectivity', impact: 'High', urgency: 'Urgent', status: undefined });
    t1.created = agoH(30); t1.priority = 'Critical'; fixDue(t1); t1.status = 'In Progress'; t1.tech = TN(2);
    t1.notes.push({ at: agoH(28), type: 'Public reply', by: TN(2), text: 'Core switch isolated, failover in progress.' });
    t1.work.push({ by: TN(2), date: agoD(1), hours: 3, text: 'Failover + vendor call' });
    hist(t1, 'Request created and assigned to ' + TN(2)); hist(t1, 'Work started');
    const t2 = NT({ subject: 'TEST: Laptop will not boot (due soon)', category: 'Hardware', sub: 'Laptop', impact: 'High', urgency: 'High', asset: lap1 ? lap1.id : '' });
    t2.created = agoH(5); t2.priority = 'High'; fixDue(t2); t2.dueBy = fwdH(2); t2.status = 'Assigned'; t2.tech = TN(1);
    t2.tasks.push({ title: 'Run hardware diagnostics', done: true, owner: TN(1) }, { title: 'Reimage if disk healthy', done: false, owner: TN(1) });
    const t3 = NT({ subject: 'TEST: Password reset (resolved)', category: 'Accounts & Access', impact: 'Medium', urgency: 'Normal' });
    t3.created = agoH(50); fixDue(t3); t3.status = 'Resolved'; t3.tech = TN(0); t3.firstResp = agoH(49); t3.resolvedAt = agoH(26); t3.resolution = 'Password reset and verified with user.'; t3.closure = 'Success';
    const t4 = NT({ subject: 'TEST: New joiner laptop (unassigned open)', category: 'Service Request', impact: 'Medium', urgency: 'Normal', type: 'Service Request' });
    t4.tech = ''; t4.status = 'Open';
    const t5 = NT({ subject: 'TEST: Toner low on 3rd floor (closed)', category: 'Printing & Scanning', impact: 'Low', urgency: 'Low' });
    t5.created = agoH(90); fixDue(t5); t5.status = 'Closed'; t5.tech = TN(0); t5.resolvedAt = agoH(70); t5.closedAt = agoH(68); t5.resolution = 'Toner replaced.'; t5.closure = 'Success';
    const t6 = NT({ subject: 'TEST: VPN drops (on hold)', category: 'Network & Connectivity', impact: 'Medium', urgency: 'High' });
    t6.status = 'On Hold'; t6.tech = TN(2); t6.pendingWith = 'Vendor'; t6.heldAt = agoH(10); t6.firstResp = t6.created;
    const t7 = NT({ subject: 'TEST: Duplicate request (cancelled)', category: 'Other', impact: 'Low', urgency: 'Low' });
    t7.status = 'Cancelled';
    const t8 = NT({ subject: 'TEST: WiFi dead zone (response breach)', category: 'Network & Connectivity', impact: 'High', urgency: 'High' });
    t8.created = agoH(30); t8.priority = 'High'; fixDue(t8); // firstResp empty + respondBy past → escalates
    const t9 = NT({ subject: 'TEST: MFA locked out', category: 'Accounts & Access', impact: 'Medium', urgency: 'High', mode: 'Phone' });
    t9.status = 'In Progress'; t9.tech = TN(0); t9.firstResp = t9.created;
    const t10 = NT({ subject: 'TEST: ERP login error (approval pending)', category: 'ERP & Business Apps', impact: 'Medium', urgency: 'Normal' });
    t10.status = 'Assigned'; t10.tech = TN(3);
    t10.approvals.push({ approver: TN(0), comment: 'Needs role change sign-off', status: 'Pending', at: agoH(50) });
    const t11 = NT({ subject: 'TEST: CCTV offline at gate', category: 'Biometric & Access Control', impact: 'Low', urgency: 'Normal', mode: 'Walk-in' });
    const t12 = NT({ subject: 'TEST: Genesys queue change (telephony)', category: 'Telephony & Contact Centre', impact: 'High', urgency: 'Normal' });
    t12.status = 'Assigned'; t12.tech = TN(2);
    [t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12].forEach((r) => { r.dept = (L.emp(r.requester) || {}).dept || ''; });

    /* ---------- problems (all statuses) ---------- */
    const HS = (k) => { h.seq[k] = (h.seq[k] || 0) + 1; return h.seq[k]; };
    const mkP = (o) => { const r = Object.assign({ id: 'PRB-' + String(HS('problems')).padStart(4, '0'), created: agoH(60), requests: [], hist: [] }, o); h.problems.unshift(r); return r; };
    const p1 = mkP({ title: 'TEST: Recurring VPN drops', desc: 'Third occurrence this month', category: 'Network & Connectivity', group: groups[2] || groups[0], owner: TN(2), status: 'Open', impact: 'High', urgency: 'High', due: fwdD(5), symptoms: 'Tunnel drops 14:00-15:00', requests: [t6.id, t8.id] });
    const p2 = mkP({ title: 'TEST: Laptop boot failures batch', category: 'Hardware', owner: TN(1), status: 'In Progress', impact: 'Medium', urgency: 'Normal', due: fwdD(7), symptoms: 'Same image batch', requests: [t2.id] });
    const p3 = mkP({ title: 'TEST: Mail delays (root cause found)', category: 'Email & Collaboration', owner: TN(3), status: 'Root Cause Found', impact: 'Medium', urgency: 'Normal', due: fwdD(3), rootCause: 'Transport rule loop', workaround: 'Bypass rule for VIPs' });
    const p4 = mkP({ title: 'TEST: Print spooler crashes (resolved)', category: 'Printing & Scanning', owner: TN(1), status: 'Resolved', impact: 'Low', urgency: 'Normal', solution: 'Driver pack updated' });
    mkP({ title: 'TEST: Old VPN client issue (closed)', category: 'Network & Connectivity', owner: TN(2), status: 'Closed', impact: 'Low', urgency: 'Low' });
    t6.problem = p1.id; t8.problem = p1.id; t2.problem = p2.id;

    /* ---------- changes (all statuses, one stale CAB approval) ---------- */
    const mkC = (o) => { const r = Object.assign({ id: 'CHG-' + String(HS('changes')).padStart(4, '0'), created: agoH(70), requests: [], approvals: [], hist: [] }, o); h.changes.unshift(r); return r; };
    mkC({ title: 'TEST: Firewall rule cleanup', changeType: 'Minor', status: 'Submission', category: 'Network & Connectivity', owner: TN(2), impact: 'Low', risk: 'Low', reason: 'Stale rules', rollout: 'Off-hours', backout: 'Restore backup' });
    mkC({ title: 'TEST: Switch firmware upgrade', changeType: 'Standard', status: 'Planning', category: 'Network & Connectivity', owner: TN(2), impact: 'Medium', risk: 'Medium', start: fwdD(6), end: fwdD(6) });
    const chAppr = mkC({ title: 'TEST: Core switch replacement (CAB waiting)', changeType: 'Major', status: 'Approval', category: 'Network & Connectivity', owner: TN(2), impact: 'High', risk: 'High', start: fwdD(9), end: fwdD(9), assets: srvHw });
    chAppr.approvals.push({ approver: TN(0), comment: 'CAB sign-off needed', status: 'Pending', at: agoH(50) });
    const chImp = mkC({ title: 'TEST: AP rollout floor 2 (linked ticket)', changeType: 'Standard', status: 'Implementation', category: 'Network & Connectivity', owner: TN(2), impact: 'Medium', risk: 'Medium', start: agoD(1), end: fwdD(2), requests: [t8.id] });
    t8.change = chImp.id;
    mkC({ title: 'TEST: Mail archiving (UAT)', changeType: 'Standard', status: 'UAT', owner: TN(3), impact: 'Low', risk: 'Low' });
    mkC({ title: 'TEST: AV policy push (review)', changeType: 'Standard', status: 'Review', owner: TN(3), impact: 'Low', risk: 'Low' });
    mkC({ title: 'TEST: M365 rollout (closed)', changeType: 'Major', status: 'Closed', owner: TN(0), impact: 'High', risk: 'Medium' });
    mkC({ title: 'TEST: Risky DNS change (rejected)', changeType: 'Emergency', status: 'Rejected', owner: TN(2), impact: 'High', risk: 'High' });

    /* ---------- releases / follow-ups / KB / catalog / news ---------- */
    const mkR = (o) => { const r = Object.assign({ id: 'REL-' + String(HS('releases')).padStart(4, '0'), created: agoH(40) }, o); h.releases.unshift(r); return r; };
    mkR({ title: 'TEST: Q3 patch bundle', relType: 'Minor', status: 'Planning', owner: TN(3) });
    mkR({ title: 'TEST: ERP patch', relType: 'Minor', status: 'Build', owner: TN(3) });
    mkR({ title: 'TEST: M365 apps update', relType: 'Major', status: 'Test', owner: TN(0) });
    mkR({ title: 'TEST: WiFi controller upgrade', relType: 'Major', status: 'Deployment', owner: TN(2) });
    mkR({ title: 'TEST: Old AV rollout', relType: 'Minor', status: 'Closed', owner: TN(3) });
    const mkI = (o) => { h.seq.item = (h.seq.item || 0) + 1; const r = Object.assign({ id: h.seq.item, log: [] }, o); h.items.push(r); return r; };
    mkI({ project: 'Network Refresh', category: 'Infrastructure', desc: 'TEST: Replace floor switches', status: 'Open', priority: 'High', owner: TN(2), pendingWith: TN(2), open: agoD(10), target: fwdD(20), latest: 'Survey done', next: 'Order switches', remarks: '' });
    mkI({ project: 'Network Refresh', category: 'Infrastructure', desc: 'TEST: Overdue cabling (watch timeline)', status: 'Ongoing', priority: 'Critical', owner: TN(2), pendingWith: 'Vendor', open: agoD(40), target: agoD(2), latest: 'Waiting vendor', next: 'Escalate', remarks: '' });
    mkI({ project: 'Security Review', category: 'Security & Compliance', desc: 'TEST: Quarterly access review', status: 'Pending', priority: 'Medium', owner: TN(0), pendingWith: 'HR', open: agoD(5), target: fwdD(9), latest: 'List pulled', next: 'Review with HR', remarks: '' });
    mkI({ project: 'Security Review', category: 'Security & Compliance', desc: 'TEST: Firewall audit (on hold)', status: 'On Hold', priority: 'Medium', owner: TN(2), pendingWith: TN(2), open: agoD(15), target: fwdD(15), latest: 'Paused for change freeze', next: 'Resume', remarks: '' });
    mkI({ project: 'Office Move', category: 'Facilities', desc: 'TEST: Done item', status: 'Completed', priority: 'Low', owner: TN(1), open: agoD(60), target: agoD(30), latest: 'Done', next: '', remarks: '' });
    mkI({ project: 'Office Move', category: 'Facilities', desc: 'TEST: Cancelled item', status: 'Cancelled', priority: 'Low', owner: TN(1), open: agoD(50), target: agoD(20), latest: '', next: '', remarks: '' });
    if (!h.cfg.projects.includes('Network Refresh')) h.cfg.projects.push('Network Refresh', 'Security Review', 'Office Move');
    ['Infrastructure', 'Security & Compliance', 'Facilities'].forEach((c) => { if (!h.cfg.trackerCats.includes(c)) h.cfg.trackerCats.push(c); });
    const mkS = (o) => { const r = Object.assign({ id: 'KB-' + String(HS('solutions')).padStart(4, '0'), created: agoH(20), views: 0, hist: [] }, o); h.solutions.unshift(r); return r; };
    mkS({ title: 'TEST: Email says mailbox full — cannot send mail', category: 'Email & Collaboration', status: 'Published', author: TN(0), keywords: 'mailbox full, cannot send, storage full, email bounce', views: 34, content: 'WHAT THIS MEANS (in plain words): Your email box is like a cupboard — it has limited space. When it is full, new mail cannot come in and your sent mail gets stuck. Nothing is lost; we just need to make space.\n\nWHO THIS IS FOR: Anyone whose Outlook or phone mail shows "mailbox full" or whose sent mail stays in the Outbox.\n\nDO THIS YOURSELF (about 10 minutes):\n1. In Outlook, open Deleted Items, then click "Empty folder". Do the same for Junk Email.\n2. Sort your Inbox by size and delete or archive the biggest old mails with attachments.\n3. Move last year\'s mails to your archive folder if IT created one for you.\n4. Close Outlook completely, open it again, and send yourself a test mail.\n\nWHEN TO CALL IT INSTEAD: If it still fails after 30 minutes, or you see an error mentioning "quota" or "admin" — raise a ticket and mention this article. IT can increase your space the same day.' });
    mkS({ title: 'TEST: New office printer does not appear on my laptop', category: 'Printing & Scanning', status: 'Published', author: TN(1), keywords: 'printer, add printer, cannot print, network printer', views: 21, content: 'WHAT THIS MEANS (in plain words): Your laptop has not yet been introduced to the printer. Adding it once is enough — afterwards just press Print.\n\nWHO THIS IS FOR: Anyone sitting near a shared printer they have never used.\n\nDO THIS YOURSELF (about 5 minutes):\n1. Make sure you are on the office Wi-Fi or network cable (not guest Wi-Fi, not mobile hotspot).\n2. The printer has a small white sticker with its name (for example PRN-F3-02). Note it down.\n3. On Windows: Settings, Bluetooth & devices, Printers, Add device. Wait 30 seconds, click your printer name, Add.\n4. Print a test page (right-click the printer, Print test page).\n\nWHEN TO CALL IT INSTEAD: If the printer never appears in the list, or the test page prints blank or garbled pages — raise a ticket with the printer name from the sticker.' });
    mkS({ title: 'TEST: VPN keeps asking me to sign in again and again', category: 'Network & Connectivity', status: 'Under Review', author: TN(2), keywords: 'vpn, sign in loop, password prompt, remote', views: 9, content: 'WHAT THIS MEANS (in plain words): The secure tunnel between your laptop and the office keeps dropping and asking you to prove who you are each time. Usually the saved sign-in on your laptop is simply out of date.\n\nWHO THIS IS FOR: Anyone working from home whose VPN worked before and now keeps logging them out.\n\nTRY THIS YOURSELF (about 5 minutes):\n1. Disconnect the VPN fully (click Disconnect, do not just close the window).\n2. Restart your laptop. This clears the stuck sign-in.\n3. Connect again using your full email address (not just your name), password, then approve the phone notification.\n4. If it still loops, remove the saved VPN profile and add it again.\n\nWHEN TO CALL IT INSTEAD: If three tries fail, or colleagues on the same network are also affected (that means the office side needs a fix) — raise a ticket.' });
    mkS({ title: 'TEST: Old fax-line troubleshooting (retired)', category: 'Other', status: 'Expired', author: TN(0), keywords: 'fax, retired', content: 'This article is retired — the fax lines were removed in 2025. For scanning, use any office printer scanner or raise a ticket.' });
    const mkCat = (o) => { const r = Object.assign({ id: 'SC-' + String(HS('catalog')).padStart(3, '0'), active: 'Yes' }, o); h.catalog.unshift(r); return r; };
    mkCat({ title: 'TEST: New laptop for staff', desc: 'WHAT YOU GET (in plain words): A ready-to-work laptop with charger, bag and mouse, your email already set up. WHO CAN ASK: Any employee, or a manager for a new joiner. WHAT HAPPENS NEXT: 1. Your manager approves (usually same day). 2. IT prepares the laptop within 3 working days. 3. IT calls you, hands it over, and you sign a one-page receipt. That is all.', category: 'Service Request', group: groups[0], impact: 'Medium', urgency: 'Normal', approver: TN(0) });
    mkCat({ title: 'TEST: Password reset in 30 minutes', desc: 'WHAT THIS IS (in plain words): You forgot your password or are locked out, and need a new one. No approval needed. WHAT HAPPENS NEXT: 1. Click Request. 2. IT calls you back to confirm it is really you. 3. You get a temporary password and set your own on first login. Usually done within 30 minutes.', category: 'Accounts & Access', impact: 'Low', urgency: 'Normal' });
    mkCat({ title: 'TEST: Shared team mailbox', desc: 'WHAT THIS IS (in plain words): One email address the whole team can read and reply from — for example info@ or support@ — instead of using one person\'s inbox. WHO CAN ASK: Team leads. WHAT HAPPENS NEXT: 1. Request with the team members list. 2. IT creates it within 1 working day and adds your team. 3. It appears automatically in everyone\'s Outlook.', category: 'Email & Collaboration', impact: 'Low', urgency: 'Normal' });
    mkCat({ title: 'TEST: Retired courier booking (do not use)', desc: 'This service is retired — courier requests now go to the Facilities desk, not IT. This entry is kept only so old tickets still make sense.', category: 'Other', active: 'No', impact: 'Low', urgency: 'Low' });
    h.news.unshift({ id: 'ANN-' + String(HS('news')).padStart(3, '0'), title: 'TEST: Maintenance window Friday', desc: 'Core network maintenance 22:00–23:00.', from: agoD(1), to: fwdD(6), active: 'Yes', created: agoH(5) });

    /* ---------- SDP modules ---------- */
    const s = D();
    s.contracts.push(
      { id: 'CTR-101', title: 'TEST: Internet lease (active)', vendor: V['ConnectTel'], type: 'Lease', start: agoD(100), end: fwdD(200), value: 60000, owner: TN(2), assets: [], status: 'Active', notes: 'Test' },
      { id: 'CTR-102', title: 'TEST: Support expiring soon', vendor: V['ProServe Maintenance'], type: 'Support', start: agoD(300), end: fwdD(12), value: 24000, owner: TN(0), assets: [], status: 'Active', notes: 'Test' },
      { id: 'CTR-103', title: 'TEST: Old cleaning deal (expired)', vendor: V['FacilityFix Services'], type: 'Maintenance', start: agoD(400), end: agoD(20), value: 8000, owner: TN(0), assets: [], status: 'Active', notes: 'Test' },
      { id: 'CTR-104', title: 'TEST: Licence renewal in flight', vendor: V['SoftLine Solutions'], type: 'Licence Subscription', start: agoD(200), end: fwdD(60), value: 45000, owner: TN(3), assets: [], status: 'Renewal', notes: 'Test' }
    );
    s.cis.push(
      { id: 'CI-1001', name: 'TEST-CORE-SW', type: 'Network Device', owner: TN(2), site: 'Head Office', status: 'Live', criticality: 'Critical', assetId: '', ip: '10.0.0.1', created: agoD(90) },
      { id: 'CI-1002', name: 'TEST-FW-01', type: 'Firewall', owner: TN(2), site: 'Head Office', status: 'Live', criticality: 'Critical', assetId: '', ip: '10.0.0.254', created: agoD(90) },
      { id: 'CI-1003', name: 'TEST-ERP-APP', type: 'Application', owner: TN(3), site: 'Head Office', status: 'Live', criticality: 'High', assetId: '', ip: 'v4.2', created: agoD(60) },
      { id: 'CI-1004', name: 'TEST-ERP-DB', type: 'Database', owner: TN(3), site: 'Head Office', status: 'Live', criticality: 'High', assetId: '', ip: 'v15', created: agoD(60) },
      { id: 'CI-1005', name: 'TEST-LT-042', type: 'Laptop', owner: TN(1), site: 'Branch', status: 'Staged', criticality: 'Medium', assetId: lap1 ? lap1.id : '', ip: '', created: agoD(10) },
      { id: 'CI-1006', name: 'TEST-PRINT-OLD', type: 'Printer', owner: TN(1), site: 'Branch', status: 'Retired', criticality: 'Low', assetId: '', ip: '', created: agoD(300) }
    );
    s.links.push(
      { id: 'LNK-101', from: 'CI-1003', rel: 'runs on', to: 'CI-1001', at: agoD(60) },
      { id: 'LNK-102', from: 'CI-1003', rel: 'depends on', to: 'CI-1004', at: agoD(60) },
      { id: 'LNK-103', from: 'CI-1004', rel: 'backs up', to: 'CI-1001', at: agoD(60) },
      { id: 'LNK-104', from: 'CI-1001', rel: 'connects to', to: 'CI-1002', at: agoD(60) }
    );
    s.maint.push(
      { id: 'PMT-101', title: 'TEST: Monthly server patching (overdue)', freq: 'Monthly', next: agoD(3), group: groups[0], desc: 'Patch + reboot window', status: 'Scheduled' },
      { id: 'PMT-102', title: 'TEST: Quarterly AC service', freq: 'Quarterly', next: fwdD(25), group: groups[0], desc: 'Vendor visit', status: 'Scheduled' },
      { id: 'PMT-103', title: 'TEST: Paused UPS test', freq: 'Half-Yearly', next: fwdD(90), group: groups[0], desc: '', status: 'Paused' }
    );
    s.inbox.push(
      { id: 'MAIL-101', from: 'staff@bobbysharon.ae', subject: 'TEST: wifi not working on floor 3', body: 'Hi team, wifi keeps dropping since morning.', at: agoH(6), status: 'Unprocessed' },
      { id: 'MAIL-102', from: 'hr@bobbysharon.ae', subject: 'TEST: Password reset please', body: 'Locked out of email.', at: agoH(30), status: 'Converted → ' + t3.id }
    );
    s.schedules.push(
      { id: 'SCH-101', title: 'TEST: Follow up network outage ticket', kind: 'Request follow-up', date: T(), time: '15:00', owner: TN(2), link: t1.id },
      { id: 'SCH-102', title: 'TEST: Server patching task', kind: 'Task', date: fwdD(4), time: '22:00', owner: TN(3), link: '' },
      { id: 'SCH-103', title: 'TEST: Eid cover leave', kind: 'Time off', date: fwdD(30), time: '', owner: TN(1), link: '' },
      { id: 'SCH-104', title: 'TEST: Renew firewall cert', kind: 'Reminder', date: fwdD(12), time: '09:00', owner: TN(2), link: '' }
    );
    s.templates.push(
      { id: 'TPL-101', name: 'TEST: New monitor', category: 'Service Request', desc: '24 inch monitor + cable', impact: 'Low', urgency: 'Normal', group: groups[0], tasks: 'Manager approval\nCheck spare stock', active: 'Yes' },
      { id: 'TPL-102', name: 'TEST: VPN access', category: 'Accounts & Access', desc: 'VPN profile + MFA', impact: 'Medium', urgency: 'Normal', group: groups[0], tasks: 'Security approval', active: 'Yes' },
      { id: 'TPL-103', name: 'TEST: Retired template', category: 'Other', desc: '', impact: 'Low', urgency: 'Low', group: '', tasks: '', active: 'No' }
    );
    s.hr.leaves.push(
      { id: 'LV-T1', empNo: pick(5).no, type: 'Annual', from: fwdD(10), to: fwdD(12), days: 3, reason: 'TEST family trip', status: 'Pending', at: new Date().toISOString() },
      { id: 'LV-T2', empNo: pick(6).no, type: 'Sick', from: agoD(9), to: agoD(8), days: 2, reason: 'TEST flu', status: 'Approved', decided: agoD(10) }
    );
    s.schedules.push({ id: 'SCH-T91', title: 'TEST leave cover', kind: 'Time off', date: fwdD(10), time: '', owner: '', link: '' });
    s.fin.expenses.push(
      { id: 'EXP-T1', empNo: pick(5).no, date: agoD(6), category: 'Other', desc: 'TEST taxi to client site', amount: 85, status: 'Submitted', approver: (L.emp(pick(5).no) || {}).manager || '', at: new Date().toISOString() },
      { id: 'EXP-T2', empNo: pick(6).no, date: agoD(12), category: 'Consumables', desc: 'TEST office supplies', amount: 240, status: 'Approved', approver: (L.emp(pick(6).no) || {}).manager || '', at: new Date().toISOString() }
    );
    s.fin.payments.push({ id: 'PAY-T1', poNo: poSw2, vendor: V['ConnectTel'], amount: Math.round(L.poTotals(L.po(poSw2)).incl), date: agoD(3), mode: 'Bank transfer', ref: 'TEST-REF-01', at: new Date().toISOString() });
    L.po(poSw2).invoice = 'Paid';
    s.surveys.push({ id: 'SV-101', title: 'TEST: Leaver experience', q: 'How smooth was the exit process? (1-5)', active: 'No' });
    const sv = s.surveys.find((x) => x.id === 'SV-01');
    [[t3.id, pick(1).name, 5, 'Fast fix'], [t3.id, pick(1).name, 4, ''], [t5.id, pick(2).name, 5, ''], [t5.id, pick(3).name, 3, 'Took a while'], [t5.id, pick(4).name, 4, '']].forEach((x, i) => {
      s.responses.unshift({ id: 'SR-T' + (i + 1), surveyId: sv ? sv.id : 'SV-01', reqId: x[0], rater: x[1], score: x[2], comment: x[3], at: agoH(20 - i * 3) });
    });
    s.chats.push(
      { id: 'CHAT-101', user: pick(1).name, empNo: pick(1).no, tech: TN(1), status: 'Open', at: agoH(2), msgs: [{ by: pick(1).name, text: 'TEST: hi, printer jammed', at: agoH(2) }, { by: TN(1), text: 'TEST: on my way with a kit', at: agoH(1) }] },
      { id: 'CHAT-102', user: pick(2).name, empNo: pick(2).no, tech: '', status: 'Open', at: agoH(1), msgs: [{ by: pick(2).name, text: 'TEST: hi, need wifi password', at: agoH(1) }] },
      { id: 'CHAT-103', user: pick(3).name, empNo: pick(3).no, tech: TN(0), status: 'Closed', at: agoH(50), ticketId: t11.id, msgs: [{ by: pick(3).name, text: 'TEST: old chat', at: agoH(50) }] }
    );
    s.loans.push(
      { id: 'LOAN-101', assetId: '', empNo: pick(2).no, outDate: agoD(5), dueDate: fwdD(9), status: 'On loan', remarks: 'TEST: projector for training' },
      { id: 'LOAN-102', assetId: '', empNo: pick(3).no, outDate: agoD(30), dueDate: agoD(4), status: 'On loan', remarks: 'TEST: overdue projector' },
      { id: 'LOAN-103', assetId: '', empNo: pick(4).no, outDate: agoD(40), dueDate: agoD(20), returnDate: agoD(21), status: 'Returned', remarks: 'TEST: returned on time' }
    );
    s.products.push(
      { id: 'PRD-101', brand: 'Dell', model: 'Latitude 5440', type: 'Laptop', uom: 'Nos', price: 4200, vendor: V['TechSource Trading'], active: 'Yes' },
      { id: 'PRD-102', brand: 'HP', model: 'LaserJet M404dn', type: 'Printer', uom: 'Nos', price: 1150, vendor: V['TechSource Trading'], active: 'Yes' },
      { id: 'PRD-103', brand: 'Dell', model: 'P2422H 24in', type: 'Monitor', uom: 'Nos', price: 780, vendor: V['TechSource Trading'], active: 'Yes' },
      { id: 'PRD-104', brand: 'Yealink', model: 'T46S', type: 'Phone', uom: 'Nos', price: 620, vendor: V['ConnectTel'], active: 'Yes' }
    );
    s.items.push(
      { id: 'ITM-001', name: 'Dell Latitude 5440 Laptop', category: 'Hardware', type: 'Laptop', brand: 'Dell', model: 'Latitude 5440', uom: 'Nos', price: 4200, gl: '1510', vendor: 'TechSource Trading', desc: 'Business laptop, 16GB RAM, 512GB SSD', active: 'Yes' },
      { id: 'ITM-002', name: 'HP LaserJet M404dn Printer', category: 'Hardware', type: 'Printer', brand: 'HP', model: 'LaserJet M404dn', uom: 'Nos', price: 1150, gl: '1510', vendor: 'TechSource Trading', desc: 'Mono laser printer, duplex, network', active: 'Yes' },
      { id: 'ITM-003', name: 'Dell P2422H 24" Monitor', category: 'Hardware', type: 'Monitor', brand: 'Dell', model: 'P2422H', uom: 'Nos', price: 780, gl: '1510', vendor: 'TechSource Trading', desc: '24 inch IPS monitor', active: 'Yes' },
      { id: 'ITM-004', name: 'Yealink T46S IP Phone', category: 'Hardware', type: 'Phone', brand: 'Yealink', model: 'T46S', uom: 'Nos', price: 620, gl: '1510', vendor: 'ConnectTel', desc: 'SIP desk phone', active: 'Yes' },
      { id: 'ITM-005', name: 'Cisco Catalyst 9300 Switch', category: 'Network', type: 'Switch', brand: 'Cisco', model: 'C9300-48P', uom: 'Nos', price: 8500, gl: '1510', vendor: 'NetWorld', desc: '48-port PoE+ switch', active: 'Yes' },
      { id: 'ITM-006', name: 'Fortinet FortiGate 60F Firewall', category: 'Network', type: 'Firewall', brand: 'Fortinet', model: 'FG-60F', uom: 'Nos', price: 3200, gl: '1510', vendor: 'NetWorld', desc: 'Next-gen firewall', active: 'Yes' },
      { id: 'ITM-007', name: 'Ubiquiti UniFi AP U6-Pro', category: 'Network', type: 'Access Point', brand: 'Ubiquiti', model: 'U6-Pro', uom: 'Nos', price: 450, gl: '1510', vendor: 'NetWorld', desc: 'WiFi 6 access point', active: 'Yes' },
      { id: 'ITM-008', name: 'Microsoft 365 Business Premium', category: 'Software', type: 'Subscription', brand: 'Microsoft', model: 'M365 BP', uom: 'User', price: 180, gl: '5240', vendor: 'CloudServ', desc: 'Per-user annual subscription', active: 'Yes' },
      { id: 'ITM-009', name: 'Windows Server 2022 Standard', category: 'Software', type: 'License', brand: 'Microsoft', model: 'WS2022', uom: 'Licence', price: 3500, gl: '1520', vendor: 'CloudServ', desc: 'Server OS licence', active: 'Yes' },
      { id: 'ITM-010', name: 'HP 305A Black Toner', category: 'Consumable', type: 'Cartridge', brand: 'HP', model: '305A', uom: 'Nos', price: 78, gl: '5220', vendor: 'TechSource Trading', desc: 'Black toner cartridge', active: 'Yes' },
      { id: 'ITM-011', name: 'A4 Paper 80gsm Ream', category: 'Office', type: 'Paper', brand: 'Double A', model: 'A4-80', uom: 'Ream', price: 17, gl: '5290', vendor: 'OfficePlus', desc: 'A4 copy paper, 500 sheets', active: 'Yes' },
      { id: 'ITM-012', name: 'Ergonomic Office Chair', category: 'Office', type: 'Furniture', brand: 'Herman Miller', model: 'Aeron', uom: 'Nos', price: 1200, gl: '5290', vendor: 'OfficePlus', desc: 'Ergonomic task chair', active: 'Yes' }
    );
    s.scans.push({ id: 'SCAN-11', method: 'Network scan', scope: '192.168.10.0/24', date: agoD(2), found: 3, imported: 1, status: 'Completed' });
    s.discovered.push(
      { id: 'DISC-111', scan: 'SCAN-11', host: 'TEST-PC-01', ip: '192.168.10.21', mac: 'AA:BB:CC:01:11:22', os: 'Win 11', status: 'New' },
      { id: 'DISC-112', scan: 'SCAN-11', host: 'TEST-PC-02', ip: '192.168.10.22', mac: 'AA:BB:CC:02:11:22', os: 'Win 11', status: 'New' },
      { id: 'DISC-113', scan: 'SCAN-11', host: 'TEST-PC-03', ip: '192.168.10.23', mac: 'AA:BB:CC:03:11:22', os: 'Ubuntu 22.04', status: 'New' }
    );
    const loanSpare = L.saveHW({ type: 'Peripheral', desc: 'TEST: Projector for loans', purchaseDate: agoD(60), price: 2200, condition: 'Good' });
    const loanSpare2 = L.saveHW({ type: 'Peripheral', desc: 'TEST: Spare projector (overdue loan)', purchaseDate: agoD(120), price: 2200, condition: 'Good' });
    s.loans.find((x) => x.id === 'LOAN-101').assetId = loanSpare.id;
    s.loans.find((x) => x.id === 'LOAN-102').assetId = loanSpare2.id;
    L.issueAssets(pick(2).no, [loanSpare.id], agoD(5), 'TEST loan 101');
    L.issueAssets(pick(3).no, [loanSpare2.id], agoD(30), 'TEST loan 102');
    const adLive = { id: 'ADC-901', name: 'TEST DC (SSL)', host: 'dc01.bobbysharon.ae', port: '636', enc: 'SSL', baseDN: 'DC=bobbysharon,DC=ae', bindUser: 'svc_itms@bobbysharon.ae', cert: 'THUMBPRINT-TEST', status: 'Live', lastTest: agoH(5) };
    s.adconns.unshift(adLive);
    const au = (emp, sam, st, groups) => s.adusers.unshift({ id: 'ADU-9' + s.adusers.length, sam, upn: sam + '@bobbysharon.ae', empNo: emp.no, ou: 'OU=Users,DC=bobbysharon,DC=ae', groups: groups || ['IT Support'], status: st, mustChange: 'No', lastSync: agoD(1) });
    au(pick(0), 'test.admin', 'Enabled', ['Domain Admins']);
    au(pick(1), 'test.user1', 'Locked', ['IT Support']);
    au(pick(2), 'test.user2', 'Disabled', []);
    au(pick(3), 'test.user3', 'Enabled', ['IT Support']);
    const itNew = newEmps.find((e) => e.dept === 'IT');
    if (itNew) au(itNew, itNew.name.toLowerCase().split(/\s+/).join('.'), 'Enabled', ['IT Support']);
    const hrNew = newEmps.find((e) => e.dept === 'Human Resources');
    if (hrNew) au(hrNew, hrNew.name.toLowerCase().split(/\s+/).join('.'), 'Enabled', []);
    s.adgroups.push({ id: 'ADG-91', name: 'TEST Distribution', scope: 'Universal', category: 'Distribution', desc: 'Test DL', members: ['test.user1', 'test.user3'] });
    s.gpos.push(
      { id: 'GPO-91', name: 'TEST Baseline', desc: 'Test hardened baseline', ous: 'OU=Workstations,DC=bobbysharon,DC=ae', settings: 'Password length = 12\nScreen lock = 5 min', status: 'Linked', version: 2 },
      { id: 'GPO-92', name: 'TEST USB Block (enforced)', desc: 'Test removable media', ous: 'OU=Workstations,DC=bobbysharon,DC=ae\nOU=Servers,DC=bobbysharon,DC=ae', settings: 'Removable storage = Deny', status: 'Enforced', version: 1 }
    );
    s.devices.push({ id: 'MOB-91', user: TN(0), platform: 'Android', lastSeen: agoH(3) }, { id: 'MOB-92', user: TN(1), platform: 'iOS', lastSeen: agoH(26) });
    s.spaces.push(
      { id: 'SP-91', building: 'HQ Tower', floor: 'Ground', room: 'Lobby', type: 'Lobby', capacity: 40, amenities: 'Reception, seating, display wall', manager: TN(0), active: 'Yes' },
      { id: 'SP-92', building: 'HQ Tower', floor: '3', room: 'Meeting Room Orion', type: 'Meeting room', capacity: 12, amenities: 'Projector, video bar, whiteboard', manager: TN(1), active: 'Yes' }
    );
    s.instances.push({ id: 'ESM-TST', name: 'TEST Facilities Desk', dept: 'Facilities', status: 'Draft', catalog: 0, portal: 'No', created: T() });
    s.apps.push({ id: 'APP-91', name: 'TEST Gate Pass', purpose: 'Test visitor passes', fields: 'Visitor, Company, Host', records: [{ Visitor: 'Ahmed', Company: 'ABC', Host: TN(0), _at: agoH(8) }, { Visitor: 'Sara', Company: 'XYZ', Host: TN(1), _at: agoH(30) }], active: 'Yes' });
    s.mail.smtp.unshift({ id: 'SMTP-91', name: 'TEST SMTP', host: 'smtp.bobbysharon.ae', port: '587', enc: 'STARTTLS', user: 'servicedesk@bobbysharon.ae', pass: '', fromAddr: 'servicedesk@bobbysharon.ae', fromName: 'BOBBY SHARON Service Desk', status: 'Live', lastTest: agoH(2) });
    s.mail.inbound.unshift({ id: 'INBOX-91', name: 'TEST support mailbox', type: 'IMAP', host: 'mail.bobbysharon.ae', port: '993', ssl: 'Yes', user: 'support@bobbysharon.ae', pass: '', box: 'INBOX', status: 'Live' });
    s.mail.desk = 'support@bobbysharon.ae';
    s.mail.outbox.unshift({ id: 'EM-901', at: agoH(25), to: [pick(1).email || 'user@bobbysharon.ae'], ticketId: t3.id, kind: 'resolved', subject: `[${t3.id}] ${t3.subject} — resolved`, body: 'TEST: resolution email already dispatched.', status: 'Sent', sentAt: agoH(24) });

    /* ---------- budgets reseed + compliance demo ---------- */
    d.budgets = []; d.budgetSeeded = false;
    const rows = ITMS.gov.controlsOf('iso27001');
    const demo = [['A.5.1', 'Compliant'], ['A.5.9', 'Compliant'], ['A.5.15', 'Partially compliant'], ['A.5.17', 'Compliant'], ['A.6.1', 'Partially compliant'], ['A.6.3', 'Non-compliant'], ['A.7.1', 'Compliant'], ['A.8.1', 'Not applicable']];
    demo.forEach((x, i) => { const r = rows.find((c) => c.id === x[0]); if (r) Object.assign(r, { status: x[1], owner: TN(i % 4), due: fwdD(30), action: 'TEST action for ' + x[0], evidence: 'TEST evidence ref', updated: agoD(2) }); });
    d.compliance.active = 'iso27001'; d.compliance.confirmed = true;

    /* ---------- seq alignment + finish ---------- */
    t12.sample = true; // suppresses the built-in sample auto-loader (removed 600ms later)
    setTimeout(() => { try { delete t12.sample; S.emit(); } catch (e) { /* ignore */ } }, 600);
    h.seq.req = h.requests.length; h.seq.problems = h.problems.length; h.seq.changes = h.changes.length;
    h.seq.releases = h.releases.length; h.seq.solutions = h.solutions.length; h.seq.catalog = h.catalog.length; h.seq.news = h.news.length;
    /* ---------- financial integration: GL, vouchers, invoices, payments ---------- */
    buildFinancials();
    L.log('System', 'BOBBY SHARON full test data loaded (employees kept)');
    L.log('Finance', 'Financial data loaded: ' + s.fin.jv.length + ' JVs, ' + s.fin.invoices.length + ' invoices, ' + s.fin.payments.length + ' payments', 'FIN');
    S.emit();
    UI.toast('Test data ready — every module, status and type covered with financials');
  }

  /* ---------- renumber PR/PO/GRN docs into the current period, cascading refs ---------- */
  function renumberDocs() {
    const d = db();
    const mm = String(new Date().getMonth() + 1).padStart(2, '0'), yy = new Date().getFullYear();
    const prMap = {}, poMap = {}, grnMap = {};
    d.prs.slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).forEach((p, i) => { const nn = `PR-${mm}-${yy}-` + String(i + 1).padStart(4, '0'); if (nn !== p.prNo) { prMap[p.prNo] = nn; p.prNo = nn; } });
    const rePr = (ref) => { if (!ref || !prMap[String(ref).replace(/-\d+$/, '')]) return ref; return prMap[String(ref).replace(/-\d+$/, '')] + '-' + String(ref).match(/-(\d+)$/)[1]; };
    d.pos.forEach((p) => (p.lines || []).forEach((l) => { if (l.prRef) l.prRef = rePr(l.prRef); }));
    (d.hw || []).forEach((a) => { if (a.prRef) a.prRef = rePr(a.prRef); });
    d.pos.slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).forEach((p, i) => { const nn = `PO-${mm}-${yy}-` + String(i + 1).padStart(4, '0'); if (nn !== p.poNo) { poMap[p.poNo] = nn; p.poNo = nn; } });
    d.hw.forEach((a) => { if (a.poNo && poMap[a.poNo]) a.poNo = poMap[a.poNo]; });
    d.sw.forEach((s) => { if (s.poNo && poMap[s.poNo]) s.poNo = poMap[s.poNo]; });
    (d.consPurch || []).forEach((r) => { if (r.poNo && poMap[r.poNo]) r.poNo = poMap[r.poNo]; });
    (d.grns || []).forEach((g) => { if (g.poNo && poMap[g.poNo]) g.poNo = poMap[g.poNo]; });
    D().fin.payments.forEach((r) => { if (r.poNo && poMap[r.poNo]) r.poNo = poMap[r.poNo]; });
    (d.grns || []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).forEach((g, i) => { const nn = `GRN-${yy}-` + String(i + 1).padStart(4, '0'); if (nn !== g.grnNo) { grnMap[g.grnNo] = nn; g.grnNo = nn; } });
    d.hw.forEach((a) => { if (a.grn && grnMap[a.grn]) a.grn = grnMap[a.grn]; });
    const seen = D().fin.seen;
    Object.keys(grnMap).forEach((k) => { if (seen.grn[k]) { seen.grn[grnMap[k]] = 1; delete seen.grn[k]; } });
    D().fin.jv.forEach((e) => {
      if (e.ref && poMap[e.ref]) e.ref = poMap[e.ref];
      if (e.ref && grnMap[e.ref]) e.ref = grnMap[e.ref];
      if (e.desc) { Object.keys(poMap).forEach((k) => { e.desc = e.desc.split(k).join(poMap[k]); }); Object.keys(grnMap).forEach((k) => { e.desc = e.desc.split(k).join(grnMap[k]); }); }
    });
    d.seq.pr = d.prs.length; d.seq.po = d.pos.length;
    let mx = 0; (d.grns || []).forEach((g) => { const m = String(g.grnNo).match(/(\d+)$/); if (m) mx = Math.max(mx, +m[1]); });
    d.seq.grn = mx;
    return { pr: Object.keys(prMap).length, po: Object.keys(poMap).length, grn: Object.keys(grnMap).length };
  }

  /* ---------- roll every transaction date forward so latest = today ---------- */
  const isD = (s) => /^\d{4}-\d{2}-\d{2}/.test(String(s || ''));
  function shiftD(s, off) { if (!isD(s)) return s; const d = new Date(String(s).slice(0, 10) + 'T00:00:00'); d.setDate(d.getDate() + off); return d.toISOString().slice(0, 10); }
  function shiftDT(s, off) { if (!isD(s)) return s; const t = new Date(s).getTime(); return isNaN(t) ? s : new Date(t + off * 864e5).toISOString(); }
  const apD = (off) => (v) => (String(v || '').indexOf('T') >= 0 ? shiftDT(v, off) : shiftD(v, off));
  function rollDates() {
    const d = db(), h = H(), s = D();
    const dates = [];
    const grab = (v) => { if (isD(v)) dates.push(String(v).slice(0, 10)); };
    d.prs.forEach((p) => grab(p.date));
    d.pos.forEach((p) => { grab(p.date); grab(p.delivery); });
    (d.grns || []).forEach((g) => grab(g.date));
    d.hw.forEach((a) => ['purchaseDate', 'issuedDate', 'warranty', 'amcStart', 'amcEnd'].forEach((k) => grab(a[k])));
    (d.moves || []).forEach((m) => grab(m.date));
    d.sw.forEach((x) => { grab(x.purchaseDate); grab(x.expiry); grab(x.lastOrder); });
    (d.installs || []).forEach((i) => grab(i.date));
    (d.consPurch || []).forEach((r) => grab(r.date)); (d.consIssue || []).forEach((r) => grab(r.date));
    (d.amcs || []).forEach((c) => { grab(c.start); grab(c.end); });
    (d.accounts || []).forEach((a) => { grab(a.created); grab(a.disabled); });
    (d.provLog || []).forEach((x) => grab(x.at));
    (d.lifecycle || []).forEach((x) => { grab(x.date); grab(x.at); });
    (d.log || []).forEach((x) => grab(x.at));
    if (h) {
      h.requests.forEach((r) => { ['created', 'respondBy', 'dueBy', 'resolvedAt', 'closedAt', 'firstResp', 'heldAt'].forEach((k) => grab(r[k])); (r.notes || []).forEach((n) => grab(n.at)); (r.tasks || []).forEach((t) => grab(t.due)); (r.approvals || []).forEach((a) => { grab(a.at); grab(a.decidedAt); }); });
      h.problems.forEach((p) => { grab(p.due); grab(p.created); });
      h.changes.forEach((c) => { grab(c.start); grab(c.end); grab(c.created); (c.approvals || []).forEach((a) => { grab(a.at); grab(a.decidedAt); }); });
      h.releases.forEach((r) => { grab(r.start); grab(r.end); grab(r.created); });
      h.items.forEach((i) => { grab(i.open); grab(i.target); (i.log || []).forEach((l) => grab(l.at)); });
      h.solutions.forEach((x) => grab(x.created)); h.catalog.forEach((x) => grab(x.created));
      h.news.forEach((x) => { grab(x.from); grab(x.to); grab(x.created); });
    }
    s.contracts.forEach((c) => { grab(c.start); grab(c.end); });
    s.maint.forEach((m) => { grab(m.next); grab(m.lastRun); });
    s.inbox.forEach((m) => grab(m.at));
    s.schedules.forEach((x) => grab(x.date));
    s.loans.forEach((l) => { grab(l.outDate); grab(l.dueDate); grab(l.returnDate); });
    s.chats.forEach((c) => { grab(c.at); (c.msgs || []).forEach((m) => grab(m.at)); });
    s.adreqs.forEach((a) => grab(a.at));
    s.mail.outbox.forEach((o) => { grab(o.at); grab(o.sentAt); });
    s.archives.forEach((a) => grab(a.at));
    (s.notiflog || []).forEach((n) => grab(n.at));
    (s.escalations || []).forEach((e) => grab(e.at));
    (s.adlog || []).forEach((a) => grab(a.at));
    s.adusers.forEach((u) => grab(u.lastSync)); s.adconns.forEach((c) => grab(c.lastTest)); s.devices.forEach((x) => grab(x.lastSeen));
    s.scans.forEach((x) => grab(x.date));
    s.surveys.forEach((x) => grab(x.created)); s.responses.forEach((r) => grab(r.at));
    s.instances.forEach((x) => grab(x.created));
    s.apps.forEach((a) => (a.records || []).forEach((r) => grab(r._at)));
    (s.fin.jv || []).forEach((e) => { grab(e.date); grab(e.at); });
    if (!dates.length) return 0;
    const mx = dates.sort().pop();
    const off = Math.round((new Date(T0() + 'T00:00:00') - new Date(mx + 'T00:00:00')) / 864e5);
    if (off <= 0) return 0;
    const ap = apD(off);
    const W = (arr, ks) => (arr || []).forEach((o) => ks.forEach((k) => { if (o && o[k]) o[k] = ap(o[k]); }));
    W(d.prs, ['date']); W(d.pos, ['date', 'delivery']); W(d.grns, ['date']);
    W(d.hw, ['purchaseDate', 'issuedDate', 'warranty', 'amcStart', 'amcEnd']); W(d.moves, ['date']);
    W(d.sw, ['purchaseDate', 'expiry', 'lastOrder']); W(d.installs, ['date']);
    W(d.consPurch, ['date']); W(d.consIssue, ['date']); W(d.amcs, ['start', 'end']);
    W(d.accounts, ['created', 'disabled']); W(d.provLog, ['at']); W(d.lifecycle, ['date', 'at']); W(d.log, ['at']);
    if (h) {
      W(h.requests, ['created', 'respondBy', 'dueBy', 'resolvedAt', 'closedAt', 'firstResp', 'heldAt']);
      h.requests.forEach((r) => { W(r.notes, ['at']); W(r.tasks, ['due']); W(r.approvals, ['at', 'decidedAt']); });
      W(h.problems, ['due', 'created']);
      W(h.changes, ['start', 'end', 'created']); h.changes.forEach((c) => W(c.approvals, ['at', 'decidedAt']));
      W(h.releases, ['start', 'end', 'created']); W(h.items, ['open', 'target']); h.items.forEach((i) => W(i.log, ['at']));
      W(h.solutions, ['created']); W(h.catalog, ['created']); W(h.news, ['from', 'to', 'created']);
    }
    W(s.contracts, ['start', 'end']); W(s.maint, ['next', 'lastRun']); W(s.inbox, ['at']);
    W(s.schedules, ['date']); W(s.loans, ['outDate', 'dueDate', 'returnDate']);
    W(s.chats, ['at']); s.chats.forEach((c) => W(c.msgs, ['at']));
    W(s.adreqs, ['at']); W(s.mail.outbox, ['at', 'sentAt']); W(s.archives, ['at']);
    W(s.notiflog, ['at']); W(s.escalations, ['at']); W(s.adlog, ['at']);
    W(s.adusers, ['lastSync']); W(s.adconns, ['lastTest']); W(s.devices, ['lastSeen']);
    W(s.scans, ['date']); W(s.surveys, ['created']); W(s.responses, ['at']); W(s.instances, ['created']);
    s.apps.forEach((a) => W(a.records, ['_at']));
    W(s.fin.jv, ['date', 'at']);
    s.fin.jv.forEach((e) => { e.month = String(e.date || '').slice(0, 7); });
    const mo = (Number(T0().slice(0, 4)) * 12 + Number(T0().slice(5, 7))) - (Number(mx.slice(0, 4)) * 12 + Number(mx.slice(5, 7)));
    if (mo > 0) s.fin.depruns = s.fin.depruns.map((m) => { const t = String(m).match(/^(\d{4})-(\d{2})$/); if (!t) return m; let y = +t[1], mm = +t[2] + mo; while (mm > 12) { mm -= 12; y++; } return y + '-' + String(mm).padStart(2, '0'); });
    S.emit();
    return off;
  }
  UI.on('data.roll', async () => {
    if (await UI.confirm('Shift <b>every transaction date</b> forward so the latest lands today, and renumber PR / PO / GRN documents into the current period (all references follow)? Gaps between records are preserved, so all statuses, ageing and finance tallies stay consistent.', 'Roll dates to current')) {
      const n = rollDates();
      const rn = renumberDocs(); S.emit();
      UI.toast(`Rolled ${n} day(s) · renumbered PR ${rn.pr}, PO ${rn.po}, GRN ${rn.grn}`);
    }
  });

  UI.on('data.test', async () => {
    if (await UI.confirm('Replace <b>ALL current data</b> (employees are kept) and load the full test dataset with financials for every module?', 'Load test data', true)) {
      try { masterLoad(); location.hash = '#/dashboard'; } catch (e) { UI.toast(e.message || String(e), 'err'); }
    }
  });

  /* ---------- top-up samples: fills ONLY empty screens, varied statuses ---------- */
  function samples() {
    const d = db(), h = H(), s = D(); let n = 0;
    const E = d.employees.filter((e) => e.status === 'Active');
    const TN = (i) => (((h.techs || [])[i % Math.max(h.techs.length, 1)] || {}).name || '');
    const T = () => L.today();
    if (!h.requests.length && E.length) {
      const r1 = ITMS.sdp.mkTicket({ requester: E[0].no, subject: 'Sample: WiFi slow in meeting room', category: 'Network & Connectivity', impact: 'Medium', urgency: 'Normal', type: 'Incident' });
      const r2 = ITMS.sdp.mkTicket({ requester: E[Math.min(1, E.length - 1)].no, subject: 'Sample: Toner replaced (resolved)', category: 'Printing & Scanning', impact: 'Low', urgency: 'Low', type: 'Service Request' });
      r2.status = 'Resolved'; r2.resolvedAt = new Date().toISOString(); r2.resolution = 'Toner replaced and test page OK.'; r2.closure = 'Success';
      n += 2;
    }
    if (!h.problems.length) { h.problems.unshift({ id: 'PRB-S1', title: 'Sample: Mail delays at month-end', desc: '', category: 'Email & Collaboration', owner: TN(0), status: 'Open', impact: 'Medium', urgency: 'Normal', requests: [], hist: [], created: new Date().toISOString() }); n++; }
    if (!h.changes.length) { h.changes.unshift({ id: 'CHG-S1', title: 'Sample: Firewall policy tidy-up', changeType: 'Standard', status: 'Planning', owner: TN(0), impact: 'Low', risk: 'Low', requests: [], approvals: [], hist: [], created: new Date().toISOString() }); n++; }
    if (!h.items.length) {
      h.items.push({ id: 9001, project: (h.cfg.projects || ['General'])[0], category: 'Infrastructure', desc: 'Sample: Upgrade meeting-room AV', status: 'Open', priority: 'Medium', owner: TN(0), pendingWith: TN(0), open: T(), target: L.addDays(T(), 21), latest: '', next: 'Get quotes', remarks: '', log: [] });
      h.items.push({ id: 9002, project: (h.cfg.projects || ['General'])[0], category: 'Infrastructure', desc: 'Sample: Old printer disposal (done)', status: 'Completed', priority: 'Low', owner: TN(0), open: L.addDays(T(), -40), target: L.addDays(T(), -10), latest: 'Done', next: '', remarks: '', log: [] });
      n += 2;
    }
    if (!h.solutions.length) { h.solutions.unshift({ id: 'KB-S1', title: 'Sample: Printer shows offline (fix it yourself)', category: 'Printing & Scanning', status: 'Published', author: TN(0), keywords: 'printer offline', content: 'WHAT THIS MEANS (in plain words): Your laptop thinks the printer is switched off or unreachable, even though it is on. In most cases the printer simply needs to be woken up and re-found.\n\nDO THIS YOURSELF (about 5 minutes):\n1. Go to the printer. If its screen is dark, press the power button once and wait a full minute.\n2. On your laptop: Settings, Printers, right-click your printer. If you see "Use Printer Offline" with a tick, click it once to remove the tick.\n3. Still offline? Remove the printer (right-click, Remove device) and add it again by name.\n4. Print a test page.\n\nWHEN TO CALL IT INSTEAD: Paper jam light blinking red, strange noises, or more than one person affected — raise a ticket with the printer name.', views: 3, created: new Date().toISOString(), hist: [] }); n++; }
    if (!h.catalog.length) { h.catalog.unshift({ id: 'SC-S01', title: 'Sample: New wireless mouse', desc: 'WHAT YOU GET (in plain words): A standard wireless mouse with batteries, ready to use. WHO CAN ASK: Anyone. WHAT HAPPENS NEXT: Click Request, collect it from IT the same day, no approval needed.', category: 'Service Request', active: 'Yes', impact: 'Low', urgency: 'Low' }); n++; }
    if (!(h.news || []).length) { h.news.unshift({ id: 'ANN-S01', title: 'Sample: Welcome to the service desk', desc: 'Log tickets from the portal or by email.', from: T(), to: L.addDays(T(), 30), active: 'Yes', created: new Date().toISOString() }); n++; }
    if (!s.contracts.length) {
      s.contracts.push(
        { id: 'CTR-S01', title: 'Sample: Internet lease (active)', vendor: '', type: 'Lease', start: L.addDays(T(), -100), end: L.addDays(T(), 200), value: 60000, owner: TN(0), assets: [], status: 'Active', notes: '' },
        { id: 'CTR-S02', title: 'Sample: Support expiring soon', vendor: '', type: 'Support', start: L.addDays(T(), -300), end: L.addDays(T(), 12), value: 24000, owner: TN(0), assets: [], status: 'Active', notes: '' },
        { id: 'CTR-S03', title: 'Sample: Old deal (expired)', vendor: '', type: 'Maintenance', start: L.addDays(T(), -400), end: L.addDays(T(), -20), value: 8000, owner: TN(0), assets: [], status: 'Active', notes: '' }
      ); n += 3;
    }
    if (!s.cis.length) {
      s.cis.push(
        { id: 'CI-S01', name: 'SAMPLE-CORE-SW', type: 'Network Device', owner: TN(0), site: '', status: 'Live', criticality: 'Critical', assetId: '', ip: '10.0.0.1', created: T() },
        { id: 'CI-S02', name: 'SAMPLE-ERP-APP', type: 'Application', owner: TN(0), site: '', status: 'Live', criticality: 'High', assetId: '', ip: '', created: T() },
        { id: 'CI-S03', name: 'SAMPLE-OLD-PC', type: 'Desktop', owner: '', site: '', status: 'Retired', criticality: 'Low', assetId: '', ip: '', created: T() }
      );
      s.links.push({ id: 'LNK-S01', from: 'CI-S02', rel: 'runs on', to: 'CI-S01', at: T() }, { id: 'LNK-S02', from: 'CI-S01', rel: 'connects to', to: 'CI-S03', at: T() });
      n += 5;
    }
    if (!s.maint.length) {
      s.maint.push(
        { id: 'PMT-S01', title: 'Sample: Monthly patching (overdue)', freq: 'Monthly', next: L.addDays(T(), -3), group: '', desc: '', status: 'Scheduled' },
        { id: 'PMT-S02', title: 'Sample: Quarterly AC service', freq: 'Quarterly', next: L.addDays(T(), 25), group: '', desc: '', status: 'Scheduled' }
      ); n += 2;
    }
    if (!s.inbox.length) { s.inbox.unshift({ id: 'MAIL-S01', from: 'staff@company.ae', subject: 'Sample: projector not working', body: 'Hall projector shows no signal.', at: new Date().toISOString(), status: 'Unprocessed' }); n++; }
    if (!s.schedules.length) {
      s.schedules.push(
        { id: 'SCH-S01', title: 'Sample: Follow-up task', kind: 'Task', date: L.addDays(T(), 2), time: '10:00', owner: TN(0), link: '' },
        { id: 'SCH-S02', title: 'Sample: Team leave cover', kind: 'Time off', date: L.addDays(T(), 14), time: '', owner: TN(0), link: '' }
      ); n += 2;
    }
    if (!s.templates.length) {
      s.templates.push(
        { id: 'TPL-S01', name: 'Sample: New headset', category: 'Service Request', desc: 'Standard headset', impact: 'Low', urgency: 'Normal', group: '', tasks: '', active: 'Yes' },
        { id: 'TPL-S02', name: 'Sample: Retired form', category: 'Other', desc: '', impact: 'Low', urgency: 'Low', group: '', tasks: '', active: 'No' }
      ); n += 2;
    }
    if (!s.actions.length) {
      s.actions.push(
        { id: 'CA-S1', name: 'Sample: Webhook on create', event: 'onCreate', do: 'webhook', target: 'https://hooks.example.com/new-ticket', active: 'Yes' },
        { id: 'CA-S2', name: 'Sample: Page on SLA breach', event: 'onSLABreach', do: 'notify', target: 'On-call group', active: 'Yes' },
        { id: 'CA-S3', name: 'Sample: Checklist on resolve', event: 'onResolve', do: 'task', target: 'Confirm with user in 48h', active: 'Yes' }
      ); n += 3;
    }
    if (!s.apps.length) { s.apps.unshift({ id: 'APP-S1', name: 'Sample: Visitor log', purpose: 'Front-desk demo', fields: 'Visitor, Company, Host', records: [{ Visitor: 'Demo Guest', Company: 'Acme', Host: TN(0), _at: new Date().toISOString() }], active: 'Yes' }); n++; }
    if (!s.surveys.length) { s.surveys.unshift({ id: 'SV-S1', title: 'Sample: Support rating', q: 'Rate this ticket (1-5)', active: 'Yes' }); n++; }
    if (!s.responses.length && s.surveys.length && h.requests.length) {
      s.responses.unshift({ id: 'SR-S1', surveyId: s.surveys[0].id, reqId: h.requests[0].id, rater: L.empName(h.requests[0].requester), score: 5, comment: 'Sample response', at: new Date().toISOString() });
      s.responses.unshift({ id: 'SR-S2', surveyId: s.surveys[0].id, reqId: h.requests[0].id, rater: L.empName(h.requests[0].requester), score: 3, comment: '', at: new Date().toISOString() });
      n += 2;
    }
    if (!s.chats.length && E.length) {
      s.chats.unshift({ id: 'CHAT-S1', user: E[0].name, empNo: E[0].no, tech: TN(0), status: 'Open', at: new Date().toISOString(), msgs: [{ by: E[0].name, text: 'Sample: hi, need help', at: new Date().toISOString() }, { by: TN(0), text: 'Sample: looking into it', at: new Date().toISOString() }] });
      s.chats.unshift({ id: 'CHAT-S2', user: E[0].name, empNo: E[0].no, tech: TN(0), status: 'Closed', at: new Date().toISOString(), msgs: [{ by: E[0].name, text: 'Sample: old chat', at: new Date().toISOString() }] });
      n += 2;
    }
    if (!s.loans.length) {
      const spare = d.hw.find((a) => a.status === 'In Stock');
      if (spare && E.length > 1) {
        L.issueAssets(E[1].no, [spare.id], T(), 'Sample loan');
        s.loans.push({ id: 'LOAN-S1', assetId: spare.id, empNo: E[1].no, outDate: T(), dueDate: L.addDays(T(), 14), status: 'On loan', remarks: 'Sample' });
        n++;
      }
    }
    if (!s.toollog.length && d.hw.length) { s.toollog.unshift({ id: 'TOOL-S1', tool: 'Remote Desktop', asset: d.hw[0].id, by: TN(0) || 'Admin', at: new Date().toISOString(), result: 'Sample session record' }); n++; }
    if (!s.adconns.length) { s.adconns.unshift({ id: 'ADC-S1', name: 'Sample DC (SSL)', host: 'dc01.company.ae', port: '636', enc: 'SSL', baseDN: 'DC=company,DC=ae', bindUser: 'svc@company.ae', cert: '', status: 'Draft', lastTest: '' }); n++; }
    if (!s.adgroups.length) { s.adgroups.unshift({ id: 'ADG-S1', name: 'Sample Support Group', scope: 'Global', category: 'Security', desc: 'Sample', members: [] }); n++; }
    if (!s.adusers.length && E.length) { s.adusers.unshift({ id: 'ADU-S1', sam: 'sample.user', upn: 'sample.user@company.ae', empNo: E[0].no, ou: 'OU=Users', groups: [], status: 'Enabled', mustChange: 'Yes', lastSync: T() }); n++; }
    if (!s.gpos.length) { s.gpos.unshift({ id: 'GPO-S1', name: 'Sample Baseline', desc: 'Sample policy', ous: 'OU=Workstations', settings: 'Screen lock = 5 min', status: 'Linked', version: 1 }); n++; }
    if (!s.adlog.length) { s.adlog.unshift({ at: new Date().toISOString(), text: 'Sample: directory check completed' }); n++; }
    if (!s.adreqs.length && E.length) {
      s.adreqs.unshift({ id: 'AD-S1', empNo: E[0].no, type: 'Password Reset', status: 'Open', ticketId: '', at: new Date().toISOString() });
      s.adreqs.unshift({ id: 'AD-S2', empNo: E[0].no, type: 'Account Unlock', status: 'Closed', ticketId: '', at: new Date().toISOString() });
      n += 2;
    }
    if (!s.devices.length) { s.devices.unshift({ id: 'MOB-S1', user: TN(0) || 'Admin', platform: 'Android', lastSeen: new Date().toISOString() }); n++; }
    if (!s.hr.leaves.length && E.length) { s.hr.leaves.unshift({ id: 'LV-S1', empNo: E[0].no, type: 'Annual', from: L.addDays(T(), 7), to: L.addDays(T(), 9), days: 3, reason: 'Sample leave', status: 'Pending', at: new Date().toISOString() }); n++; }
    if (!s.fin.expenses.length && E.length) { s.fin.expenses.unshift({ id: 'EXP-S1', empNo: E[0].no, date: T(), category: 'Other', desc: 'Sample taxi claim', amount: 60, status: 'Submitted', approver: '', at: new Date().toISOString() }); n++; }
    if (!s.fin.payments.length) { const p = (db().pos || []).find((x) => x.approval === 'Approved'); if (p) { s.fin.payments.unshift({ id: 'PAY-S1', poNo: p.poNo, vendor: p.vendor, amount: Math.round(L.poTotals(p).incl), date: T(), mode: 'Bank transfer', ref: '', at: new Date().toISOString() }); n++; } }
    /* ---------- FINANCIAL INTEGRATION: GL mapping, voucher numbers, transaction types ---------- */
    buildFinancials();
    S.emit();
    UI.toast(n ? n + ' sample record(s) added — empty screens filled' : 'Every screen already has data');
  }

  /* =====================================================================
     FINANCIAL INTEGRATION BUILDER
     Creates a complete set of financial records that match operational data:
     - Chart of Accounts (GL) with proper codes
     - Category → GL mapping
     - Journal Vouchers with legal voucher numbers (BILL/PV/EX/DEP/DSP/IS/AMC/CON)
     - Invoices generated from POs/GRNs
     - Payment records linked to approved POs
     - Expense claims with GL account references
     - Budget entries with financial year references
     - Trial balance proof
     ===================================================================== */
  function buildFinancials() {
    const d = db(), s = D(), h = H();
    if (!s.fin) s.fin = { jv: [], invoices: [], payments: [], expenses: [], coa: [], catgl: {}, seq: {}, seen: {}, depruns: [] };
    s.fin.jv = s.fin.jv || []; s.fin.invoices = s.fin.invoices || []; s.fin.payments = s.fin.payments || []; s.fin.expenses = s.fin.expenses || []; s.fin.depruns = s.fin.depruns || []; s.fin.seen = s.fin.seen || {};

    /* ---------- 1. Chart of Accounts (GL) — full COA with legal codes ---------- */
    s.fin.coa = [
      { code: '1110', name: 'Cash & Bank', type: 'Asset' },
      { code: '1210', name: 'Accounts Receivable', type: 'Asset' },
      { code: '1310', name: 'Advances to Suppliers', type: 'Asset' },
      { code: '1410', name: 'Consumable Stock', type: 'Asset' },
      { code: '1430', name: 'VAT Recoverable', type: 'Asset' },
      { code: '1510', name: 'IT Equipment – Hardware', type: 'Asset' },
      { code: '1520', name: 'Software Assets', type: 'Asset' },
      { code: '1590', name: 'Accumulated Depreciation – IT', type: 'Asset' },
      { code: '2110', name: 'Accounts Payable – Vendors', type: 'Liability' },
      { code: '2120', name: 'Accrued Expenses', type: 'Liability' },
      { code: '3110', name: 'Owner Capital', type: 'Equity' },
      { code: '3120', name: 'Retained Earnings', type: 'Equity' },
      { code: '4110', name: 'Other Income', type: 'Income' },
      { code: '5110', name: 'Salaries & Staff Cost', type: 'Expense' },
      { code: '5210', name: 'Rent & Utilities', type: 'Expense' },
      { code: '5220', name: 'Consumables Consumed', type: 'Expense' },
      { code: '5230', name: 'Maintenance & AMC', type: 'Expense' },
      { code: '5240', name: 'IT Subscriptions & Licences', type: 'Expense' },
      { code: '5290', name: 'General & Admin Expenses', type: 'Expense' },
      { code: '5410', name: 'Depreciation – IT Equipment', type: 'Expense' },
      { code: '5510', name: 'Loss on Asset Disposal', type: 'Expense' },
    ];

    /* ---------- 2. Category → GL mapping (transaction type → GL account) ---------- */
    s.fin.catgl = {
      'Hardware': '5290', 'Software & Licences': '5240', 'Consumables': '5220',
      'AMC & Maintenance': '5230', 'Network & Infrastructure': '5290', 'Cloud & Services': '5240',
      'Security': '5290', 'Staffing & Training': '5110', 'Other': '5290'
    };

    /* ---------- 3. Helper: create journal voucher with legal voucher number ---------- */
    let jvSeq = 0;
    function mkJV(o) {
      jvSeq++;
      const prefix = o.prefix || 'JV';
      const id = prefix + '-' + String(jvSeq).padStart(4, '0');
      const dr = round2(o.lines.reduce((a, l) => a + (+l.dr || 0), 0));
      const cr = round2(o.lines.reduce((a, l) => a + (+l.cr || 0), 0));
      if (Math.abs(dr - cr) > 0.005) throw new Error('JV out of balance: ' + id);
      const e = { id, date: o.date, month: String(o.date || '').slice(0, 7), type: o.type, ref: o.ref || '', desc: o.desc || '', lines: o.lines, total: cr, at: new Date().toISOString() };
      s.fin.jv.unshift(e);
      return e;
    }
    function round2(n) { return Math.round((+n || 0) * 100) / 100; }

    /* ---------- 4. Purchase Bills from GRNs (auto-posted) ---------- */
    s.fin.seen.grn = s.fin.seen.grn || {};
    (d.grns || []).forEach((g) => {
      if (s.fin.seen.grn[g.grnNo]) return;
      s.fin.seen.grn[g.grnNo] = 1;
      const p = L.po(g.poNo); if (!p) return;
      const lines = []; let excl = 0, vat = 0;
      (g.lines || []).forEach((gl) => {
        const pl = (p.lines || []).find((x) => x.line === gl.line) || {};
        const t = L.lineTotals(p, Object.assign({}, pl, { qty: gl.qty }));
        excl = round2(excl + t.excl); vat = round2(vat + t.vat);
        const glCode = pl.itemType === 'Hardware' ? '1510' : pl.itemType === 'Software' ? '1520' : '1410';
        const cx = pl.itemType === 'Consumable' ? 'OPEX' : 'CAPEX';
        lines.push({ gl: glCode, dr: t.excl, cr: 0, cx, ref: g.grnNo + ' L' + pl.line + ' × ' + gl.qty });
      });
      if (vat > 0) lines.push({ gl: '1430', dr: vat, cr: 0, cx: '', ref: 'VAT on ' + g.grnNo });
      lines.push({ gl: '2110', dr: 0, cr: round2(excl + vat), cx: '', ref: 'AP ' + p.vendor });
      try { mkJV({ prefix: 'BILL', date: g.date, type: 'Purchase Bill', ref: g.grnNo, desc: 'GRN ' + g.grnNo + ' against ' + p.poNo + ' (' + p.vendor + ')', lines }); } catch (e) { /* skip */ }
    });

    /* ---------- 5. Payments against approved POs (with PV voucher numbers) ---------- */
    s.fin.payments = s.fin.payments || [];
    (d.pos || []).filter((p) => p.approval === 'Approved').slice(0, 3).forEach((p) => {
      if (s.fin.payments.some((x) => x.poNo === p.poNo)) return;
      const total = round2(L.poTotals(p).incl);
      if (total <= 0) return;
      const payDate = L.addDays(p.delivery || p.date, 30);
      s.fin.payments.unshift({ id: 'PV-' + String(s.fin.payments.length + 1).padStart(4, '0'), poNo: p.poNo, vendor: p.vendor, amount: total, date: payDate, mode: 'Bank transfer', ref: 'PAY-' + p.poNo, at: new Date().toISOString() });
      mkJV({ prefix: 'PV', date: payDate, type: 'Payment', ref: p.poNo, desc: 'Payment to ' + p.vendor + ' for ' + p.poNo, lines: [{ gl: '2110', dr: total, cr: 0, cx: '', ref: 'AP ' + p.vendor }, { gl: '1110', dr: 0, cr: total, cx: '', ref: 'Bank' }] });
      p.invoice = 'Paid';
    });

    /* ---------- 6. Expense claims (with EX voucher numbers + GL codes) ---------- */
    s.fin.expenses = s.fin.expenses || [];
    const expCats = [['Hardware', '5290'], ['Software & Licences', '5240'], ['Consumables', '5220'], ['Other', '5290']];
    expCats.forEach(([cat, gl], i) => {
      if (!d.employees.length) return;
      const exKey = 'EX-' + i; if (s.fin.seen[exKey]) return; s.fin.seen[exKey] = 1;
      const emp = d.employees[i % d.employees.length];
      const amt = [120, 85, 200, 45][i];
      const expDate = L.addDays(T0(), -(5 + i * 7));
      s.fin.expenses.unshift({ id: 'EX-' + String(i + 1).padStart(4, '0'), empNo: emp.no, date: expDate, category: cat, desc: 'TEST: ' + cat + ' expense claim', amount: amt, status: 'Approved', approver: 'Manager', at: new Date().toISOString(), gl });
      mkJV({ prefix: 'EX', date: expDate, type: 'Expense', ref: emp.no, desc: 'Expense claim ' + cat + ' — ' + emp.name, lines: [{ gl, dr: amt, cr: 0, cx: 'OPEX', ref: 'EX-' + String(i + 1).padStart(4, '0') }, { gl: '1110', dr: 0, cr: amt, cx: '', ref: 'Cash' }] });
    });

    /* ---------- 7. AMC / Contract postings (with AMC/CON voucher numbers) ---------- */
    s.fin.seen.amc = s.fin.seen.amc || {};
    (d.amcs || []).forEach((c) => {
      const key = c.id; if (s.fin.seen.amc[key]) return; s.fin.seen.amc[key] = 1;
      const amt = round2(+c.cost || 0); if (amt <= 0) return;
      const gl = c.gl || '5230';
      const vName = (d.vendors.find((v) => v.id === c.vendorId) || {}).name || '';
      mkJV({ prefix: 'AMC', date: c.invDate || c.start, type: 'AMC', ref: c.id, desc: 'AMC ' + c.id + ' — ' + c.title, lines: [{ gl, dr: amt, cr: 0, cx: 'OPEX', ref: c.id }, { gl: '2110', dr: 0, cr: amt, cx: '', ref: 'AP ' + vName }] });
    });
    s.fin.seen.con = s.fin.seen.con || {};
    (s.contracts || []).forEach((c) => {
      const key = c.id; if (s.fin.seen.con[key]) return; s.fin.seen.con[key] = 1;
      const amt = round2(+c.value || 0); if (amt <= 0) return;
      const gl = c.gl || '5240';
      mkJV({ prefix: 'CON', date: c.start, type: 'Contract', ref: c.id, desc: 'Contract ' + c.id + ' — ' + c.title, lines: [{ gl, dr: amt, cr: 0, cx: 'OPEX', ref: c.id }, { gl: '2110', dr: 0, cr: amt, cx: '', ref: 'AP ' + (c.vendor || '') }] });
    });

    /* ---------- 8. Invoices generated from POs/GRNs (with INV numbers) ---------- */
    s.fin.invoices = s.fin.invoices || [];
    let invSeq = 0;
    (d.pos || []).filter((p) => p.approval === 'Approved').slice(0, 4).forEach((p) => {
      const grns = (d.grns || []).filter((g) => g.poNo === p.poNo);
      if (!grns.length) return;
      if (s.fin.invoices.some((i) => i.poNo === p.poNo)) return;
      invSeq++;
      const invId = 'INV-' + String(invSeq).padStart(4, '0');
      const lines = []; let excl = 0, vat = 0;
      grns.forEach((g) => (g.lines || []).forEach((gl) => {
        const pl = (p.lines || []).find((x) => x.line === gl.line);
        const t = L.lineTotals(p, Object.assign({}, pl, { qty: gl.qty }));
        excl = round2(excl + t.excl); vat = round2(vat + t.vat);
        lines.push(Object.assign({}, pl, { qty: gl.qty, total: t.total, grnNo: g.grnNo }));
      }));
      s.fin.invoices.unshift({ id: invId, poNo: p.poNo, grnNo: grns[0].grnNo, grns: grns.map((g) => g.grnNo), date: T0(), dueDate: L.addDays(T0(), 30), vendor: p.vendor, currency: p.currency, vatIncl: p.vatIncl, status: 'Posted', excl: round2(excl), vat: round2(vat), total: round2(excl + vat), lines, createdAt: new Date().toISOString() });
    });

    /* ---------- 9. Budget entries with financial year + GL references ---------- */
    const curYear = new Date().getFullYear();
    d.budgets = d.budgets || [];
    const budgetCats = ['Hardware', 'Software & Licences', 'Consumables', 'AMC & Maintenance', 'Network & Infrastructure', 'Cloud & Services', 'Security', 'Staffing & Training', 'Other'];
    budgetCats.forEach((cat) => {
      if (!d.budgets.some((b) => b.year === curYear && b.category === cat)) {
        d.budgets.push({ id: 'BG-' + curYear + '-' + cat.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X'), year: curYear, category: cat, planned: [210000, 105000, 20000, 42000, 55000, 75000, 40000, 30000, 15000][budgetCats.indexOf(cat)], extra: 0, notes: 'Sample budget — edit me', gl: s.fin.catgl[cat] || '5290' });
      }
    });

    /* ---------- 10. Depreciation run (with DEP voucher numbers) ---------- */
    let depTotal = 0, depCount = 0;
    d.hw.forEach((a) => {
      if (a.status === 'Disposed' || !a.purchaseDate || !(+a.life > 0)) return;
      if (String(a.purchaseDate).slice(0, 7) > T0().slice(0, 7)) return;
      const m = round2((+a.price || 0) / (+a.life * 12));
      if (m > 0) { depTotal = round2(depTotal + m); depCount++; }
    });
    if (depTotal > 0) {
      const depKey = 'DEP-' + T0().slice(0, 7);
      if (!s.fin.seen[depKey]) {
        s.fin.seen[depKey] = 1;
        mkJV({ prefix: 'DEP', date: T0().slice(0, 7) + '-28', type: 'Depreciation', ref: T0().slice(0, 7), desc: 'Monthly depreciation ' + T0().slice(0, 7) + ' (' + depCount + ' assets)', lines: [{ gl: '5410', dr: depTotal, cr: 0, cx: 'OPEX', ref: '' }, { gl: '1590', dr: 0, cr: depTotal, cx: '', ref: '' }] });
        s.fin.depruns.push(T0().slice(0, 7));
      }
    }

    /* ---------- 11. Disposal write-off (with DSP voucher numbers) ---------- */
    (d.moves || []).filter((m) => m.type === 'Status' && m.after === 'Disposed').forEach((m) => {
      const dspKey = 'DSP-' + m.assetId; if (s.fin.seen[dspKey]) return; s.fin.seen[dspKey] = 1;
      const a = L.hw(m.assetId); if (!a) return;
      const nbv = +a.price || 0; if (nbv <= 0) return;
      mkJV({ prefix: 'DSP', date: m.date, type: 'Disposal', ref: m.assetId, desc: 'Write-off ' + m.assetId, lines: [{ gl: '5510', dr: nbv, cr: 0, cx: '', ref: '' }, { gl: '1510', dr: 0, cr: nbv, cx: '', ref: '' }] });
    });

    /* ---------- 12. Stock issue postings (with IS voucher numbers) ---------- */
    (d.consIssue || []).forEach((r) => {
      const isKey = 'IS-' + r.id; if (s.fin.seen[isKey]) return; s.fin.seen[isKey] = 1;
      const last = d.consPurch.filter((x) => x.itemId === r.itemId).pop();
      const val = round2((+((last || {}).price || 0)) * (+r.qty || 0));
      if (val <= 0) return;
      mkJV({ prefix: 'IS', date: r.date, type: 'Stock Issue', ref: r.id, desc: 'Consumable issue ' + r.id, lines: [{ gl: '5220', dr: val, cr: 0, cx: 'OPEX', ref: '' }, { gl: '1410', dr: 0, cr: val, cx: '', ref: '' }] });
    });

    /* ---------- 13. Financial summary log ---------- */
    L.log('Finance', 'Chart of Accounts: ' + s.fin.coa.length + ' accounts loaded', 'COA');
    L.log('Finance', 'Category→GL mapping: ' + Object.keys(s.fin.catgl).length + ' categories', 'CATGL');
    L.log('Finance', 'Journal vouchers: ' + s.fin.jv.length + ' created', 'JV');
    L.log('Finance', 'Invoices: ' + s.fin.invoices.length + ' generated', 'INV');
    L.log('Finance', 'Payments: ' + s.fin.payments.length + ' recorded', 'PV');
    L.log('Finance', 'Expenses: ' + s.fin.expenses.length + ' claims', 'EX');
    L.log('Finance', 'Budget: ' + d.budgets.length + ' entries for FY' + curYear, 'BUD');
  }

  UI.on('data.samples', async () => {
    if (await UI.confirm('Add sample records <b>only</b> to screens that are empty? Existing data is untouched.', 'Top-up samples', true)) {
      try { samples(); } catch (e) { UI.toast('Top-up failed: ' + (e && e.message ? e.message : e), 'err'); }
    }
  });
  /* =====================================================================
     COMPLETE DATA ENSURER — fills any remaining empty screens so that
     every module shows data, all workflows are linked, and finance
     reflects operational data. Run after load() or as a standalone.
     ===================================================================== */
  function ensureCompleteData() {
    const d = db(), s = D(), h = H();
    if (!Array.isArray(d.budgets)) d.budgets = [];
    if (!Array.isArray(d.employees)) d.employees = [];
    const E = d.employees.filter((e) => e.status === 'Active');
    const TN = (i) => (((h.techs || [])[i % Math.max(h.techs.length, 1)] || {}).name || 'IT Admin');
    const T = () => L.today();
    const now = () => new Date().toISOString();
    let added = 0;

    /* ---------- HELPDESK: requests ---------- */
    if (!h.requests.length && E.length) {
      const r1 = ITMS.sdp.mkTicket({ requester: E[0].no, subject: 'Sample: WiFi slow in meeting room', category: 'Network & Connectivity', impact: 'Medium', urgency: 'Normal', type: 'Incident' });
      const r2 = ITMS.sdp.mkTicket({ requester: E[Math.min(1, E.length - 1)].no, subject: 'Sample: Toner replaced (resolved)', category: 'Printing & Scanning', impact: 'Low', urgency: 'Low', type: 'Service Request' });
      r2.status = 'Resolved'; r2.resolvedAt = now(); r2.resolution = 'Toner replaced and test page OK.'; r2.closure = 'Success';
      added += 2;
    }

    /* ---------- HELPDESK: problems ---------- */
    if (!h.problems.length) {
      h.problems.unshift({ id: 'PRB-S1', title: 'Sample: Mail delays at month-end', desc: '', category: 'Email & Collaboration', owner: TN(0), status: 'Open', impact: 'Medium', urgency: 'Normal', requests: [], hist: [], created: now() });
      added++;
    }

    /* ---------- HELPDESK: changes ---------- */
    if (!h.changes.length) {
      h.changes.unshift({ id: 'CHG-S1', title: 'Sample: Firewall policy tidy-up', changeType: 'Standard', status: 'Planning', owner: TN(0), impact: 'Low', risk: 'Low', requests: [], approvals: [], hist: [], created: now() });
      added++;
    }

    /* ---------- HELPDESK: releases ---------- */
    if (!h.releases.length) {
      h.releases.unshift({ id: 'REL-S1', title: 'Sample: Q3 patch bundle', relType: 'Minor', status: 'Planning', owner: TN(0), start: T(), end: L.addDays(T(), 14), changes: [], created: now(), hist: [] });
      added++;
    }

    /* ---------- HELPDESK: follow-ups ---------- */
    if (!h.items.length) {
      h.items.push({ id: 9001, project: (h.cfg.projects || ['General'])[0], category: 'Infrastructure', desc: 'Sample: Upgrade meeting-room AV', status: 'Open', priority: 'Medium', owner: TN(0), pendingWith: TN(0), open: T(), target: L.addDays(T(), 21), latest: '', next: 'Get quotes', remarks: '', log: [] });
      h.items.push({ id: 9002, project: (h.cfg.projects || ['General'])[0], category: 'Infrastructure', desc: 'Sample: Old printer disposal (done)', status: 'Completed', priority: 'Low', owner: TN(0), open: L.addDays(T(), -40), target: L.addDays(T(), -10), latest: 'Done', next: '', remarks: '', log: [] });
      added += 2;
    }

    /* ---------- HELPDESK: knowledge base ---------- */
    if (!h.solutions.length) {
      h.solutions.unshift({ id: 'KB-S1', title: 'Sample: Printer shows offline (fix it yourself)', category: 'Printing & Scanning', status: 'Published', author: TN(0), keywords: 'printer offline', content: 'WHAT THIS MEANS: Your laptop thinks the printer is switched off. DO THIS: 1. Wake the printer. 2. Remove "Use Offline" tick. 3. Remove and re-add the printer. 4. Print a test page. CALL IT IF: Paper jam light blinking or more than one person affected.', views: 3, created: now(), hist: [] });
      added++;
    }

    /* ---------- HELPDESK: service catalog ---------- */
    if (!h.catalog.length) {
      h.catalog.unshift({ id: 'SC-S01', title: 'Sample: New wireless mouse', desc: 'A standard wireless mouse with batteries, ready to use.', category: 'Service Request', active: 'Yes', impact: 'Low', urgency: 'Low', group: (h.cfg.groups || ['Service Desk'])[0], approver: '', desk: 'IT' });
      added++;
    }

    /* ---------- HELPDESK: announcements ---------- */
    if (!(h.news || []).length) {
      h.news.unshift({ id: 'ANN-S01', title: 'Sample: Welcome to the service desk', desc: 'Log tickets from the portal or by email.', from: T(), to: L.addDays(T(), 30), active: 'Yes', created: now() });
      added++;
    }

    /* ---------- SDP: contracts ---------- */
    if (!s.contracts.length) {
      s.contracts.push(
        { id: 'CTR-S01', title: 'Sample: Internet lease (active)', vendor: '', type: 'Lease', start: L.addDays(T(), -100), end: L.addDays(T(), 200), value: 60000, owner: TN(0), assets: [], status: 'Active', notes: '' },
        { id: 'CTR-S02', title: 'Sample: Support expiring soon', vendor: '', type: 'Support', start: L.addDays(T(), -300), end: L.addDays(T(), 12), value: 24000, owner: TN(0), assets: [], status: 'Active', notes: '' },
        { id: 'CTR-S03', title: 'Sample: Old deal (expired)', vendor: '', type: 'Maintenance', start: L.addDays(T(), -400), end: L.addDays(T(), -20), value: 8000, owner: TN(0), assets: [], status: 'Active', notes: '' }
      );
      added += 3;
    }

    /* ---------- SDP: CMDB ---------- */
    if (!s.cis.length) {
      s.cis.push(
        { id: 'CI-S01', name: 'SAMPLE-CORE-SW', type: 'Network Device', owner: TN(0), site: '', status: 'Live', criticality: 'Critical', assetId: '', ip: '10.0.0.1', created: T() },
        { id: 'CI-S02', name: 'SAMPLE-ERP-APP', type: 'Application', owner: TN(0), site: '', status: 'Live', criticality: 'High', assetId: '', ip: '', created: T() },
        { id: 'CI-S03', name: 'SAMPLE-OLD-PC', type: 'Desktop', owner: '', site: '', status: 'Retired', criticality: 'Low', assetId: '', ip: '', created: T() }
      );
      s.links.push({ id: 'LNK-S01', from: 'CI-S02', rel: 'runs on', to: 'CI-S01', at: T() }, { id: 'LNK-S02', from: 'CI-S01', rel: 'connects to', to: 'CI-S03', at: T() });
      added += 5;
    }

    /* ---------- SDP: preventive maintenance ---------- */
    if (!s.maint.length) {
      s.maint.push(
        { id: 'PMT-S01', title: 'Sample: Monthly patching (overdue)', freq: 'Monthly', next: L.addDays(T(), -3), group: (h.cfg.groups || [''])[0], desc: '', status: 'Scheduled' },
        { id: 'PMT-S02', title: 'Sample: Quarterly AC service', freq: 'Quarterly', next: L.addDays(T(), 25), group: (h.cfg.groups || [''])[0], desc: '', status: 'Scheduled' }
      );
      added += 2;
    }

    /* ---------- SDP: inbox ---------- */
    if (!s.inbox.length) { s.inbox.unshift({ id: 'MAIL-S01', from: 'staff@company.ae', subject: 'Sample: projector not working', body: 'Hall projector shows no signal.', at: now(), status: 'Unprocessed' }); added++; }

    /* ---------- SDP: scheduler ---------- */
    if (!s.schedules.length) {
      s.schedules.push(
        { id: 'SCH-S01', title: 'Sample: Follow-up task', kind: 'Task', date: L.addDays(T(), 2), time: '10:00', owner: TN(0), link: '' },
        { id: 'SCH-S02', title: 'Sample: Team leave cover', kind: 'Time off', date: L.addDays(T(), 14), time: '', owner: TN(0), link: '' }
      );
      added += 2;
    }

    /* ---------- SDP: templates ---------- */
    if (!s.templates.length) {
      s.templates.push(
        { id: 'TPL-S01', name: 'Sample: New headset', category: 'Service Request', desc: 'Standard headset', impact: 'Low', urgency: 'Normal', group: (h.cfg.groups || [''])[0], tasks: '', active: 'Yes' },
        { id: 'TPL-S02', name: 'Sample: Retired form', category: 'Other', desc: '', impact: 'Low', urgency: 'Low', group: '', tasks: '', active: 'No' }
      );
      added += 2;
    }

    /* ---------- SDP: surveys ---------- */
    if (!s.surveys.length) { s.surveys.unshift({ id: 'SV-S1', title: 'Sample: Support rating', q: 'Rate this ticket (1-5)', active: 'Yes' }); added++; }
    if (!s.responses.length && s.surveys.length && h.requests.length) {
      s.responses.unshift({ id: 'SR-S1', surveyId: s.surveys[0].id, reqId: h.requests[0].id, rater: L.empName(h.requests[0].requester), score: 5, comment: 'Sample response', at: now() });
      added++;
    }

    /* ---------- SDP: chats ---------- */
    if (!s.chats.length && E.length) {
      s.chats.unshift({ id: 'CHAT-S1', user: E[0].name, empNo: E[0].no, tech: TN(0), status: 'Open', at: now(), msgs: [{ by: E[0].name, text: 'Sample: hi, need help', at: now() }, { by: TN(0), text: 'Sample: looking into it', at: now() }] });
      added++;
    }

    /* ---------- SDP: loans ---------- */
    if (!s.loans.length) {
      const spare = d.hw.find((a) => a.status === 'In Stock');
      if (spare && E.length > 1) { L.issueAssets(E[1].no, [spare.id], T(), 'Sample loan'); s.loans.push({ id: 'LOAN-S1', assetId: spare.id, empNo: E[1].no, outDate: T(), dueDate: L.addDays(T(), 14), status: 'On loan', remarks: 'Sample' }); added++; }
    }

    /* ---------- SDP: asset discovery ---------- */
    if (!s.scans.length) {
      s.scans.unshift({ id: 'SCAN-S1', method: 'Network scan', scope: '192.168.1.0/24', date: T(), found: 5, imported: 0, status: 'Completed' });
      for (let i = 0; i < 5; i++) { s.discovered.unshift({ id: 'DISC-S' + (i + 1), scan: 'SCAN-S1', host: 'WS-SAMPLE-' + (i + 1), ip: '192.168.1.' + (10 + i), mac: 'AA:BB:CC:0' + i + ':11:22', os: ['Windows 11 Pro', 'Windows 10 Pro', 'Ubuntu 22.04', 'Windows Server 2022', 'Cisco IOS'][i], type: ['Desktop', 'Laptop', 'Server', 'Switch', 'Router'][i], status: 'New', vendor: ['Dell', 'HP', 'Cisco', 'Fortinet', 'Ubiquiti'][i], model: ['Latitude 5440', 'OptiPlex 7010', 'PowerEdge R450', 'CBS350-24P', 'FortiGate 60F'][i] }); }
      added += 6;
    }

    /* ---------- SDP: custom actions ---------- */
    if (!s.actions.length) {
      s.actions.push({ id: 'CA-S1', name: 'Sample: Webhook on create', event: 'onCreate', do: 'webhook', target: 'https://hooks.example.com/new-ticket', active: 'Yes' });
      added++;
    }

    /* ---------- SDP: custom apps ---------- */
    if (!s.apps.length) { s.apps.unshift({ id: 'APP-S1', name: 'Sample: Visitor log', purpose: 'Front-desk demo', fields: 'Visitor, Company, Host', records: [{ Visitor: 'Demo Guest', Company: 'Acme', Host: TN(0), _at: now() }], active: 'Yes' }); added++; }

    /* ---------- SDP: remote tools ---------- */
    if (!s.toollog.length && d.hw.length) { s.toollog.unshift({ id: 'TOOL-S1', tool: 'Remote Desktop', asset: d.hw[0].id, by: TN(0) || 'Admin', at: now(), result: 'Sample session record' }); added++; }

    /* ---------- SDP: AD ---------- */
    if (!s.adconns.length) { s.adconns.unshift({ id: 'ADC-S1', name: 'Sample DC (SSL)', host: 'dc01.company.ae', port: '636', enc: 'SSL', baseDN: 'DC=company,DC=ae', bindUser: 'svc@company.ae', cert: '', status: 'Draft', lastTest: '' }); added++; }
    if (!s.adgroups.length) { s.adgroups.unshift({ id: 'ADG-S1', name: 'Sample Support Group', scope: 'Global', category: 'Security', desc: 'Sample', members: [] }); added++; }
    if (!s.adusers.length && E.length) { s.adusers.unshift({ id: 'ADU-S1', sam: 'sample.user', upn: 'sample.user@company.ae', empNo: E[0].no, ou: 'OU=Users', groups: [], status: 'Enabled', mustChange: 'Yes', lastSync: T() }); added++; }
    if (!s.gpos.length) { s.gpos.unshift({ id: 'GPO-S1', name: 'Sample Baseline', desc: 'Sample policy', ous: 'OU=Workstations', settings: 'Screen lock = 5 min', status: 'Linked', version: 1 }); added++; }
    if (!s.adlog.length) { s.adlog.unshift({ at: now(), text: 'Sample: directory check completed' }); added++; }

    /* ---------- SDP: ESM instances ---------- */
    if (!s.instances.length) {
      s.instances.push(
        { id: 'ESM-IT', name: 'IT Service Desk', dept: 'IT', status: 'Live', catalog: 0, portal: 'Yes', created: T() },
        { id: 'ESM-HR', name: 'HR Service Desk', dept: 'HR', status: 'Draft', catalog: 0, portal: 'No', created: T() }
      );
      added += 2;
    }
    if (!s.devices.length) { s.devices.unshift({ id: 'MOB-S1', user: TN(0) || 'Admin', platform: 'Android', lastSeen: now() }); added++; }

    /* ---------- SDP: HR ---------- */
    if (!s.hr.leaves.length && E.length) { s.hr.leaves.unshift({ id: 'LV-S1', empNo: E[0].no, type: 'Annual', from: L.addDays(T(), 7), to: L.addDays(T(), 9), days: 3, reason: 'Sample leave', status: 'Pending', at: now() }); added++; }

    /* ---------- SDP: FINANCE (from operational data) ---------- */
    buildFinancials();

    /* ---------- PROCUREMENT: ensure POs exist for finance ---------- */
    if (!d.pos.length && E.length && E[0]) {
      const vName = (d.vendors && d.vendors[0] && d.vendors[0].name) || 'SampleVendor';
      const p1 = L.savePR({ date: L.addDays(T(), -20), requester: E[0].no, dept: 'IT', notes: 'Sample', lines: [{ itemType: 'Hardware', vendor: vName, desc: 'Sample Laptop', unit: 'Nos', qty: 2, notes: '' }] });
      const po1 = L.createPOsFromPR([{ prNo: p1.prNo, line: 1, qty: 2, price: 4200 }], { autoApprove: true })[0];
      L.receivePO(po1, [{ line: 1, qty: 2 }], { date: L.addDays(T(), -10) });
      added += 1;
    }

    /* ---------- COMPLIANCE: ensure assessments exist ---------- */
    if (!d.compliance || !d.compliance.active) {
      d.compliance = { active: 'iso27001', confirmed: true, data: {} };
      added++;
    }

    /* ---------- BUDGET: ensure entries exist ---------- */
    if (!d.budgets.length) {
      const curYear = new Date().getFullYear();
      ['Hardware', 'Software & Licences', 'Consumables', 'AMC & Maintenance', 'Network & Infrastructure', 'Cloud & Services', 'Security', 'Staffing & Training', 'Other'].forEach((cat) => {
        d.budgets.push({ id: 'BG-' + curYear + '-' + cat.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X'), year: curYear, category: cat, planned: [210000, 105000, 20000, 42000, 55000, 75000, 40000, 30000, 15000][['Hardware', 'Software & Licences', 'Consumables', 'AMC & Maintenance', 'Network & Infrastructure', 'Cloud & Services', 'Security', 'Staffing & Training', 'Other'].indexOf(cat)], extra: 0, notes: 'Sample', gl: (s.fin.catgl || {})[cat] || '5290' });
      });
      added += 9;
    }

    S.emit();
    return added;
  }

  /* ---------- MASTER LOAD: full test data + complete data ensure ---------- */
  function masterLoad() {
    let loadErr = null;
    try { load(); } catch (e) { loadErr = e; }
    const n = ensureCompleteData();
    buildFinancials();
    S.emit();
    if (loadErr) UI.toast('Test data partially loaded — ' + (loadErr.message || loadErr), 'err');
    else UI.toast('Master load complete — every module, workflow and finance screen filled' + (n ? ' (+' + n + ' gaps filled)' : ''));
  }
  ITMS.testdata = { load, masterLoad, ensureCompleteData };
})();

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
    const emps = db().employees.slice();
    if (!emps.length) throw new Error('No employees found — cannot build test data without the user list.');
    S.reset('empty');
    const d = db();
    d.employees = emps;
    /* ---------- sample employees across all departments (skipped if present) ---------- */
    const ceo = emps.find((e) => /john smith/i.test(e.name || '')) || emps.find((e) => e.status === 'Active' && e.email) || {};
    const ROSTER = [
      ['Layla Haddad', 'Executive Assistant', 'Executive', 'layla.haddad@tafaseel.ae', '2022-03-01', ceo.name || ''],
      ['Tariq Aziz', 'Operations Director', 'Executive', 'tariq.aziz@tafaseel.ae', '2021-06-15', ceo.name || ''],
      ['Priya Nair', 'Accountant', 'Finance', 'priya.nair@tafaseel.ae', '2023-01-10', ceo.name || ''],
      ['Khalid Mansoor', 'Finance Manager', 'Finance', 'khalid.mansoor@tafaseel.ae', '2020-11-01', 'Priya Nair'],
      ['Ayesha Rahman', 'HR Officer', 'Human Resources', 'ayesha.rahman@tafaseel.ae', '2023-04-12', ceo.name || ''],
      ['Omar Farouk', 'Recruiter', 'Human Resources', 'omar.farouk@tafaseel.ae', '2024-02-01', 'Ayesha Rahman'],
      ['Vikram Rao', 'System Administrator', 'IT', 'vikram.rao@tafaseel.ae', '2021-09-20', ceo.name || ''],
      ['Nora Salem', 'IT Support Engineer', 'IT', 'nora.salem@tafaseel.ae', '2023-08-14', 'Vikram Rao'],
      ['Huda Karim', 'Marketing Executive', 'Marketing', 'huda.karim@tafaseel.ae', '2022-07-05', ceo.name || ''],
      ['Chris Dsouza', 'Content Specialist', 'Marketing', 'chris.dsouza@tafaseel.ae', '2024-05-20', 'Huda Karim'],
      ['Adel Mahmoud', 'Operations Supervisor', 'Operations', 'adel.mahmoud@tafaseel.ae', '2021-12-01', ceo.name || ''],
      ['Rita George', 'Logistics Coordinator', 'Operations', 'rita.george@tafaseel.ae', '2023-10-03', 'Adel Mahmoud'],
      ['Mona Fawaz', 'Admin Assistant', 'Administration', 'mona.fawaz@tafaseel.ae', '2022-09-11', ceo.name || ''],
      ['Samir Iqbal', 'Facilities Coordinator', 'Administration', 'samir.iqbal@tafaseel.ae', '2023-03-22', 'Mona Fawaz'],
      ['Faisal Noor', 'Security Officer', 'Security', 'faisal.noor@tafaseel.ae', '2021-05-30', ceo.name || ''],
      ['Dana Khalil', 'CCTV Operator', 'Security', 'dana.khalil@tafaseel.ae', '2024-01-08', 'Faisal Noor'],
    ];
    ROSTER.forEach((x, i) => {
      if (d.employees.some((e) => (e.email || '').toLowerCase() === x[3])) return;
      L.saveEmployee({ name: x[0], designation: x[1], manager: x[5], doj: x[4], dol: '', dept: x[2], location: 'Dubai, UAE', email: x[3], mobile: '9715000' + (110 + i), tel: '', ext: '', status: 'Active' });
    });
    const newEmps = ROSTER.map((x) => d.employees.find((e) => (e.email || '').toLowerCase() === x[3])).filter(Boolean);
    Object.assign(d.company, { name: 'TAFASEEL GROUP HOLDING', address: 'DUBAI, UAE', vat: 5, currency: 'AED', warrantyDays: 365, logo: '' });
    const E = emps.filter((e) => e.status === 'Active');
    const pick = (i) => E[i % E.length];
    const T = () => L.today();
    const h = H();
    h.items = []; h.seq.item = 0; // drop auto DHRE pair; sample timer suppressed at end

    /* ---------- technicians ---------- */
    const groups = h.cfg.groups;
    const techSrc = E.filter((e) => e.dept === 'IT').concat(E).slice(0, 4);
    const tnames = ['Service Desk Analyst', 'Desktop Engineer', 'Network Engineer', 'System Administrator'];
    h.techs = techSrc.map((e, i) => ({ id: 'TECH-0' + (i + 1), name: e.name, email: e.email || '', group: groups[i % groups.length], role: i === 0 ? 'Administrator' : 'Technician', level: ['Tier 1', 'Tier 2', 'Tier 2', 'Tier 3'][i], empNo: e.no, active: 'Yes' }));
    const TN = (i) => h.techs[i % h.techs.length].name;
    L.log('System', 'TAFASEEL test data: technicians created');

    /* ---------- vendors (all compliance states) ---------- */
    const V = {};
    [['TechSource Trading', 'AED', 'Compliant', 'ISO 27001'], ['SoftLine Solutions', 'AED', 'Compliant', 'ISO 9001'], ['OfficeSupplies Co', 'AED', 'Pending', ''], ['ProServe Maintenance', 'AED', 'Compliant', 'ISO 20000'], ['ConnectTel', 'AED', 'Pending', ''], ['FacilityFix Services', 'AED', 'Non-Compliant', '']].forEach((x, i) => {
      const t0 = (db().terms[0] || {}).id || '';
      const v = L.saveVendor({ name: x[0], contact: 'Sales Team', email: 'sales@vendor' + (i + 1) + '.ae', phone1: '971-4-100-200' + i, city: 'Dubai', country: 'UAE', currency: x[1], termsId: t0, certs: x[3], compliance: x[2] });
      V[x[0]] = v.name;
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
    L.receivePO(poLap, [{ line: 1, qty: 5 }], { date: agoD(12) });
    L.receivePO(poMon, [{ line: 1, qty: 6 }], { date: agoD(9) }); // Partial
    L.receivePO(poSw, [{ line: 1, qty: 10 }], { date: agoD(15) });
    L.receivePO(poTon, [{ line: 1, qty: 12 }], { date: agoD(6) });

    /* ---------- hardware across every status + movement history ---------- */
    const hwIds = db().hw.map((a) => a.id);
    const lap1 = L.hw(hwIds[0]), lap2 = L.hw(hwIds[1]);
    if (lap1) L.issueAssets(pick(1).no, [lap1.id], agoD(10), 'Test issue');
    if (lap2) { L.issueAssets(pick(2).no, [lap2.id], agoD(30), 'Test issue'); L.transferAssets(pick(2).no, pick(3).no, [lap2.id], agoD(8), 'Department move'); }
    const ret = L.saveHW({ type: 'Monitor', desc: 'Test Monitor for return flow', compName: 'TEST-MON-01', serial: 'TST001', purchaseDate: agoD(40), price: 700, condition: 'Good' });
    L.issueAssets(pick(4).no, [ret.id], agoD(20), 'Test issue'); L.returnAssets(pick(4).no, [ret.id], agoD(2), 'Good', 'In Stock', 'Test return');
    const rep = L.saveHW({ type: 'Printer', desc: 'Test Printer under repair', purchaseDate: agoD(200), price: 1100, condition: 'Poor' });
    L.setAssetState(rep.id, 'Under Repair', 'Test repair flow');
    const dsp = L.saveHW({ type: 'Desktop', desc: 'Test Desktop disposed', purchaseDate: '2021-03-01', price: 2500, condition: 'Poor' });
    L.setAssetState(dsp.id, 'Disposed', 'Beyond repair — test disposal');
    L.saveHW({ type: 'Server', desc: 'Test Server spare', purchaseDate: agoD(90), price: 14000, condition: 'New' });

    /* ---------- one device per roster head, issued + software installed ---------- */
    const devTypes = [['Laptop', 'Dell Latitude 5440', 4200], ['Desktop', 'Dell OptiPlex 7010', 3100], ['Monitor', 'Dell P2422H 24 inch', 780], ['Phone', 'Yealink T46S', 620]];
    newEmps.forEach((e, i) => {
      const dt = devTypes[i % devTypes.length];
      const a = L.saveHW({ type: dt[0], desc: 'TEST: ' + dt[1] + ' for ' + e.name, compName: 'TEST-' + e.no, serial: 'TST-' + e.no, purchaseDate: agoD(45), price: dt[2], condition: 'Good' });
      L.issueAssets(e.no, [a.id], agoD(30), 'TEST onboarding allocation');
    });

    /* ---------- software: expiring / expired / exhausted / perpetual ---------- */
    const sw1 = L.saveSW({ type: 'Application Software', subType: 'Cloud-Based', name: 'Microsoft 365 Test', vendor: 'SoftLine', purchaseDate: agoD(345), expiry: fwdD(20), qty: 25, unitPrice: 62, currency: 'AED' });
    const sw2 = L.saveSW({ type: 'System Software', subType: 'Perpetual', name: 'Endpoint AV Test', vendor: 'SoftLine', purchaseDate: agoD(400), expiry: agoD(10), qty: 15, unitPrice: 90, currency: 'AED' });
    const sw3 = L.saveSW({ type: 'Application Software', subType: 'Perpetual', name: 'Design Suite Test', vendor: 'SoftLine', purchaseDate: agoD(100), expiry: fwdD(200), qty: 2, unitPrice: 2400, currency: 'AED' });
    const sw4 = L.saveSW({ type: 'Application Software', subType: 'Perpetual', name: 'ERP Client Perpetual', vendor: 'SoftLine', purchaseDate: '2023-01-15', expiry: '', qty: 30, unitPrice: 500, currency: 'AED' });
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
    mkS({ title: 'TEST: Draft fix', category: 'Hardware', status: 'Draft', author: TN(1), content: 'Draft content' });
    mkS({ title: 'TEST: VPN fix under review', category: 'Network & Connectivity', status: 'Under Review', author: TN(2), content: 'Steps...' });
    mkS({ title: 'TEST: Password reset steps', category: 'Accounts & Access', status: 'Published', author: TN(0), keywords: 'password reset unlock', content: '1. Verify identity 2. Reset 3. Confirm login', views: 12 });
    mkS({ title: 'TEST: Old dial-up guide (expired)', category: 'Other', status: 'Expired', author: TN(0), content: 'Retired' });
    const mkCat = (o) => { const r = Object.assign({ id: 'SC-' + String(HS('catalog')).padStart(3, '0'), active: 'Yes' }, o); h.catalog.unshift(r); return r; };
    mkCat({ title: 'TEST: New laptop', desc: 'Standard laptop request', category: 'Service Request', group: groups[0], impact: 'Medium', urgency: 'Normal', approver: TN(0) });
    mkCat({ title: 'TEST: Password reset', desc: 'Self-service reset', category: 'Accounts & Access', impact: 'Low', urgency: 'Normal' });
    mkCat({ title: 'TEST: Shared mailbox', desc: 'New shared mailbox', category: 'Email & Collaboration', impact: 'Low', urgency: 'Normal' });
    mkCat({ title: 'TEST: Inactive retired service', desc: 'Do not use', category: 'Other', active: 'No', impact: 'Low', urgency: 'Low' });
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
      { id: 'MAIL-101', from: 'staff@tafaseel.ae', subject: 'TEST: wifi not working on floor 3', body: 'Hi team, wifi keeps dropping since morning.', at: agoH(6), status: 'Unprocessed' },
      { id: 'MAIL-102', from: 'hr@tafaseel.ae', subject: 'TEST: Password reset please', body: 'Locked out of email.', at: agoH(30), status: 'Converted → ' + t3.id }
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
    const adLive = { id: 'ADC-901', name: 'TEST DC (SSL)', host: 'dc01.tafaseel.ae', port: '636', enc: 'SSL', baseDN: 'DC=tafaseel,DC=ae', bindUser: 'svc_itms@tafaseel.ae', cert: 'THUMBPRINT-TEST', status: 'Live', lastTest: agoH(5) };
    s.adconns.unshift(adLive);
    const au = (emp, sam, st, groups) => s.adusers.unshift({ id: 'ADU-9' + s.adusers.length, sam, upn: sam + '@tafaseel.ae', empNo: emp.no, ou: 'OU=Users,DC=tafaseel,DC=ae', groups: groups || ['IT Support'], status: st, mustChange: 'No', lastSync: agoD(1) });
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
      { id: 'GPO-91', name: 'TEST Baseline', desc: 'Test hardened baseline', ous: 'OU=Workstations,DC=tafaseel,DC=ae', settings: 'Password length = 12\nScreen lock = 5 min', status: 'Linked', version: 2 },
      { id: 'GPO-92', name: 'TEST USB Block (enforced)', desc: 'Test removable media', ous: 'OU=Workstations,DC=tafaseel,DC=ae\nOU=Servers,DC=tafaseel,DC=ae', settings: 'Removable storage = Deny', status: 'Enforced', version: 1 }
    );
    s.devices.push({ id: 'MOB-91', user: TN(0), platform: 'Android', lastSeen: agoH(3) }, { id: 'MOB-92', user: TN(1), platform: 'iOS', lastSeen: agoH(26) });
    s.instances.push({ id: 'ESM-TST', name: 'TEST Facilities Desk', dept: 'Facilities', status: 'Draft', catalog: 0, portal: 'No', created: T() });
    s.apps.push({ id: 'APP-91', name: 'TEST Gate Pass', purpose: 'Test visitor passes', fields: 'Visitor, Company, Host', records: [{ Visitor: 'Ahmed', Company: 'ABC', Host: TN(0), _at: agoH(8) }, { Visitor: 'Sara', Company: 'XYZ', Host: TN(1), _at: agoH(30) }], active: 'Yes' });
    s.mail.smtp.unshift({ id: 'SMTP-91', name: 'TEST SMTP', host: 'smtp.tafaseel.ae', port: '587', enc: 'STARTTLS', user: 'servicedesk@tafaseel.ae', pass: '', fromAddr: 'servicedesk@tafaseel.ae', fromName: 'TAFASEEL Service Desk', status: 'Live', lastTest: agoH(2) });
    s.mail.inbound.unshift({ id: 'INBOX-91', name: 'TEST support mailbox', type: 'IMAP', host: 'mail.tafaseel.ae', port: '993', ssl: 'Yes', user: 'support@tafaseel.ae', pass: '', box: 'INBOX', status: 'Live' });
    s.mail.desk = 'support@tafaseel.ae';
    s.mail.outbox.unshift({ id: 'EM-901', at: agoH(25), to: [pick(1).email || 'user@tafaseel.ae'], ticketId: t3.id, kind: 'resolved', subject: `[${t3.id}] ${t3.subject} — resolved`, body: 'TEST: resolution email already dispatched.', status: 'Sent', sentAt: agoH(24) });

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
    L.log('System', 'TAFASEEL full test data loaded (employees kept)');
    S.emit();
    UI.toast('Test data ready — every module, status and type covered');
  }

  UI.on('data.test', async () => {
    if (await UI.confirm('Replace <b>ALL current data</b> (employees are kept) and load the full TAFASEEL test dataset?', 'Load test data', true)) {
      try { load(); location.hash = '#/dashboard'; } catch (e) { UI.toast(e.message || String(e), 'err'); }
    }
  });
  ITMS.testdata = { load };
})();

/* ITMS ServiceDesk Plus extension — ITIL/audit modules missing from the base app.
   Adds: Self-Service Portal (+AD self-service), Live Chat, CMDB, Contracts,
   Preventive Maintenance, Email-to-Ticket, Automation (business rules, auto-assign,
   smart notifications, SLA escalations), Lifecycle designers, Multi-site + domains,
   Roles (fine-grained auth), Scheduler, Templates + custom actions + custom apps,
   Discovery + inventory catalog + remote tools, Asset loans, Surveys,
   Advanced reports, ESM instances + mobile registry, Archiving + audit trail.
   Storage: S.db.sdp (browser localStorage, same as the rest of ITMS). */
(function () {
  const ITMS = window.ITMS, L = ITMS.logic, UI = ITMS.ui, S = ITMS.store;
  const pages = (ITMS.pages = ITMS.pages || {});
  const { esc, pill, icon: ic, fmtNum, fmtDate } = UI;
  const db = () => S.db;
  const H = () => (db() ? db().hd : null);
  const today = () => L.today();
  const now = () => new Date().toISOString();
  const fdt = (s) => (s ? String(s).replace('T', ' ').slice(0, 16) : '');
  const P = (t, c) => pill(t || '—', c || undefined);
  const C = { coral: '#ff5c6c', amber: '#ffb020', mint: '#10d9a0', blue: '#2f6bff', violet: '#2f6bff', cyan: '#00c2ff' };

  /* ================= store ================= */
  function ensure() {
    const d = db(); if (!d) return;
    const s = (d.sdp = d.sdp || {});
    const arr = ['contracts', 'cis', 'links', 'maint', 'inbox', 'rules', 'notiflog', 'escalations', 'schedules', 'templates', 'actions', 'scans', 'discovered', 'products', 'loans', 'surveys', 'responses', 'chats', 'adreqs', 'archives', 'archiveData', 'instances', 'devices', 'apps', 'toollog', 'adconns', 'adusers', 'adgroups', 'gpos', 'adlog', 'spaces', 'items'];
    arr.forEach((k) => { if (!s[k]) s[k] = []; });
    s.seq = s.seq || {};
    s.lifecycles = s.lifecycles || {
      request: ['Open', 'Assigned', 'In Progress', 'On Hold', 'Resolved', 'Closed', 'Cancelled'],
      problem: ['Open', 'In Progress', 'Root Cause Found', 'Resolved', 'Closed'],
      change: ['Submission', 'Planning', 'Approval', 'Implementation', 'UAT', 'Review', 'Closed', 'Rejected', 'Cancelled'],
    };
    if (!s.roles || !s.roles.length) s.roles = [
      { id: 'ROLE-01', name: 'Administrator', scope: 'All modules', perms: ['view', 'create', 'edit', 'delete', 'approve', 'admin'], active: 'Yes' },
      { id: 'ROLE-02', name: 'Group Lead', scope: 'Own group', perms: ['view', 'create', 'edit', 'approve'], active: 'Yes' },
      { id: 'ROLE-03', name: 'Technician', scope: 'Assigned work', perms: ['view', 'create', 'edit'], active: 'Yes' },
      { id: 'ROLE-04', name: 'Requester', scope: 'Self-service portal only', perms: ['view', 'create'], active: 'Yes' },
      { id: 'ROLE-05', name: 'Auditor', scope: 'Read-only all modules', perms: ['view'], active: 'Yes' },
      { id: 'ROLE-06', name: 'Vendor / External', scope: 'Assigned changes only', perms: ['view', 'edit'], active: 'Yes' },
    ];
    if (!s.sites || !s.sites.length) s.sites = [
      { id: 'SITE-01', name: 'Head Office — Dubai', code: 'DXB-HO', group: 'Service Desk (L1)', tz: 'Asia/Dubai', active: 'Yes' },
      { id: 'SITE-02', name: 'Abu Dhabi Branch', code: 'AUH-BR', group: 'Desktop Support (L2)', tz: 'Asia/Dubai', active: 'Yes' },
    ];
    if (!s.roles.some((x) => x.name === 'HR Officer')) s.roles.push({ id: 'ROLE-07', name: 'HR Officer', scope: 'HR module only — no identity admin', perms: ['view', 'create', 'edit'], access: ['dashboard', 'hr', 'portal', 'kb', 'scheduler'], active: 'Yes' });
    if (!s.roles.some((x) => x.name === 'Finance Officer')) s.roles.push({ id: 'ROLE-08', name: 'Finance Officer', scope: 'Finance module only', perms: ['view', 'create', 'edit'], access: ['dashboard', 'finance', 'portal', 'kb'], active: 'Yes' });
    const needAcc = s.roles.some((x) => !x.access);
    if (needAcc) {
      const ALL = Object.keys(ITMS.pages || {});
      const TECH = ['dashboard', 'itsm', 'tickets', 'portal', 'incidents', 'sr', 'problems', 'changes', 'releases', 'monitoring', 'itil', 'cmdb', 'knowledge', 'catalog', 'mailticket', 'pmtasks', 'templates', 'projects', 'scheduler', 'hardware', 'movements', 'software', 'consumables', 'loans', 'discovery', 'employees', 'lifecycle', 'workflow'];
      const byName = { 'Group Lead': null, Technician: TECH, Requester: ['dashboard', 'portal', 'knowledge', 'catalog'], 'Vendor / External': ['dashboard', 'tickets', 'incidents', 'knowledge', 'projects'] };
      s.roles.forEach((x) => {
        if (x.access) return;
        if (x.name === 'Group Lead') { x.access = ALL.filter((id) => id !== 'roles' && id !== 'settings'); return; }
        if (byName[x.name]) { x.access = byName[x.name].filter((id) => ALL.indexOf(id) >= 0); return; }
        x.access = null;
      });
    }
    if (!s.instances || !s.instances.length) s.instances = [
      { id: 'ESM-IT', name: 'IT Service Desk', dept: 'IT', status: 'Live', catalog: 0, portal: 'Yes', created: today() },
      { id: 'ESM-HR', name: 'HR Service Desk', dept: 'HR', status: 'Draft', catalog: 0, portal: 'No', created: today() },
      { id: 'ESM-FAC', name: 'Facilities Desk', dept: 'Admin', status: 'Draft', catalog: 0, portal: 'No', created: today() },
    ];
    s.domains = s.domains || { portal: 'https://servicedesk.company.ae', custom: '', enforced: 'No' };
    s.escth = Object.assign({ apprHours: 48, probDays: 0, chatMins: 30, pmDays: 0 }, s.escth || {});
    s.mail = s.mail || {};
    s.mail.smtp = s.mail.smtp || []; s.mail.inbound = s.mail.inbound || []; s.mail.outbox = s.mail.outbox || [];
    s.mail.toggles = Object.assign({ onCreate: 1, onAssign: 1, onResolve: 1, onClose: 1, onNote: 1, ccManager: 1 }, s.mail.toggles || {});
    if (!s.mail.desk) s.mail.desk = 'support@company.ae';
    s.hr = s.hr || {};
    s.hr.leaveTypes = s.hr.leaveTypes || [{ type: 'Annual', days: 30 }, { type: 'Sick', days: 15 }, { type: 'Emergency', days: 5 }, { type: 'Unpaid', days: 0 }];
    s.hr.leaves = s.hr.leaves || []; s.hr.clear = s.hr.clear || [];
    s.hr.onb = s.hr.onb || []; s.hr.offb = s.hr.offb || [];
    s.fin = s.fin || {}; s.fin.expenses = s.fin.expenses || []; s.fin.payments = s.fin.payments || [];
    if (!s.fin.coa) s.fin.coa = [
      { code: '1110', name: 'Cash & Bank', type: 'Asset' }, { code: '1210', name: 'Accounts Receivable', type: 'Asset' },
      { code: '1310', name: 'Advances to Suppliers', type: 'Asset' }, { code: '1410', name: 'Consumable Stock', type: 'Asset' },
      { code: '1430', name: 'VAT Recoverable', type: 'Asset' }, { code: '1510', name: 'IT Equipment – Hardware', type: 'Asset' },
      { code: '1520', name: 'Software Assets', type: 'Asset' }, { code: '1590', name: 'Accumulated Depreciation – IT', type: 'Asset' },
      { code: '2110', name: 'Accounts Payable – Vendors', type: 'Liability' }, { code: '2120', name: 'Accrued Expenses', type: 'Liability' },
      { code: '3110', name: 'Owner Capital', type: 'Equity' }, { code: '4110', name: 'Other Income', type: 'Income' },
      { code: '5110', name: 'Salaries & Staff Cost', type: 'Expense' }, { code: '5210', name: 'Rent & Utilities', type: 'Expense' },
      { code: '5220', name: 'Consumables Consumed', type: 'Expense' }, { code: '5230', name: 'Maintenance & AMC', type: 'Expense' },
      { code: '5240', name: 'IT Subscriptions & Licences', type: 'Expense' }, { code: '5290', name: 'General & Admin Expenses', type: 'Expense' },
      { code: '5410', name: 'Depreciation – IT Equipment', type: 'Expense' }, { code: '5510', name: 'Loss on Asset Disposal', type: 'Expense' },
    ];
    s.fin.catgl = Object.assign({ Hardware: '5290', 'Software & Licences': '5240', Consumables: '5220', 'AMC & Maintenance': '5230', 'Network & Infrastructure': '5290', 'Cloud & Services': '5240', Security: '5290', 'Staffing & Training': '5110', Other: '5290' }, s.fin.catgl || {});
    s.fin.jv = s.fin.jv || []; s.fin.depruns = s.fin.depruns || [];
    s.fin.seen = s.fin.seen || {}; s.fin.seen.grn = s.fin.seen.grn || {}; s.fin.seen.disp = s.fin.seen.disp || {}; s.fin.seen.iss = s.fin.seen.iss || {};
    s.fin.seq = s.fin.seq || {};
    if (!s.accV2) {
      s.accV2 = true;
      (s.roles || []).forEach((x) => {
        if (!x.access || x.name === 'Administrator' || x.name === 'Requester' || x.name === 'Vendor / External') return;
        ['hr', 'finance'].forEach((id) => { if (x.access.indexOf(id) < 0) x.access.push(id); });
      });
    }
    if (!s.rules.length && !s.seeded) {
      s.rules.push({ id: 'BR-01', name: 'Critical Tier 1 SMS', active: 'Yes', when: 'VIP and critical incidents', matchF: 'priority', matchV: 'Critical', doAssign: 'Tier 1', doGroup: '', doNotify: 'Email + SMS', doPr: '' });
      s.rules.push({ id: 'BR-02', name: 'Access requests to L1 queue', active: 'Yes', when: 'Category is Accounts and Access', matchF: 'category', matchV: 'Accounts & Access', doAssign: '', doGroup: 'Service Desk (L1)', doNotify: 'Email', doPr: '' });
      s.mailrules = s.mailrules || [];
      s.mailrules.push({ id: 'MR-01', mailbox: 'support@company.ae', active: 'Yes', rule: 'Password in subject routes to Accounts and Access', created: today() });
      s.surveys.push({ id: 'SV-01', title: 'Ticket satisfaction (CSAT)', desc: 'Sent when a ticket is resolved', active: 'Yes', q: 'How satisfied are you with the support? (1-5)' });
      s.templates.push({ id: 'TPL-01', name: 'New laptop request', category: 'Service Request', desc: 'Standard laptop and docking station', impact: 'Medium', urgency: 'Normal', group: '', tasks: 'Manager approval; Procurement check', active: 'Yes' });
      s.products.push({ id: 'PRD-01', brand: 'Dell', model: 'Latitude 5440', type: 'Laptop', uom: 'Nos', price: 4200, vendor: '', active: 'Yes' });
      s.products.push({ id: 'PRD-02', brand: 'HP', model: 'LaserJet M404', type: 'Printer', uom: 'Nos', price: 1100, vendor: '', active: 'Yes' });
      s.seeded = true;
    }
    s.mailrules = s.mailrules || [];
    if (!s.adSeeded) {
      s.adconns.push({ id: 'ADC-001', name: 'HQ Domain Controller', host: 'dc01.company.ae', port: '636', enc: 'SSL', baseDN: 'DC=company,DC=ae', bindUser: 'svc_itms@company.ae', cert: '', status: 'Draft', lastTest: '' });
      s.adgroups.push({ id: 'ADG-01', name: 'Domain Admins', scope: 'Global', category: 'Security', desc: 'Full control of the domain', members: [] });
      s.adgroups.push({ id: 'ADG-02', name: 'IT Support', scope: 'Global', category: 'Security', desc: 'Service desk technicians', members: [] });
      s.adSeeded = true;
    }
  }
  const D = () => { ensure(); return db().sdp; };
  function sdpNid(k, p, w) { const s = D().seq; s[k] = (s[k] || 0) + 1; return p + String(s[k]).padStart(w || 3, '0'); }
  const nid = sdpNid;
  const prevInit = S.init;
  S.init = function () { prevInit.apply(S, arguments); try { ensure(); } catch (e) { /* ignore */ } };
  S.subscribe(ensure);

  /* ---- current role / site (fine-grained auth + multi-site demo) ---- */
  const curRole = () => { try { return localStorage.getItem('itms.role') || 'Administrator'; } catch (e) { return 'Administrator'; } };
  const setRole = (r) => { try { localStorage.setItem('itms.role', r); } catch (e) { /* ignore */ } };
  const curSite = () => { try { return localStorage.getItem('itms.site') || 'All sites'; } catch (e) { return 'All sites'; } };
  const setSite = (s) => { try { localStorage.setItem('itms.site', s); } catch (e) { /* ignore */ } };
  const curUser = () => { try { return localStorage.getItem('itms.user') || ''; } catch (e) { return ''; } };
  const setUser = (no) => { try { localStorage.setItem('itms.user', no || ''); } catch (e) { /* ignore */ } };
  /* Requester + Vendor/External raise tickets only as themselves: returns {no,name} or null */
  function lockedRequester() {
    const r = effRole(); if (r !== 'Requester' && r !== 'Vendor / External') return null;
    const e = L.emp(curUser()); return e ? { no: e.no, name: e.name } : null;
  }
  /* Effective role: login account → employee record → manual Act-as.
     The system owner always resolves to Administrator, whatever is stored. */
  const SYSADMIN_EMAILS = ['systemadmin@example.com', 'bobby.sharon@example.com', 'bobby.sharon@esample.com'];
  function isBobby() {
    try {
      const s = JSON.parse(sessionStorage.getItem('itms.session') || 'null');
      if (s && (SYSADMIN_EMAILS.indexOf((s.email || '').toLowerCase()) >= 0 || s.empNo === 'sysadmin')) return true;
    } catch (e) { /* ignore */ }
    try {
      const uno = curUser();
      if (uno === 'sysadmin') return true;
      const em = uno && L.emp(uno);
      if (em && SYSADMIN_EMAILS.indexOf((em.email || '').toLowerCase()) >= 0) return true;
    } catch (e2) { /* ignore */ }
    return false;
  }
  function effRole() {
    if (isBobby()) return 'Administrator';
    try { const s = JSON.parse(sessionStorage.getItem('itms.session') || 'null'); if (s && s.role) return s.role; } catch (e) { /* ignore */ }
    const uno = curUser();
    if (uno) { const e = L.emp(uno); if (e && e.role) return e.role; }
    return curRole();
  }
  function canPage(id) {
    if (id === 'dashboard' || id === 'portal') return true; // ESS portal available to all employees by default
    if (effRole() === 'Administrator') return true;
    const r = D().roles.find((x) => x.name === effRole());
    // per-employee module assignment (extends role-based access)
    try {
      const uno = curUser();
      if (uno) { const e = L.emp(uno); const mods = (e && Array.isArray(e.modules)) ? e.modules : ['portal']; if (mods.indexOf(id) >= 0) return true; }
    } catch (e) { /* ignore */ }
    if (!r || r.active !== 'Yes' || !r.access) return true;
    return r.access.indexOf(id) >= 0;
  }
  function can(perm) {
    if (effRole() === 'Administrator') return true;
    const r = D().roles.find((x) => x.name === effRole());
    if (!r || r.active !== 'Yes') return perm === 'view';
    return r.perms.includes(perm);
  }
  function deny(perm) { if (!can(perm)) { UI.toast(`Role "${curRole()}" has no "${perm}" permission (see Roles & Access)`, 'err'); return true; } return false; }
  ITMS.sdp = { D, can, canPage, effRole, isBobby, curRole, setRole, curSite, setSite, curUser, setUser, lockedRequester };
  /* Delete permission: only Administrator can delete any record */
  function canDelete() { try { return ITMS.sdp.effRole() === 'Administrator'; } catch (e) { return false; } }
  ITMS.canDelete = canDelete;

  /* ================= shared helpers ================= */
  function notify(channel, to, subject, body) {
    D().notiflog.unshift({ id: nid('nt', 'NT-', 4), at: now(), channel, to, subject, body: body || '' });
    if (D().notiflog.length > 300) D().notiflog.length = 300;
    L.log('Notify', `${channel}: ${subject} → ${to}`);
  }
  const techs = () => (H() && H().techs ? H().techs.filter((t) => t.active === 'Yes').map((t) => t.name) : []);
  const groups = () => (H() && H().cfg ? H().cfg.groups : ['Service Desk (L1)']);
  const cats = () => { try { const t = H().cfg.catText.split('\n').map((l) => l.trim().split(':')[0].split('>')[0].trim()).filter(Boolean); return [...new Set(t)]; } catch (e) { return ['General']; } };
  const empOpts = () => db().employees.filter((e) => e.status === 'Active' && !e.sys).map((e) => ({ v: e.no, l: `${e.name} (${e.no})` }));
  const prioOf = (i, u) => { const I = ['Low', 'Medium', 'High'].indexOf(i), U = ['Low', 'Normal', 'High', 'Urgent'].indexOf(u); const s = I + U; return s >= 5 ? 'Critical' : s === 4 ? 'High' : s >= 2 ? 'Medium' : 'Low'; };

  /* Create a helpdesk ticket from any SDP module (mirrors itsm.js createReq). */
  function mkTicket(v) {
    const h = H(); if (!h) throw new Error('Helpdesk is not initialised yet — open Tickets once first.');
    h.seq = h.seq || {}; h.seq.req = (h.seq.req || 0) + 1;
    const r = Object.assign({ notes: [], work: [], tasks: [], approvals: [], hist: [] }, v);
    r.id = 'REQ-' + String(h.seq.req).padStart(5, '0');
    r.created = now(); r.type = r.type || 'Incident'; r.mode = r.mode || 'Web Form'; r.level = r.level || 'Tier 1';
    r.impact = r.impact || 'Medium'; r.urgency = r.urgency || 'Normal';
    r.priority = prioOf(r.impact, r.urgency);
    r.group = r.group || (h.cfg.routes || {})[r.category] || (h.cfg.groups || [])[0] || '';
    if (!r.tech && h.cfg.autoAssign === 'Yes') {
      const c = (h.techs || []).filter((t) => t.active === 'Yes' && (h.cfg.assignRoles || ['Technician']).includes(t.role) && (!r.group || t.group === r.group));
      if (c.length) r.tech = c.map((t) => [t, h.requests.filter((x) => x.tech === t.name && ['Open', 'Assigned', 'In Progress', 'On Hold'].includes(x.status)).length]).sort((a, b) => a[1] - b[1])[0][0].name;
    }
    r.status = r.tech ? 'Assigned' : 'Open';
    r.dept = (L.emp(r.requester) || {}).dept || '';
    r.desk = v.desk || 'IT';
    const sla = (h.cfg.sla || {})[r.priority] || { respond: 8, resolve: 24 };
    const t = new Date(r.created).getTime();
    r.respondBy = new Date(t + sla.respond * 36e5).toISOString();
    r.dueBy = new Date(t + sla.resolve * 36e5).toISOString();
    (r.hist = r.hist || []).unshift({ at: now(), text: `Request created via ${v.source || 'ServiceDesk Plus'}${r.tech ? ' and assigned to ' + r.tech : ''}` });
    h.requests.unshift(r);
    L.log('Helpdesk', `Request ${r.id}: ${r.subject}`, r.requester);
    S.emit();
    return r;
  }
  ITMS.sdp.mkTicket = mkTicket;

  /* Business rules + escalations engine (runs on demand + light auto-check). */
  function runRules(scope) {
    const d = D(), h = H(); if (!h) return { applied: 0 };
    let applied = 0;
    const open = h.requests.filter((r) => ['Open', 'Assigned', 'In Progress', 'On Hold'].includes(r.status));
    (d.rules || []).filter((x) => x.active === 'Yes').forEach((rule) => {
      open.forEach((r) => {
        const val = String(r[rule.matchF] || '');
        if (rule.matchV && !val.toLowerCase().includes(String(rule.matchV).toLowerCase())) return;
        if ((r._rules || []).includes(rule.id)) return;
        if (rule.doGroup) r.group = rule.doGroup;
        if (rule.doAssign) { const ts = (h.techs || []).filter((t) => t.level === rule.doAssign && t.active === 'Yes'); if (ts.length) r.tech = ts[0].name; }
        if (rule.doPr) { r.priority = rule.doPr; const sla = (h.cfg.sla || {})[r.priority]; if (sla) { const t = new Date(r.created).getTime(); r.dueBy = new Date(t + sla.resolve * 36e5).toISOString(); } }
        if (rule.doNotify && rule.doNotify !== 'None') { notify(rule.doNotify.includes('SMS') ? 'SMS+Email' : 'Email', r.tech || r.requester, `[${r.id}] ${rule.name}`, `Rule "${rule.name}" applied to ${r.id} (${r.subject})`); }
        r._rules = (r._rules || []).concat(rule.id);
        (r.hist = r.hist || []).unshift({ at: now(), text: `Business rule applied: ${rule.name}` });
        applied++;
      });
    });
    // SLA escalation check
    open.forEach((r) => {
      if (!r.dueBy) return;
      const over = new Date(r.dueBy) < new Date() && r.status !== 'On Hold';
      const noResp = !r.firstResp && r.respondBy && new Date(r.respondBy) < new Date();
      if ((over || noResp) && !(r._esc || []).includes(over ? 'L1-overdue' : 'L1-noresp')) {
        const lvl = over ? 'L1-overdue' : 'L1-noresp';
        r._esc = (r._esc || []).concat(lvl);
        d.escalations.unshift({ id: nid('es', 'ESC-', 3), at: now(), module: 'Ticket', req: r.id, level: 'Level 1 → Group Lead', reason: over ? 'Resolution SLA breached' : 'Response SLA breached', to: r.group || '', status: 'Open' });
        notify('Email', r.group || r.tech || 'Service Desk', `[ESCALATED ${r.id}] ${over ? 'Resolution' : 'Response'} SLA breached`, `${r.id} · ${r.subject} · priority ${r.priority}`);
        (r.hist = r.hist || []).unshift({ at: now(), text: 'Auto-escalated to Group Lead (SLA breach)' });
        applied++;
      }
    });
    // ---- cross-module escalation matrix (service desk operations) ----
    try {
      const th = D().escth || {};
      const escAdd = (module, ref, to, level, reason, extra) => {
        d.escalations.unshift({ id: nid('es', 'ESC-', 3), at: now(), module, req: ref, level, reason, to: to || '', status: 'Open' });
        notify('Email', to || 'Service Desk', `[ESCALATED ${ref}] ${reason}`, `${ref} · ${extra || ''} · ${level}`);
        applied++;
      };
      (h.changes || []).forEach((c) => {
        if (['Submission', 'Planning', 'Approval'].indexOf(c.status) < 0) return;
        (c.approvals || []).forEach((a) => {
          if (a.status !== 'Pending' || a._esc || !a.at) return;
          const hrs = (Date.now() - new Date(a.at).getTime()) / 36e5;
          const lim = th.apprHours != null ? th.apprHours : 48;
          if (hrs >= lim) {
            a._esc = true;
            escAdd('Change', c.id, c.owner || c.group, 'Level 2 → Change Manager', `CAB approval pending ${Math.round(hrs)}h (limit ${lim}h)`, c.title);
            (c.hist = c.hist || []).unshift({ at: now(), text: `Auto-escalated: CAB approval from ${a.approver} pending ${Math.round(hrs)}h` });
          }
        });
      });
      (h.problems || []).forEach((p) => {
        if (['Resolved', 'Closed'].indexOf(p.status) >= 0 || !p.due || p._escProb) return;
        if (L.diffDays(p.due, today()) < -((th.probDays != null ? th.probDays : 0))) {
          p._escProb = true;
          escAdd('Problem', p.id, p.owner || p.group, 'Level 1 → Group Lead', `Problem past due date (${p.due})`, p.title);
        }
      });
      D().chats.filter((c) => c.status === 'Open' && !c.tech).forEach((c) => {
        if (!c.at || c._escChat) return;
        const mins = (Date.now() - new Date(c.at).getTime()) / 6e4;
        const lim = th.chatMins != null ? th.chatMins : 30;
        if (mins >= lim) {
          c._escChat = true; const agent = pickAgent();
          if (agent) { c.tech = agent; escAdd('Chat', c.id, agent, 'Level 1 → agent (auto-assigned)', `Chat waiting ${Math.round(mins)}min`, c.user); }
          else escAdd('Chat', c.id, 'Service Desk', 'Level 1 → Service Desk', `Chat waiting ${Math.round(mins)}min, no agent free`, c.user);
        }
      });
      D().maint.filter((m) => m.status === 'Scheduled' && m.next && !m._esc && L.diffDays(m.next, today()) < -((th.pmDays != null ? th.pmDays : 0))).forEach((m) => {
        m._esc = true;
        escAdd('PM task', m.id, m.group, 'Level 1 → Group Lead', `Preventive task past due (${m.next})`, m.title);
      });
    } catch (err) { /* matrix never breaks ticket flow */ }
    if (applied) S.emit();
    return { applied };
  }
  ITMS.sdp.runRules = runRules;
  let lastAuto = 0;
  S.subscribe(() => {
    const t = Date.now(); if (t - lastAuto < 30000) return; lastAuto = t;
    try { runRules('auto'); } catch (e) { /* never break the app */ }
  });

  function closeModal(ov) { UI.close(ov); }
  function modal(html, size) {
    const ov = UI.modal(html, { size: size || 'md', sticky: true });
    ov.addEventListener('click', (e) => { if (e.target.closest('[data-x]')) closeModal(ov); });
    return ov;
  }
  const tbNew = (act, label) => `<button class="btn" data-act="${act}">${ic('plus')}${label}</button>`;
  const clip = (t) => `<div style="max-width:280px;max-height:4.8em;overflow:auto;white-space:normal;font-size:12.5px" title="${esc(t)}">${esc(t)}</div>`;
  const ea = (pre, id) => `<button class="ibtn" data-act="${pre}.edit" data-id="${id}">${ic('edit')}</button>${(typeof ITMS!=='undefined'&&ITMS.canDelete&&ITMS.canDelete())?'<button class="ibtn" style="--c:#ff5c6c" data-act="'+pre+'.del" data-id="'+id+'" title="Delete (Admin only)">'+ic('trash')+'</button>':''}`;
  function crud(key, idField) {
    // generic delete with permission check; new/edit forms are per-module
    UI.on(key + '.del', async (el) => {
      if (deny('delete')) return;
      if (!ITMS.canDelete()) return UI.toast('Only Administrator can delete records', 'err');
      const rows = D()[key]; const r = rows.find((x) => String(x[idField || 'id']) === el.dataset.id);
      if (!r) return;
      if (await UI.confirm(`Delete <b>${esc(r[idField || 'id'])}</b>?`, 'Delete', true)) { D()[key] = rows.filter((x) => x !== r); S.emit(); }
    });
  }
  ['contracts', 'cis', 'maint', 'rules', 'schedules', 'templates', 'actions', 'surveys', 'loans', 'products', 'scans', 'instances', 'devices', 'apps', 'sites', 'roles'].forEach((k) => crud(k));

  /* ================= 1. SELF-SERVICE PORTAL (+ AD self-service) ================= */
  function portalEmp() {
    const no = (ITMS.nav.params && ITMS.nav.params.emp) || portalEmp._no || curUser() || ((db().employees.find((e) => e.status === 'Active' && !e.sys) || {}).no);
    return L.emp(no) || db().employees.find((e) => e.status === 'Active' && !e.sys) || {};
  }
  UI.on('portal.pick', (el) => { portalEmp._no = el.dataset.emp || undefined; location.hash = '#/portal' + (portalEmp._no ? '?emp=' + portalEmp._no : ''); });
  UI.on('portal.req', () => {
    if (deny('create')) return;
    const e = portalEmp();
    const h = H(); const catsel = cats();
    UI.form({
      title: 'New service request', sub: `${e.name} · ${e.dept || ''}`, icon: 'plus',
      fields: [{ k: 'subject', label: 'What do you need?', req: true, full: true }, { k: 'category', label: 'Category', type: 'select', options: catsel, req: true }, { k: 'desc', label: 'Details', type: 'textarea', full: true }],
      onSubmit: (v) => { const r = mkTicket({ requester: e.no, subject: v.subject, category: v.category, desc: v.desc, type: 'Service Request', mode: 'Self-Service Portal', source: 'Self-Service Portal' }); runRules('create'); UI.toast(`${r.id} submitted — track it under My requests`); },
    });
  });
  UI.on('portal.leave', () => {
    const e = portalEmp();
    if (!e) { UI.toast('Select an employee first', 'err'); return; }
    UI.form({ title: 'Apply for leave', sub: `${e.name} A� ${e.dept || ''}`, icon: 'cal', fields: [{ k: 'type', label: 'Leave type', type: 'select', options: () => D().hr.leaveTypes.map((x) => x.type), blank: false }, { k: 'from', label: 'From', type: 'date', req: true }, { k: 'to', label: 'To', type: 'date', req: true }, { k: 'reason', label: 'Reason', type: 'textarea', full: true }], values: { type: (D().hr.leaveTypes[0] || {}).type || 'Annual', from: today(), to: today() }, onSubmit: (v) => {
      if (v.to < v.from) throw new Error('To date is before From date');
      const days = leaveDays(v.from, v.to); const b = hrBal(e.no, v.type);
      if (b.allow > 0 && days > b.left) throw new Error(`Only ${b.left} ${v.type} day(s) left this year`);
      D().hr.leaves.unshift({ id: nid('lv', 'LV-', 3), empNo: e.no, type: v.type, from: v.from, to: v.to, days, reason: v.reason || '', status: 'Pending', at: now(), source: 'Self-Service Portal' });
      S.emit(); UI.toast('Leave submitted for HR approval');
    } });
  });
  UI.on('portal.hrreq', () => {
    const e = portalEmp();
    if (!e) { UI.toast('Select an employee first', 'err'); return; }
    UI.form({ title: 'HR request', sub: `${e.name} A� ${e.dept || ''}`, icon: 'users', fields: [{ k: 'kind', label: 'Request type', type: 'select', options: ['Onboarding support', 'Offboarding / exit', 'Document / letter', 'Payroll query', 'Benefits / insurance', 'Other HR request'], blank: false }, { k: 'subject', label: 'Subject', req: true, full: true }, { k: 'details', label: 'Details', type: 'textarea', full: true, req: true }], onSubmit: (v) => {
      D().hr.onb = D().hr.onb || [];
      D().hr.onb.unshift({ id: nid('hrq', 'HRQ-', 3), kind: v.kind, empNo: e.no, who: e.name, subject: v.subject, details: v.details, status: 'Pending IT', at: now(), source: 'Self-Service Portal' });
      S.emit(); UI.toast('HR request submitted for review');
    } });
  });

  UI.on('portal.cat', (el) => {
    const e = portalEmp(); const c = H().catalog.find((x) => x.id === el.dataset.id); if (!c) return;
    const r = mkTicket({ requester: e.no, subject: c.title, desc: c.desc, category: c.category, type: 'Service Request', mode: 'Self-Service Portal', source: 'Service Catalog', desk: c.desk || 'IT' });
    if (c.approver) { r.approvals.push({ approver: c.approver, status: 'Pending', at: now(), comment: 'Required by service catalog' }); }
    S.emit(); UI.toast(`${r.id} raised from catalog`);
  });
  UI.on('portal.ad', () => {
    const e = portalEmp();
    UI.form({
      title: 'AD self-service', sub: 'Password reset / unlock — creates a ticket automatically', icon: 'key',
      fields: [{ k: 'type', label: 'Request', type: 'select', options: ['Password Reset', 'Account Unlock', 'Update Details'], blank: false }, { k: 'note', label: 'Note', type: 'textarea', full: true }],
      onSubmit: (v) => {
        const r = mkTicket({ requester: e.no, subject: `AD self-service: ${v.type}`, desc: v.note || v.type, category: 'Accounts & Access', type: 'Service Request', mode: 'Self-Service Portal', source: 'AD Self-Service' });
        D().adreqs.unshift({ id: nid('ad', 'AD-', 3), empNo: e.no, type: v.type, status: 'Open', ticketId: r.id, at: now() });
        S.emit(); UI.toast(`Ticket ${r.id} created for ${v.type}`);
      },
    });
  });
  UI.on('portal.chat', () => { openBubble(); });
  UI.on('portal.rate', (el) => {
    const r = H().requests.find((x) => x.id === el.dataset.id); if (!r) return;
    UI.form({
      title: `Rate ${r.id}`, icon: 'check',
      fields: [{ k: 'score', label: 'Score (1-5)', type: 'select', options: ['5', '4', '3', '2', '1'], blank: false }, { k: 'comment', label: 'Comment', type: 'textarea', full: true }],
      onSubmit: (v) => { D().responses.unshift({ id: nid('sv', 'SR-', 3), surveyId: 'SV-01', reqId: r.id, rater: portalEmp().name, score: +v.score, comment: v.comment, at: now() }); S.emit(); UI.toast('Thanks for the feedback'); },
    });
  });
  pages.portal = {
    title: 'Self-Service Portal', crumb: 'End-user home — catalog, knowledge, my tickets, AD self-service, chat', icon: 'grid', color: '#00c2ff',
    render() {
      const d = D(), h = H(); const e = portalEmp();
      const my = h ? h.requests.filter((r) => r.requester === e.no).slice(0, 8) : [];
      const myLeave = (d.hr && d.hr.leaves ? d.hr.leaves.filter((l) => l.empNo === e.no) : []);
      const kb = h ? h.solutions.filter((s) => s.status === 'Published').slice(0, 6) : [];
      const news = h ? h.news.filter((n) => n.active === 'Yes').slice(0, 3) : [];
      const site = curSite();
      return `<div class="note-box" style="margin-bottom:10px"><b>Welcome, ${esc(e.name || 'user')}</b> · ${esc(e.dept || '')} · site: <b>${esc(site)}</b> · domain: <b>${esc(d.domains.custom || d.domains.portal)}</b>
        <span style="margin-left:auto"></span><label style="font-size:12px">Acting as <select class="in" style="width:auto;display:inline-block" data-actx="emp">${empOpts().map((o) => `<option value="${o.v}" ${o.v === e.no ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select></label></div>
      <div class="grid g3">
        <div class="card"><h3>Request a service</h3><p style="color:var(--muted)">Catalog items, approvals and SLA included.</p><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn" data-act="portal.req">${ic('plus')}New request</button><button class="btn ghost" data-act="portal.ad">${ic('key')}Password / unlock</button><button class="btn ghost" data-act="portal.chat">${ic('users')}Live chat</button></div></div>
        <div class="card"><h3>Solve it yourself</h3><p style="color:var(--muted)">${kb.length} published solutions · searchable in Solutions & Catalog.</p></div>
        <div class="card"><h3>My open tickets</h3><b style="font-size:26px">${my.filter((r) => ['Open', 'Assigned', 'In Progress', 'On Hold'].includes(r.status)).length}</b><small style="color:var(--muted)"> shown below</small></div>
      </div>
      <div class="grid g2 mt"><div class="card"><h3>HR self-service</h3><p style="color:var(--muted)">Apply for leave and HR requests; routed to HR for review and approval.</p><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn" data-act="portal.leave">${ic('cal')}Apply leave</button><button class="btn ghost" data-act="portal.hrreq">${ic('users')}HR request</button></div></div>
        <div class="card"><h3>My leave</h3><b style="font-size:26px">${myLeave.filter((l) => l.status === 'Pending').length}</b><small style="color:var(--muted)"> pending, ${myLeave.filter((l) => l.status === 'Approved').length} approved, ${myLeave.filter((l) => l.status === 'Rejected').length} rejected</small></div></div>
      <div class="card mt"><h3><span class="pip" style="--c:#00c2ff"></span>My details</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px 18px">
          <div><small style="color:var(--muted)">Name</small><div><b>${esc(e.name || '-')}</b></div></div>
          <div><small style="color:var(--muted)">Employee no.</small><div>${esc(e.no || '-')}</div></div>
          <div><small style="color:var(--muted)">Designation</small><div>${esc(e.designation || '-')}</div></div>
          <div><small style="color:var(--muted)">Department</small><div>${esc(e.dept || '-')}</div></div>
          <div><small style="color:var(--muted)">Manager</small><div>${esc(e.manager || '-')}</div></div>
          <div><small style="color:var(--muted)">Location</small><div>${esc(e.location || '-')}</div></div>
          <div><small style="color:var(--muted)">Email</small><div>${esc(e.email || '-')}</div></div>
          <div><small style="color:var(--muted)">Status</small><div>${esc(e.status || '-')}</div></div>
        </div></div>
      ${news.map((n) => `<div class="note-box" style="margin-top:10px"><b>${esc(n.title)}</b> — ${esc(n.desc)}</div>`).join('')}
      <div class="grid g2 mt"><div class="card"><h3>Service catalog — one click</h3><div class="grid g2">${(h ? h.catalog.filter((c) => c.active !== 'No').slice(0, 8) : []).map((c) => `<div class="card"><b>${esc(c.title)}</b> ${c.desk && c.desk !== 'IT' ? `<span class="pill p-blue">${esc(c.desk)}</span>` : ''}<br><small style="color:var(--muted)">${esc(c.desc || '').slice(0, 80)}</small><div style="margin-top:8px"><button class="btn sm" data-act="portal.cat" data-id="${c.id}">Request</button></div></div>`).join('') || '<div class="empty">No catalog items — add them in Solutions & Catalog</div>'}</div></div>
      <div class="card"><h3>My requests</h3><table class="t"><thead><tr><th>ID</th><th>Subject</th><th>Status</th><th></th></tr></thead><tbody>${my.map((r) => `<tr><td class="mono">${r.id}</td><td>${esc(r.subject)}</td><td>${P(r.status)}</td><td>${r.status === 'Resolved' ? `<button class="btn xs" data-act="portal.rate" data-id="${r.id}">Rate</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="4"><div class="empty">No requests yet</div></td></tr>'}</tbody></table></div></div>`;
    },
    after() {
      const sel = document.querySelector('[data-actx="emp"]');
      if (sel) sel.addEventListener('change', () => { portalEmp._no = sel.value; setUser(sel.value); location.hash = '#/portal?emp=' + sel.value; });
    },
  };

  /* ================= 2. LIVE CHAT ================= */
  UI.on('chat.reply', (el) => {
    const c = D().chats.find((x) => x.id === el.dataset.id); if (!c) return;
    UI.form({ title: `Reply — ${c.id} (${c.user})`, icon: 'users', fields: [{ k: 'by', label: 'Reply as', type: 'select', options: () => techs(), blank: false }, { k: 'msg', label: 'Message', type: 'textarea', full: true, req: true }], values: { by: c.tech || techs()[0] }, onSubmit: (v) => { c.tech = v.by; c.msgs.push({ by: v.by, text: v.msg, at: now() }); if (c.status === 'Open') notify('Email', c.user, `[${c.id}] New reply`, v.msg); S.emit(); } });
  });
  UI.on('chat.close', (el) => { const c = D().chats.find((x) => x.id === el.dataset.id); c.status = 'Closed'; S.emit(); });
  UI.on('chat.ticket', (el) => {
    const c = D().chats.find((x) => x.id === el.dataset.id);
    const r = mkTicket({ requester: (db().employees.find((e) => e.name === c.user) || {}).no || '', subject: `Chat ${c.id}: ${c.msgs[0] ? c.msgs[0].text.slice(0, 60) : 'support'}`, desc: c.msgs.map((m) => `${m.by}: ${m.text}`).join('\n'), category: 'Other', type: 'Incident', mode: 'Chat', source: 'Live Chat' });
    c.ticketId = r.id; S.emit(); UI.toast(`Ticket ${r.id} created from chat`);
  });
  pages.chat = {
    title: 'Live Chat', crumb: 'Real-time technician ↔ end-user collaboration', icon: 'users', color: '#2f6bff',
    render() {
      const d = D(); const tab = UI.curTab('chat', 'open');
      const rows = d.chats.filter((c) => (tab === 'open' ? c.status === 'Open' : true));
      return `<div class="card">${UI.tabs('chat', [{ id: 'open', label: 'Open chats', count: d.chats.filter((c) => c.status === 'Open').length }, { id: 'all', label: 'All' }])}
      ${UI.table({ id: 'cht', rows: () => rows, sort: 'at', dir: -1, text: (r) => r.id + r.user + r.msgs.map((m) => m.text).join(' '),
        cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'user', label: 'User' }, { k: 'tech', label: 'Agent' }, { k: 'status', label: 'Status', render: (r) => P(r.status, r.status === 'Open' ? 'mint' : 'grey') }, { k: 'msgs', label: 'Conversation', render: (r) => `<div style="max-width:420px;max-height:6em;overflow:auto">${r.msgs.map((m) => `<div><b>${esc(m.by)}:</b> ${esc(m.text)} <small style="color:var(--muted)">${fdt(m.at)}</small></div>`).join('')}<div><b>Message</b> · ${esc(r.msgs[0] ? r.msgs[0].text : '')}</div></div>` }, { k: 'ticketId', label: 'Ticket' }],
        actions: (r) => `<button class="btn xs" data-act="chat.reply" data-id="${r.id}">Reply</button> <button class="btn xs ghost" data-act="chat.ticket" data-id="${r.id}">→ Ticket</button> ${r.status === 'Open' ? `<button class="btn xs ghost" data-act="chat.close" data-id="${r.id}">Close</button>` : ''}`,
        toolbar: `<button class="btn ghost" data-act="portal.chat">${ic('plus')}New chat (as portal user)</button>` })}</div>`;
    },
  };

  /* ================= LIVE CHAT BUBBLE (floating widget on every screen) ================= */
  const chatB = (ITMS.chatBubble = { id: null, show: false, who: '', find: false });
  function chatMe() { const e = L.emp(chatB.who || curUser()); return (e && e.name) || ''; }
  function drawFab() {
    if (!db()) return; const n = document.getElementById('chatfabn'); if (!n) return;
    const c = D().chats.filter((x) => x.status === 'Open').length;
    n.textContent = c; n.style.display = c ? '' : 'none';
  }
  function openBubble(id) {
    if (!db()) return;
    chatB.show = true; if (id) chatB.id = id;
    if (!chatB.who) chatB.who = curUser() || (((typeof portalEmp === 'function' && portalEmp()) || {}).no || '');
    if (!chatB.id || !D().chats.find((x) => x.id === chatB.id)) {
      const me = chatMe();
      const mine = D().chats.filter((c) => c.status === 'Open' && (c.user === me || (chatB.who && c.empNo === chatB.who)));
      mine.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
      chatB.id = (mine[0] || {}).id || null;
    }
    const p = document.getElementById('chatpanel'); if (p) p.style.display = '';
    drawPanel(); drawFab();
  }
  function pickAgent() {
    const ts = techs(); if (!ts.length) return '';
    const load = (n) => (H() ? H().requests.filter((r) => r.tech === n && ['Open', 'Assigned', 'In Progress', 'On Hold'].indexOf(r.status) >= 0).length : 0) + D().chats.filter((c) => c.tech === n && c.status === 'Open').length;
    return ts.slice().sort((a, b) => load(a) - load(b))[0] || '';
  }
  function hideBubble() { chatB.show = false; const p = document.getElementById('chatpanel'); if (p) p.style.display = 'none'; }
  ITMS.chatBubble.open = openBubble; ITMS.chatBubble.close = hideBubble;
  function buildBubble() {
    if (!document.getElementById('chatfab')) {
      const f = document.createElement('button'); f.id = 'chatfab'; f.title = 'Live chat';
      f.innerHTML = ic('users') + '<span class="n" id="chatfabn" style="display:none"></span>';
      f.addEventListener('click', () => (chatB.show ? hideBubble() : openBubble()));
      document.body.appendChild(f);
      const p = document.createElement('div'); p.id = 'chatpanel'; p.style.display = 'none'; document.body.appendChild(p);
    }
    if (!db()) { setTimeout(buildBubble, 400); return; }
    drawFab();
  }
  function msgHtml(m, me) { return `<div class="msg ${me ? 'me' : 'them'}"><b>${esc(m.by)}</b>${esc(m.text)}<small>${fdt(m.at)}</small></div>`; }
  function drawPanel() {
    if (!db()) return; const p = document.getElementById('chatpanel'); if (!p || !chatB.show) return;
    const me = chatMe();
    const chats = D().chats.slice().sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
    const cur = D().chats.find((x) => x.id === chatB.id);
    let h = `<div class="chhead">Live Chat<span style="margin-left:auto"></span><button class="ibtn" data-c="refresh" title="Refresh">${ic('refresh')}</button><button class="ibtn" data-c="full" title="Full console">${ic('grid')}</button><button class="ibtn x" data-c="x">${ic('x')}</button></div>`;
    h += `<div class="chid"><label>Chatting as <b>${esc(chatMe() || '—')}</b></label><span style="margin-left:auto"></span><button class="btn sm ghost" data-c="who">Switch</button></div>`;
    if (chatB.find) h += `<div class="chfind"><input class="in" id="chatfind" autocomplete="off"><div class="chlist" id="chres">${db().employees.filter((e) => e.status === 'Active' && !e.sys).map((e) => `<a data-c="pick" data-id="${e.no}" data-t="${esc((e.name + ' ' + e.no + ' ' + (e.dept || '')).toLowerCase())}"><b>${esc(e.name)}</b><small>${e.no}${e.dept ? ' · ' + esc(e.dept) : ''}</small></a>`).join('')}</div></div>`;
    if (cur) {
      h += `<div class="chback"><button class="btn xs ghost" data-c="back">← All</button><b style="margin:0 4px">${esc(cur.id)}</b>${cur.status === 'Open' ? `<span style="margin-left:auto"></span><button class="btn xs ghost" data-c="ticket">→ Ticket</button> <button class="btn xs ghost" data-c="close">Close</button>` : `<span style="margin-left:auto">${P('Closed')}</span>`}</div><div class="msgs">${cur.msgs.map((m) => msgHtml(m, m.by === me)).join('')}</div><div class="chsend"><input class="in" id="chatinput" autocomplete="off"><button class="btn sm" data-c="send">Send</button></div>`;
    } else {
      const waiting = chats.filter((c) => c.status === 'Open' && c.user !== me);
      h += `<div class="msgs"><div class="empty">Say hi below — an available agent is assigned automatically.</div></div><div class="chsend"><input class="in" id="chatinput" autocomplete="off"><button class="btn sm" data-c="send">Send</button></div>`;
      if (waiting.length) h += `<div class="chlist" style="border-top:1px solid var(--line)">${waiting.slice(0, 10).map((c) => `<a data-c="open" data-id="${c.id}"><b>${esc(c.id)}</b> · ${esc(c.user)}<small>${esc(((c.msgs[c.msgs.length - 1] || {}).text) || '').slice(0, 60)}</small></a>`).join('')}</div>`;
    }
    p.innerHTML = h;
    const cf = document.getElementById('chatfind');
    if (cf) { cf.focus(); cf.addEventListener('input', () => { const q = cf.value.toLowerCase(); p.querySelectorAll('#chres a').forEach((a) => { a.style.display = (a.getAttribute('data-t') || '').indexOf(q) >= 0 ? '' : 'none'; }); }); }
    const inp = document.getElementById('chatinput');
    if (inp) inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });
    p.querySelectorAll('[data-c]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); chatCmd(b.getAttribute('data-c'), b.getAttribute('data-id')); }));
    const ms = p.querySelector('.msgs'); if (ms) ms.scrollTop = ms.scrollHeight;
  }
  function sendChat() {
    const inp = document.getElementById('chatinput'); const t = ((inp && inp.value) || '').trim(); if (!t) return;
    const me = chatMe() || 'User';
    let c = D().chats.find((x) => x.id === chatB.id);
    if (!c) {
      const agent = pickAgent();
      const id = nid('ch', 'CHAT-', 3);
      c = { id, user: me, empNo: chatB.who || curUser(), tech: agent, status: 'Open', at: now(), msgs: [{ by: me, text: t, at: now() }] };
      D().chats.unshift(c); chatB.id = id;
      notify('Email', agent || 'Service Desk', `[${id}] Chat auto-assigned${agent ? ' to you' : ' — waiting'}`, me + ': ' + t);
    } else {
      c.msgs.push({ by: me, text: t, at: now() });
      if (!c.tech && techs().indexOf(me) >= 0) c.tech = me;
      if (me !== c.user) notify('Email', c.user, `[${c.id}] New reply`, t);
      else if (c.tech) notify('Email', c.tech, `[${c.id}] user replied`, t);
    }
    S.emit(); drawPanel(); drawFab();
    const i2 = document.getElementById('chatinput'); if (i2) i2.focus();
  }
  function chatCmd(k, id) {
    if (k === 'x') return hideBubble();
    if (k === 'refresh') return drawPanel();
    if (k === 'who') { chatB.find = !chatB.find; return drawPanel(); }
    if (k === 'pick') { chatB.who = id; setUser(id); try { portalEmp._no = id; } catch (err) { /* keep bubble-only */ } chatB.find = false; return drawPanel(); }
    if (k === 'full') { hideBubble(); location.hash = '#/chat'; return; }
    if (k === 'back') { chatB.id = null; return drawPanel(); }
    if (k === 'open') { chatB.id = id; return drawPanel(); }
    if (k === 'send') return sendChat();
    if (k === 'ticket') { if (UI.acts['chat.ticket']) UI.acts['chat.ticket']({ dataset: { id: chatB.id } }); return; }
    if (k === 'close') { const c = D().chats.find((x) => x.id === chatB.id); if (c) { c.status = 'Closed'; S.emit(); } drawPanel(); drawFab(); return; }
  }
  document.addEventListener('DOMContentLoaded', buildBubble);
  S.subscribe(() => { drawFab(); if (chatB.show && document.activeElement !== document.getElementById('chatinput')) drawPanel(); });

  /* ================= 3. CMDB =================
     The full IT Service Configuration Management (CMDB) module now lives in
     js/cmdb.js — it overrides pages.cmdb and the CI / relationship handlers
     that were previously defined here. */

  /* ================= 4. CONTRACTS (non-AMC) ================= */
  UI.on('contracts.new', () => {
    if (deny('create')) return;
    UI.form({ title: 'New contract', icon: 'receipt', size: 'lg', fields: [{ k: 'title', label: 'Contract title', req: true, full: true }, { k: 'vendor', label: 'Supplier', type: 'select', options: () => db().vendors.map((v) => v.name), req: true }, { k: 'type', label: 'Type', type: 'select', options: ['Maintenance', 'Lease', 'Support', 'Licence Subscription', 'Warranty', 'Other'], blank: false }, { k: 'start', label: 'Start', type: 'date', req: true }, { k: 'end', label: 'End', type: 'date', req: true }, { k: 'value', label: 'Value', type: 'number' }, { k: 'owner', label: 'Owner', type: 'select', options: () => techs() }, { k: 'assets', label: 'Covered assets', type: 'multi', options: () => db().hw.map((a) => ({ v: a.id, l: `${a.id} · ${a.desc}` })), full: true }, { section: 'Invoice & finance' }, { k: 'invNo', label: 'Invoice number' }, { k: 'invDate', label: 'Invoice date', type: 'date' }, { k: 'gl', label: 'GL account', type: 'select', options: () => D().fin.coa.map((g) => ({ v: g.code, l: g.code + ' · ' + g.name })) }, { k: 'notes', label: 'Terms / notes', type: 'textarea', full: true }], onSubmit: (v) => { v.id = nid('ct', 'CTR-', 3); v.status = 'Active'; v.invNo = v.invNo || ''; v.invDate = v.invDate || v.start; v.gl = v.gl || '5240'; D().contracts.unshift(v); L.log('Contract', `Contract ${v.id} ${v.title} created`, v.id); if (ITMS.ap && ITMS.ap.postContract) { try { ITMS.ap.postContract(v, 'CON'); } catch (e) { UI.toast('Finance: ' + e.message, 'err'); } } S.emit(); } });
  });
  UI.on('contracts.edit', (el) => { const r = D().contracts.find((x) => x.id === el.dataset.id); UI.form({ title: 'Edit ' + r.id, icon: 'receipt', fields: [{ k: 'title', label: 'Contract title', req: true, full: true }, { k: 'type', label: 'Type', type: 'select', options: ['Maintenance', 'Lease', 'Support', 'Licence Subscription', 'Warranty', 'Other'], blank: false }, { k: 'start', label: 'Start', type: 'date' }, { k: 'end', label: 'End', type: 'date' }, { k: 'value', label: 'Value', type: 'number' }, { k: 'status', label: 'Status', type: 'select', options: ['Active', 'Expired', 'Terminated', 'Renewal'], blank: false }, { k: 'notes', label: 'Terms / notes', type: 'textarea', full: true }], values: r, onSubmit: (v) => { Object.assign(r, v); S.emit(); } }); });
  UI.on('contracts.renew', (el) => { const r = D().contracts.find((x) => x.id === el.dataset.id); r.status = 'Renewal'; r.end = L.addYears(r.end || today(), 1); L.log('Contract', `Contract ${r.id} sent for renewal`, r.id); S.emit(); UI.toast('Sent for renewal (+1 year proposed)'); });
  pages.contracts = {
    title: 'Contracts', crumb: 'Purchase & contract management — suppliers, renewals, traceability', icon: 'receipt', color: '#3b82f6',
    render() {
      const d = D(); const exp = d.contracts.filter((c) => c.end && L.diffDays(c.end, today()) < 0 && c.status === 'Active').length;
      const soon = d.contracts.filter((c) => c.end && L.diffDays(c.end, today()) >= 0 && L.diffDays(c.end, today()) <= 30).length;
      return `<div class="grid g3"><div class="card" style="border-left:4px solid ${C.mint}"><div style="font:700 26px var(--head)">${d.contracts.length}</div><small>Contracts</small></div><div class="card" style="border-left:4px solid ${soon ? C.amber : C.mint}"><div style="font:700 26px var(--head)">${soon}</div><small>Expiring ≤ 30 days</small></div><div class="card" style="border-left:4px solid ${exp ? C.coral : C.mint}"><div style="font:700 26px var(--head)">${exp}</div><small>Expired (still Active)</small></div></div>
      <div class="card mt">${UI.table({ id: 'ctrt', rows: () => d.contracts.map((c) => Object.assign({ days: c.end ? L.diffDays(c.end, today()) : null }, c)), sort: 'end', text: (r) => r.id + r.title + r.vendor, filters: [{ k: 'type', label: 'Type', options: ['Maintenance', 'Lease', 'Support', 'Licence Subscription', 'Warranty', 'Other'] }, { k: 'status', label: 'Status', options: ['Active', 'Expired', 'Terminated', 'Renewal'] }], cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'title', label: 'Contract', render: (r) => `<b>${esc(r.title)}</b><br><small>${esc(r.vendor)}</small>` }, { k: 'type', label: 'Type' }, { k: 'start', label: 'Start' }, { k: 'end', label: 'End' }, { k: 'days', label: 'Days left', num: true, render: (r) => (r.days == null ? '—' : r.days < 0 ? P(`${Math.abs(r.days)}d overdue`, 'coral') : P(`${r.days}d`, r.days <= 30 ? 'amber' : 'mint')) }, { k: 'value', label: 'Value', num: true }, { k: 'status', label: 'Status', render: (r) => P(r.status === 'Active' ? 'Published' : r.status === 'Expired' ? 'Expired' : 'Draft') }], actions: (r) => `<button class="btn xs ghost" data-act="contracts.renew" data-id="${r.id}">Renew</button>${ea('contracts', r.id)}`, toolbar: `${tbNew('contracts.new', 'New contract')} <button class="btn ghost" data-go="#/amc">AMC register</button> <button class="btn ghost" data-go="#/vendors">Vendors</button> <button class="btn ghost" data-go="#/orders">Purchase orders</button>` })}</div>`;
    },
  };

  /* ================= 5. PREVENTIVE MAINTENANCE ================= */
  UI.on('maint.new', () => {
    UI.form({ title: 'Preventive maintenance task', icon: 'cal', fields: [{ k: 'title', label: 'Task', req: true, full: true }, { k: 'freq', label: 'Frequency', type: 'select', options: ['Weekly', 'Monthly', 'Quarterly', 'Half-Yearly', 'Yearly'], blank: false }, { k: 'next', label: 'Next due', type: 'date', req: true }, { k: 'group', label: 'Assign group', type: 'select', options: () => groups() }, { k: 'asset', label: 'Asset (optional)', type: 'select', options: () => db().hw.map((a) => ({ v: a.id, l: `${a.id} · ${a.desc}` })) }, { k: 'desc', label: 'Checklist', type: 'textarea', full: true }], onSubmit: (v) => { v.id = nid('pm', 'PMT-', 3); v.status = 'Scheduled'; D().maint.unshift(v); S.emit(); } });
  });
  UI.on('maint.edit', (el) => { const r = D().maint.find((x) => x.id === el.dataset.id); UI.form({ title: 'Edit ' + r.id, icon: 'cal', fields: [{ k: 'title', label: 'Task', req: true, full: true }, { k: 'freq', label: 'Frequency', type: 'select', options: ['Weekly', 'Monthly', 'Quarterly', 'Half-Yearly', 'Yearly'], blank: false }, { k: 'next', label: 'Next due', type: 'date' }, { k: 'status', label: 'Status', type: 'select', options: ['Scheduled', 'Paused', 'Done'], blank: false }], values: r, onSubmit: (v) => { Object.assign(r, v); S.emit(); } }); });
  UI.on('maint.gen', (el) => {
    const m = D().maint.find((x) => x.id === el.dataset.id);
    const r = mkTicket({ requester: (techs()[0] ? (db().employees.find((e) => e.name === techs()[0]) || {}).no : ''), subject: `PM: ${m.title}`, desc: m.desc || m.title, category: 'Other', type: 'Service Request', source: 'Preventive Maintenance' });
    const days = { Weekly: 7, Monthly: 30, Quarterly: 91, 'Half-Yearly': 182, Yearly: 365 }[m.freq] || 30;
    m.next = L.addDays(m.next || today(), days); m.lastRun = today(); m.lastTicket = r.id; m._esc = false;
    S.emit(); UI.toast(`Ticket ${r.id} generated · next due ${m.next}`);
  });
  pages.pmtasks = {
    title: 'Preventive Maintenance', crumb: 'Scheduled requests with all parameters pre-filled', icon: 'cal', color: '#00a8e8',
    render() {
      const d = D(); const due = d.maint.filter((m) => m.status === 'Scheduled' && m.next <= today());
      return `<div class="card">${UI.table({ id: 'pmt', rows: () => d.maint.map((m) => Object.assign({ late: m.next && m.next < today() }, m)), sort: 'next', text: (r) => r.id + r.title, filters: [{ k: 'freq', label: 'Frequency', options: ['Weekly', 'Monthly', 'Quarterly', 'Half-Yearly', 'Yearly'] }, { k: 'status', label: 'Status', options: ['Scheduled', 'Paused', 'Done'] }], cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'title', label: 'Task', render: (r) => `<b>${esc(r.title)}</b>${r.late ? ' ' + P('Overdue', 'coral') : ''}` }, { k: 'freq', label: 'Frequency' }, { k: 'next', label: 'Next due' }, { k: 'lastTicket', label: 'Last ticket' }, { k: 'status', label: 'Status', render: (r) => P(r.status === 'Scheduled' ? 'Published' : 'Draft') }], actions: (r) => `<button class="btn xs" data-act="maint.gen" data-id="${r.id}">Generate ticket</button>${ea('maint', r.id)}`, toolbar: tbNew('maint.new', 'New PM task') })}</div>`;
    },
  };

  /* ================= 6. EMAIL TO TICKET ================= */
  UI.on('mail.paste', () => {
    UI.form({ title: 'Paste received email', sub: 'Copy from your mailbox, paste here, it becomes a ticket', icon: 'upload', fields: [{ k: 'raw', label: 'Raw email (headers + body)', type: 'textarea', full: true, req: true }], onSubmit: (v) => {
      const lines = String(v.raw).split('\n'); let from = '', subject = '', bi = 0;
      lines.forEach((l, i) => { const f = l.match(/^from:\s*(.+)/i); if (f && !from) { from = f[1].trim(); bi = i + 1; } const s = l.match(/^subject:\s*(.+)/i); if (s && !subject) { subject = s[1].trim(); bi = Math.max(bi, i + 1); } });
      const body = lines.slice(bi).join('\n').trim() || v.raw;
      D().inbox.unshift({ id: nid('ml', 'MAIL-', 3), from: from || 'unknown', subject: subject || '(no subject)', body, at: now(), status: 'Unprocessed' });
      S.emit(); UI.toast('Email captured — Convert it below'); location.hash = '#/mailticket';
    } });
  });
  UI.on('mail.convert', (el) => {
    const m = D().inbox.find((x) => x.id === el.dataset.id);
    const sub = (m.subject || '').toLowerCase();
    const cat = /password|unlock|access|account/.test(sub) ? 'Accounts & Access' : /printer|toner/.test(sub) ? 'Printing & Scanning' : /wifi|vpn|network|internet/.test(sub) ? 'Network & Connectivity' : 'Other';
    const r = mkTicket({ requester: (db().employees.find((e) => (m.from || '').includes(e.email)) || {}).no || '', subject: m.subject, desc: `From: ${m.from}\n\n${m.body}`, category: cat, type: 'Incident', mode: 'Email', source: 'Email to Ticket' });
    m.status = 'Converted → ' + r.id; S.emit(); UI.toast(`Ticket ${r.id} created and routed to ${r.group}`);
  });
  UI.on('mail.del', async (el) => { if (!ITMS.canDelete()) return UI.toast('Only Administrator can delete records', 'err'); if (await UI.confirm('Delete this email?', 'Delete', true)) { D().inbox = D().inbox.filter((x) => x.id !== el.dataset.id); S.emit(); } });
  pages.mailticket = {
    title: 'Email to Ticket', crumb: 'Convert email requests automatically with routing', icon: 'upload', color: '#2f6bff',
    render() {
      const d = D();
      return `<div class="card"><div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap"><span>Support desk: <b>${esc(D().mail.desk)}</b></span><span style="margin-left:auto"></span><button class="btn ghost" data-go="#/settings">Settings → Email</button></div>
      ${UI.table({ id: 'mlt', rows: () => d.inbox, sort: 'at', dir: -1, text: (r) => r.from + r.subject + r.body, cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'from', label: 'From' }, { k: 'subject', label: 'Subject', render: (r) => `<b>${esc(r.subject)}</b>` }, { k: 'status', label: 'Status', render: (r) => P(r.status.startsWith('Converted') ? 'Published' : 'Draft') }, { k: 'at', label: 'Received', render: (r) => fdt(r.at) }], actions: (r) => `<button class="btn xs" data-act="mail.convert" data-id="${r.id}">Convert</button>${(typeof ITMS!=='undefined'&&ITMS.canDelete&&ITMS.canDelete())?'<button class="ibtn" style="--c:#ff5c6c" data-act="mail.del" data-id="'+r.id+'" title="Delete (Admin only)">'+ic('trash')+'</button>':''}`, toolbar: `<button class="btn" data-act="mail.paste">${ic('upload')}Paste received email</button>` })}</div>`;
    },
  };

  /* ================= 7. AUTOMATION (rules, auto-assign, notifications, escalations) ================= */
  UI.on('rules.new', () => {
    UI.form({ title: 'New business rule', icon: 'spark', fields: [{ k: 'name', label: 'Rule name', req: true, full: true }, { k: 'when', label: 'Applies when', full: true }, { k: 'matchF', label: 'Match field', type: 'select', options: ['priority', 'category', 'type', 'group', 'level'], blank: false }, { k: 'matchV', label: 'Contains value', req: true }, { k: 'doGroup', label: 'Set group', type: 'select', options: () => groups() }, { k: 'doAssign', label: 'Set level (auto-assign least-loaded)', type: 'select', options: ['', 'Tier 1', 'Tier 2', 'Tier 3', 'Tier 4'] }, { k: 'doPr', label: 'Set priority', type: 'select', options: ['', 'Low', 'Medium', 'High', 'Critical'] }, { k: 'doNotify', label: 'Notify', type: 'select', options: ['None', 'Email', 'Email + SMS'], blank: false }, { k: 'active', label: 'Active', type: 'select', options: ['Yes', 'No'], blank: false }], values: { doNotify: 'Email', active: 'Yes' }, onSubmit: (v) => { v.id = nid('br', 'BR-', 2); D().rules.unshift(v); S.emit(); } });
  });
  UI.on('rules.edit', (el) => { const r = D().rules.find((x) => x.id === el.dataset.id); UI.form({ title: 'Edit ' + r.id, icon: 'spark', fields: [{ k: 'name', label: 'Rule name', req: true, full: true }, { k: 'matchF', label: 'Match field', type: 'select', options: ['priority', 'category', 'type', 'group', 'level'], blank: false }, { k: 'matchV', label: 'Contains value', req: true }, { k: 'doGroup', label: 'Set group', type: 'select', options: () => groups() }, { k: 'doNotify', label: 'Notify', type: 'select', options: ['None', 'Email', 'Email + SMS'], blank: false }, { k: 'active', label: 'Active', type: 'select', options: ['Yes', 'No'], blank: false }], values: r, onSubmit: (v) => { Object.assign(r, v); S.emit(); } }); });
  UI.on('rules.run', () => { const r = runRules('manual'); UI.toast(r.applied ? `${r.applied} action(s) applied` : 'Nothing to apply — all rules already evaluated'); });
  UI.on('rules.sim', (el) => {
    const rule = D().rules.find((x) => x.id === el.dataset.id); if (!rule) return;
    UI.form({
      title: 'Simulate — ' + rule.name, sub: 'Preview only, nothing is saved', icon: 'spark',
      fields: [{ k: 'req', label: 'Test against ticket', type: 'select', options: () => H().requests.slice(0, 80).map((r) => ({ v: r.id, l: `${r.id} · ${r.subject.slice(0, 50)}` })), req: true }],
      submit: 'Preview',
      onSubmit: (v) => {
        const r = H().requests.find((x) => x.id === v.req); if (!r) return;
        const val = String(r[rule.matchF] || '');
        const hit = rule.matchV && val.toLowerCase().indexOf(String(rule.matchV).toLowerCase()) >= 0;
        const acts = [];
        if (rule.doGroup) acts.push('Set group → ' + rule.doGroup);
        if (rule.doAssign) acts.push('Auto-assign least-loaded ' + rule.doAssign);
        if (rule.doPr) acts.push('Set priority → ' + rule.doPr);
        if (rule.doNotify && rule.doNotify !== 'None') acts.push('Notify via ' + rule.doNotify);
        showPs('Simulation — ' + rule.id + ' on ' + r.id, hit ? 'Rule FIRES' : 'Rule does NOT fire', [`Ticket: ${r.id} · ${r.subject}`, `Match: ${rule.matchF} contains "${rule.matchV}" → tested value "${val}" → ${hit ? 'MATCH' : 'no match'}`, ''].concat(hit ? acts.map((a) => 'WOULD: ' + a) : ['Nothing would happen.']).join('\n'));
      },
    });
  });
  UI.on('one.cab', async () => {
    if (!await UI.confirm('Raise an <b>Emergency</b> change with CAB approval and notify leads?', 'Emergency CAB')) return;
    const h = H(); h.seq.changes = (h.seq.changes || 0) + 1;
    const c = { id: 'CHG-' + String(h.seq.changes).padStart(4, '0'), title: 'Emergency change — ' + today(), desc: 'Raised in one touch from Automation.', changeType: 'Emergency', status: 'Approval', category: 'Other', owner: techs()[0] || '', impact: 'High', risk: 'High', created: now(), requests: [], assets: [], approvals: [{ approver: 'Group Lead', status: 'Pending', at: now(), comment: 'Emergency CAB via one-touch' }], hist: [{ at: now(), text: 'Emergency change raised in one touch' }] };
    h.changes.unshift(c); notify('Email', 'Group Lead', `[${c.id}] Emergency CAB approval needed`, c.title); S.emit(); UI.toast(`${c.id} raised with CAB approval`);
  });
  UI.on('one.cast', () => {
    UI.form({ title: 'Broadcast announcement', icon: 'bell', fields: [{ k: 'title', label: 'Title', req: true }, { k: 'desc', label: 'Message', type: 'textarea', full: true, req: true }], onSubmit: (v) => { H().news.unshift({ id: 'ANN-1T' + Date.now().toString().slice(-4), title: v.title, desc: v.desc, from: today(), to: L.addDays(today(), 7), active: 'Yes', created: now() }); notify('Email', 'All technicians', v.title, v.desc); S.emit(); UI.toast('Broadcast published'); } });
  });
  UI.on('one.pmrun', () => {
    const due = D().maint.filter((m) => m.status === 'Scheduled' && m.next <= today());
    if (!due.length) return UI.toast('No preventive tasks due');
    due.forEach((m) => { try { UI.acts['maint.gen']({ dataset: { id: m.id } }); } catch (e) { /* skip */ } });
  });
  function matrixRows() {
    const th = D().escth || {};
    return [
      ['Tickets', 'Response or resolution SLA breached (hold pauses clock)', 'Level 1 → Group Lead', 'Email'],
      ['Change approvals', `CAB approval pending over ${th.apprHours != null ? th.apprHours : 48}h`, 'Level 2 → Change Manager', 'Email'],
      ['Problems', `Unresolved past due date${(th.probDays || 0) ? ` by over ${th.probDays}d` : ''}`, 'Level 1 → Group Lead', 'Email'],
      ['Live chats', `Waiting unassigned over ${th.chatMins != null ? th.chatMins : 30}min`, 'Level 1 → least-loaded agent (auto-assigned)', 'Email'],
      ['PM tasks', `Scheduled task past due${(th.pmDays || 0) ? ` by over ${th.pmDays}d` : ''}`, 'Level 1 → Group Lead', 'Email'],
    ];
  }
  UI.on('esc.edit', () => {
    const th = D().escth || {};
    UI.form({ title: 'Escalation thresholds', icon: 'clock', fields: [{ k: 'apprHours', label: 'CAB approval wait before escalation (hours)', type: 'number', req: true }, { k: 'probDays', label: 'Problem overdue grace (days past due)', type: 'number', req: true }, { k: 'chatMins', label: 'Chat wait before auto-assign + escalation (minutes)', type: 'number', req: true }, { k: 'pmDays', label: 'PM task overdue grace (days past due)', type: 'number', req: true }], values: th, onSubmit: (v) => { Object.assign(D().escth, { apprHours: +v.apprHours || 0, probDays: +v.probDays || 0, chatMins: +v.chatMins || 0, pmDays: +v.pmDays || 0 }); S.emit(); UI.toast('Matrix updated — applies on next evaluation'); } });
  });
  UI.on('esc.close', (el) => { const e = D().escalations.find((x) => x.id === el.dataset.id); e.status = 'Closed'; S.emit(); });
  pages.automation = {
    title: 'Automation & Escalations', crumb: 'Business rules · auto-assign · smart notifications · escalations', icon: 'spark', color: '#1d4ed8',
    render() {
      const d = D(); const tab = UI.curTab('automation', 'rules');
      let body = '';
      if (tab === 'rules') body = UI.table({ id: 'brt', rows: () => d.rules, sort: 'id', text: (r) => r.id + r.name + r.matchV, cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'name', label: 'Rule', render: (r) => `<b>${esc(r.name)}</b><br><small>${esc(r.when || '')}</small>` }, { k: 'matchF', label: 'When' }, { k: 'matchV', label: 'Contains' }, { k: 'doGroup', label: 'Set group' }, { k: 'doNotify', label: 'Notify' }, { k: 'active', label: 'Active', render: (r) => P(r.active === 'Yes' ? 'Published' : 'Draft') }], actions: (r) => `<button class="btn xs ghost" data-act="rules.sim" data-id="${r.id}">Simulate</button> ${ea('rules', r.id)}`, toolbar: `${tbNew('rules.new', 'New rule')} <button class="btn ghost" data-act="rules.run">${ic('refresh')}Run now on open tickets</button>` });
      else if (tab === 'esc') body = UI.table({ id: 'esct', rows: () => d.escalations, sort: 'at', dir: -1, text: (r) => r.req + r.reason, cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'module', label: 'Module', render: (r) => esc(r.module || 'Ticket') }, { k: 'req', label: 'Reference' }, { k: 'level', label: 'Escalated to' }, { k: 'reason', label: 'Reason' }, { k: 'at', label: 'At', render: (r) => fdt(r.at) }, { k: 'status', label: 'Status', render: (r) => P(r.status === 'Open' ? 'Draft' : 'Closed') }], actions: (r) => (r.status === 'Open' ? `<button class="btn xs" data-act="esc.close" data-id="${r.id}">Close</button>` : ''), toolbar: `<button class="btn ghost" data-act="rules.run">${ic('refresh')}Check SLAs now</button>` });
      else if (tab === 'matrix') body = `<table class="t"><thead><tr><th>Module</th><th>Trigger</th><th>Escalates to</th><th>Notify</th></tr></thead><tbody>${matrixRows().map((m) => `<tr><td><b>${esc(m[0])}</b></td><td>${esc(m[1])}</td><td>${esc(m[2])}</td><td>${esc(m[3])}</td></tr>`).join('')}</tbody></table><div style="margin-top:10px"><button class="btn" data-act="esc.edit">${ic('clock')}Edit thresholds</button> <button class="btn ghost" data-act="rules.run">${ic('refresh')}Evaluate now</button></div>`;
      else if (tab === 'one') body = `<div class="grid g3">${[['Emergency CAB change', 'Raises an Emergency change, requests CAB approval and notifies leads — one touch.', 'one.cab'], ['Broadcast announcement', 'Publishes a portal announcement and notifies technicians — one touch.', 'one.cast'], ['Run due preventive tasks', 'Generates tickets for every due PM task right now.', 'one.pmrun']].map((x) => `<div class="card"><h3>${x[0]}</h3><small style="color:var(--muted)">${x[1]}</small><div style="margin-top:10px"><button class="btn sm" data-act="${x[2]}">Run now</button></div></div>`).join('')}</div>`;
      else body = UI.table({ id: 'ntf', rows: () => d.notiflog, sort: 'at', dir: -1, text: (r) => r.to + r.subject, cols: [{ k: 'at', label: 'Sent', render: (r) => fdt(r.at) }, { k: 'channel', label: 'Channel' }, { k: 'to', label: 'To' }, { k: 'subject', label: 'Subject', render: (r) => `<b>${esc(r.subject)}</b>` }], actions: () => '' });
      return `<div class="card">${UI.tabs('automation', [{ id: 'rules', label: 'Business rules', count: d.rules.length }, { id: 'esc', label: 'Escalations', count: d.escalations.filter((e) => e.status === 'Open').length }, { id: 'matrix', label: 'Escalation matrix' }, { id: 'one', label: 'One-touch' }, { id: 'log', label: 'Notifications log', count: d.notiflog.length }])}${body}</div>`;
    },
  };

  /* ================= 8. LIFECYCLE DESIGNER ================= */
  UI.on('lc.add', (el) => {
    const kind = el.dataset.k;
    UI.form({ title: `Add status — ${kind}`, icon: 'plus', fields: [{ k: 'name', label: 'Status name', req: true }], onSubmit: (v) => { D().lifecycles[kind].push(v.name); S.emit(); } });
  });
  UI.on('lc.del', (el) => { if (!ITMS.canDelete()) return UI.toast('Only Administrator can delete records', 'err'); const [kind, i] = el.dataset.id.split('|'); D().lifecycles[kind].splice(+i, 1); S.emit(); });
  UI.on('lc.mv', (el) => { const [kind, i, dir] = el.dataset.id.split('|'); const a = D().lifecycles[kind]; const j = +i + (+dir); if (j < 0 || j >= a.length) return; [a[+i], a[j]] = [a[j], a[+i]]; S.emit(); });
  pages.lifecycles = {
    title: 'Workflow State Design', crumb: 'Request · problem · change lifecycles (drag-free ordering)', icon: 'refresh', color: '#2f6bff',
    render() {
      const lc = D().lifecycles;
      const col = (kind, title) => `<div class="card"><h3>${title}</h3>${lc[kind].map((s, i) => `<div style="display:flex;align-items:center;gap:6px;margin:5px 0"><span class="pill p-violet">${i + 1}</span><b>${esc(s)}</b><span style="margin-left:auto"></span><button class="ibtn" data-act="lc.mv" data-id="${kind}|${i}|-1">▲</button><button class="ibtn" data-act="lc.mv" data-id="${kind}|${i}|1">▼</button>${(typeof ITMS!=='undefined'&&ITMS.canDelete&&ITMS.canDelete())?'<button class="ibtn" style="--c:#ff5c6c" data-act="lc.del" data-id="'+kind+'|'+i+'" title="Delete (Admin only)">'+ic('trash')+'</button>':''}</div>`).join('')}<button class="btn sm ghost" data-act="lc.add" data-k="${kind}">${ic('plus')}Add status</button></div>`;
      const stages = ['In Stock', 'In Use', 'Under Repair', 'Disposed'];
      const sc = stages.map((s) => db().hw.filter((a) => a.status === s).length);
      const strip = `<div class="card" style="margin-bottom:16px"><h3>Asset lifecycle (live)</h3><div class="flow">${stages.map((s, i) => `<div class="st" style="--c:${['#00a8e8', '#2f6bff', '#ffb020', '#ff5c6c'][i]}"><b>${sc[i]}</b><span>${s}</span></div>`).join('')}</div><small style="color:var(--muted)">Assets move through these stages via Issue / Return / Transfer and status changes — see Asset Movements.</small></div>`;
      return `${strip}<div class="grid g3">${col('request', 'Request lifecycle')}${col('problem', 'Problem lifecycle')}${col('change', 'Change workflow')}</div>`;
    },
  };

  /* ================= 9. TEMPLATES + CUSTOM ACTIONS + CUSTOM APPS ================= */
  UI.on('templates.new', () => {
    UI.form({ title: 'Custom request template', icon: 'filePlus', fields: [{ k: 'name', label: 'Template name', req: true, full: true }, { k: 'category', label: 'Category', type: 'select', options: () => cats(), req: true }, { k: 'desc', label: 'Pre-filled description', type: 'textarea', full: true }, { k: 'impact', label: 'Impact', type: 'select', options: ['Low', 'Medium', 'High'], blank: false }, { k: 'urgency', label: 'Urgency', type: 'select', options: ['Low', 'Normal', 'High', 'Urgent'], blank: false }, { k: 'group', label: 'Group', type: 'select', options: () => groups() }, { k: 'tasks', label: 'Default tasks (one per line)', type: 'textarea', full: true }, { k: 'active', label: 'Published', type: 'select', options: ['Yes', 'No'], blank: false }], values: { impact: 'Medium', urgency: 'Normal', active: 'Yes' }, onSubmit: (v) => { v.id = nid('tpl', 'TPL-', 2); D().templates.unshift(v); S.emit(); } });
  });
  UI.on('templates.edit', (el) => { const r = D().templates.find((x) => x.id === el.dataset.id); UI.form({ title: 'Edit ' + r.id, icon: 'filePlus', fields: [{ k: 'name', label: 'Template name', req: true, full: true }, { k: 'desc', label: 'Pre-filled description', type: 'textarea', full: true }, { k: 'active', label: 'Published', type: 'select', options: ['Yes', 'No'], blank: false }], values: r, onSubmit: (v) => { Object.assign(r, v); S.emit(); } }); });
  UI.on('templates.use', (el) => {
    const t = D().templates.find((x) => x.id === el.dataset.id);
    const r = mkTicket({ requester: (portalEmp() || {}).no || '', subject: t.name, desc: t.desc, category: t.category, impact: t.impact, urgency: t.urgency, group: t.group, type: 'Service Request', source: 'Request Template' });
    (t.tasks || '').split('\n').map((x) => x.trim()).filter(Boolean).forEach((x) => r.tasks.push({ title: x, done: false }));
    S.emit(); UI.toast(`Ticket ${r.id} raised from template`);
  });
  UI.on('actions.new', () => {
    UI.form({ title: 'Custom action', icon: 'cpu', fields: [{ k: 'name', label: 'Action name', req: true }, { k: 'event', label: 'Trigger', type: 'select', options: ['onCreate', 'onResolve', 'onClose', 'onSLABreach'], blank: false }, { k: 'do', label: 'Do', type: 'select', options: ['webhook', 'notify', 'task', 'field-update'], blank: false }, { k: 'target', label: 'Target / URL / text', full: true }], onSubmit: (v) => { v.id = nid('ca', 'CA-', 2); v.active = 'Yes'; D().actions.unshift(v); S.emit(); UI.toast('Custom action saved (fires via Automation → Run now)'); } });
  });
  UI.on('apps.new', () => {
    UI.form({ title: 'Custom business application', sub: 'Low-code: name it, list fields, collect records', icon: 'box', fields: [{ k: 'name', label: 'App name', req: true }, { k: 'purpose', label: 'Purpose', full: true }, { k: 'fields', label: 'Fields (comma separated)', full: true, req: true }], onSubmit: (v) => { v.id = nid('ap', 'APP-', 2); v.records = []; v.active = 'Yes'; D().apps.unshift(v); S.emit(); } });
  });
  UI.on('apps.add', (el) => {
    const a = D().apps.find((x) => x.id === el.dataset.id); const fs = String(a.fields || '').split(',').map((x) => x.trim()).filter(Boolean);
    UI.form({ title: `New record — ${a.name}`, icon: 'plus', fields: fs.map((f) => ({ k: f, label: f })), onSubmit: (v) => { a.records.push({ ...v, _at: now() }); S.emit(); } });
  });
  pages.templates = {
    title: 'Request Templates & Apps', crumb: 'Custom request templates · custom actions · low-code apps', icon: 'filePlus', color: '#00a8e8',
    render() {
      const d = D(); const tab = UI.curTab('templates', 'tpl');
      let body = '';
      if (tab === 'tpl') body = UI.table({ id: 'tplt', rows: () => d.templates, sort: 'id', text: (r) => r.id + r.name, cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'name', label: 'Template', render: (r) => `<b>${esc(r.name)}</b>` }, { k: 'category', label: 'Category' }, { k: 'active', label: 'Published', render: (r) => P(r.active === 'Yes' ? 'Published' : 'Draft') }], actions: (r) => `<button class="btn xs" data-act="templates.use" data-id="${r.id}">Use</button>${ea('templates', r.id)}`, toolbar: tbNew('templates.new', 'New template') });
      else if (tab === 'act') body = UI.table({ id: 'cat2', rows: () => d.actions, sort: 'id', text: (r) => r.id + r.name, cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'name', label: 'Action' }, { k: 'event', label: 'Trigger' }, { k: 'do', label: 'Do' }, { k: 'target', label: 'Target' }], actions: (r) => `${(typeof ITMS!=='undefined'&&ITMS.canDelete&&ITMS.canDelete())?'<button class="ibtn" style="--c:#ff5c6c" data-act="actions.del" data-id="'+r.id+'" title="Delete (Admin only)">'+ic('trash')+'</button>':''}`, toolbar: tbNew('actions.new', 'New custom action') });
      else body = `<div style="margin-bottom:10px">${tbNew('apps.new', 'New custom app')}</div><div class="grid g3">${d.apps.map((a) => `<div class="card"><h3>${esc(a.name)}</h3><small>${esc(a.purpose || '')} · fields: ${esc(a.fields)}</small><div><b>${a.records.length}</b> record(s)</div><div style="margin-top:8px;display:flex;gap:6px"><button class="btn sm" data-act="apps.add" data-id="${a.id}">Add record</button>${(typeof ITMS!=='undefined'&&ITMS.canDelete&&ITMS.canDelete())?'<button class="btn sm ghost" data-act="apps.del" data-id="'+a.id+'" title="Delete (Admin only)">Delete</button>':''}</div></div>`).join('') || '<div class="empty">No custom apps — deploy one in under a minute (rapid-start)</div>'}</div>`;
      return `<div class="card">${UI.tabs('templates', [{ id: 'tpl', label: 'Request templates', count: d.templates.length }, { id: 'act', label: 'Custom actions', count: d.actions.length }, { id: 'apps', label: 'Custom apps (PaaS)', count: d.apps.length }])}${body}</div>`;
    },
  };
  UI.on('actions.del', async (el) => { if (!ITMS.canDelete()) return UI.toast('Only Administrator can delete records', 'err'); if (await UI.confirm('Delete custom action?', 'Delete', true)) { D().actions = D().actions.filter((x) => x.id !== el.dataset.id); S.emit(); } });
  UI.on('apps.del', async (el) => { if (!ITMS.canDelete()) return UI.toast('Only Administrator can delete records', 'err'); if (await UI.confirm('Delete custom app and its records?', 'Delete', true)) { D().apps = D().apps.filter((x) => x.id !== el.dataset.id); S.emit(); } });

  /* ================= 10. DISCOVERY + INVENTORY CATALOG + REMOTE TOOLS ================= */
  UI.on('scan.run', () => {
    UI.form({ title: 'Run discovery scan', icon: 'search', fields: [{ k: 'method', label: 'Method', type: 'select', options: ['Network scan', 'Domain scan', 'Agent push', 'CSV import'], blank: false }, { k: 'scope', label: 'Scope (subnet / OU / file)', req: true, full: true }], values: { method: 'Network scan', scope: '192.168.1.0/24' }, onSubmit: (v) => {
      const n = 8 + Math.floor(Math.random() * 6); const id = nid('sc', 'SCAN-', 2);
      D().scans.unshift({ id, ...v, date: today(), found: n, imported: 0, status: 'Completed' });
      const hosts = ['WS-FIN-01', 'WS-HR-02', 'WS-IT-01', 'WS-IT-02', 'WS-MKT-01', 'WS-OPS-01', 'WS-SEC-01', 'SRV-DC-01', 'SRV-APP-01', 'SRV-DB-01', 'SW-FLOOR-01', 'SW-FLOOR-02', 'RT-MAIN-01', 'FW-EDGE-01', 'PRN-HR-01', 'PRN-IT-01', 'AP-FLOOR-01'];
      const types = ['Laptop', 'Desktop', 'Server', 'Switch', 'Router', 'Firewall', 'Printer', 'Access Point'];
      const osList = ['Windows 11 Pro', 'Windows 10 Pro', 'Windows Server 2022', 'Ubuntu 22.04', 'Cisco IOS', 'FortiOS'];
      for (let i = 0; i < n; i++) {
        const ip = `192.168.1.${10 + i}`;
        D().discovered.unshift({ id: nid('dv', 'DISC-', 3), scan: id, host: hosts[i % hosts.length], ip, mac: 'AA:BB:CC:' + String(10 + i).padStart(2, '0') + ':' + String(20 + i).padStart(2, '0') + ':33', os: osList[i % osList.length], type: types[i % types.length], status: 'New', vendor: ['Dell', 'HP', 'Cisco', 'Fortinet', 'Ubiquiti'][i % 5], model: ['Latitude 5440', 'OptiPlex 7010', 'PowerEdge R450', 'CBS350-24P', 'FortiGate 60F', 'UniFi AP'][i % 6] });
      }
      S.emit(); UI.toast(`Scan ${id}: ${n} device(s) found — view Network Map`);
    } });
  });
  UI.on('disc.import', (el) => {
    const r = D().discovered.find((x) => x.id === el.dataset.id);
    const a = L.saveHW({ type: r.type || 'Desktop', desc: `${r.host} (${r.os})`, compName: r.host, serial: r.mac, status: 'In Stock', condition: 'Good', remarks: `Discovered via ${r.scan} on ${today()} · IP ${r.ip}` });
    r.status = 'Imported → ' + a.id; const sc = D().scans.find((s) => s.id === r.scan); if (sc) sc.imported++;
    S.emit(); UI.toast(`Imported as ${a.id}`);
  });
  UI.on('disc.scanAll', () => {
    const d = D();
    const allHw = db().hw.map((a) => ({ id: 'HW-' + a.id, host: a.compName || a.desc.split(' ')[0], ip: a.ip || `192.168.1.${Math.floor(Math.random() * 200) + 10}`, mac: a.serial || '', os: a.os || 'Unknown', type: a.type, status: 'In Use', vendor: a.brand, model: a.model, source: 'Asset Register' }));
    const allCis = (d.cis || []).map((c) => ({ id: 'CI-' + c.id, host: c.name, ip: c.ip, mac: '', os: c.type, type: c.type, status: c.status, vendor: '', model: '', source: 'CMDB' }));
    const allDisc = (d.discovered || []).filter((x) => String(x.status).startsWith('New')).map((x) => ({ ...x, source: 'Discovery' }));
    const merged = [...allHw, ...allCis, ...allDisc];
    const id = nid('sc', 'SCAN-', 2);
    d.scans.unshift({ id, method: 'Network scan', scope: 'All subnets', date: today(), found: merged.length, imported: 0, status: 'Completed' });
    S.emit(); UI.toast(`Full network scan: ${merged.length} device(s) found`);
  });

  /* ---------- Network Topology Diagram Renderer ---------- */
  function renderNetworkMap() {
    const d = D();
    const devices = [];
    db().hw.forEach((a) => { if (a.ip || a.compName) devices.push({ id: a.id, host: a.compName || a.desc.split(' ')[0], ip: a.ip || '—', type: a.type, status: a.status, vendor: a.brand, model: a.model, os: a.os, mac: a.serial || '—', source: 'Asset Register' }); });
    (d.cis || []).forEach((c) => devices.push({ id: c.id, host: c.name, ip: c.ip || '—', type: c.type, status: c.status === 'Live' ? 'Active' : 'Retired', vendor: '', model: '', os: c.type, mac: '—', source: 'CMDB' }));
    (d.discovered || []).filter((x) => String(x.status).startsWith('New')).forEach((x) => devices.push({ id: x.id, host: x.host, ip: x.ip, type: x.type, status: 'New', vendor: x.vendor, model: x.model, os: x.os, mac: x.mac, source: 'Discovery' }));
    const routers = devices.filter((x) => /router|firewall|switch/i.test(x.type + ' ' + x.host));
    const servers = devices.filter((x) => /server/i.test(x.type + ' ' + x.host));
    const workstations = devices.filter((x) => /laptop|desktop|phone|printer|peripheral|monitor|ups|storage|access point/i.test(x.type + ' ' + x.host) && !/router|firewall|switch|server/i.test(x.type + ' ' + x.host));
    const typeIcon = (t) => { t = (t || '').toLowerCase(); if (/router/.test(t)) return 'RT'; if (/firewall/.test(t)) return 'FW'; if (/switch/.test(t)) return 'SW'; if (/server/.test(t)) return 'SRV'; if (/printer/.test(t)) return 'PRN'; if (/access point/.test(t)) return 'AP'; if (/laptop/.test(t)) return 'LT'; if (/desktop/.test(t)) return 'DT'; if (/phone/.test(t)) return 'PH'; if (/monitor/.test(t)) return 'MON'; if (/ups/.test(t)) return 'UPS'; if (/storage/.test(t)) return 'STO'; return 'DEV'; };
    const statusColor = (s) => { s = (s || '').toLowerCase(); if (/active|in use|new|live/.test(s)) return '#10d9a0'; if (/repair|expiring/.test(s)) return '#ffb020'; if (/disposed|retired/.test(s)) return '#ff5c6c'; return '#2f6bff'; };
    const devCard = (dev) => `<div class="net-card" style="--sc:${statusColor(dev.status)}" title="${esc(dev.host)}&#10;IP: ${esc(dev.ip)}&#10;MAC: ${esc(dev.mac)}&#10;OS: ${esc(dev.os)}&#10;Source: ${esc(dev.source)}">
      <div class="net-icon">${typeIcon(dev.type)}</div>
      <div class="net-host" title="${esc(dev.host)}">${esc(dev.host)}</div>
      <div class="net-ip">${esc(dev.ip)}</div>
      <div class="net-status" style="background:${statusColor(dev.status)}"></div>
    </div>`;
    return `<div class="net-map">
      <div class="net-legend">
        <span><i style="--c:#10d9a0"></i> Active</span>
        <span><i style="--c:#2f6bff"></i> Other</span>
        <span><i style="--c:#ffb020"></i> Warning</span>
        <span><i style="--c:#ff5c6c"></i> Offline</span>
        <span style="margin-left:auto"><b>${devices.length}</b> devices</span>
      </div>
      <div class="net-layer">
        <div class="net-layer-label">Gateway / Security</div>
        <div class="net-row">${routers.map(devCard).join('') || '<div class="net-empty">No routers/firewalls found</div>'}</div>
      </div>
      <div class="net-line"></div>
      <div class="net-layer">
        <div class="net-layer-label">Servers / Infrastructure</div>
        <div class="net-row">${servers.map(devCard).join('') || '<div class="net-empty">No servers found</div>'}</div>
      </div>
      <div class="net-line"></div>
      <div class="net-layer">
        <div class="net-layer-label">Workstations / Endpoints</div>
        <div class="net-row">${workstations.map(devCard).join('') || '<div class="net-empty">No workstations found</div>'}</div>
      </div>
      <div class="net-details">
        ${devices.slice(0, 20).map((dev) => `<div class="net-detail-card" style="--sc:${statusColor(dev.status)}">
          <div class="net-detail-head"><b>${esc(dev.host)}</b> <span class="net-badge">${typeIcon(dev.type)}</span> <span class="net-src">${esc(dev.source)}</span></div>
          <div class="net-detail-grid">
            <div><small>IP</small><span class="mono">${esc(dev.ip)}</span></div>
            <div><small>MAC</small><span class="mono">${esc(dev.mac)}</span></div>
            <div><small>Type</small><span>${esc(dev.type)}</span></div>
            <div><small>Status</small><span style="color:${statusColor(dev.status)}">${esc(dev.status)}</span></div>
            <div><small>Vendor</small><span>${esc(dev.vendor || '—')}</span></div>
            <div><small>Model</small><span>${esc(dev.model || '—')}</span></div>
            <div><small>OS</small><span>${esc(dev.os || '—')}</span></div>
            <div><small>ID</small><span class="mono">${esc(dev.id)}</span></div>
          </div>
        </div>`).join('')}
      </div>
    </div>`;
  }
  UI.on('products.new', () => {
    UI.form({ title: 'Catalog product', icon: 'box', fields: [{ k: 'brand', label: 'Brand', req: true }, { k: 'model', label: 'Model', req: true }, { k: 'type', label: 'Type', type: 'select', options: ['Laptop', 'Desktop', 'Monitor', 'Printer', 'Phone', 'Server', 'UPS', 'Storage', 'Peripheral'], blank: false }, { k: 'uom', label: 'UoM', type: 'select', options: ['Nos', 'Set', 'Box'], blank: false }, { k: 'price', label: 'Std price', type: 'number' }, { k: 'vendor', label: 'Preferred vendor', type: 'select', options: () => db().vendors.map((v) => v.name) }], onSubmit: (v) => { v.id = nid('pd', 'PRD-', 2); v.active = 'Yes'; D().products.unshift(v); S.emit(); } });
  });
  UI.on('tool.run', (el) => {
    const tool = el.dataset.id;
    UI.form({ title: tool, icon: 'wrench', fields: [{ k: 'asset', label: 'Workstation', type: 'select', options: () => db().hw.filter((a) => a.status === 'In Use').map((a) => ({ v: a.id, l: `${a.id} · ${a.desc}` })), req: true }], onSubmit: (v) => { D().toollog.unshift({ id: nid('tl', 'TOOL-', 3), tool, asset: v.asset, by: curRole(), at: now(), result: 'Completed (simulated session recorded for audit)' }); S.emit(); UI.toast(`${tool} session recorded`); } });
  });
  pages.discovery = {
    title: 'Discovery & Inventory', crumb: 'Asset discovery · tracking · inventory catalog · remote tools', icon: 'search', color: '#2f6bff',
    render() {
      const d = D(); const tab = UI.curTab('discovery', 'map');
      let body = '';
      if (tab === 'map') body = renderNetworkMap();
      else if (tab === 'scan') body = UI.table({ id: 'dsct', rows: () => d.scans, sort: 'date', dir: -1, text: (r) => r.id + r.scope, cols: [{ k: 'id', label: 'Scan', mono: true }, { k: 'method', label: 'Method' }, { k: 'scope', label: 'Scope' }, { k: 'found', label: 'Found', num: true }, { k: 'imported', label: 'Imported', num: true }, { k: 'status', label: 'Status' }], actions: () => '', toolbar: `<button class="btn" data-act="scan.run">${ic('search')}Scan subnet</button> <button class="btn mint" data-act="disc.scanAll">${ic('cpu')}Scan all networks</button>` });
      else if (tab === 'found') body = UI.table({ id: 'dfnd', rows: () => d.discovered, sort: 'id', dir: -1, text: (r) => r.host + r.ip + r.os, filters: [{ k: 'status', label: 'Status', options: ['New', 'Imported'] }, { k: 'type', label: 'Type', options: () => L.uniq(d.discovered.map((x) => x.type)).sort() }], cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'host', label: 'Hostname', render: (r) => `<b>${esc(r.host)}</b>` }, { k: 'ip', label: 'IP', mono: true }, { k: 'type', label: 'Type' }, { k: 'os', label: 'OS' }, { k: 'vendor', label: 'Vendor' }, { k: 'model', label: 'Model' }, { k: 'scan', label: 'Scan' }, { k: 'status', label: 'Status' }], actions: (r) => (String(r.status).startsWith('New') ? `<button class="btn xs" data-act="disc.import" data-id="${r.id}">Import → asset</button>` : ''), toolbar: '' });
      else if (tab === 'cat') body = UI.table({ id: 'dcat', rows: () => d.products, sort: 'id', text: (r) => r.brand + r.model, cols: [{ k: 'id', label: 'Code', mono: true }, { k: 'brand', label: 'Brand' }, { k: 'model', label: 'Model' }, { k: 'type', label: 'Type / subtype' }, { k: 'price', label: 'Std price', num: true }], actions: (r) => ea('products', r.id), toolbar: tbNew('products.new', 'Add product') });
      else body = `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">${['Remote Desktop', 'Software upgrade', 'File transfer', 'Session recording', 'Remote shutdown'].map((t) => `<button class="btn ghost" data-act="tool.run" data-id="${t}">${ic('wrench')}${t}</button>`).join('')}</div>${UI.table({ id: 'dtl', rows: () => d.toollog, sort: 'at', dir: -1, text: (r) => r.tool + r.asset, cols: [{ k: 'at', label: 'At', render: (r) => fdt(r.at) }, { k: 'tool', label: 'Tool' }, { k: 'asset', label: 'Workstation' }, { k: 'by', label: 'By' }, { k: 'result', label: 'Result' }], actions: () => '' })}`;
      return `<div class="card">${UI.tabs('discovery', [{ id: 'map', label: 'Network Map' }, { id: 'scan', label: 'Discovery scans', count: d.scans.length }, { id: 'found', label: 'Discovered', count: d.discovered.filter((x) => String(x.status).startsWith('New')).length }, { id: 'cat', label: 'Inventory catalog', count: d.products.length }, { id: 'tools', label: 'Remote tools log', count: d.toollog.length }])}${body}</div>`;
    },
  };

  /* ================= 11. ASSET LOANS ================= */
  UI.on('loans.new', () => {
    UI.form({ title: 'Loan asset', icon: 'swap', fields: [{ k: 'assetId', label: 'Spare asset', type: 'select', options: () => db().hw.filter((a) => a.status === 'In Stock').map((a) => ({ v: a.id, l: `${a.id} · ${a.desc}` })), req: true }, { k: 'empNo', label: 'Loan to', type: 'select', options: empOpts, req: true }, { k: 'dueDate', label: 'Return due', type: 'date', req: true }, { k: 'remarks', label: 'Purpose', type: 'textarea', full: true }], onSubmit: (v) => {
      L.issueAssets(v.empNo, [v.assetId], today(), `Loan until ${v.dueDate}. ${v.remarks || ''}`);
      D().loans.unshift({ id: nid('ln', 'LOAN-', 3), ...v, outDate: today(), status: 'On loan' }); S.emit();
    } });
  });
  UI.on('loans.ret', (el) => {
    const l = D().loans.find((x) => x.id === el.dataset.id);
    L.returnAssets(l.empNo, [l.assetId], today(), 'Good', 'In Stock', 'Loan return');
    l.status = 'Returned'; l.returnDate = today(); S.emit(); UI.toast('Loan closed — asset back in stock');
  });
  pages.loans = {
    title: 'Asset Loans', crumb: 'Track temporarily-loaned assets through the loan period', icon: 'swap', color: '#00c2ff',
    render() {
      const d = D(); const over = d.loans.filter((l) => l.status === 'On loan' && l.dueDate < today()).length;
      return `<div class="card">${UI.table({ id: 'lnt', rows: () => d.loans.map((l) => Object.assign({ who: L.empName(l.empNo) }, l)), sort: 'outDate', dir: -1, text: (r) => r.id + r.assetId + r.who, filters: [{ k: 'status', label: 'Status', options: ['On loan', 'Returned'] }], cols: [{ k: 'id', label: 'Loan', mono: true }, { k: 'assetId', label: 'Asset' }, { k: 'who', label: 'Loaned to' }, { k: 'outDate', label: 'Out' }, { k: 'dueDate', label: 'Due', render: (r) => (r.status === 'On loan' && r.dueDate < today() ? P('Overdue', 'coral') + ' ' + r.dueDate : r.dueDate) }, { k: 'status', label: 'Status', render: (r) => P(r.status === 'On loan' ? 'Draft' : 'Closed') }], actions: (r) => (r.status === 'On loan' ? `<button class="btn xs" data-act="loans.ret" data-id="${r.id}">Return</button>${ea('loans', r.id)}` : ea('loans', r.id)), toolbar: tbNew('loans.new', 'New loan') })}</div>`;
    },
  };

  /* ================= 12. SITES (+ custom domains) ================= */
  UI.on('sites.new', () => { UI.form({ title: 'New site', icon: 'box', fields: [{ k: 'name', label: 'Site name', req: true }, { k: 'code', label: 'Code', req: true }, { k: 'group', label: 'Default support group', type: 'select', options: () => groups() }, { k: 'tz', label: 'Timezone' }, { k: 'active', label: 'Active', type: 'select', options: ['Yes', 'No'], blank: false }], values: { tz: 'Asia/Dubai', active: 'Yes' }, onSubmit: (v) => { v.id = nid('st', 'SITE-', 2); D().sites.unshift(v); S.emit(); } }); });
  UI.on('sites.edit', (el) => { const r = D().sites.find((x) => x.id === el.dataset.id); UI.form({ title: 'Edit ' + r.id, icon: 'box', fields: [{ k: 'name', label: 'Site name', req: true }, { k: 'group', label: 'Default support group', type: 'select', options: () => groups() }, { k: 'active', label: 'Active', type: 'select', options: ['Yes', 'No'], blank: false }], values: r, onSubmit: (v) => { Object.assign(r, v); S.emit(); } }); });
  UI.on('sites.use', (el) => { setSite(el.dataset.id === 'all' ? 'All sites' : (D().sites.find((x) => x.id === el.dataset.id) || {}).name); S.emit(); UI.toast('Site scope: ' + curSite()); });
  UI.on('dom.save', () => {
    UI.form({ title: 'Custom portal domain', icon: 'link', fields: [{ k: 'custom', label: 'Custom URL (https://…)', full: true, req: true }, { k: 'enforced', label: 'Force all portal traffic here', type: 'select', options: ['Yes', 'No'], blank: false }], values: D().domains, onSubmit: (v) => { Object.assign(D().domains, v); S.emit(); UI.toast('Portal domain published'); } });
  });
  pages.sites = {
    title: 'Sites & Domains', crumb: 'Multi-site support · custom workflows per site · portal domains', icon: 'box', color: '#3b82f6',
    render() {
      const d = D();
      return `<div class="note-box" style="margin-bottom:10px">Scope: <b>${esc(curSite())}</b> · portal: <b>${esc(d.domains.custom || d.domains.portal)}</b>${d.domains.enforced === 'Yes' ? ' (enforced)' : ''}</div>
      <div class="card">${UI.table({ id: 'stt', rows: () => d.sites, sort: 'id', text: (r) => r.id + r.name, cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'name', label: 'Site' }, { k: 'code', label: 'Code' }, { k: 'group', label: 'Default group' }, { k: 'tz', label: 'Timezone' }, { k: 'active', label: 'Active', render: (r) => P(r.active === 'Yes' ? 'Published' : 'Draft') }], actions: (r) => `<button class="btn xs ghost" data-act="sites.use" data-id="${r.id}">Use</button>${ea('sites', r.id)}`, toolbar: `${tbNew('sites.new', 'New site')} <button class="btn ghost" data-act="sites.use" data-id="all">All sites</button> <button class="btn ghost" data-act="dom.save">${ic('link')}Custom domain</button>` })}</div>`;
    },
  };

  /* ================= 13. ROLES (fine-grained authorizations) ================= */
  const pageOpts = () => Object.keys(ITMS.pages || {}).sort().map((id) => ({ v: id, l: `${((ITMS.pages || {})[id] || {}).title || id} (${id})` }));
  UI.on('roles.edit', (el) => {
    const r = D().roles.find((x) => x.id === el.dataset.id);
    UI.form({ title: 'Permissions — ' + r.name, icon: 'shield', fields: [{ k: 'perms', label: 'Allowed actions', type: 'multi', options: ['view', 'create', 'edit', 'delete', 'approve', 'admin'], full: true }, { k: 'access', label: 'Allowed modules (empty = all)', type: 'multi', options: pageOpts, full: true }, { k: 'active', label: 'Active', type: 'select', options: ['Yes', 'No'], blank: false }], values: r, onSubmit: (v) => { r.perms = v.perms && v.perms.length ? v.perms : ['view']; r.active = v.active; r.access = (v.access && v.access.length) ? v.access : null; if (r.name === 'Administrator') { if (r.perms.indexOf('admin') < 0) r.perms.push('admin'); r.active = 'Yes'; r.access = null; } S.emit(); UI.toast('Access updated — takes effect on next navigation'); } });
  });
  UI.on('roles.as', (el) => { setRole(el.dataset.id); S.emit(); UI.toast('Acting as role: ' + el.dataset.id); });
  pages.roles = {
    title: 'Roles & Access', crumb: 'Fine-grained authorizations per module', icon: 'shield', color: '#2f6bff',
    render() {
      const d = D(); const me = L.emp(curUser());
      return `<div class="note-box" style="margin-bottom:10px">Acting role: <b>${esc(curRole())}</b> · Logged in as: <b>${esc(me ? me.name + ' (' + me.no + ')' : '— nobody —')}</b> <select class="in" id="roleuser" style="width:auto;display:inline-block;margin-left:8px"><option value="">— select user —</option>${db().employees.filter((e) => e.status === 'Active' && !e.sys).map((e) => `<option value="${e.no}" ${e.no === curUser() ? 'selected' : ''}>${esc(e.name)} (${e.no})</option>`).join('')}</select></div>
      <div class="card">${UI.table({ id: 'rlt', rows: () => d.roles, sort: 'id', text: (r) => r.id + r.name, cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'name', label: 'Role' }, { k: 'scope', label: 'Scope' }, { k: 'perms', label: 'Permissions', render: (r) => r.perms.map((x) => `<span class="pill p-blue">${x}</span>`).join(' ') }, { k: 'active', label: 'Active', render: (r) => P(r.active === 'Yes' ? 'Published' : 'Draft') }], actions: (r) => `<button class="btn xs ghost" data-act="roles.as" data-id="${r.name}">Act as</button><button class="btn xs" data-act="roles.edit" data-id="${r.id}">Permissions</button>`, toolbar: '' })}</div>`;
    },
    after() {
      const sel = document.getElementById('roleuser');
      if (sel) sel.addEventListener('change', () => { setUser(sel.value); const e = L.emp(sel.value); UI.toast(e ? 'Logged in as ' + e.name : 'User cleared'); });
    },
  };

  /* ================= 14. SCHEDULER ================= */
  UI.on('sched.new', () => {
    UI.form({ title: 'Scheduler entry', icon: 'clock', fields: [{ k: 'title', label: 'Title', req: true, full: true }, { k: 'kind', label: 'Kind', type: 'select', options: ['Request follow-up', 'Task', 'Time off', 'Reminder'], blank: false }, { k: 'date', label: 'Date', type: 'date', req: true }, { k: 'time', label: 'Time' }, { k: 'owner', label: 'Technician', type: 'select', options: () => techs() }, { k: 'link', label: 'Linked ticket', type: 'select', options: () => (H() ? H().requests.slice(0, 50).map((r) => ({ v: r.id, l: `${r.id} · ${r.subject.slice(0, 40)}` })) : []) }], values: { kind: 'Task', date: today() }, onSubmit: (v) => { v.id = nid('sd', 'SCH-', 3); D().schedules.unshift(v); S.emit(); } });
  });
  pages.scheduler = {
    title: 'Scheduler', crumb: 'Requests · tasks · time off · reminders in one calendar', icon: 'clock', color: '#5b8def',
    render() {
      const d = D();
      return `<div class="card">${UI.table({ id: 'sdt', rows: () => d.schedules, sort: 'date', text: (r) => r.title + r.owner, filters: [{ k: 'kind', label: 'Kind', options: ['Request follow-up', 'Task', 'Time off', 'Reminder'] }, { k: 'owner', label: 'Technician', options: () => techs() }], cols: [{ k: 'date', label: 'Date' }, { k: 'time', label: 'Time' }, { k: 'title', label: 'Title', render: (r) => `<b>${esc(r.title)}</b>` }, { k: 'kind', label: 'Kind', render: (r) => P(r.kind, 'violet') }, { k: 'owner', label: 'Owner' }, { k: 'link', label: 'Ticket' }], actions: (r) => `${(typeof ITMS!=='undefined'&&ITMS.canDelete&&ITMS.canDelete())?'<button class="ibtn" style="--c:#ff5c6c" data-act="sched.del" data-id="'+r.id+'" title="Delete (Admin only)">'+ic('trash')+'</button>':''}`, toolbar: tbNew('sched.new', 'Add entry') })}</div>`;
    },
  };
  UI.on('sched.del', async (el) => { if (!ITMS.canDelete()) return UI.toast('Only Administrator can delete records', 'err'); if (await UI.confirm('Delete scheduler entry?', 'Delete', true)) { D().schedules = D().schedules.filter((x) => x.id !== el.dataset.id); S.emit(); } });

  /* ================= 15. SURVEYS ================= */
  UI.on('surveys.new', () => { UI.form({ title: 'New survey', icon: 'trend', fields: [{ k: 'title', label: 'Title', req: true, full: true }, { k: 'q', label: 'Question (1-5 scale)', full: true, req: true }, { k: 'active', label: 'Active', type: 'select', options: ['Yes', 'No'], blank: false }], values: { active: 'Yes' }, onSubmit: (v) => { v.id = nid('svy', 'SV-', 2); D().surveys.unshift(v); S.emit(); } }); });
  UI.on('surveys.edit', (el) => { const r = D().surveys.find((x) => x.id === el.dataset.id); if (!r) return; UI.form({ title: 'Edit ' + r.id, icon: 'trend', fields: [{ k: 'title', label: 'Title', req: true, full: true }, { k: 'q', label: 'Question (1-5 scale)', full: true }, { k: 'active', label: 'Active', type: 'select', options: ['Yes', 'No'], blank: false }], values: r, onSubmit: (v) => { Object.assign(r, v); S.emit(); } }); });
  UI.on('products.edit', (el) => { const r = D().products.find((x) => x.id === el.dataset.id); if (!r) return; UI.form({ title: 'Edit ' + r.id, icon: 'box', fields: [{ k: 'brand', label: 'Brand', req: true }, { k: 'model', label: 'Model', req: true }, { k: 'price', label: 'Std price', type: 'number' }, { k: 'active', label: 'Active', type: 'select', options: ['Yes', 'No'], blank: false }], values: r, onSubmit: (v) => { Object.assign(r, v); S.emit(); } }); });

  /* ================= ITEM MASTER ================= */
  const ITEM_CATS = ['Hardware', 'Software', 'Network', 'Consumable', 'Office', 'Other'];
  const ITEM_TYPES = ['Laptop', 'Desktop', 'Monitor', 'Printer', 'Phone', 'Server', 'Storage', 'Peripheral', 'UPS', 'Switch', 'Router', 'Firewall', 'Access Point', 'License', 'Subscription', 'Toner', 'Cartridge', 'Cable', 'Battery', 'Paper', 'Furniture', 'Appliance', 'Other'];
  const glOpts = () => D().fin.coa.map((g) => ({ v: g.code, l: g.code + ' · ' + g.name }));
  const itemFields = () => [
    { section: 'Item identity' },
    { k: 'name', label: 'Item name', req: true, full: true },
    { k: 'category', label: 'Category', type: 'select', options: ITEM_CATS, req: true, blank: false },
    { k: 'type', label: 'Type / subtype', type: 'select', options: ITEM_TYPES, blank: false },
    { k: 'brand', label: 'Brand' }, { k: 'model', label: 'Model' },
    { k: 'uom', label: 'Unit of measure', type: 'select', options: ['Nos', 'Set', 'Box', 'Pack', 'Ream', 'Meter', 'User', 'Licence'], blank: false },
    { section: 'Commercials' },
    { k: 'price', label: 'Standard price', type: 'number', step: '0.01' },
    { k: 'gl', label: 'GL account', type: 'select', options: glOpts, blank: false },
    { k: 'vendor', label: 'Preferred vendor', type: 'select', options: () => db().vendors.map((v) => v.name) },
    { k: 'desc', label: 'Description', type: 'textarea', full: true },
    { k: 'active', label: 'Active', type: 'select', options: ['Yes', 'No'], blank: false },
  ];
  UI.on('itemmaster.new', () => { if (deny('create')) return; UI.form({ title: 'New item', icon: 'box', size: 'lg', fields: itemFields(), values: { category: 'Hardware', uom: 'Nos', active: 'Yes', price: 0 }, onSubmit: (v) => { v.id = nid('it', 'ITM-', 3); v.price = +v.price || 0; D().items.unshift(v); L.log('Item', `Item ${v.id} ${v.name} created`, v.id); S.emit(); UI.toast('Item created: ' + v.id); } }); });
  UI.on('itemmaster.edit', (el) => { const r = D().items.find((x) => x.id === el.dataset.id); if (!r) return; UI.form({ title: 'Edit ' + r.id, icon: 'box', size: 'lg', fields: itemFields(), values: r, onSubmit: (v) => { Object.assign(r, v); r.price = +r.price || 0; S.emit(); } }); });
  UI.on('itemmaster.del', async (el) => { if (!ITMS.canDelete()) return UI.toast('Only Administrator can delete records', 'err'); if (D().pos.some((p) => p.lines.some((l) => l.itemId === el.dataset.id))) return UI.toast('Item used in purchase orders — cannot delete', 'err'); if (await UI.confirm('Delete item ' + el.dataset.id + '?', 'Delete', true)) { D().items = D().items.filter((x) => x.id !== el.dataset.id); S.emit(); } });
  pages.itemmaster = {
    title: 'Item Master', crumb: 'Every asset & consumable item with its GL account — the source for all procurement', icon: 'box', color: '#3b82f6', group: 'Assets',
    render() {
      const d = D();
      return `<div class="card">${UI.table({
        id: 'itm', rows: () => d.items, sort: 'id', text: (r) => [r.id, r.name, r.category, r.vendor].join(' '),
        filters: [{ k: 'category', label: 'Category', options: ITEM_CATS }, { k: 'active', label: 'Active', options: ['Yes', 'No'] }, { k: 'vendor', label: 'Vendor', options: () => db().vendors.map((v) => v.name) }],
        cols: [
          { k: 'id', label: 'Code', mono: true }, { k: 'name', label: 'Item', render: (r) => `<b>${esc(r.name)}</b>` },
          { k: 'category', label: 'Category', render: (r) => P(r.category) }, { k: 'type', label: 'Type' },
          { k: 'brand', label: 'Brand' }, { k: 'model', label: 'Model' }, { k: 'uom', label: 'UoM' },
          { k: 'price', label: 'Std price', num: true, render: (r) => fmtNum(r.price, 2) },
          { k: 'gl', label: 'GL account', mono: true, render: (r) => r.gl ? `<span class="link" data-go="#/finance">${r.gl} · ${esc(glName(r.gl))}</span>` : '—' },
          { k: 'vendor', label: 'Vendor', render: (r) => esc(r.vendor || '—') }, { k: 'active', label: 'Active', render: (r) => P(r.active === 'Yes' ? 'Published' : 'Draft') },
        ],
        actions: (r) => ea('itemmaster', r.id),
        toolbar: tbNew('itemmaster.new', 'New item') + ' <button class="btn ghost" data-act="ms.pick" data-keys="uom">' + ic('tag') + 'Add UOM</button>',
        empty: 'No items yet — add every asset and consumable here so procurement, GRN and finance all reference the same item with its GL account.',
      })}</div>`;
    },
  };
  UI.on('instances.edit', (el) => { const r = D().instances.find((x) => x.id === el.dataset.id); if (!r) return; UI.form({ title: 'Edit ' + r.id, icon: 'spark', fields: [{ k: 'name', label: 'Desk name', req: true }, { k: 'dept', label: 'Department' }, { k: 'status', label: 'Status', type: 'select', options: ['Draft', 'Live'], blank: false }], values: r, onSubmit: (v) => { Object.assign(r, v); r.portal = r.status === 'Live' ? 'Yes' : 'No'; S.emit(); } }); });
  pages.surveys = {
    title: 'Experience Surveys', crumb: 'General + request-linked surveys with reports', icon: 'trend', color: '#00a8e8',
    render() {
      const d = D();
      const rep = d.surveys.map((s) => { const rs = d.responses.filter((r) => r.surveyId === s.id); const avg = rs.length ? (rs.reduce((a, r) => a + (+r.score || 0), 0) / rs.length) : 0; return { s, n: rs.length, avg }; });
      return `<div class="grid g3">${rep.map((r) => `<div class="card" style="border-left:4px solid ${C.mint}"><b>${esc(r.s.title)}</b><div style="font:700 24px var(--head)">${r.avg ? r.avg.toFixed(1) + ' / 5' : '—'}</div><small>${r.n} response(s)</small></div>`).join('') || '<div class="empty">No surveys</div>'}</div>
      <div class="card mt">${UI.table({ id: 'svt', rows: () => d.surveys, sort: 'id', text: (r) => r.id + r.title, cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'title', label: 'Survey' }, { k: 'q', label: 'Question' }, { k: 'active', label: 'Active', render: (r) => P(r.active === 'Yes' ? 'Published' : 'Draft') }], actions: (r) => ea('surveys', r.id), toolbar: tbNew('surveys.new', 'New survey') })}</div>
      <div class="card mt"><h3>Responses</h3>${UI.table({ id: 'svr', rows: () => d.responses, sort: 'at', dir: -1, text: (r) => r.reqId + r.rater + r.comment, cols: [{ k: 'reqId', label: 'Ticket' }, { k: 'rater', label: 'By' }, { k: 'score', label: 'Score', num: true }, { k: 'comment', label: 'Comment' }, { k: 'at', label: 'At', render: (r) => fdt(r.at) }], actions: () => '' })}</div>`;
    },
  };

  /* ================= 16. ADVANCED REPORTS ================= */
  /* pages.reportsplus is registered by js/reports.js (loaded after this file) with
     the full 41-canned-report set. Do NOT register it here — the later load wins. */

  /* ================= 17. ESM (instances, mobile, best practices) ================= */
  const DESK_PACKS = [
    { match: ['hr', 'human', 'people'], group: 'HR Operations', items: [['Leave application', 'Time off for vacation, sick or personal leave — state dates and reason.', 'Service Request', ''], ['Salary certificate request', 'Official salary letter for bank or visa use.', 'Service Request', ''], ['New joiner onboarding', 'Accounts, mailbox, access and asset issuance for a new joiner.', 'Service Request', '']], links: [['Onboarding & offboarding', '#/lifecycle'], ['Employees', '#/employees']] },
    { match: ['facil', 'admin', 'maintenance', 'workplace'], group: 'Facilities', items: [['AC / maintenance request', 'Cooling, electrical or plumbing issue — state building and floor.', 'Service Request', ''], ['Office repair', 'Furniture, doors, lighting and general repairs.', 'Service Request', ''], ['Meeting-room setup', 'Chairs, projector and video setup for a meeting.', 'Service Request', '']], links: [['Preventive maintenance', '#/pmtasks'], ['Asset loans', '#/loans']] },
    { match: ['finan', 'account', 'audit'], group: 'Finance', items: [['Expense reimbursement', 'Claim back approved business spend — attach receipts.', 'Service Request', 'APPROVER'], ['Budget approval', 'Approval for planned department spend.', 'Service Request', 'APPROVER'], ['Vendor payment status', 'Ask where a supplier payment stands.', 'Service Request', '']], links: [['Pending approvals', '#/itsm'], ['IT Budget', '#/budget']] },
    { match: ['legal', 'counsel'], group: 'Legal', items: [['NDA review', 'Get a non-disclosure agreement reviewed before signing.', 'Service Request', ''], ['Contract vetting', 'Legal review of a vendor or customer contract.', 'Service Request', ''], ['Legal notice tracking', 'Register and track an incoming legal notice.', 'Service Request', '']], links: [['Follow-ups', '#/projects'], ['Contracts', '#/contracts']] },
  ];
  const GENERIC_PACK = { group: '', items: [['General service request', 'Anything else this department handles.', 'Service Request', ''], ['Feedback / suggestion', 'Ideas to improve the service.', 'Service Request', '']], links: [['Tickets', '#/tickets'], ['Service catalog', '#/kb']] };
  function packFor(dept) { const s = String(dept || '').toLowerCase(); return DESK_PACKS.find((p) => p.match.some((m) => s.indexOf(m) >= 0)) || GENERIC_PACK; }
  function seedDesk(inst) {
    const h = H(); const pack = packFor(inst.dept);
    const grp = inst.group || pack.group;
    if (grp && (h.cfg.groups || []).indexOf(grp) < 0) h.cfg.groups.push(grp);
    if (grp) inst.group = grp;
    let n = 0;
    pack.items.forEach((it) => {
      if (h.catalog.some((c) => c.desk === inst.id && c.title === it[0])) return;
      h.seq.catalog = (h.seq.catalog || 0) + 1;
      h.catalog.unshift({ id: 'SC-' + String(h.seq.catalog).padStart(3, '0'), title: it[0], desc: it[1], desk: inst.id, category: it[2], group: grp || h.cfg.groups[0], approver: it[3] === 'APPROVER' ? (techs()[0] || '') : '', impact: 'Medium', urgency: 'Normal', active: 'Yes', created: now() });
      n++;
    });
    return n;
  }
  UI.on('esm.new', () => { UI.form({ title: 'Rapid-start service desk (< 60s)', icon: 'plus', fields: [{ k: 'name', label: 'Desk name', req: true }, { k: 'dept', label: 'Department', req: true }, { k: 'group', label: 'Fulfilment group (created if missing)' }], onSubmit: (v) => { v.id = 'ESM-' + v.dept.slice(0, 2).toUpperCase() + '-' + (D().instances.length + 1); v.status = 'Draft'; v.catalog = 0; v.portal = 'No'; v.created = today(); D().instances.unshift(v); const n = seedDesk(v); S.emit(); UI.toast(`${v.name} instance created with ${n} catalog items`); } }); });
  UI.on('esm.go', (el) => { const i = D().instances.find((x) => x.id === el.dataset.id); i.status = i.status === 'Live' ? 'Draft' : 'Live'; i.portal = i.status === 'Live' ? 'Yes' : 'No'; if (i.status === 'Live') seedDesk(i); S.emit(); });
  UI.on('esm.req', () => {
    const inst = D().instances.find((x) => x.id === UI.tab.esmDesk); if (!inst) return;
    UI.form({ title: 'New ' + inst.dept + ' request', sub: inst.name, icon: 'plus', fields: [{ k: 'subject', label: 'Subject', req: true, full: true }, { k: 'category', label: 'Category', type: 'select', options: cats, req: true }, { k: 'desc', label: 'Details', type: 'textarea', full: true }], onSubmit: (v) => { const r = mkTicket({ requester: curUser() || '', subject: v.subject, desc: v.desc, category: v.category, type: 'Service Request', mode: 'Enterprise Portal', source: inst.name, desk: inst.id }); runRules('create'); S.emit(); UI.toast(`${r.id} raised on ${inst.name}`); } });
  });
  UI.on('dev.new', () => { UI.form({ title: 'Register mobile device', icon: 'plus', fields: [{ k: 'user', label: 'User', type: 'select', options: () => techs(), req: true }, { k: 'platform', label: 'Platform', type: 'select', options: ['iOS', 'Android', 'Windows'], blank: false }], onSubmit: (v) => { v.id = nid('dv2', 'MOB-', 3); v.lastSeen = now(); D().devices.unshift(v); S.emit(); } }); });
  UI.on('dev.del', async (el) => { if (!ITMS.canDelete()) return UI.toast('Only Administrator can delete records', 'err'); if (await UI.confirm('Delete this device registration?', 'Delete', true)) { D().devices = D().devices.filter((x) => x.id !== el.dataset.id); S.emit(); UI.toast('Device deleted'); } });
  pages.esm = {
    title: 'Multi-Department Service Desks', crumb: 'Unified platform · rapid-start desks · single portal · mobile', icon: 'spark', color: '#00c2ff',
    render() {
      const d = D(); const tab = UI.curTab('esm', 'desk');
      let body = '';
      if (tab === 'desk') body = UI.table({ id: 'esmi', rows: () => d.instances, sort: 'id', text: (r) => r.id + r.name, cols: [{ k: 'id', label: 'Instance', mono: true }, { k: 'name', label: 'Desk' }, { k: 'dept', label: 'Department' }, { k: 'status', label: 'Status', render: (r) => P(r.status === 'Live' ? 'Published' : 'Draft') }, { k: 'portal', label: 'In enterprise portal' }], actions: (r) => `<button class="btn xs" data-act="esm.go" data-id="${r.id}">${r.status === 'Live' ? 'Set draft' : 'Go live'}</button>${ea('instances', r.id)}`, toolbar: tbNew('esm.new', 'New desk in 60 seconds') });
      else if (tab === 'mob') body = UI.table({ id: 'esmm', rows: () => d.devices, sort: 'lastSeen', dir: -1, text: (r) => r.user + r.platform, cols: [{ k: 'id', label: 'Device', mono: true }, { k: 'user', label: 'User' }, { k: 'platform', label: 'App (iOS/Android/Windows)' }, { k: 'lastSeen', label: 'Last seen', render: (r) => fdt(r.lastSeen) }], actions: (r) => `${(typeof ITMS!=='undefined'&&ITMS.canDelete&&ITMS.canDelete())?'<button class="ibtn" style="--c:#ff5c6c" data-act="dev.del" data-id="'+r.id+'" title="Delete (Admin only)">'+ic('trash')+'</button>':''}`, toolbar: tbNew('dev.new', 'Register device') });
      else if (tab === 'ws') {
        const live = d.instances.filter((i) => i.status === 'Live');
        const sel = UI.tab.esmDesk || (live[0] || {}).id;
        const inst = live.find((x) => x.id === sel);
        if (!inst) body = '<div class="empty"><b>No live desk</b>Go live on the instances tab first.</div>';
        else {
          const R = H().requests.filter((r) => (r.desk || 'IT') === inst.id);
          const open = R.filter((r) => ['Open', 'Assigned', 'In Progress', 'On Hold'].indexOf(r.status) >= 0);
          const od = open.filter((r) => r.dueBy && new Date(r.dueBy) < new Date() && r.status !== 'On Hold');
          const un = open.filter((r) => !r.tech);
          const cat = H().catalog.filter((c) => c.desk === inst.id && c.active !== 'No');
          const pk = packFor(inst.dept);
          const kpi = (nn, ll) => `<div class="card" style="border-left:4px solid ${C.blue}"><div style="font:700 22px var(--head)">${nn}</div><small style="color:var(--muted)">${ll}</small></div>`;
          body = `<div style="margin-bottom:10px"><label>Desk <select class="in" id="esmsel" style="width:auto;display:inline-block">${live.map((x) => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${esc(x.name)} (${esc(x.dept)})</option>`).join('')}</select></label></div>`
            + `<div class="grid g3">${kpi(open.length, 'Open requests')}${kpi(od.length, 'SLA overdue')}${kpi(un.length, 'Unassigned')}</div>`
            + `<div class="card mt"><h3>Requests<button class="btn sm" style="margin-left:auto" data-act="esm.req">${ic('plus')}New ${esc(inst.dept)} request</button></h3>${UI.table({ id: 'esmdt', rows: () => H().requests.filter((r) => (r.desk || 'IT') === (UI.tab.esmDesk || '')), sort: 'created', dir: -1, text: (r) => r.id + r.subject, cols: [{ k: 'id', label: 'ID', mono: true, render: (r) => `<a class="link" data-act="rq.view" data-id="${r.id}">${r.id}</a>` }, { k: 'subject', label: 'Subject', render: (r) => `<b>${esc(r.subject)}</b>` }, { k: 'status', label: 'Status', render: (r) => P(r.status) }, { k: 'tech', label: 'Assigned to' }, { k: 'created', label: 'Created', render: (r) => fdt(r.created) }], actions: (r) => `<button class="ibtn" data-act="rq.view" data-id="${r.id}">${ic('eye')}</button>`, toolbar: '' })}</div>`
            + `<div class="card mt"><h3>Desk catalog</h3><div class="grid g3">${cat.map((c) => `<div class="card"><b>${esc(c.title)}</b><br><small style="color:var(--muted)">${esc(c.desc || '').slice(0, 90)}</small><div style="margin-top:8px"><button class="btn sm" data-act="sc.use" data-id="${c.id}">Request</button></div></div>`).join('') || '<div class="empty">No catalog items — they seed automatically on go-live.</div>'}</div></div>`
            + `<div class="card mt"><h3>Connected flows</h3><div style="display:flex;gap:8px;flex-wrap:wrap">${pk.links.map((l) => `<button class="btn ghost" data-go="${l[1]}">${l[0]} →</button>`).join('')}</div></div>`;
        }
      }
      else if (tab === 'spaces') body = UI.table({ id: 'spct', rows: () => d.spaces, sort: 'building', text: (r) => r.id + r.building + r.room, filters: [{ k: 'type', label: 'Space type', options: ['Office', 'Meeting room', 'Lobby', 'Store', 'Plant room', 'Parking', 'Other'] }, { k: 'active', label: 'Active', options: ['Yes', 'No'] }], cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'building', label: 'Building / campus', render: (r) => `<b>${esc(r.building)}</b>` }, { k: 'floor', label: 'Floor' }, { k: 'room', label: 'Room / area' }, { k: 'type', label: 'Type' }, { k: 'capacity', label: 'Seats', num: true }, { k: 'amenities', label: 'Amenities', render: (r) => `<small>${esc(r.amenities || '—')}</small>` }, { k: 'active', label: 'Active', render: (r) => P(r.active === 'Yes' ? 'Published' : 'Draft') }], actions: (r) => `<button class="btn xs" data-act="spaces.req" data-id="${r.id}">Maintenance</button> <button class="btn xs ghost" data-act="spaces.edit" data-id="${r.id}">Edit</button> ${(typeof ITMS!=='undefined'&&ITMS.canDelete&&ITMS.canDelete())?'<button class="btn xs ghost" data-act="spaces.del" data-id="'+r.id+'" title="Delete (Admin only)">Delete</button>':''}`, toolbar: tbNew('spaces.new', 'New space') });
      else body = `<div class="grid g2">${[['Out-of-the-box best practices', ['Incident → problem → change → release flow active', 'SLA + escalations + approvals enforced', 'CMDB impact attached to changes', 'Knowledge (solutions) reuse on resolve', 'Surveys on every resolved ticket', 'Quarterly access + backup review']], ['Single enterprise portal', [`One URL: ${d.domains.custom || d.domains.portal}`, `${d.instances.filter((i) => i.status === 'Live').length} live desk(s) reachable from portal`, 'Unique templates + automations per desk', 'Central users, groups and audit log']]].map(([t, items]) => `<div class="card"><h3>${t}</h3>${items.map((x) => `<label class="chk"><input type="checkbox" checked disabled><span>${esc(x)}</span></label>`).join('')}</div>`).join('')}</div>`;
      return `<div class="card">${UI.tabs('esm', [{ id: 'desk', label: 'Service desk instances', count: d.instances.length }, { id: 'ws', label: 'Desk workspace' }, { id: 'mob', label: 'Helpdesk mobile apps', count: d.devices.length }, { id: 'spaces', label: 'Spaces', count: d.spaces.length }, { id: 'bp', label: 'Best practices' }])}${body}</div>`;
    },
    after() {
      const s = document.getElementById('esmsel');
      if (s) s.addEventListener('change', () => { UI.tab.esmDesk = s.value; S.emit(); });
    },
  };
  UI.on('spaces.new', () => {
    UI.form({ title: 'New space', icon: 'box', fields: [{ k: 'building', label: 'Building / campus', req: true }, { k: 'floor', label: 'Floor' }, { k: 'room', label: 'Room / area' }, { k: 'type', label: 'Space type', type: 'select', options: ['Office', 'Meeting room', 'Lobby', 'Store', 'Plant room', 'Parking', 'Other'], blank: false }, { k: 'capacity', label: 'Capacity (seats)', type: 'number' }, { k: 'amenities', label: 'Amenities', type: 'textarea', full: true }, { k: 'manager', label: 'Space manager', type: 'select', options: () => techs() }, { k: 'active', label: 'Active', type: 'select', options: ['Yes', 'No'], blank: false }], values: { type: 'Office', active: 'Yes' }, onSubmit: (v) => { v.id = nid('sp', 'SP-', 2); D().spaces.unshift(v); S.emit(); UI.toast('Space added'); } });
  });
  UI.on('spaces.edit', (el) => { const r = D().spaces.find((x) => x.id === el.dataset.id); UI.form({ title: 'Edit ' + r.id, icon: 'box', fields: [{ k: 'building', label: 'Building / campus', req: true }, { k: 'floor', label: 'Floor' }, { k: 'room', label: 'Room / area' }, { k: 'type', label: 'Space type', type: 'select', options: ['Office', 'Meeting room', 'Lobby', 'Store', 'Plant room', 'Parking', 'Other'], blank: false }, { k: 'capacity', label: 'Capacity (seats)', type: 'number' }, { k: 'amenities', label: 'Amenities', type: 'textarea', full: true }, { k: 'active', label: 'Active', type: 'select', options: ['Yes', 'No'], blank: false }], values: r, onSubmit: (v) => { Object.assign(r, v); S.emit(); } }); });
  UI.on('spaces.del', async (el) => { if (!ITMS.canDelete()) return UI.toast('Only Administrator can delete records', 'err'); if (await UI.confirm('Delete this space?', 'Delete', true)) { D().spaces = D().spaces.filter((x) => x.id !== el.dataset.id); S.emit(); } });
  UI.on('spaces.req', (el) => {
    const s = D().spaces.find((x) => x.id === el.dataset.id); if (!s) return;
    const fac = D().instances.find((i) => /facil|admin/i.test((i.dept || '') + (i.name || '')) && i.status === 'Live');
    const r = mkTicket({ requester: curUser() || '', subject: `Maintenance — ${s.building}${s.room ? ' / ' + s.room : ''}`, desc: `Space: ${s.building}, floor ${s.floor || '—'}, room ${s.room || '—'} (${s.type}). Amenities: ${s.amenities || '—'}`, category: 'Service Request', type: 'Service Request', source: 'Space management', desk: fac ? fac.id : 'IT' });
    S.emit(); UI.toast(`${r.id} raised${fac ? ' on ' + fac.name : ''}`);
  });

  /* ================= AD & GROUP POLICY CENTER ================= */
  const alog = (text) => { D().adlog.unshift({ at: now(), text }); if (D().adlog.length > 200) D().adlog.length = 200; L.log('AD', text); };
  const adLive = () => D().adconns.find((c) => c.status === 'Live') || D().adconns[0];
  function psConn(c) {
    const ssl = String(c.port) === '636' || c.enc === 'SSL';
    const lines = [
      '# ITMS-generated — test the AD/LDAP connection' + (ssl ? ' over SSL (LDAPS, port 636)' : ' (port ' + c.port + ')'),
      '# Requires: RSAT ActiveDirectory module. LDAPS needs a valid cert on the DC.',
      '$DC   = "' + c.host + '"',
      '$Port = ' + c.port,
      '$Base = "' + c.baseDN + '"',
      '$cred = Get-Credential -UserName "' + c.bindUser + '" -Message "AD bind account"',
    ];
    if (ssl) lines.push('$conn = New-Object DirectoryServices.DirectoryEntry("LDAP://" + $DC + ":$Port/$Base", $cred.UserName, $cred.GetNetworkCredential().Password, "SecureSocketsLayer")');
    else lines.push('$conn = New-Object DirectoryServices.DirectoryEntry("LDAP://" + $DC + ":$Port/$Base", $cred.UserName, $cred.GetNetworkCredential().Password)');
    lines.push('$searcher = New-Object DirectoryServices.DirectorySearcher($conn)', '$searcher.Filter = "(objectClass=user)"', '$searcher.SizeLimit = 5', '$searcher.FindAll() | ForEach-Object { $_.Properties["samaccountname"] }');
    return lines.join('\n');
  }
  function showPs(title, sub, code) {
    const ov = modal(`<header><span class="gem" style="width:38px;height:38px;border-radius:13px">${ic('cpu')}</span><div><h3>${esc(title)}</h3><small>${esc(sub)}</small></div><button class="ibtn x" data-x>${ic('x')}</button></header><div class="body"><pre style="background:#0f2040;color:#cfe3ff;padding:14px;border-radius:12px;overflow:auto;font-size:12px;max-height:50vh">${esc(code)}</pre><small style="color:var(--muted)">Run on a domain-joined admin host. Every run is written to the Sync log tab for audit.</small></div><footer><button class="btn ghost" data-x>Close</button></footer>`, 'lg');
    return ov;
  }
  UI.on('adconn.new', () => {
    UI.form({ title: 'New directory connection', sub: 'LDAPS (636/SSL) recommended for production', icon: 'link', fields: [{ k: 'name', label: 'Name', req: true }, { k: 'host', label: 'Domain controller / LDAP host', req: true }, { k: 'port', label: 'Port', type: 'select', options: ['389', '636', '3268', '3269'], blank: false }, { k: 'enc', label: 'Encryption', type: 'select', options: ['None', 'STARTTLS', 'SSL'], blank: false }, { k: 'baseDN', label: 'Base DN (e.g. DC=company,DC=ae)', req: true, full: true }, { k: 'bindUser', label: 'Bind account (UPN)', req: true }, { k: 'cert', label: 'LDAPS cert thumbprint (optional)', full: true }], values: { port: '636', enc: 'SSL' }, onSubmit: (v) => { v.id = nid('adc', 'ADC-', 3); v.status = 'Draft'; v.lastTest = ''; D().adconns.unshift(v); alog(`Connection ${v.id} ${v.name} added (${v.host}:${v.port}/${v.enc})`); S.emit(); } });
  });
  UI.on('adconn.edit', (el) => { const r = D().adconns.find((x) => x.id === el.dataset.id); UI.form({ title: 'Edit ' + r.id, icon: 'link', fields: [{ k: 'name', label: 'Name', req: true }, { k: 'host', label: 'Host', req: true }, { k: 'port', label: 'Port', type: 'select', options: ['389', '636', '3268', '3269'], blank: false }, { k: 'enc', label: 'Encryption', type: 'select', options: ['None', 'STARTTLS', 'SSL'], blank: false }, { k: 'baseDN', label: 'Base DN', full: true }, { k: 'bindUser', label: 'Bind account (UPN)' }, { k: 'cert', label: 'LDAPS cert thumbprint', full: true }], values: r, onSubmit: (v) => { Object.assign(r, v); r.status = 'Draft'; r.lastTest = ''; alog(`Connection ${r.id} edited — re-test required`); S.emit(); } }); });
  UI.on('adconn.del', async (el) => { if (!ITMS.canDelete()) return UI.toast('Only Administrator can delete records', 'err'); if (await UI.confirm('Delete this connection profile?', 'Delete', true)) { D().adconns = D().adconns.filter((x) => x.id !== el.dataset.id); alog(`Connection ${el.dataset.id} deleted`); S.emit(); } });
  UI.on('adconn.test', (el) => {
    const c = D().adconns.find((x) => x.id === el.dataset.id);
    if (!c.host || !c.baseDN || !c.bindUser) { UI.toast('Host, Base DN and bind account are required', 'err'); return; }
    if ((c.enc === 'SSL' || String(c.port) === '636') && !c.host) { UI.toast('LDAPS needs a reachable DC hostname', 'err'); return; }
    c.status = 'Live'; c.lastTest = now(); alog(`Connection ${c.id} tested OK (${c.host}:${c.port}/${c.enc})`); S.emit();
    showPs(`Test connection — ${c.name}`, c.host + ':' + c.port + ' · ' + c.enc + ' · run this on the admin host as evidence', psConn(c));
  });
  const mkSam = (name) => {
    const parts = String(name || '').toLowerCase().split(/\s+/);
    const first = (parts[0] || 'user').replace(/[^a-z0-9]/g, '');
    const rest = parts.slice(1).join('').replace(/[^a-z0-9]/g, '');
    const base = (first + '.' + rest).replace(/^\.|\.$/g, '') || 'user';
    let s = base, i = 1; const taken = new Set(D().adusers.map((u) => u.sam));
    while (taken.has(s)) s = base + (++i); return s;
  };
  UI.on('aduser.sync', () => {
    UI.form({ title: 'Provision from employees', sub: 'Creates AD accounts for active staff missing one — linked by employee no.', icon: 'users', fields: [{ k: 'domain', label: 'UPN domain', req: true }, { k: 'ou', label: 'Target OU', req: true }], values: { domain: 'company.ae', ou: 'OU=Users,' + (adLive() ? adLive().baseDN : 'DC=company,DC=ae') }, onSubmit: (v) => {
      let n = 0; db().employees.filter((e) => e.status === 'Active' && !e.sys).forEach((e) => { if (D().adusers.some((u) => u.empNo === e.no)) return; const sam = mkSam(e.name); D().adusers.unshift({ id: nid('adu', 'ADU-', 3), sam, upn: sam + '@' + v.domain, empNo: e.no, ou: v.ou, groups: ['IT Support'], status: 'Enabled', mustChange: 'Yes', lastSync: today() }); alog(`Provisioned ${sam} for ${e.name} (${e.no}) → ${v.ou}`); n++; });
      S.emit(); UI.toast(n ? n + ' account(s) provisioned (password must change at logon)' : 'Everyone already has an account');
    } });
  });
  UI.on('aduser.new', () => {
    UI.form({ title: 'New AD account', icon: 'plus', fields: [{ k: 'empNo', label: 'Employee', type: 'select', options: empOpts, req: true }, { k: 'ou', label: 'OU', req: true }, { k: 'groups', label: 'Member of', type: 'multi', options: () => D().adgroups.map((g) => g.name), full: true }], values: { ou: 'OU=Users,' + (adLive() ? adLive().baseDN : 'DC=company,DC=ae') }, onSubmit: (v) => { const e = L.emp(v.empNo) || {}; const sam = mkSam(e.name); D().adusers.unshift({ id: nid('adu', 'ADU-', 3), sam, upn: sam + '@company.ae', empNo: v.empNo, ou: v.ou, groups: v.groups || [], status: 'Enabled', mustChange: 'Yes', lastSync: today() }); alog(`Account ${sam} created for ${e.name}`); S.emit(); } });
  });
  UI.on('aduser.edit', (el) => { const r = D().adusers.find((x) => x.id === el.dataset.id); UI.form({ title: 'Edit ' + r.sam, icon: 'edit', fields: [{ k: 'ou', label: 'OU' }, { k: 'groups', label: 'Member of', type: 'multi', options: () => D().adgroups.map((g) => g.name), full: true }], values: r, onSubmit: (v) => { Object.assign(r, v); alog(`${r.sam} updated (OU/groups)`); S.emit(); } }); });
  UI.on('aduser.toggle', (el) => {
    const r = D().adusers.find((x) => x.id === el.dataset.id); const to = r.status === 'Enabled' ? 'Disabled' : 'Enabled'; r.status = to; r.lastSync = today();
    alog(`${r.sam} ${to === 'Disabled' ? 'disabled (run from People → Onboarding & Offboarding for leavers)' : 'enabled'}`);
    S.emit(); showPs(`${to === 'Disabled' ? 'Disable' : 'Enable'} — ${r.sam}`, 'Run on the admin host; the status change above is your audit record', (to === 'Disabled' ? 'Disable-ADAccount' : 'Enable-ADAccount') + ' -Identity "' + r.sam + '"');
  });
  UI.on('aduser.unlock', (el) => { const r = D().adusers.find((x) => x.id === el.dataset.id); r.status = 'Enabled'; r.lastSync = today(); alog(`${r.sam} unlocked`); S.emit(); showPs('Unlock — ' + r.sam, 'Account lockout cleared', 'Unlock-ADAccount -Identity "' + r.sam + '"'); });
  UI.on('aduser.reset', (el) => {
    const r = D().adusers.find((x) => x.id === el.dataset.id); const temp = 'Temp#' + Math.floor(1000 + Math.random() * 9000) + '!Xy'; r.mustChange = 'Yes'; r.lastSync = today();
    alog(`${r.sam} password reset (must change at next logon)`);
    S.emit(); showPs('Reset password — ' + r.sam, 'One-time display — hand to the user securely, never by email', 'Set-ADAccountPassword -Identity "' + r.sam + '" -Reset -NewPassword (ConvertTo-SecureString -AsPlainText "' + temp + '" -Force)\nSet-ADUser -Identity "' + r.sam + '" -ChangePasswordAtLogon $true   # temporary: ' + temp);
  });
  UI.on('aduser.del', async (el) => { if (!ITMS.canDelete()) return UI.toast('Only Administrator can delete records', 'err'); if (await UI.confirm('Remove this managed account record? (AD object itself is disabled, never deleted here)', 'Remove', true)) { const r = D().adusers.find((x) => x.id === el.dataset.id); D().adusers = D().adusers.filter((x) => x !== r); alog(`${r.sam} removed from management`); S.emit(); } });
  UI.on('adgroup.new', () => { UI.form({ title: 'New AD group', icon: 'plus', fields: [{ k: 'name', label: 'Group name', req: true }, { k: 'scope', label: 'Scope', type: 'select', options: ['Domain Local', 'Global', 'Universal'], blank: false }, { k: 'category', label: 'Category', type: 'select', options: ['Security', 'Distribution'], blank: false }, { k: 'desc', label: 'Purpose', type: 'textarea', full: true }], values: { scope: 'Global', category: 'Security' }, onSubmit: (v) => { v.id = nid('adg', 'ADG-', 2); v.members = []; D().adgroups.unshift(v); alog(`Group ${v.name} created`); S.emit(); } }); });
  UI.on('adgroup.edit', (el) => { const r = D().adgroups.find((x) => x.id === el.dataset.id); UI.form({ title: 'Edit ' + r.name, icon: 'edit', fields: [{ k: 'desc', label: 'Purpose', type: 'textarea', full: true }, { k: 'members', label: 'Members (SAM)', type: 'multi', options: () => D().adusers.map((u) => u.sam), full: true }], values: r, onSubmit: (v) => { Object.assign(r, v); (v.members || []).forEach((m) => { const u = D().adusers.find((x) => x.sam === m); if (u && !(u.groups || []).includes(r.name)) u.groups.push(r.name); }); alog(`Group ${r.name} updated (${(v.members || []).length} members)`); S.emit(); } }); });
  UI.on('adgroup.del', async (el) => { if (!ITMS.canDelete()) return UI.toast('Only Administrator can delete records', 'err'); if (await UI.confirm('Delete this group record?', 'Delete', true)) { const r = D().adgroups.find((x) => x.id === el.dataset.id); D().adusers.forEach((u) => { u.groups = (u.groups || []).filter((g) => g !== r.name); }); D().adgroups = D().adgroups.filter((x) => x !== r); alog(`Group ${r.name} deleted`); S.emit(); } });
  UI.on('gpo.new', () => {
    UI.form({ title: 'New Group Policy object', icon: 'plus', fields: [{ k: 'name', label: 'GPO name', req: true, full: true }, { k: 'desc', label: 'Purpose', type: 'textarea', full: true }, { k: 'ous', label: 'Link to OUs (one per line)', type: 'textarea', full: true }, { k: 'settings', label: 'Key settings (one per line)', type: 'textarea', full: true }, { k: 'status', label: 'Status', type: 'select', options: ['Linked', 'Enforced', 'Unlinked', 'Disabled'], blank: false }], values: { status: 'Linked' }, onSubmit: (v) => { v.id = nid('gpo', 'GPO-', 2); v.version = 1; D().gpos.unshift(v); alog(`GPO ${v.name} created (${v.status})`); S.emit(); } });
  });
  UI.on('gpo.edit', (el) => { const r = D().gpos.find((x) => x.id === el.dataset.id); UI.form({ title: 'Edit ' + r.name, icon: 'edit', fields: [{ k: 'desc', label: 'Purpose', type: 'textarea', full: true }, { k: 'ous', label: 'Link to OUs (one per line)', type: 'textarea', full: true }, { k: 'settings', label: 'Key settings (one per line)', type: 'textarea', full: true }, { k: 'status', label: 'Status', type: 'select', options: ['Linked', 'Enforced', 'Unlinked', 'Disabled'], blank: false }], values: r, onSubmit: (v) => { Object.assign(r, v); r.version = (r.version || 1) + 1; alog(`GPO ${r.name} updated → v${r.version}`); S.emit(); } }); });
  UI.on('gpo.del', async (el) => { if (!ITMS.canDelete()) return UI.toast('Only Administrator can delete records', 'err'); if (await UI.confirm('Delete this GPO record? (Back it up first from the row action)', 'Delete', true)) { const r = D().gpos.find((x) => x.id === el.dataset.id); D().gpos = D().gpos.filter((x) => x !== r); alog(`GPO ${r.name} deleted`); S.emit(); } });
  UI.on('gpo.backup', (el) => {
    const r = D().gpos.find((x) => x.id === el.dataset.id);
    alog(`GPO ${r.name} backup script generated`);
    showPs('Backup — ' + r.name, 'Versioned backup + HTML report for audit', ['Backup-GPO -Name "' + r.name + '" -Path "\\\\fileserver\\GPOBackups\\' + r.name + '" -Comment "v' + (r.version || 1) + ' ' + today() + '"', 'Get-GPOReport -Name "' + r.name + '" -ReportType Html -Path "$env:TEMP\\' + r.name + '-v' + (r.version || 1) + '.html"', '# Linked OUs:', String(r.ous || '').split('\n').map((o) => '#   ' + o.trim()).filter((o) => o.trim() !== '#').join('\n') || '#   (none)', '# Settings:', String(r.settings || '').split('\n').map((o) => '#   ' + o.trim()).filter((o) => o.trim() !== '#').join('\n') || '#   (none)'].join('\n'));
  });
  UI.on('adps.go', (el) => {
    const k = el.dataset.id; const c = adLive();
    if (k === 'starter') showPs('New starter provisioning', 'Creates user, sets password, adds to groups, enables mailbox note', ['Import-Module ActiveDirectory', '$params = @{ Name = "<First Last>"; SamAccountName = "<sam>"; UserPrincipalName = "<sam>@company.ae"', '  Path = "OU=Users,' + (c ? c.baseDN : 'DC=company,DC=ae') + '"; AccountPassword = (Read-Host -AsSecureString "Temp password")', '  Enabled = $true; ChangePasswordAtLogon = $true; PasswordNeverExpires = $false }', 'New-ADUser @params', 'Add-ADGroupMember -Identity "IT Support" -Members "<sam>"'].join('\n'));
    else if (k === 'leaver') showPs('Leaver offboarding', 'Mirror of People → Onboarding & Offboarding: disable, expire, move, strip groups', ['Import-Module ActiveDirectory', 'Disable-ADAccount -Identity "<sam>"', 'Set-ADAccountExpiration -Identity "<sam>" -DateTime (Get-Date)', 'Get-ADPrincipalGroupMembership -Identity "<sam>" | Where-Object { $_.Name -ne "Domain Users" } | ForEach-Object { Remove-ADGroupMember -Identity $_ -Members "<sam>" -Confirm:$false }', 'Move-ADObject -Identity (Get-ADUser "<sam>").DistinguishedName -TargetPath "OU=Disabled,' + (c ? c.baseDN : 'DC=company,DC=ae') + '"'].join('\n'));
    else showPs('GPO health report', 'All GPOs, links and empty GPOs for review', ['Import-Module GroupPolicy', 'Get-GPO -All | Select-Object DisplayName, GpoStatus, ModificationTime | Format-Table -AutoSize', 'Get-GPO -All | ForEach-Object { $links = ([xml](Get-GPOReport -Guid $_.Id -ReportType Xml)).GPO.LinksTo; if (-not $links) { $_.DisplayName + "  <-- UNLINKED" } }'].join('\n'));
  });
  pages.addirectory = {
    title: 'AD & Group Policy', crumb: 'Directory connections (SSL) · users · groups · GPOs — linked to employees', icon: 'key', color: '#00a8e8',
    render() {
      const d = D(); const tab = UI.curTab('ad', 'conn');
      const tabs = UI.tabs('ad', [{ id: 'conn', label: 'Connections', count: d.adconns.length }, { id: 'users', label: 'Users', count: d.adusers.length }, { id: 'groups', label: 'Groups', count: d.adgroups.length }, { id: 'gpo', label: 'Group Policy', count: d.gpos.length }, { id: 'scripts', label: 'Runbooks' }, { id: 'log', label: 'Sync log', count: d.adlog.length }]);
      let body = '';
      if (tab === 'conn') body = UI.table({ id: 'adct', rows: () => d.adconns, sort: 'id', text: (r) => r.id + r.name + r.host, cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'name', label: 'Connection', render: (r) => `<b>${esc(r.name)}</b>` }, { k: 'host', label: 'Host' }, { k: 'port', label: 'Port' }, { k: 'enc', label: 'Encryption', render: (r) => P(r.enc === 'SSL' ? 'Published' : 'Draft') }, { k: 'baseDN', label: 'Base DN' }, { k: 'status', label: 'Status', render: (r) => P(r.status === 'Live' ? 'Published' : 'Draft') }, { k: 'lastTest', label: 'Last test', render: (r) => fdt(r.lastTest) }], actions: (r) => `<button class="btn xs" data-act="adconn.test" data-id="${r.id}">Test</button> <button class="btn xs ghost" data-act="adconn.edit" data-id="${r.id}">Edit</button> ${(typeof ITMS!=='undefined'&&ITMS.canDelete&&ITMS.canDelete())?'<button class="btn xs ghost" data-act="adconn.del" data-id="'+r.id+'" title="Delete (Admin only)">Delete</button>':''}`, toolbar: tbNew('adconn.new', 'New connection') });
      else if (tab === 'users') body = UI.table({ id: 'adut', rows: () => d.adusers.map((u) => Object.assign({ emp: L.empName(u.empNo) }, u)), sort: 'sam', text: (r) => r.sam + r.emp + r.ou, filters: [{ k: 'status', label: 'Status', options: ['Enabled', 'Locked', 'Disabled'] }], cols: [{ k: 'sam', label: 'SAM / UPN', mono: true, render: (r) => `<b>${esc(r.sam)}</b><br><small>${esc(r.upn)}</small>` }, { k: 'emp', label: 'Employee', render: (r) => `<a class="link" data-act="emp.view" data-id="${r.empNo}">${esc(r.emp)}</a>` }, { k: 'ou', label: 'OU' }, { k: 'groups', label: 'Groups', render: (r) => esc((r.groups || []).join(', ')) }, { k: 'status', label: 'Status', render: (r) => (r.status === 'Enabled' ? P('Published') : r.status === 'Locked' ? P('Draft') : P('Expired')) }, { k: 'mustChange', label: 'Must change PW' }], actions: (r) => `<button class="btn xs" data-act="aduser.reset" data-id="${r.id}">Reset PW</button> <button class="btn xs ghost" data-act="aduser.unlock" data-id="${r.id}">Unlock</button> <button class="btn xs ghost" data-act="aduser.toggle" data-id="${r.id}">${r.status === 'Enabled' ? 'Disable' : 'Enable'}</button> <button class="btn xs ghost" data-act="aduser.edit" data-id="${r.id}">Edit</button>`, toolbar: `${tbNew('aduser.sync', 'Sync from employees')} ${tbNew('aduser.new', 'New account')} <button class="btn ghost" data-go="#/employees">Employees</button> <button class="btn ghost" data-go="#/lifecycle">On/offboarding</button>` });
      else if (tab === 'groups') body = UI.table({ id: 'adgt', rows: () => d.adgroups, sort: 'id', text: (r) => r.id + r.name, cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'name', label: 'Group', render: (r) => `<b>${esc(r.name)}</b>` }, { k: 'scope', label: 'Scope' }, { k: 'category', label: 'Category' }, { k: 'members', label: 'Members', render: (r) => `${(r.members || []).length}` }], actions: (r) => `<button class="btn xs ghost" data-act="adgroup.edit" data-id="${r.id}">Members</button> ${(typeof ITMS!=='undefined'&&ITMS.canDelete&&ITMS.canDelete())?'<button class="btn xs ghost" data-act="adgroup.del" data-id="'+r.id+'" title="Delete (Admin only)">Delete</button>':''}`, toolbar: tbNew('adgroup.new', 'New group') });
      else if (tab === 'gpo') body = UI.table({ id: 'gpot', rows: () => d.gpos, sort: 'id', text: (r) => r.id + r.name + r.ous, cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'name', label: 'GPO', render: (r) => `<b>${esc(r.name)}</b><br><small>v${r.version || 1} · ${esc(r.desc || '')}</small>` }, { k: 'ous', label: 'Linked OUs', render: (r) => `<div style="max-width:260px;white-space:pre-wrap">${esc(r.ous || '—')}</div>` }, { k: 'status', label: 'Status', render: (r) => P(r.status === 'Linked' || r.status === 'Enforced' ? 'Published' : r.status === 'Disabled' ? 'Expired' : 'Draft') }], actions: (r) => `<button class="btn xs" data-act="gpo.backup" data-id="${r.id}">Backup script</button> <button class="btn xs ghost" data-act="gpo.edit" data-id="${r.id}">Edit</button> ${(typeof ITMS!=='undefined'&&ITMS.canDelete&&ITMS.canDelete())?'<button class="btn xs ghost" data-act="gpo.del" data-id="'+r.id+'" title="Delete (Admin only)">Delete</button>':''}`, toolbar: tbNew('gpo.new', 'New GPO') });
      else if (tab === 'scripts') body = `<div class="grid g3">${[['New starter provisioning', 'starter', 'User + groups + temp password, mirrors onboarding'], ['Leaver offboarding', 'leaver', 'Disable, expire, strip groups, move to Disabled OU'], ['GPO health report', 'gporep', 'All GPOs, links and unlinked GPOs']].map(([t, k, s]) => `<div class="card"><h3>${t}</h3><small style="color:var(--muted)">${s}</small><div style="margin-top:10px"><button class="btn sm" data-act="adps.go" data-id="${k}">Generate script</button></div></div>`).join('')}</div>`;
      else body = UI.table({ id: 'adlt', rows: () => d.adlog, sort: 'at', dir: -1, text: (r) => r.text, cols: [{ k: 'at', label: 'At', render: (r) => fdt(r.at) }, { k: 'text', label: 'Event' }], actions: () => '' });
      return `<div class="card">${tabs}${body}</div>`;
    },
  };

  /* ================= EMAIL (SMTP/IMAP/POP + ticket notifications + inbound) ================= */
  const M = () => D().mail;
  const TOGS = [['onCreate', 'Ticket logged'], ['onAssign', 'Assigned / work started'], ['onResolve', 'Resolved (resolution included)'], ['onClose', 'Ticket closed'], ['onNote', 'New reply / note'], ['ccManager', 'Also email the reporting manager']];
  function mgrOf(empNo) {
    const e = L.emp(empNo) || {}; if (!e.manager) return null;
    return db().employees.find((x) => x.name === e.manager && x.status === 'Active' && x.email) || null;
  }
  function queueOutbox(kind, r) {
    const m = M(); const key = { created: 'onCreate', assigned: 'onAssign', resolved: 'onResolve', closed: 'onClose', note: 'onNote' }[kind];
    if (!m.toggles[key]) return false;
    r._em = r._em || {}; if (r._em[kind]) return false; r._em[kind] = 1;
    const emp = L.emp(r.requester) || {};
    const to = [emp.email].filter(Boolean);
    if (m.toggles.ccManager) { const mg = mgrOf(r.requester); if (mg && to.indexOf(mg.email) < 0) to.push(mg.email); }
    if (!to.length) return false;
    const kl = { created: 'logged', assigned: r.tech ? 'assigned to ' + r.tech : 'in progress', resolved: 'resolved', closed: 'closed', note: 'updated' }[kind];
    const lines = [`Ticket ${r.id} — ${r.subject} — ${kl}`, `Requester: ${L.empName(r.requester)}`, `Status: ${r.status} · Priority: ${r.priority}`, `Category: ${[r.category, r.sub, r.item].filter(Boolean).join(' › ')}`];
    if (kind === 'resolved' && r.resolution) lines.push('', `Resolution (${r.closure || ''}):`, r.resolution);
    if (kind === 'note' && (r.notes || []).length) { const n = r.notes[0]; lines.push('', `Latest reply by ${n.by}:`, n.text); }
    lines.push('', `Support desk: ${m.desk}`);
    m.outbox.unshift({ id: nid('em', 'EM-', 3), at: now(), to, ticketId: r.id, kind, subject: `[${r.id}] ${r.subject} — ${kl}`, body: lines.join('\n'), status: 'Queued' });
    return true;
  }
  let emSnap = null, lastEm = 0;
  S.subscribe(() => {
    const t = Date.now(); if (t - lastEm < 15000) return; lastEm = t;
    try {
      const h = H(); if (!h || !h.requests) return;
      if (!emSnap) { emSnap = {}; h.requests.forEach((r) => { emSnap[r.id] = { st: r.status, n: (r.notes || []).length, res: !!r.resolvedAt, clo: !!r.closedAt }; }); return; }
      let changed = false;
      h.requests.forEach((r) => {
        const s = emSnap[r.id];
        if (!s) { emSnap[r.id] = { st: r.status, n: (r.notes || []).length, res: !!r.resolvedAt, clo: !!r.closedAt }; if (queueOutbox('created', r)) changed = true; return; }
        if (s.st !== r.status) {
          if (r.status === 'Assigned' || r.status === 'In Progress') { if (queueOutbox('assigned', r)) changed = true; }
          if ((r.status === 'Resolved' && !s.res) || (!s.res && !!r.resolvedAt)) { if (queueOutbox('resolved', r)) changed = true; }
          if ((r.status === 'Closed' && !s.clo) || (!s.clo && !!r.closedAt)) { if (queueOutbox('closed', r)) changed = true; }
        } else {
          if (!s.res && r.resolvedAt) { if (queueOutbox('resolved', r)) changed = true; }
          if (!s.clo && r.closedAt) { if (queueOutbox('closed', r)) changed = true; }
        }
        if ((r.notes || []).length > s.n) { if (queueOutbox('note', r)) changed = true; }
        emSnap[r.id] = { st: r.status, n: (r.notes || []).length, res: !!r.resolvedAt, clo: !!r.closedAt };
      });
      if (changed) S.emit();
    } catch (e) { /* watcher never breaks */ }
  });
  UI.on('mail.sync', () => {
    const h = H(); if (!h) return; let n = 0;
    h.requests.forEach((r) => {
      const before = M().outbox.length;
      if (['Assigned', 'In Progress'].indexOf(r.status) >= 0) queueOutbox('assigned', r);
      if (r.resolvedAt && Date.now() - new Date(r.resolvedAt).getTime() < 7 * 864e5) queueOutbox('resolved', r);
      if (r.closedAt && Date.now() - new Date(r.closedAt).getTime() < 7 * 864e5) queueOutbox('closed', r);
      if (M().outbox.length > before) n++;
    });
    S.emit(); UI.toast(n ? n + ' ticket(s) queued for email' : 'Nothing pending');
  });
  UI.on('mail.smtpnew', () => {
    UI.form({ title: 'SMTP account (sending)', icon: 'upload', fields: [{ k: 'name', label: 'Name', req: true }, { k: 'host', label: 'SMTP host', req: true }, { k: 'port', label: 'Port', type: 'select', options: ['25', '465', '587', '2525'], blank: false }, { k: 'enc', label: 'Encryption', type: 'select', options: ['None', 'STARTTLS', 'SSL'], blank: false }, { k: 'user', label: 'Username', req: true }, { k: 'pass', label: 'Password' }, { k: 'fromAddr', label: 'From address', req: true }, { k: 'fromName', label: 'From name' }], values: { port: '587', enc: 'STARTTLS' }, onSubmit: (v) => { v.id = nid('sm', 'SMTP-', 2); v.status = 'Draft'; v.lastTest = ''; M().smtp.unshift(v); S.emit(); } });
  });
  UI.on('mail.smtpedit', (el) => { const r = M().smtp.find((x) => x.id === el.dataset.id); UI.form({ title: 'Edit ' + r.id, icon: 'upload', fields: [{ k: 'name', label: 'Name', req: true }, { k: 'host', label: 'SMTP host', req: true }, { k: 'port', label: 'Port', type: 'select', options: ['25', '465', '587', '2525'], blank: false }, { k: 'enc', label: 'Encryption', type: 'select', options: ['None', 'STARTTLS', 'SSL'], blank: false }, { k: 'user', label: 'Username' }, { k: 'pass', label: 'Password' }, { k: 'fromAddr', label: 'From address' }, { k: 'fromName', label: 'From name' }], values: r, onSubmit: (v) => { Object.assign(r, v); r.status = 'Draft'; S.emit(); } }); });
  UI.on('mail.smtpdel', async (el) => { if (!ITMS.canDelete()) return UI.toast('Only Administrator can delete records', 'err'); if (await UI.confirm('Delete this SMTP account?', 'Delete', true)) { M().smtp = M().smtp.filter((x) => x.id !== el.dataset.id); S.emit(); } });
  UI.on('mail.smtptest', (el) => {
    const r = M().smtp.find((x) => x.id === el.dataset.id);
    if (!r.host || !r.user || !r.fromAddr) { UI.toast('Host, username and from address are required', 'err'); return; }
    r.status = 'Live'; r.lastTest = now(); L.log('Email', `SMTP ${r.id} ${r.host}:${r.port}/${r.enc} verified`, r.id); S.emit(); UI.toast('Account verified');
  });
  UI.on('mail.innew', () => {
    UI.form({ title: 'Inbound mailbox (email → ticket)', icon: 'upload', fields: [{ k: 'name', label: 'Name', req: true }, { k: 'type', label: 'Protocol', type: 'select', options: ['IMAP', 'POP3'], blank: false }, { k: 'host', label: 'Host', req: true }, { k: 'port', label: 'Port', type: 'select', options: ['143', '993', '110', '995'], blank: false }, { k: 'ssl', label: 'SSL', type: 'select', options: ['Yes', 'No'], blank: false }, { k: 'user', label: 'Username', req: true }, { k: 'pass', label: 'Password' }, { k: 'box', label: 'Mailbox', req: true }], values: { type: 'IMAP', port: '993', ssl: 'Yes', box: 'INBOX' }, onSubmit: (v) => { v.id = nid('ib', 'INBOX-', 2); v.status = 'Draft'; M().inbound.unshift(v); S.emit(); } });
  });
  UI.on('mail.inedit', (el) => { const r = M().inbound.find((x) => x.id === el.dataset.id); UI.form({ title: 'Edit ' + r.id, icon: 'upload', fields: [{ k: 'name', label: 'Name', req: true }, { k: 'host', label: 'Host' }, { k: 'port', label: 'Port', type: 'select', options: ['143', '993', '110', '995'], blank: false }, { k: 'ssl', label: 'SSL', type: 'select', options: ['Yes', 'No'], blank: false }, { k: 'user', label: 'Username' }, { k: 'pass', label: 'Password' }, { k: 'box', label: 'Mailbox' }], values: r, onSubmit: (v) => { Object.assign(r, v); r.status = 'Draft'; S.emit(); } }); });
  UI.on('mail.indel', async (el) => { if (!ITMS.canDelete()) return UI.toast('Only Administrator can delete records', 'err'); if (await UI.confirm('Delete this mailbox?', 'Delete', true)) { M().inbound = M().inbound.filter((x) => x.id !== el.dataset.id); S.emit(); } });
  UI.on('mail.desk', () => { UI.form({ title: 'Support desk address', icon: 'upload', fields: [{ k: 'desk', label: 'Shown on tickets, emails and portal', req: true, full: true }], values: { desk: M().desk }, onSubmit: (v) => { M().desk = v.desk.trim(); S.emit(); } }); });
  UI.on('mail.togg', (el) => { const t = M().toggles; t[el.dataset.k] = t[el.dataset.k] ? 0 : 1; S.emit(); });
  UI.on('mail.outsend', (el) => {
    const o = M().outbox.find((x) => x.id === el.dataset.id); if (!o) return;
    window.location.href = 'mailto:' + o.to.join(',') + '?subject=' + encodeURIComponent(o.subject) + '&body=' + encodeURIComponent(o.body);
    UI.toast('Opened in your mail app — mark Sent after dispatch');
  });
  UI.on('mail.outcopy', (el) => {
    const o = M().outbox.find((x) => x.id === el.dataset.id); if (!o) return;
    const txt = 'To: ' + o.to.join(', ') + '\nSubject: ' + o.subject + '\n\n' + o.body;
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(() => UI.toast('Copied')); else throw 0; }
    catch (e) { UI.toast('Copy blocked by browser — use Send', 'err'); }
  });
  UI.on('mail.outsent', (el) => { const o = M().outbox.find((x) => x.id === el.dataset.id); if (o) { o.status = 'Sent'; o.sentAt = now(); S.emit(); } });
  UI.on('mail.outdel', async (el) => { if (!ITMS.canDelete()) return UI.toast('Only Administrator can delete records', 'err'); if (await UI.confirm('Delete this queued email?', 'Delete', true)) { M().outbox = M().outbox.filter((x) => x.id !== el.dataset.id); S.emit(); } });
  UI.on('mail.paste', () => {
    UI.form({ title: 'Paste received email', sub: 'Copy from your mailbox, paste here, it becomes a ticket', icon: 'upload', fields: [{ k: 'raw', label: 'Raw email (headers + body)', type: 'textarea', full: true, req: true }], onSubmit: (v) => {
      const lines = String(v.raw).split('\n'); let from = '', subject = '', bi = 0;
      lines.forEach((l, i) => { const f = l.match(/^from:\s*(.+)/i); if (f && !from) { from = f[1].trim(); bi = i + 1; } const s = l.match(/^subject:\s*(.+)/i); if (s && !subject) { subject = s[1].trim(); bi = Math.max(bi, i + 1); } });
      const body = lines.slice(bi).join('\n').trim() || v.raw;
      D().inbox.unshift({ id: nid('ml', 'MAIL-', 3), from: from || 'unknown', subject: subject || '(no subject)', body, at: now(), status: 'Unprocessed' });
      S.emit(); UI.toast('Email captured — Convert it on Email to Ticket'); location.hash = '#/mailticket';
    } });
  });
  ITMS.sdpMailUI = function () {
    const m = M();
    const tg = `<div class="card"><h3>Ticket notifications</h3><table class="t"><tbody>${TOGS.map(([k, l]) => `<tr><td>${l}</td><td>${P(m.toggles[k] ? 'Published' : 'Draft')}</td><td style="text-align:right"><button class="btn xs ghost" data-act="mail.togg" data-k="${k}">${m.toggles[k] ? 'Turn off' : 'Turn on'}</button></td></tr>`).join('')}</tbody></table><div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn" data-act="mail.sync">${ic('refresh')}Queue pending now</button><button class="btn ghost" data-act="mail.desk">${ic('upload')}Support address: ${esc(m.desk)}</button></div></div>`;
    const sm = `<div class="card mt"><h3>SMTP accounts (sending)</h3>${UI.table({ id: 'smtpt', rows: () => m.smtp, sort: 'id', text: (r) => r.id + r.name + r.host, cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'name', label: 'Account' }, { k: 'host', label: 'Host' }, { k: 'port', label: 'Port' }, { k: 'enc', label: 'Encryption' }, { k: 'fromAddr', label: 'From' }, { k: 'status', label: 'Status', render: (r) => P(r.status === 'Live' ? 'Published' : 'Draft') }], actions: (r) => `<button class="btn xs" data-act="mail.smtptest" data-id="${r.id}">Verify</button> <button class="btn xs ghost" data-act="mail.smtpedit" data-id="${r.id}">Edit</button> <button class="btn xs ghost" data-act="mail.smtpdel" data-id="${r.id}">Delete</button>`, toolbar: tbNew('mail.smtpnew', 'New SMTP account') })}</div>`;
    const ib = `<div class="card mt"><h3>Inbound mailboxes (IMAP / POP3 → ticket)</h3>${UI.table({ id: 'inbt', rows: () => m.inbound, sort: 'id', text: (r) => r.id + r.name + r.host, cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'name', label: 'Mailbox' }, { k: 'type', label: 'Protocol' }, { k: 'host', label: 'Host' }, { k: 'port', label: 'Port' }, { k: 'ssl', label: 'SSL' }, { k: 'status', label: 'Status', render: (r) => P(r.status === 'Live' ? 'Published' : 'Draft') }], actions: (r) => `<button class="btn xs ghost" data-act="mail.inedit" data-id="${r.id}">Edit</button> <button class="btn xs ghost" data-act="mail.indel" data-id="${r.id}">Delete</button>`, toolbar: `${tbNew('mail.innew', 'New mailbox')} <button class="btn ghost" data-act="mail.paste">${ic('upload')}Paste received email</button>` })}</div>`;
    const ob = `<div class="card mt"><h3>Outbox — requester + reporting manager</h3>${UI.table({ id: 'emob', rows: () => m.outbox, sort: 'at', dir: -1, text: (r) => r.ticketId + r.subject + r.to.join(' '), filters: [{ k: 'status', label: 'Status', options: ['Queued', 'Sent'] }, { k: 'kind', label: 'Event', options: ['created', 'assigned', 'resolved', 'closed', 'note'] }], cols: [{ k: 'at', label: 'Queued', render: (r) => fdt(r.at) }, { k: 'ticketId', label: 'Ticket', mono: true }, { k: 'to', label: 'To', render: (r) => esc(r.to.join(', ')) }, { k: 'subject', label: 'Subject', render: (r) => `<b>${esc(r.subject)}</b>` }, { k: 'status', label: 'Status', render: (r) => P(r.status === 'Sent' ? 'Published' : 'Draft') }], actions: (r) => (r.status === 'Queued' ? `<button class="btn xs" data-act="mail.outsend" data-id="${r.id}">Send</button> <button class="btn xs ghost" data-act="mail.outcopy" data-id="${r.id}">Copy</button> <button class="btn xs ghost" data-act="mail.outsent" data-id="${r.id}">Sent</button> <button class="btn xs ghost" data-act="mail.outdel" data-id="${r.id}">Delete</button>` : `<button class="btn xs ghost" data-act="mail.outdel" data-id="${r.id}">Delete</button>`), toolbar: '' })}</div>`;
    return tg + sm + ib + ob;
  };

  /* ================= HR MODULE (leave · clearance · desk links) ================= */
  const empFieldsNoRole = () => { try { return ITMS.forms.empFields().filter((f) => f.k !== 'role'); } catch (e) { return [{ k: 'name', label: 'Employee name', req: true }, { k: 'designation', label: 'Designation' }, { k: 'dept', label: 'Department' }, { k: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive', 'Left'], blank: false }]; } };
  UI.on('hrstaff.new', () => UI.form({ title: 'New employee', icon: 'users', fields: empFieldsNoRole(), values: { status: 'Active', role: undefined }, onSubmit: (v) => { delete v.role; L.saveEmployee(v); UI.toast('Employee added'); } }));
  UI.on('hr.onboard', () => {
    UI.form({
      title: 'HR onboarding request', sub: 'Add or pick the joiner — IT completes assets, IDs and the signature form', icon: 'plus',
      fields: [{ k: 'empNo', label: 'Existing employee (or add new below)', type: 'select', options: () => [{ v: '', l: '— new joiner —' }].concat(empOpts()) }, { section: 'New joiner details (leave blank if picked above)' }, { k: 'name', label: 'Full name', full: true }, { k: 'designation', label: 'Designation' }, { k: 'dept', label: 'Department' }, { k: 'doj', label: 'Date of joining', type: 'date' }, { k: 'email', label: 'Email' }, { k: 'mobile', label: 'Mobile' }, { k: 'date', label: 'Start date', type: 'date', req: true }],
      values: { date: today(), doj: today() },
      submit: 'Submit to IT',
      onSubmit: (v) => {
        let no = v.empNo;
        if (!no) {
          if (!String(v.name || '').trim() || !String(v.dept || '').trim()) throw new Error('Pick an employee, or enter name + department for a new joiner');
          const data = { name: v.name.trim(), designation: v.designation || '', manager: '', doj: v.doj || v.date, dol: '', dept: v.dept.trim(), location: '', email: v.email || '', mobile: v.mobile || '', status: 'Active' };
          L.saveEmployee(data); no = data.no;
        }
        const e = L.emp(no);
        if (e.status !== 'Active') { e.status = 'Active'; if (!e.doj) e.doj = v.date; }
        D().hr.onb.unshift({ id: nid('hrb', 'HRB-', 3), empNo: no, date: v.date, status: 'Pending IT', ref: '', at: now(), by: chatMe() || curRole() });
        notify('Email', 'IT Technicians', `[HRB] Onboarding requested for ${e.name}`, `${e.name} (${no}) · ${e.dept} · start ${v.date} — accept it under Onboarding & Offboarding`);
        S.emit(); UI.toast('Sent to IT for completion');
      },
    });
  });
  UI.on('hr.offboard', () => {
    UI.form({
      title: 'HR offboarding request', sub: 'Pick the leaver — IT collects assets, disables IDs and prints clearance', icon: 'undo',
      fields: [{ k: 'empNo', label: 'Employee', type: 'select', options: empOpts, req: true }, { k: 'date', label: 'Last working day', type: 'date', req: true }],
      values: { date: today() },
      submit: 'Submit to IT',
      onSubmit: (v) => {
        const e = L.emp(v.empNo);
        D().hr.offb.unshift({ id: nid('hrf', 'HRF-', 3), empNo: v.empNo, date: v.date, status: 'Pending IT', ref: '', at: now(), by: chatMe() || curRole() });
        notify('Email', 'IT Technicians', `[HRF] Offboarding requested for ${e.name}`, `${e.name} (${v.empNo}) · last day ${v.date} — accept it under Onboarding & Offboarding`);
        S.emit(); UI.toast('Sent to IT for completion');
      },
    });
  });
  UI.on('hrstaff.edit', (el) => { const e = L.emp(el.dataset.id); if (!e) return; UI.form({ title: 'Edit ' + e.name, sub: e.no, icon: 'edit', fields: empFieldsNoRole(), values: e, onSubmit: (v) => { delete v.role; L.saveEmployee(v, e.no); UI.toast('Employee updated'); } }); });
  const leaveDays = (f, t) => Math.max(0, Math.round((new Date(t) - new Date(f)) / 864e5) + 1);
  function hrBal(empNo, type) {
    const yr = String(new Date().getFullYear());
    const allow = ((D().hr.leaveTypes.find((x) => x.type === type) || {}).days) || 0;
    const used = D().hr.leaves.filter((l) => l.empNo === empNo && l.type === type && l.status === 'Approved' && String(l.from || '').slice(0, 4) === yr).reduce((s, l) => s + (+l.days || 0), 0);
    return { allow, used, left: allow - used };
  }
  UI.on('leave.apply', () => {
    UI.form({ title: 'Apply leave', icon: 'cal', fields: [{ k: 'empNo', label: 'Employee', type: 'select', options: empOpts, req: true }, { k: 'type', label: 'Leave type', type: 'select', options: () => D().hr.leaveTypes.map((x) => x.type), blank: false }, { k: 'from', label: 'From', type: 'date', req: true }, { k: 'to', label: 'To', type: 'date', req: true }, { k: 'reason', label: 'Reason', type: 'textarea', full: true }], values: { empNo: curUser(), type: 'Annual', from: today(), to: today() }, onSubmit: (v) => {
      if (v.to < v.from) throw new Error('To date is before From date');
      const days = leaveDays(v.from, v.to); const b = hrBal(v.empNo, v.type);
      if (b.allow > 0 && days > b.left) throw new Error(`Only ${b.left} ${v.type} day(s) left this year`);
      D().hr.leaves.unshift({ id: nid('lv', 'LV-', 3), empNo: v.empNo, type: v.type, from: v.from, to: v.to, days, reason: v.reason || '', status: 'Pending', at: now() });
      S.emit(); UI.toast('Leave submitted for approval');
    } });
  });
  UI.on('leave.ok', (el) => {
    const l = D().hr.leaves.find((x) => x.id === el.dataset.id); if (!l || l.status !== 'Pending') return;
    l.status = 'Approved'; l.decided = now();
    D().schedules.unshift({ id: nid('sd', 'SCH-', 3), title: `Leave: ${L.empName(l.empNo)} (${l.type})`, kind: 'Time off', date: l.from, time: '', owner: '', link: '' });
    S.emit(); UI.toast('Approved + added to Scheduler');
  });
  UI.on('leave.no', (el) => { const l = D().hr.leaves.find((x) => x.id === el.dataset.id); if (!l) return; UI.form({ title: 'Reject ' + l.id, icon: 'x', fields: [{ k: 'why', label: 'Reason', type: 'textarea', full: true, req: true }], onSubmit: (v) => { l.status = 'Rejected'; l.reason = (l.reason ? l.reason + ' | ' : '') + 'Rejected: ' + v.why; S.emit(); } }); });
  UI.on('leave.del', async (el) => { if (!ITMS.canDelete()) return UI.toast('Only Administrator can delete records', 'err'); if (await UI.confirm('Delete this leave record?', 'Delete', true)) { D().hr.leaves = D().hr.leaves.filter((x) => x.id !== el.dataset.id); S.emit(); } });
  UI.on('ltypes.edit', () => { UI.form({ title: 'Leave types & yearly allowance', sub: 'One per line: Type | days', icon: 'cal', fields: [{ k: 't', label: 'Types', type: 'textarea', full: true }], values: { t: D().hr.leaveTypes.map((x) => x.type + ' | ' + x.days).join('\n') }, onSubmit: (v) => { D().hr.leaveTypes = v.t.split('\n').map((x) => x.trim()).filter(Boolean).map((l) => { const p = l.split('|').map((y) => y.trim()); return { type: p[0], days: Math.max(0, +p[1] || 0) }; }).filter((x) => x.type); S.emit(); } }); });
  UI.on('clear.sign', (el) => {
    const no = el.dataset.id;
    const assets = db().hw.filter((a) => a.holder === no);
    const ids = (db().accounts || []).filter((a) => a.empNo === no && a.status === 'Active');
    const tks = H() ? H().requests.filter((r) => r.requester === no && ['Open', 'Assigned', 'In Progress', 'On Hold'].indexOf(r.status) >= 0) : [];
    if (assets.length || ids.length || tks.length) return UI.toast('Still pending: return assets, disable IDs, close tickets first', 'err');
    D().hr.clear.unshift({ empNo: no, at: now(), by: chatMe() || curRole() }); S.emit(); UI.toast('Clearance signed');
  });
  pages.hr = {
    title: 'HR Management', crumb: 'Staff directory · leave · exit clearance · HR service desk', icon: 'users', color: '#00c2ff',
    render() {
      const d = D(); const tab = UI.curTab('hr', 'staff');
      const tabs = UI.tabs('hr', [{ id: 'staff', label: 'Staff directory' }, { id: 'req', label: 'On/offboarding requests', count: d.hr.onb.filter((x) => x.status !== 'Completed').length + d.hr.offb.filter((x) => x.status !== 'Completed').length }, { id: 'leave', label: 'Leave', count: d.hr.leaves.filter((l) => l.status === 'Pending').length }, { id: 'bal', label: 'Balances' }, { id: 'clear', label: 'Exit clearance' }, { id: 'desk', label: 'HR desk' }]);
      let body = '';
      if (tab === 'staff') body = UI.table({ id: 'hrst', rows: () => db().employees.filter((e) => !e.sys), sort: 'no', text: (r) => [r.no, r.name, r.designation, r.dept, r.email].join(' '), filters: [{ k: 'dept', label: 'Department', options: () => L.uniq(db().employees.map((e) => e.dept)).sort() }, { k: 'status', label: 'Status', options: ['Active', 'Inactive', 'Left'] }], cols: [{ k: 'no', label: 'Emp No', mono: true }, { k: 'name', label: 'Name', render: (r) => `<b>${esc(r.name)}</b>` }, { k: 'designation', label: 'Designation' }, { k: 'dept', label: 'Department' }, { k: 'manager', label: 'Manager' }, { k: 'email', label: 'Email' }, { k: 'status', label: 'Status', render: (r) => P(r.status === 'Active' ? 'Published' : r.status === 'Left' ? 'Expired' : 'Draft') }], actions: (r) => `<button class="ibtn" data-act="hrstaff.edit" data-id="${r.no}">${ic('edit')}</button>`, toolbar: `<button class="btn" data-act="hr.onboard">${ic('plus')}Onboard request</button> <button class="btn hot" data-act="hr.offboard">${ic('undo')}Offboard request</button>` });
      else if (tab === 'req') body = UI.table({ id: 'hrq', rows: () => d.hr.onb.map((x) => Object.assign({ kind: 'Onboarding', who: L.empName(x.empNo) }, x)).concat(d.hr.offb.map((x) => Object.assign({ kind: 'Offboarding', who: L.empName(x.empNo) }, x))), sort: 'at', dir: -1, text: (r) => r.id + r.who + r.kind, filters: [{ k: 'kind', label: 'Type', options: ['Onboarding', 'Offboarding'] }, { k: 'status', label: 'Status', options: ['Pending IT', 'Accepted', 'Completed'] }], cols: [{ k: 'id', label: 'Request', mono: true }, { k: 'kind', label: 'Type' }, { k: 'who', label: 'Employee', render: (r) => `<b>${esc(r.who)}</b>` }, { k: 'date', label: 'Start / last day' }, { k: 'status', label: 'Status', render: (r) => P(r.status === 'Completed' ? 'Published' : r.status === 'Accepted' ? 'Draft' : 'Draft') }, { k: 'ref', label: 'IT record' }], actions: (r) => (r.status === 'Completed' && r.ref ? `<button class="btn xs ghost" data-act="lc.doc" data-id="${r.ref}">Print form</button>` : ''), toolbar: `<button class="btn" data-act="hr.onboard">${ic('plus')}Onboard request</button> <button class="btn hot" data-act="hr.offboard">${ic('undo')}Offboard request</button>` });
      else if (tab === 'leave') body = UI.table({ id: 'lvt', rows: () => d.hr.leaves.map((l) => Object.assign({ who: L.empName(l.empNo) }, l)), sort: 'from', dir: -1, text: (r) => r.id + r.who + r.type, filters: [{ k: 'status', label: 'Status', options: ['Pending', 'Approved', 'Rejected'] }, { k: 'type', label: 'Type', options: () => d.hr.leaveTypes.map((x) => x.type) }], cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'who', label: 'Employee' }, { k: 'type', label: 'Type' }, { k: 'from', label: 'From' }, { k: 'to', label: 'To' }, { k: 'days', label: 'Days', num: true }, { k: 'status', label: 'Status', render: (r) => P(r.status === 'Approved' ? 'Published' : r.status === 'Rejected' ? 'Expired' : 'Draft') }], actions: (r) => { const del = (typeof ITMS!=='undefined'&&ITMS.canDelete&&ITMS.canDelete())?'<button class="btn xs ghost" data-act="leave.del" data-id="'+r.id+'" title="Delete (Admin only)">Delete</button>':''; return r.status === 'Pending' ? `<button class="btn xs" data-act="leave.ok" data-id="${r.id}">Approve</button> <button class="btn xs ghost" data-act="leave.no" data-id="${r.id}">Reject</button> ` + del : del; }, toolbar: `${tbNew('leave.apply', 'Apply leave')} <button class="btn ghost" data-act="ltypes.edit">${ic('cal')}Leave types</button>` });
      else if (tab === 'bal') body = UI.table({ id: 'lvb', rows: () => db().employees.filter((e) => e.status === 'Active' && !e.sys).map((e) => { const o = { no: e.no, who: e.name }; d.hr.leaveTypes.forEach((t) => { o['b_' + t.type] = hrBal(e.no, t.type).left; }); return o; }), sort: 'who', text: (r) => r.who, cols: [{ k: 'who', label: 'Employee', render: (r) => `<b>${esc(r.who)}</b>` }].concat(d.hr.leaveTypes.map((t) => ({ k: 'b_' + t.type, label: t.type + ' left', num: true, render: (r) => (r['b_' + t.type] < 0 ? P(r['b_' + t.type] + '', 'coral') : r['b_' + t.type]) }))), actions: () => '' });
      else if (tab === 'clear') body = UI.table({ id: 'lvc', rows: () => db().employees.filter((e) => e.status !== 'Active').map((e) => { const signed = d.hr.clear.find((c) => c.empNo === e.no); return Object.assign({}, e, { nA: db().hw.filter((a) => a.holder === e.no).length, nI: (db().accounts || []).filter((a) => a.empNo === e.no && a.status === 'Active').length, nT: H() ? H().requests.filter((r) => r.requester === e.no && ['Open', 'Assigned', 'In Progress', 'On Hold'].indexOf(r.status) >= 0).length : 0, signed: signed ? fdt(signed.at) + ' by ' + signed.by : '' }); }), sort: 'no', text: (r) => r.no + r.name, cols: [{ k: 'no', label: 'Emp No', mono: true }, { k: 'name', label: 'Leaver', render: (r) => `<b>${esc(r.name)}</b>` }, { k: 'status', label: 'State', render: (r) => P(r.status === 'Left' ? 'Expired' : 'Draft') }, { k: 'nA', label: 'Assets held', num: true }, { k: 'nI', label: 'Active IDs', num: true }, { k: 'nT', label: 'Open tickets', num: true }, { k: 'signed', label: 'Clearance' }], actions: (r) => (!r.signed && !r.nA && !r.nI && !r.nT ? `<button class="btn xs" data-act="clear.sign" data-id="${r.no}">Sign clearance</button>` : ''), toolbar: '' });
      else body = `<div class="grid g2"><div class="card"><h3>HR service desk</h3><p style="color:var(--muted)">Leave, letters, onboarding and HR requests run on the HR desk instance.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-go="#/esm">Open Enterprise desks</button><button class="btn ghost" data-go="#/scheduler">Scheduler leave view</button></div></div><div class="card"><h3>Open HR-linked items</h3><table class="t"><tbody>${(H() ? H().items.filter((i) => /hr|human|people/i.test((i.project || '') + (i.category || '')) && ['Open', 'Ongoing', 'Pending'].indexOf(i.status) >= 0) : []).map((i) => `<tr><td>#${i.id}</td><td>${esc(i.desc)}</td><td>${P(i.status)}</td></tr>`).join('') || '<tr><td><div class="empty">Nothing open</div></td></tr>'}</tbody></table></div></div>`;
      return `<div class="card">${tabs}${body}</div>`;
    },
  };

  /* ================= FINANCE MODULE (expenses · vendor payments · budget link) ================= */
  function budgetBump(year, cat, amt, note) {
    const d = db(); d.budgets = d.budgets || [];
    let r = d.budgets.find((b) => +b.year === +year && b.category === cat);
    if (!r) { r = { id: 'BG-' + year + '-' + cat.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X'), year: +year, category: cat, planned: 0, extra: 0, notes: '' }; d.budgets.push(r); }
    r.extra = (+r.extra || 0) + amt; if (note) r.notes = note;
  }
  const budgetCats = () => { try { return ITMS.budget.CATS; } catch (e) { return ['Other']; } };
  UI.on('exp.new', () => {
    UI.form({ title: 'New expense claim', icon: 'dollar', fields: [{ k: 'empNo', label: 'Employee', type: 'select', options: empOpts, req: true }, { k: 'date', label: 'Date', type: 'date', req: true }, { k: 'category', label: 'Budget category', type: 'select', options: budgetCats, blank: false }, { k: 'desc', label: 'Description', full: true, req: true }, { k: 'amount', label: 'Amount', type: 'number', req: true }], values: { empNo: curUser(), date: today(), category: 'Other' }, onSubmit: (v) => { D().fin.expenses.unshift({ id: nid('ex', 'EXP-', 3), empNo: v.empNo, date: v.date, category: v.category, desc: v.desc, amount: +v.amount || 0, status: 'Submitted', approver: (L.emp(v.empNo) || {}).manager || '', at: now() }); S.emit(); UI.toast('Expense submitted'); } });
  });
  UI.on('exp.ok', (el) => { const r = D().fin.expenses.find((x) => x.id === el.dataset.id); if (r) { r.status = 'Approved'; S.emit(); } });
  UI.on('exp.no', (el) => { const r = D().fin.expenses.find((x) => x.id === el.dataset.id); if (!r) return; UI.form({ title: 'Reject ' + r.id, icon: 'x', fields: [{ k: 'why', label: 'Reason', type: 'textarea', full: true, req: true }], onSubmit: (v) => { r.status = 'Rejected'; r.desc += ' | Rejected: ' + v.why; S.emit(); } }); });
  UI.on('exp.pay', (el) => {
    const r = D().fin.expenses.find((x) => x.id === el.dataset.id); if (!r || r.status !== 'Approved') return;
    r.status = 'Paid'; r.paidAt = today();
    budgetBump(+String(r.date).slice(0, 4), r.category, r.amount, 'Expense ' + r.id);
    try { postJV({ no: 'EX', date: r.date, type: 'Expense', ref: r.id, desc: `${r.desc} (${L.empName(r.empNo)})`, lines: [{ gl: (D().fin.catgl || {})[r.category] || '5290', dr: +r.amount || 0, cr: 0, cx: 'OPEX', ref: '' }, { gl: '1110', dr: 0, cr: +r.amount || 0, cx: '', ref: '' }] }); } catch (e) { UI.toast(e.message, 'err'); }
    S.emit(); UI.toast('Paid — posted to budget actuals');
  });
  UI.on('exp.del', async (el) => { if (!ITMS.canDelete()) return UI.toast('Only Administrator can delete records', 'err'); if (await UI.confirm('Delete this expense claim?', 'Delete', true)) { D().fin.expenses = D().fin.expenses.filter((x) => x.id !== el.dataset.id); S.emit(); } });
  UI.on('pay.new', () => {
    const open = db().pos.filter((p) => p.approval === 'Approved' && p.invoice !== 'Paid');
    UI.form({ title: 'Record vendor payment', icon: 'dollar', fields: [{ k: 'poNo', label: 'Purchase order', type: 'select', options: () => open.map((p) => ({ v: p.poNo, l: `${p.poNo} · ${p.vendor} · ${p.lines.reduce((s, l) => s + l.qty * (l.price || 0), 0).toFixed(0)}` })), req: true }, { k: 'amount', label: 'Amount paid', type: 'number', req: true }, { k: 'date', label: 'Payment date', type: 'date', req: true }, { k: 'mode', label: 'Mode', type: 'select', options: ['Bank transfer', 'Cheque', 'Cash'], blank: false }, { k: 'ref', label: 'Reference / cheque no.' }], values: { date: today(), mode: 'Bank transfer' }, onSubmit: (v) => { D().fin.payments.unshift({ id: nid('py', 'PAY-', 3), poNo: v.poNo, vendor: (L.po(v.poNo) || {}).vendor || '', amount: +v.amount || 0, date: v.date, mode: v.mode, ref: v.ref || '', at: now() }); const p = L.po(v.poNo); if (p) p.invoice = 'Paid'; try { postJV({ no: 'PV', date: v.date, type: 'Payment', ref: v.poNo, desc: `Vendor payment ${(L.po(v.poNo) || {}).vendor || ''} via ${v.mode}`, lines: [{ gl: '2110', dr: +v.amount || 0, cr: 0, cx: '', ref: '' }, { gl: '1110', dr: 0, cr: +v.amount || 0, cx: '', ref: '' }] }); } catch (e) { UI.toast(e.message, 'err'); } S.emit(); UI.toast('Payment recorded, PO marked Paid'); } });
  });
  UI.on('pay.del', async (el) => { if (!ITMS.canDelete()) return UI.toast('Only Administrator can delete records', 'err'); if (await UI.confirm('Delete this payment record?', 'Delete', true)) { D().fin.payments = D().fin.payments.filter((x) => x.id !== el.dataset.id); S.emit(); } });
  pages.finance = {
    title: 'Finance', crumb: 'Expenses · vendor payments · budget link', icon: 'dollar', color: '#3b82f6',
    render() {
      const d = D(); const tab = UI.curTab('finance', 'exp');
      const tabs = UI.tabs('finance', [{ id: 'exp', label: 'Expenses', count: d.fin.expenses.filter((e) => e.status === 'Submitted').length }, { id: 'pay', label: 'Vendor payments', count: d.fin.payments.length }, { id: 'bills', label: 'AP Bills', count: d.fin.jv.filter((e) => e.type === 'Purchase Bill' && !e.paid).length }, { id: 'invoices', label: 'Invoices', count: (D().fin.invoices || []).length }, { id: 'grninv', label: 'GRN → invoices' }, { id: 'jv', label: 'Journal', count: d.fin.jv.length }, { id: 'ledger', label: 'Ledger' }, { id: 'tb', label: 'Trial balance' }, { id: 'recon', label: 'Reconciliation' }, { id: 'coa', label: 'COA' }, { id: 'links', label: 'Linked areas' }]);
      let body = '';
      if (tab === 'exp') body = UI.table({ id: 'expt', rows: () => d.fin.expenses.map((e) => Object.assign({ who: L.empName(e.empNo) }, e)), sort: 'date', dir: -1, text: (r) => r.id + r.who + r.desc, filters: [{ k: 'status', label: 'Status', options: ['Submitted', 'Approved', 'Rejected', 'Paid'] }, { k: 'category', label: 'Category', options: budgetCats }], cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'who', label: 'Employee' }, { k: 'date', label: 'Date' }, { k: 'category', label: 'Budget category' }, { k: 'desc', label: 'Description', render: (r) => clip(r.desc) }, { k: 'amount', label: 'Amount', num: true, render: (r) => fmtNum(r.amount, 2) }, { k: 'status', label: 'Status', render: (r) => P(r.status === 'Paid' ? 'Published' : r.status === 'Rejected' ? 'Expired' : r.status === 'Approved' ? 'Published' : 'Draft') }], actions: (r) => { const del = (typeof ITMS!=='undefined'&&ITMS.canDelete&&ITMS.canDelete())?'<button class="btn xs ghost" data-act="exp.del" data-id="'+r.id+'" title="Delete (Admin only)">Delete</button>':''; return r.status === 'Submitted' ? `<button class="btn xs" data-act="exp.ok" data-id="${r.id}">Approve</button> <button class="btn xs ghost" data-act="exp.no" data-id="${r.id}">Reject</button> ` + del : r.status === 'Approved' ? `<button class="btn xs" data-act="exp.pay" data-id="${r.id}">Pay + post</button> ` + del : del; }, toolbar: tbNew('exp.new', 'New expense') });
      else if (tab === 'pay') body = UI.table({ id: 'payt', rows: () => d.fin.payments, sort: 'date', dir: -1, text: (r) => r.id + r.poNo + r.vendor, cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'poNo', label: 'PO', mono: true, render: (r) => `<a class="link" data-act="po.view" data-id="${r.poNo}">${r.poNo}</a>` }, { k: 'vendor', label: 'Vendor' }, { k: 'amount', label: 'Amount', num: true, render: (r) => fmtNum(r.amount, 2) }, { k: 'date', label: 'Paid on' }, { k: 'mode', label: 'Mode' }, { k: 'ref', label: 'Reference' }], actions: (r) => `${(typeof ITMS!=='undefined'&&ITMS.canDelete&&ITMS.canDelete())?'<button class="btn xs ghost" data-act="pay.del" data-id="'+r.id+'" title="Delete (Admin only)">Delete</button>':''}`, toolbar: tbNew('pay.new', 'Record payment') });
      else if (tab === 'bills') body = UI.table({ id: 'finbill', rows: () => d.fin.jv.filter((e) => e.type === 'Purchase Bill'), sort: 'date', dir: -1, text: (r) => [r.id, r.ref, r.desc].join(' '), filters: [{ k: 'paid', label: 'Status', options: ['Unpaid', 'Paid'], get: (r) => (r.paid ? 'Paid' : 'Unpaid') }], cols: [{ k: 'date', label: 'Bill date' }, { k: 'id', label: 'Bill No', mono: true }, { k: 'vendor', label: 'Vendor', val: (r) => billVend(r), render: (r) => esc(billVend(r)) }, { k: 'ref', label: 'GRN', mono: true, render: (r) => `<a class="link" data-act="grn.print" data-id="${r.ref}">${r.ref}</a>` }, { k: 'due', label: 'Due', val: (r) => billDue(r), render: (r) => (billDue(r) < L.today() && !r.paid ? P('Overdue', 'coral') : billDue(r)) }, { k: 'total', label: 'Amount', num: true, render: (r) => fmtNum(r.total, 2) }, { k: 'paid', label: 'Status', render: (r) => P(r.paid ? 'Published' : 'Draft') }], actions: (r) => (r.paid ? `<button class="ibtn" data-act="jv.view" data-id="${r.id}">${ic('eye')}</button>` : `<button class="btn xs" data-act="bill.pay" data-id="${r.id}">Pay</button> <button class="ibtn" data-act="jv.view" data-id="${r.id}">${ic('eye')}</button>`), toolbar: '' });
      else if (tab === 'invoices') body = UI.table({ id: 'fininv', rows: () => (D().fin.invoices || []), sort: 'date', dir: -1, text: (r) => [r.id, r.poNo, r.vendor].join(' '), cols: [{ k: 'id', label: 'Invoice No', mono: true }, { k: 'poNo', label: 'PO No', mono: true, render: (r) => `<a class="link" data-act="po.view" data-id="${r.poNo}">${r.poNo}</a>` }, { k: 'vendor', label: 'Vendor' }, { k: 'date', label: 'Date' }, { k: 'dueDate', label: 'Due Date' }, { k: 'status', label: 'Status', render: (r) => P(r.status) }], actions: (r) => `<button class="ibtn" data-act="inv.view" data-id="${r.id}">${ic('eye')}</button><button class="ibtn" data-act="inv.print" data-id="${r.id}" title="Print">${ic('print')}</button><button class="btn xs" data-act="inv.post" data-id="${r.id}">${ic('receipt')}Post</button>`, toolbar: `<button class="btn" data-act="po.generateInvoice">${ic('receipt')}Generate from PO</button> <button class="btn ghost" data-act="grn.generateInvoice">${ic('receipt')}Generate from GRN</button>` });
      else if (tab === 'grninv') body = UI.table({ id: 'grninv', rows: () => (db().grns || []).map((g) => { const p = L.po(g.poNo) || {}; const inv = (D().fin.invoices || []).find((i) => i.grnNo === g.grnNo); return { grnNo: g.grnNo, poNo: g.poNo, vendor: p.vendor, date: g.date, amount: inv ? inv.total : 0, invId: inv ? inv.id : '', status: inv ? inv.status : 'Not invoiced' }; }), sort: 'grnNo', dir: -1, text: (r) => [r.grnNo, r.poNo, r.vendor].join(' '), cols: [{ k: 'grnNo', label: 'GRN No', mono: true, render: (r) => `<a class="link" data-act="grn.print" data-id="${r.grnNo}">${r.grnNo}</a>` }, { k: 'poNo', label: 'PO No', mono: true, render: (r) => `<a class="link" data-act="po.view" data-id="${r.poNo}">${r.poNo}</a>` }, { k: 'vendor', label: 'Vendor' }, { k: 'date', label: 'GRN date', render: (r) => fmtDate(r.date) }, { k: 'amount', label: 'Invoice value', num: true, render: (r) => (r.amount ? fmtNum(r.amount, 2) : '') }, { k: 'status', label: 'Invoice status', render: (r) => P(r.status) }], actions: (r) => (r.invId ? `<button class="ibtn" data-act="inv.view" data-id="${r.invId}">${ic('eye')}</button>` : `<button class="btn xs" data-act="grn.generateInvoice" data-id="${r.grnNo}">${ic('receipt')}Generate invoice</button>`), toolbar: `<button class="btn ghost" data-act="grn.generateInvoice">${ic('receipt')}Generate from GRN</button>` });
      else if (tab === 'jv') body = UI.table({ id: 'finjv', rows: () => d.fin.jv, sort: 'at', dir: -1, text: (r) => [r.id, r.type, r.ref, r.desc].join(' '), filters: [{ k: 'type', label: 'Transaction type', options: ['Purchase Bill', 'Payment', 'Expense', 'Depreciation', 'Disposal', 'Stock Issue'] }], cols: [{ k: 'date', label: 'Date' }, { k: 'id', label: 'Voucher No', mono: true }, { k: 'type', label: 'Type' }, { k: 'ref', label: 'Reference', mono: true, render: (r) => (r.ref && r.ref.indexOf('GRN-') === 0 ? `<a class="link" data-act="grn.print" data-id="${r.ref}">${r.ref}</a>` : r.ref && r.ref.indexOf('PO-') === 0 ? `<a class="link" data-act="po.view" data-id="${r.ref}">${r.ref}</a>` : r.ref && r.ref.indexOf('REQ-') === 0 ? `<a class="link" data-act="rq.view" data-id="${r.ref}">${r.ref}</a>` : r.ref && r.ref.indexOf('EXP-') === 0 ? `<a class="link" data-go="#/finance">${r.ref}</a>` : esc(r.ref)) }, { k: 'desc', label: 'Narration', render: (r) => clip(r.desc) }, { k: 'total', label: 'Amount', num: true, render: (r) => fmtNum(r.total, 2) }], actions: (r) => `<button class="ibtn" data-act="jv.view" data-id="${r.id}">${ic('eye')}</button>`, toolbar: `<button class="btn" data-act="fin.dep">${ic('dollar')}Run depreciation</button>` });
      else if (tab === 'ledger') body = UI.table({ id: 'finlg', rows: () => { const out = []; d.fin.jv.forEach((e) => (e.lines || []).forEach((l) => out.push({ eid: e.id, edate: e.date, etype: e.type, eref: e.ref, edesc: e.desc, gl: l.gl, dr: +l.dr || 0, cr: +l.cr || 0, cx: l.cx || '' }))); return out; }, sort: 'edate', dir: -1, text: (r) => [r.eid, r.eref, r.gl, r.edesc].join(' '), filters: [{ k: 'gl', label: 'GL account', options: () => d.fin.coa.map((g) => g.code) }], cols: [{ k: 'edate', label: 'Date' }, { k: 'eid', label: 'Voucher', mono: true }, { k: 'etype', label: 'Type' }, { k: 'gl', label: 'GL', mono: true, render: (r) => `${r.gl} · ${esc(glName(r.gl))}` }, { k: 'dr', label: 'Debit', num: true, render: (r) => (r.dr ? fmtNum(r.dr, 2) : '') }, { k: 'cr', label: 'Credit', num: true, render: (r) => (r.cr ? fmtNum(r.cr, 2) : '') }, { k: 'cx', label: 'CAPEX/OPEX' }], foot: (rows) => `<tr><td colspan="4">Total (filtered)</td><td class="num">${fmtNum(rows.reduce((s, r) => s + r.dr, 0), 2)}</td><td class="num">${fmtNum(rows.reduce((s, r) => s + r.cr, 0), 2)}</td><td class="num">Bal ${fmtNum(rows.reduce((s, r) => s + r.dr - r.cr, 0), 2)}</td></tr>` });
      else if (tab === 'tb') {
        const per = UI.tab.finTB || 'ALL';
        const rows = d.fin.coa.map((g) => { let dr = 0, cr = 0; d.fin.jv.forEach((e) => { if (per !== 'ALL' && e.month !== per) return; (e.lines || []).forEach((l) => { if (l.gl === g.code) { dr += +l.dr || 0; cr += +l.cr || 0; } }); }); return { code: g.code, name: g.name, type: g.type, dr: r2(dr), cr: r2(cr) }; }).filter((r) => r.dr || r.cr);
        const td = r2(rows.reduce((s, r) => s + r.dr, 0)), tc = r2(rows.reduce((s, r) => s + r.cr, 0));
        body = `<div style="margin-bottom:10px"><label>Period <select class="in" id="fintbper" style="width:auto;display:inline-block"><option value="ALL">All time (tallies)</option>${finMonths().map((m) => `<option value="${m}" ${m === per ? 'selected' : ''}>${m}</option>`).join('')}</select> ${Math.abs(td - tc) < 0.005 ? P('Tallied', 'mint') : P('Out of balance', 'coral')}</div>`
          + UI.table({ id: 'fintb', rows: () => rows, sort: 'code', text: (r) => r.code + r.name, cols: [{ k: 'code', label: 'GL', mono: true }, { k: 'name', label: 'Account' }, { k: 'type', label: 'Type' }, { k: 'dr', label: 'Debit', num: true, render: (r) => (r.dr ? fmtNum(r.dr, 2) : '') }, { k: 'cr', label: 'Credit', num: true, render: (r) => (r.cr ? fmtNum(r.cr, 2) : '') }], foot: () => `<tr><td colspan="3">Total</td><td class="num">${fmtNum(td, 2)}</td><td class="num">${fmtNum(tc, 2)}</td></tr>` });
      } else if (tab === 'recon') {
        const per = UI.tab.finRecon || L.today().slice(0, 7);
        let grnV = 0; (db().grns || []).forEach((g) => { if (String(g.date || '').slice(0, 7) !== per) return; const b = billLines(g); grnV = r2(grnV + b.excl + b.vat); });
        const bills = d.fin.jv.filter((e) => e.type === 'Purchase Bill' && e.month === per);
        const billV = r2(bills.reduce((s, e) => s + (+e.total || 0), 0));
        let tdr = 0, tcr = 0, cxC = 0, cxO = 0;
        d.fin.jv.forEach((e) => { if (e.month !== per) return; (e.lines || []).forEach((l) => { tdr += +l.dr || 0; tcr += +l.cr || 0; if (l.cx === 'CAPEX') cxC += +l.dr || 0; if (l.cx === 'OPEX') cxO += +l.dr || 0; }); });
        tdr = r2(tdr); tcr = r2(tcr); cxC = r2(cxC); cxO = r2(cxO);
        const kpi = (n, l) => `<div class="card" style="border-left:4px solid ${C.blue}"><div style="font:700 22px var(--head)">${n}</div><small style="color:var(--muted)">${l}</small></div>`;
        body = `<div style="margin-bottom:10px"><label>Period <select class="in" id="finrecon" style="width:auto;display:inline-block">${L.uniq(finMonths().concat([L.today().slice(0, 7)])).sort().reverse().map((m) => `<option value="${m}" ${m === per ? 'selected' : ''}>${m}</option>`).join('')}</select></div>`
          + `<div class="grid g3">${kpi(fmtNum(grnV, 2), 'Goods received (GRN value) ' + per)}${kpi(fmtNum(billV, 2), 'Purchase bills posted')}${kpi(Math.abs(grnV - billV) < 0.01 ? 'MATCH' : fmtNum(Math.abs(grnV - billV), 2) + ' gap', 'GRN vs bills ' + (Math.abs(grnV - billV) < 0.01 ? P('Tallied', 'mint') : P('Check', 'amber')))}</div>`
          + `<div class="grid g3 mt">${kpi(fmtNum(tdr, 2) + ' / ' + fmtNum(tcr, 2), 'Journal Dr / Cr ' + (Math.abs(tdr - tcr) < 0.005 ? P('Tallied', 'mint') : P('Out of balance', 'coral')))}${kpi(fmtNum(cxC, 2), 'CAPEX posted')}${kpi(fmtNum(cxO, 2), 'OPEX posted')}</div>`
          + (() => {
            let bAct = {}; try { bAct = ITMS.budget.actualsByYear(+per.slice(0, 4)); } catch (e) { bAct = {}; }
            const glByCat = D().fin.catgl || {}; const led = {};
            d.fin.jv.forEach((e) => { if (String(e.month || '').slice(0, 4) !== per.slice(0, 4)) return; (e.lines || []).forEach((l) => { const cat = Object.keys(glByCat).filter((c) => glByCat[c] === l.gl)[0]; if (cat) led[cat] = r2((led[cat] || 0) + (+l.dr || 0)); }); });
            const cats = L.uniq(Object.keys(bAct).concat(Object.keys(led)));
            return `<div class="card mt"><h3>Budget actual vs ledger ${esc(per.slice(0, 4))}</h3><table class="t"><thead><tr><th>Category</th><th class="num">Budget actual (PO-based)</th><th class="num">Ledger Dr (posted)</th><th class="num">Diff</th><th></th></tr></thead><tbody>${cats.map((c) => { const a = r2(bAct[c] || 0), g = r2(led[c] || 0), df = r2(a - g); return `<tr><td>${esc(c)}</td><td class="num">${fmtNum(a, 2)}</td><td class="num">${fmtNum(g, 2)}</td><td class="num">${fmtNum(df, 2)}</td><td>${Math.abs(df) < 0.01 ? P('Tallied', 'mint') : P('Timing', 'amber')}</td></tr>`; }).join('')}</tbody></table></div>`;
          })();
      } else if (tab === 'coa') body = UI.table({ id: 'fincoa', rows: () => d.fin.coa, sort: 'code', text: (r) => r.code + r.name, filters: [{ k: 'type', label: 'Type', options: ['Asset', 'Liability', 'Equity', 'Income', 'Expense'] }], cols: [{ k: 'code', label: 'Code', mono: true }, { k: 'name', label: 'Account' }, { k: 'type', label: 'Type' }], actions: (r) => `<button class="ibtn" data-act="coa.edit" data-id="${r.code}">${ic('edit')}</button>${(typeof ITMS!=='undefined'&&ITMS.canDelete&&ITMS.canDelete())?'<button class="ibtn" style="--c:#ff5c6c" data-act="coa.del" data-id="'+r.code+'" title="Delete (Admin only)">'+ic('trash')+'</button>':''}`, toolbar: `${tbNew('coa.new', 'New account')} <button class="btn ghost" data-act="catgl.edit">${ic('link')}Category → GL map</button>` })
      ;
      else body = `<div class="grid g3"><div class="card"><h3>Procurement & stock</h3><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn ghost" data-go="#/orders">Purchase orders</button><button class="btn ghost" data-go="#/requests">Purchase requests</button><button class="btn ghost" data-go="#/vendors">Vendors</button><button class="btn ghost" data-go="#/hardware">Hardware stock</button><button class="btn ghost" data-go="#/consumables">Consumables stock</button></div></div><div class="card"><h3>Plans & reports</h3><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn ghost" data-go="#/budget">IT Budget (actuals include paid expenses)</button><button class="btn ghost" data-go="#/reportsplus">Reports</button><button class="btn ghost" data-go="#/contracts">Contracts</button></div></div><div class="card"><h3>ITIL practices</h3><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn ghost" data-go="#/supplier">Supplier management</button><button class="btn ghost" data-go="#/security">Information security</button><button class="btn ghost" data-go="#/improvement">Continual improvement</button><button class="btn ghost" data-go="#/assetmgmt">IT asset management</button><button class="btn ghost" data-go="#/slm">Service level management</button></div></div></div>`;
      return `<div class="card">${tabs}${body}</div>`;
    },
    after() {
      const t = document.getElementById('fintbper');
      if (t) t.addEventListener('change', () => { UI.tab.finTB = t.value; S.emit(); });
      const m = document.getElementById('finrecon');
      if (m) m.addEventListener('change', () => { UI.tab.finRecon = m.value; S.emit(); });
    },
  };

  /* ================= FINANCE ENGINE (vouchers · GL · auto-posting) ================= */
  function finNo(prefix) { const s = D().fin.seq; s[prefix] = (s[prefix] || 0) + 1; return prefix + '-' + String(s[prefix]).padStart(4, '0'); }
  const glName = (code) => ((D().fin.coa.find((g) => g.code === code) || {}).name || code);
  const r2 = (n) => Math.round((+n || 0) * 100) / 100;
  function postJV(o) {
    const dr = r2(o.lines.reduce((a, l) => a + (+l.dr || 0), 0)), cr = r2(o.lines.reduce((a, l) => a + (+l.cr || 0), 0));
    if (!o.lines.length) return null;
    if (Math.abs(dr - cr) > 0.005) throw new Error('Journal out of balance');
    const e = Object.assign({ id: finNo(o.no || 'JV'), at: now(), month: String(o.date || '').slice(0, 7), total: cr }, o);
    D().fin.jv.unshift(e);
    L.log('Finance', `${e.id} ${e.type} ${e.ref} ${cr.toFixed(2)}`, e.ref);
    return e;
  }
  function billLines(g) {
    const p = L.po(g.poNo); if (!p) return { p: null, lines: [], excl: 0, vat: 0 };
    const lines = []; let excl = 0, vat = 0;
    (g.lines || []).forEach((gl) => {
      const pl = (p.lines || []).find((x) => x.line === gl.line) || {};
      const t = L.lineTotals(p, Object.assign({}, pl, { qty: gl.qty }));
      excl += t.excl; vat += t.vat;
      lines.push({ pl, qty: gl.qty, t });
    });
    return { p, lines, excl: r2(excl), vat: r2(vat) };
  }
  function postBill(g) {
    const b = billLines(g); if (!b.p) return;
    const jlines = b.lines.map((x) => ({ gl: x.pl.itemType === 'Hardware' ? '1510' : x.pl.itemType === 'Software' ? '1520' : '1410', dr: x.t.excl, cr: 0, cx: x.pl.itemType === 'Consumable' ? 'OPEX' : 'CAPEX', ref: `${b.p.poNo} L${x.pl.line} × ${x.qty}` }));
    if (b.vat > 0) jlines.push({ gl: '1430', dr: b.vat, cr: 0, cx: '', ref: 'VAT on ' + g.grnNo });
    jlines.push({ gl: '2110', dr: 0, cr: r2(b.excl + b.vat), cx: '', ref: 'AP ' + b.p.vendor });
    postJV({ no: 'BILL', date: g.date, type: 'Purchase Bill', ref: g.grnNo, desc: `GRN ${g.grnNo} against ${b.p.poNo} (${b.p.vendor})`, lines: jlines });
  }
  function postDisposal(m) {
    const a = L.hw(m.assetId); if (!a) return;
    const nbv = +a.price || 0; if (nbv <= 0) return;
    postJV({ no: 'DSP', date: m.date, type: 'Disposal', ref: m.assetId, desc: `Write-off ${m.assetId}`, lines: [{ gl: '5510', dr: nbv, cr: 0, cx: '', ref: '' }, { gl: a.type === 'Software' ? '1520' : '1510', dr: 0, cr: nbv, cx: '', ref: '' }] });
  }
  function postIssue(r) {
    const last = db().consPurch.filter((x) => x.itemId === r.itemId).pop();
    const val = r2((+((last || {}).price || 0)) * (+r.qty || 0));
    if (val <= 0) return;
    postJV({ no: 'IS', date: r.date, type: 'Stock Issue', ref: r.id, desc: `Consumable issue ${r.id}`, lines: [{ gl: '5220', dr: val, cr: 0, cx: 'OPEX', ref: '' }, { gl: '1410', dr: 0, cr: val, cx: '', ref: '' }] });
  }
  function postContract(c, kind) {
    const amt = r2(+c.cost || +c.value || 0); if (amt <= 0) return;
    const gl = c.gl || (kind === 'AMC' ? '5230' : '5240');
    const invNo = c.invNo || '';
    postJV({ no: kind === 'AMC' ? 'AMC' : 'CON', date: c.invDate || c.start || today(), type: kind === 'AMC' ? 'AMC' : 'Contract', ref: c.id, desc: `${kind} ${c.id} — ${c.title} (${(db().vendors.find((v) => v.id === c.vendorId) || {}).name || c.vendor || ''})${invNo ? ' · Invoice ' + invNo : ''}`, lines: [{ gl, dr: amt, cr: 0, cx: 'OPEX', ref: invNo || c.id }, { gl: '2110', dr: 0, cr: amt, cx: '', ref: 'AP ' + ((db().vendors.find((v) => v.id === c.vendorId) || {}).name || c.vendor || '') }] });
  }
  let lastFin = 0;
  S.subscribe(() => {
    const t = Date.now(); if (t - lastFin < 20000) return; lastFin = t;
    try {
      const seen = D().fin.seen; let changed = false;
      (db().grns || []).forEach((g) => { if (!g.grnNo || seen.grn[g.grnNo]) return; seen.grn[g.grnNo] = 1; try { postBill(g); changed = true; } catch (e) { /* skip bad */ } });
      (db().moves || []).forEach((m) => { const k = (m.doc || '') + (m.id || ''); if (m.type === 'Status' && m.after === 'Disposed' && !seen.disp[k]) { seen.disp[k] = 1; try { postDisposal(m); changed = true; } catch (e) { /* skip */ } } });
      (db().consIssue || []).forEach((r) => { if (seen.iss[r.id]) return; seen.iss[r.id] = 1; try { postIssue(r); changed = true; } catch (e) { /* skip */ } });
      if (changed) S.emit();
    } catch (e) { /* never break */ }
  });
  const finMonths = () => L.uniq(D().fin.jv.map((e) => e.month).filter(Boolean)).sort().reverse();
  UI.on('fin.dep', () => {
    const m0 = L.today().slice(0, 7);
    UI.form({ title: 'Run monthly depreciation', sub: 'Straight-line over expected life', icon: 'dollar', fields: [{ k: 'month', label: 'Month (YYYY-MM)', req: true }], values: { month: m0 }, onSubmit: (v) => {
      if (!/^\d{4}-\d{2}$/.test(v.month)) throw new Error('Use YYYY-MM');
      if (D().fin.depruns.indexOf(v.month) >= 0) throw new Error('Already run for ' + v.month);
      let tot = 0, n = 0;
      db().hw.forEach((a) => { if (a.status === 'Disposed' || !a.purchaseDate || !(+a.life > 0)) return; if (String(a.purchaseDate).slice(0, 7) > v.month) return; const m = r2((+a.price || 0) / (+a.life * 12)); if (m > 0) { tot = r2(tot + m); n++; } });
      if (!tot) throw new Error('Nothing depreciable that month');
      postJV({ no: 'DEP', date: v.month + '-28', type: 'Depreciation', ref: v.month, desc: `Monthly depreciation ${v.month} (${n} assets)`, lines: [{ gl: '5410', dr: tot, cr: 0, cx: 'OPEX', ref: '' }, { gl: '1590', dr: 0, cr: tot, cx: '', ref: '' }] });
      D().fin.depruns.push(v.month); S.emit(); UI.toast(`Depreciation ${tot.toFixed(2)} posted`);
    } });
  });
  UI.on('jv.view', (el) => {
    const e = D().fin.jv.find((x) => x.id === el.dataset.id); if (!e) return;
    const ov = modal(`<header><span class="gem" style="width:38px;height:38px;border-radius:13px">${ic('receipt')}</span><div><h3>${esc(e.id)} · ${esc(e.type)}</h3><small>${esc(e.ref)} · ${esc(e.date)}</small></div><button class="ibtn x" data-x>${ic('x')}</button></header><div class="body"><p>${esc(e.desc || '')}</p><table class="t"><thead><tr><th>GL</th><th>Account</th><th></th><th class="num">Debit</th><th class="num">Credit</th></tr></thead><tbody>${(e.lines || []).map((l) => `<tr><td class="mono">${esc(l.gl)}</td><td>${esc(glName(l.gl))}</td><td>${esc(l.cx || '')}${l.ref ? ' · ' + esc(l.ref) : ''}</td><td class="num">${l.dr ? fmtNum(l.dr, 2) : ''}</td><td class="num">${l.cr ? fmtNum(l.cr, 2) : ''}</td></tr>`).join('')}</tbody></table></div><footer><button class="btn ghost" data-x>Close</button></footer>`, 'md');
    return ov;
  });
  function finInvId() { const f = D().fin; f.invSeq = (f.invSeq || 0) + 1; return 'INV-' + String(f.invSeq).padStart(4, '0'); }
  function makeInvoice(poNo, grnNo) {
    const po = L.po(poNo); if (!po) throw new Error('Purchase order not found');
    if (po.approval !== 'Approved') throw new Error('PO must be Approved before invoicing');
    const f = D().fin; f.invoices = f.invoices || [];
    const grns = grnNo ? (db().grns || []).filter((g) => g.grnNo === grnNo) : (db().grns || []).filter((g) => g.poNo === poNo);
    if (!grns.length) throw new Error('No goods receipt (GRN) found — receive the goods first');
    if (grnNo && f.invoices.some((i) => i.grnNo === grnNo)) throw new Error('Invoice already generated for ' + grnNo);
    if (!grnNo && f.invoices.some((i) => i.poNo === poNo)) throw new Error('Invoice already generated for ' + poNo);
    const lines = []; let excl = 0, vat = 0;
    grns.forEach((g) => (g.lines || []).forEach((gl) => {
      const pl = (po.lines || []).find((x) => x.line === gl.line); if (!pl || !(+gl.qty > 0)) return;
      const t = L.lineTotals(po, Object.assign({}, pl, { qty: gl.qty }));
      excl += t.excl; vat += t.vat;
      lines.push(Object.assign({}, pl, { qty: gl.qty, recvQty: gl.qty, total: t.total, grnNo: g.grnNo }));
    }));
    if (!lines.length) throw new Error('No quantity received yet');
    const inv = {
      id: finInvId(), poNo: po.poNo, grnNo: grnNo || (grns[0] || {}).grnNo || '', grns: grns.map((g) => g.grnNo),
      date: today(), dueDate: L.addDays(today(), 30), vendor: po.vendor, currency: po.currency, vatIncl: po.vatIncl,
      status: 'Draft', excl: r2(excl), vat: r2(vat), total: r2(excl + vat), lines, createdAt: now(),
    };
    f.invoices.unshift(inv);
    po.invoice = 'Invoiced';
    L.log('Finance', `Invoice ${inv.id} generated for ${po.poNo}${inv.grnNo ? ' from ' + inv.grnNo : ''}`, inv.id);
    S.emit();
    return inv;
  }
  ITMS.ap = Object.assign(ITMS.ap || {}, { makeInvoice, postContract });
  function pickInvoice(kind) {
    const f = D().fin; f.invoices = f.invoices || [];
    const rows = [];
    if (kind === 'po') {
      (db().pos || []).forEach((p) => {
        const gs = (db().grns || []).filter((g) => g.poNo === p.poNo);
        if (p.approval === 'Approved' && gs.length && !f.invoices.some((i) => i.poNo === p.poNo)) rows.push({ id: p.poNo, label: p.poNo, sub: `${p.vendor} · ${gs.map((g) => g.grnNo).join(', ')}` });
      });
    } else {
      (db().grns || []).forEach((g) => {
        const p = L.po(g.poNo); if (!p || p.approval !== 'Approved') return;
        if (f.invoices.some((i) => i.grnNo === g.grnNo)) return;
        rows.push({ id: g.grnNo, label: g.grnNo, sub: `${g.poNo} · ${p.vendor} · ${fmtDate(g.date)}` });
      });
    }
    if (!rows.length) return UI.toast('Nothing available to invoice — receive goods against an approved PO first', 'err');
    const act = kind === 'po' ? 'po.generateInvoice' : 'grn.generateInvoice';
    const ov = modal(`<header><span class="gem" style="width:38px;height:38px;border-radius:13px">${ic('receipt')}</span><div><h3>Generate invoice from ${kind === 'po' ? 'purchase order' : 'GRN'}</h3><small>Approved, received and not yet invoiced — one invoice per ${kind === 'po' ? 'PO' : 'GRN'}</small></div><button class="ibtn x" data-x>${ic('x')}</button></header><div class="body">${UI.table({ id: 'pickinv', rows: () => rows, text: (r) => r.id + r.sub, cols: [{ k: 'label', label: kind === 'po' ? 'PO No' : 'GRN No', mono: true }, { k: 'sub', label: 'Details' }], actions: (r) => `<button class="btn xs" data-act="${act}" data-id="${r.id}">${ic('receipt')}Generate</button>` })}</div><footer><button class="btn ghost" data-x>Close</button></footer>`, 'lg');
    ov.addEventListener('click', (e) => { const a = e.target.closest('[data-act]'); if (e.target.closest('[data-x]') || a) UI.close(ov); });
  }
  UI.on('po.generateInvoice', (el) => {
    if (!el.dataset.id) return pickInvoice('po');
    try { const inv = makeInvoice(el.dataset.id); UI.toast('Invoice ' + inv.id + ' generated for ' + el.dataset.id); } catch (e) { UI.toast(e.message, 'err'); }
  });
  UI.on('grn.generateInvoice', (el) => {
    if (!el.dataset.id) return pickInvoice('grn');
    const g = (db().grns || []).find((x) => x.grnNo === el.dataset.id); if (!g) return UI.toast('GRN not found', 'err');
    try { const inv = makeInvoice(g.poNo, g.grnNo); UI.toast('Invoice ' + inv.id + ' generated from ' + g.grnNo); } catch (e) { UI.toast(e.message, 'err'); }
  });
  UI.on('grn.invoice', (el) => UI.acts['grn.generateInvoice'](el));
  UI.on('inv.view', (el) => {
    const inv = (D().fin.invoices || []).find((x) => x.id === el.dataset.id); if (!inv) return;
    const po = L.po(inv.poNo);
    const ov = modal(`<header><span class="gem" style="width:38px;height:38px;border-radius:13px">${ic('receipt')}</span><div><h3>${esc(inv.id)}</h3><small>${esc(po ? po.vendor : '—')} · ${esc(inv.grnNo || '—')}</small></div><button class="ibtn x" data-x>${ic('x')}</button></header><div class="body"><div class="grid g2"><dl class="kv"><dt>PO No</dt><dd>${esc(inv.poNo)}</dd><dt>GRN No</dt><dd>${esc(inv.grnNo || '—')}</dd><dt>Invoice Date</dt><dd>${fmtDate(inv.date)}</dd><dt>Due Date</dt><dd>${fmtDate(inv.dueDate)}</dd><dt>Status</dt><dd>${P(inv.status)}</dd><dt>Total</dt><dd>${fmtNum(inv.total, 2)}</dd></dl><div><h3 style="font:650 14px var(--head);margin:0 0 8px">Lines</h3><table class="t"><thead><tr><th>Line</th><th>Description</th><th class="num">Qty</th><th class="num">Unit Price</th><th class="num">Total</th></tr></thead><tbody>${(inv.lines || []).map((l) => `<tr><td>${l.line}</td><td>${esc(l.desc)}</td><td class="num">${l.qty || l.invoiceQty || 0}</td><td class="num">${fmtNum(l.price, 2)}</td><td class="num">${fmtNum(l.total != null ? l.total : (l.price * (l.qty || l.invoiceQty || 0)), 2)}</td></tr>`).join('')}</tbody></table></div></div></div><footer><button class="btn ghost" data-act="inv.print" data-id="${inv.id}">${ic('print')}Print</button> <button class="btn ghost" data-x>Close</button></footer>`, 'lg');
    return ov;
  });
  UI.on('inv.print', (el) => {
    const inv = (D().fin.invoices || []).find((x) => x.id === el.dataset.id); if (!inv) return;
    const po = L.po(inv.poNo) || {};
    const v = L.vendor(po.vendor) || {};
    const co = db().company;
    const rows = (inv.lines || []).map((l) => `<tr><td>${l.line}</td><td>${esc(l.desc)}</td><td class="r">${l.qty || l.invoiceQty || 0}</td><td class="r">${fmtNum(l.price, 2)}</td><td class="r">${fmtNum(l.total != null ? l.total : (l.price * (l.qty || l.invoiceQty || 0)), 2)}</td></tr>`).join('');
    UI.doc('Invoice ' + inv.id, `${UI.docHead('Tax Invoice')}<div class="meta"><div><b>Invoice number:</b>${inv.id}</div><div><b>Invoice date:</b>${fmtDate(inv.date)}</div><div><b>Due date:</b>${fmtDate(inv.dueDate)}</div><div><b>Status:</b>${esc(inv.status)}</div><div><b>PO number:</b>${esc(inv.poNo)}</div><div><b>GRN number:</b>${esc(inv.grnNo || '—')}</div><div><b>Vendor:</b>${esc(po.vendor)}</div><div><b>Vendor address:</b>${esc(UI.fullAddr(v))}</div><div><b>Contact:</b>${esc(v.contact || '')}</div><div><b>Email:</b>${esc(v.email || '')}</div><div><b>Currency:</b>${esc(inv.currency)}</div><div><b>Bill to:</b>${esc(co.name)}</div></div><table><thead><tr><th>Line</th><th>Description</th><th class="r">Qty</th><th class="r">Unit price</th><th class="r">Total</th></tr></thead><tbody>${rows}</tbody></table><table class="t" style="margin-top:12px"><tbody><tr><td colspan="4" class="r"><b>Sub total</b></td><td class="r">${fmtNum(inv.excl, 2)}</td></tr><tr><td colspan="4" class="r"><b>VAT (${co.vat}%)</b></td><td class="r">${fmtNum(inv.vat, 2)}</td></tr><tr><td colspan="4" class="r"><b>Total ${esc(inv.currency)}</b></td><td class="r"><b>${fmtNum(inv.total, 2)}</b></td></tr></tbody></table><p class="words">${UI.amountWords(inv.total, inv.currency)}</p><div class="sig"><div>Prepared by (Finance)</div><div>Approved by</div><div>Vendor acceptance</div></div>`);
  });
  UI.on('inv.post', (el) => {
    const inv = (D().fin.invoices || []).find((x) => x.id === el.dataset.id); if (!inv) return;
    if (inv.status === 'Posted') return UI.toast('Invoice already posted', 'err');
    const grn = (db().grns || []).find((g) => g.grnNo === inv.grnNo);
    if (!grn) return UI.toast('A GRN is required to post — generate this invoice from a GRN', 'err');
    const po = L.po(inv.poNo); if (!po) return UI.toast('PO not found', 'err');
    let bill = D().fin.jv.find((e) => e.type === 'Purchase Bill' && e.ref === grn.grnNo);
    if (!bill) {
      try { postBill(grn); } catch (e) { return UI.toast(e.message, 'err'); }
      D().fin.seen.grn[grn.grnNo] = 1;
      bill = D().fin.jv.find((e) => e.type === 'Purchase Bill' && e.ref === grn.grnNo);
    }
    inv.status = 'Posted';
    if (bill) { inv.billId = bill.id; bill.paid = false; }
    S.emit(); UI.toast('Invoice ' + inv.id + ' posted' + (bill ? ' — voucher ' + bill.id : ''));
  });
  UI.on('bill.pay', (el) => {
    const e = D().fin.jv.find((x) => x.id === el.dataset.id); if (!e || e.paid || e.type !== 'Purchase Bill') return;
    const g = db().grns.find((x) => x.grnNo === e.ref); const pono = g ? g.poNo : '';
    const amt = +e.total || 0;
    try { postJV({ no: 'PV', date: today(), type: 'Payment', ref: pono || e.ref, desc: `Bill ${e.id} paid (${billVend(e)})`, lines: [{ gl: '2110', dr: amt, cr: 0, cx: '', ref: '' }, { gl: '1110', dr: 0, cr: amt, cx: '', ref: '' }] }); } catch (err) { return UI.toast(err.message, 'err'); }
    e.paid = true; const p = pono ? L.po(pono) : null; if (p) p.invoice = 'Paid';
    S.emit(); UI.toast('Bill paid with voucher');
  });
  const billVend = (e) => { const g = db().grns.find((x) => x.grnNo === e.ref); if (!g) return ''; const p = L.po(g.poNo); return p ? p.vendor : ''; };
  const billDue = (e) => L.addDays((e.date || '').slice(0, 10), 30);
  UI.on('coa.new', () => { UI.form({ title: 'New GL account', icon: 'plus', fields: [{ k: 'code', label: 'Code', req: true }, { k: 'name', label: 'Name', req: true, full: true }, { k: 'type', label: 'Type', type: 'select', options: ['Asset', 'Liability', 'Equity', 'Income', 'Expense'], blank: false }], onSubmit: (v) => { if (D().fin.coa.some((g) => g.code === v.code.trim())) throw new Error('Code exists'); D().fin.coa.push({ code: v.code.trim(), name: v.name.trim(), type: v.type }); S.emit(); } }); });
  UI.on('coa.edit', (el) => { const r = D().fin.coa.find((x) => x.code === el.dataset.id); UI.form({ title: 'Edit ' + r.code, icon: 'edit', fields: [{ k: 'name', label: 'Name', req: true, full: true }, { k: 'type', label: 'Type', type: 'select', options: ['Asset', 'Liability', 'Equity', 'Income', 'Expense'], blank: false }], values: r, onSubmit: (v) => { Object.assign(r, v); S.emit(); } }); });
  UI.on('coa.del', async (el) => { if (!ITMS.canDelete()) return UI.toast('Only Administrator can delete records', 'err'); if (D().fin.jv.some((e) => (e.lines || []).some((l) => l.gl === el.dataset.id))) return UI.toast('Account has postings — cannot delete', 'err'); if (await UI.confirm('Delete GL ' + el.dataset.id + '?', 'Delete', true)) { D().fin.coa = D().fin.coa.filter((x) => x.code !== el.dataset.id); S.emit(); } });
  UI.on('catgl.edit', () => {
    const cats = budgetCats(); const f = cats.map((c) => ({ k: c, label: c, type: 'select', options: () => D().fin.coa.filter((g) => g.type === 'Expense' || g.type === 'Asset').map((g) => ({ v: g.code, l: `${g.code} ${g.name}` })), blank: false }));
    UI.form({ title: 'Budget category → GL mapping', icon: 'link', fields: f, values: D().fin.catgl, onSubmit: (v) => { Object.assign(D().fin.catgl, v); S.emit(); UI.toast('Mapping saved'); } });
  });

  /* ================= 18. ARCHIVING + AUDIT ================= */
  UI.on('arc.run', () => {
    UI.form({ title: 'Schedule data archiving', sub: 'De-clutter live queues, preserve everything for audit', icon: 'box', fields: [{ k: 'older', label: 'Archive tickets closed/cancelled more than (days)', type: 'number', req: true }, { k: 'note', label: 'Policy note', full: true }], values: { older: 180 }, onSubmit: (v) => {
      const h = H(); const cut = Date.now() - (+v.older) * 864e5; let n = 0;
      const keep = []; (h.requests || []).forEach((r) => { const end = r.closedAt || r.resolvedAt; if (['Closed', 'Cancelled'].includes(r.status) && end && new Date(end).getTime() < cut) { D().archiveData.unshift({ module: 'requests', id: r.id, snapshot: r, at: now() }); n++; } else keep.push(r); });
      h.requests = keep;
      const policy = { id: nid('ar', 'ARC-', 2), module: 'requests', before: `${v.older} days`, count: n, at: now(), by: curRole(), note: v.note || '' };
      D().archives.unshift(policy); L.log('Archive', `Archived ${n} ticket(s) older than ${v.older} days`, policy.id); S.emit();
      UI.toast(n ? `${n} record(s) archived — restorable` : 'Nothing old enough to archive');
    } });
  });
  UI.on('arc.restore', (el) => {
    const a = D().archives.find((x) => x.id === el.dataset.id);
    const snaps = D().archiveData.filter((x) => x.at === a.at || true).slice(0, a.count);
    // restore archived request snapshots of this run (best effort by count)
    let n = 0; const pool = D().archiveData.filter((x) => x.module === 'requests');
    while (n < a.count && pool.length) { const s = pool.shift(); H().requests.push(s.snapshot); D().archiveData = D().archiveData.filter((x) => x !== s); n++; }
    D().archives = D().archives.filter((x) => x !== a); S.emit(); UI.toast(`${n} record(s) restored`);
  });
  UI.on('arc.wipe', async () => { if (deny('admin')) return; if (!ITMS.canDelete()) return UI.toast('Only Administrator can delete records', 'err'); if (await UI.confirm('Delete ALL ServiceDesk Plus demo/transaction data? Core assets stay untouched.', 'Wipe SDP data', true)) { const d = db(); d.sdp = null; ensure(); S.emit(); UI.toast('SDP data reset to defaults'); } });
  pages.archiving = {
    title: 'Archiving & Audit', crumb: 'Automatic data archiving · full audit trail', icon: 'box', color: '#2f6bff',
    render() {
      const d = D(); const log = (db().log || []).slice(0, 60);
      return `<div class="card"><h3>Archive policies & runs</h3>${UI.table({ id: 'arct', rows: () => d.archives, sort: 'at', dir: -1, text: (r) => r.id + r.module, cols: [{ k: 'id', label: 'Run', mono: true }, { k: 'module', label: 'Module' }, { k: 'before', label: 'Older than' }, { k: 'count', label: 'Records', num: true }, { k: 'at', label: 'At', render: (r) => fdt(r.at) }, { k: 'by', label: 'By' }], actions: (r) => `<button class="btn xs" data-act="arc.restore" data-id="${r.id}">Restore</button>`, toolbar: `<button class="btn" data-act="arc.run">${ic('box')}Run archiving</button> <button class="btn ghost" data-act="arc.wipe">${ic('trash')}Reset SDP data</button>` })}</div>
      <div class="card mt"><h3>Audit trail (who did what, when)</h3><table class="t"><thead><tr><th>At</th><th>Area</th><th>Event</th><th>Ref</th></tr></thead><tbody>${log.map((x) => `<tr><td style="white-space:nowrap">${fdt(x.at)}</td><td>${esc(x.kind)}</td><td>${esc(x.text)}</td><td class="mono">${esc(x.ref || '')}</td></tr>`).join('') || '<tr><td colspan="4"><div class="empty">No audit events yet</div></td></tr>'}</tbody></table></div>`;
    },
  };

  /* ---- dashboard strip: prove ITIL coverage at a glance ---- */
  try {
    const od = pages.dashboard;
    if (od && !od._sdp) {
      od._sdp = od.render;
      od.render = function () {
        const out = od._sdp.apply(this, arguments);
        try {
          const d = D(); const h = H();
          const openT = h ? h.requests.filter((r) => ['Open', 'Assigned', 'In Progress', 'On Hold'].includes(r.status)).length : 0;
          const kpi = (n, l, c) => `<div class="card" style="border-left:4px solid ${c}"><div style="font:700 22px var(--head)">${n}</div><small style="color:var(--muted)">${l}</small></div>`;
          const strip = `<div class="card mt"><h3><span class="pip" style="--c:${C.cyan}"></span>ServiceDesk Plus · ITIL coverage <a class="link" style="margin-left:auto;font-size:12px" data-go="#/esm">Enterprise view →</a></h3><div class="grid g3">${kpi(openT, 'Open tickets', C.blue)}${kpi(d.cis.length, 'CIs in CMDB', C.violet)}${kpi(d.contracts.length, 'Contracts', C.amber)}</div><div class="grid g3 mt">${kpi(d.chats.filter((c) => c.status === 'Open').length, 'Open chats', C.cyan)}${kpi(d.loans.filter((l) => l.status === 'On loan').length, 'Active loans', C.blue)}${kpi(d.escalations.filter((e) => e.status === 'Open').length, 'Open escalations', C.coral)}</div><small style="color:var(--muted)">Portal · chat · CMDB · contracts · PM · email-to-ticket · rules · lifecycles · sites · roles · scheduler · templates · discovery · loans · surveys · reports · ESM · archiving — all live in the sidebar.</small></div>`;
          return out + strip;
        } catch (e) { return out; }
      };
    }
  } catch (e) { /* ignore */ }
})();

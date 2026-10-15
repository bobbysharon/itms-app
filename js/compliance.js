/* ITMS Governance — end-to-end IT workflow + Policy compliance (ISO 27001 / NIST CSF / NESA / ITIL) */
(function () {
  const ITMS = window.ITMS, L = ITMS.logic, UI = ITMS.ui, S = ITMS.store, pages = (ITMS.pages = ITMS.pages || {});
  const { esc, fmtNum, money, pill, icon: ic } = UI;
  const fmtD = (s) => UI.fmtDate(s);
  const db = () => S.db;

  /* ==================== FRAMEWORK LIBRARY ==================== */
  const FW = {
    iso27001: {
      name: 'ISO/IEC 27001:2022', short: 'ISO 27001', color: '#2f6bff',
      desc: 'Information security management — Annex A controls across Organisational, People, Physical and Technological themes.',
      controls: [
        ['A.5.1', 'Policies for information security', 'ISMS policy defined, approved, published and acknowledged.', 'Approved ISMS policy + acknowledgement records'],
        ['A.5.9', 'Inventory of information & assets', 'Complete inventory of hardware, software and information assets.', 'Asset register export (this app) + ownership list'],
        ['A.5.15', 'Access control', 'Access provisioned on need-to-know; leavers revoked promptly.', 'Onboarding/offboarding forms + access review log'],
        ['A.5.17', 'Authentication information', 'Passwords/MFA managed; default credentials changed.', 'Password/MFA policy + audit sample'],
        ['A.6.1', 'Screening & onboarding', 'Background checks and security T&C for new staff.', 'HR screening records + signed T&C'],
        ['A.6.3', 'Security awareness training', 'Regular awareness training for all staff.', 'Training attendance + material'],
        ['A.7.1', 'Physical security perimeters', 'Secure areas, badges, visitor logs.', 'Site photos + visitor log'],
        ['A.7.10', 'Storage media handling', 'Media labelled, stored and disposed securely.', 'Media register + disposal certificates'],
        ['A.8.1', 'User endpoint devices', 'Laptops/mobiles secured, encrypted, tracked.', 'Asset list + encryption status report'],
        ['A.8.5', 'Secure authentication', 'MFA/strong auth on critical systems.', 'MFA enforcement screenshot'],
        ['A.8.9', 'Configuration management', 'Hardened baselines for OS/apps.', 'Baseline docs + scan results'],
        ['A.8.13', 'Information backup', 'Backups taken, tested and retained.', 'Backup logs + restore test record'],
        ['A.8.15', 'Logging & monitoring', 'Logs collected, reviewed, retained.', 'SIEM/log samples + review sign-off'],
        ['A.8.16', 'Vulnerability management', 'Patches and vuln scans on schedule.', 'Patch reports + scan reports'],
        ['A.5.24', 'Incident response planning', 'Incident plan tested; roles assigned.', 'Incident playbook + drill record'],
        ['A.5.35', 'Protection of procedures & data', 'Data protection / privacy procedures applied.', 'Data protection procedure + DPIA sample'],
      ].map((x) => ({ id: x[0], title: x[1], guidance: x[2], evidenceHint: x[3] })),
    },
    nist: {
      name: 'NIST Cybersecurity Framework (CSF) 2.0', short: 'NIST CSF', color: '#00a8e8',
      desc: 'Govern · Identify · Protect · Detect · Respond · Recover — outcome-driven categories.',
      controls: [
        ['GV.OC-01', 'Govern: organisational context & risk strategy', 'Risk strategy understood; roles and oversight assigned.', 'Risk register + RACI / charter'],
        ['ID.AM-01', 'Identify: asset inventory', 'Hardware, software, data and services inventoried.', 'Asset + software + service inventory'],
        ['ID.RA-01', 'Identify: risk assessment', 'Risks identified, assessed and prioritised.', 'Risk assessment report'],
        ['PR.AC-01', 'Protect: access control & identities', 'Identities managed; least privilege enforced.', 'AD/IAM review + joiner/mover/leaver logs'],
        ['PR.AT-01', 'Protect: awareness & training', 'Workforce trained on security duties.', 'Training plan + completion records'],
        ['PR.DS-01', 'Protect: data security', 'Data classified, encrypted and backed up.', 'Classification + encryption + backup evidence'],
        ['PR.PS-01', 'Protect: platform & patch management', 'Systems hardened and patched.', 'Hardening + patch reports'],
        ['DE.CM-01', 'Detect: continuous monitoring', 'Networks and endpoints monitored.', 'Monitoring dashboards + alert samples'],
        ['DE.AE-01', 'Detect: anomaly analysis', 'Anomalies triaged against baselines.', 'Triage tickets / SOC notes'],
        ['RS.MA-01', 'Respond: incident management', 'Incidents declared, contained, eradicated.', 'Incident tickets + post-incident review'],
        ['RS.CO-01', 'Respond: communications', 'Stakeholders notified per plan.', 'Notification log + templates'],
        ['RC.RP-01', 'Recover: recovery planning & execution', 'Recovery plans tested; backups restored.', 'DR plan + restore test evidence'],
      ].map((x) => ({ id: x[0], title: x[1], guidance: x[2], evidenceHint: x[3] })),
    },
    nesa: {
      name: 'UAE NESA IA / ISR', short: 'NESA', color: '#1d4ed8',
      desc: 'UAE Information Assurance controls — management, technical and operational families.',
      controls: [
        ['M1', 'Security management & governance', 'Security function, policies and compliance monitoring.', 'Security policy + committee minutes'],
        ['M2', 'Asset & information classification', 'Assets classified (Confidential/Restricted/Public).', 'Classification register'],
        ['M3', 'HR security (joiner/mover/leaver)', 'Screening, T&C, timely deprovisioning.', 'HR records + deprovision log'],
        ['T1', 'Network & boundary protection', 'Firewalls, segmentation, secure Wi-Fi.', 'Network diagram + firewall ruleset'],
        ['T2', 'Endpoint & server security', 'AV/EDR, encryption, patching.', 'AV console + patch report'],
        ['T3', 'Identity & access management', 'MFA for remote/admin; quarterly reviews.', 'MFA report + access review'],
        ['T4', 'Logging, monitoring & SIEM', 'Centralised logs, 12-month retention.', 'SIEM config + log samples'],
        ['T5', 'Backup & business continuity', 'Backups + BCP/DR tested annually.', 'Backup logs + BCP test report'],
        ['O1', 'Incident response capability', 'CERT liaison, 72h reporting readiness.', 'IR plan + drill evidence'],
        ['O2', 'Third-party / cloud security', 'Vendor risk reviews; data residency in UAE.', 'Vendor assessments + contracts'],
      ].map((x) => ({ id: x[0], title: x[1], guidance: x[2], evidenceHint: x[3] })),
    },
    itil: {
      name: 'ITIL 4 / COBIT-style IT practices', short: 'ITIL', color: '#5b8def',
      desc: 'Service management practices — incident, change, asset, service level and continual improvement.',
      controls: [
        ['P1', 'Incident management', 'Incidents logged, prioritised, SLA-tracked.', 'Helpdesk SLA report'],
        ['P2', 'Problem management', 'Root causes and known errors tracked.', 'Problem records + KEDB'],
        ['P3', 'Change enablement (CAB)', 'Changes assessed, approved, reviewed.', 'Change log + CAB minutes'],
        ['P4', 'Asset & configuration management', 'CMDB/asset accuracy > 95%.', 'Asset audit sample'],
        ['P5', 'Service catalogue & SLAs', 'Catalogue published; SLAs measured.', 'Catalogue + SLA report'],
        ['P6', 'Knowledge management', 'Known solutions reusable.', 'KB articles + reuse stats'],
        ['P7', 'Supplier management', 'Vendors measured against contracts.', 'Vendor scorecards'],
        ['P8', 'Continual improvement register', 'Improvements owned and tracked.', 'Improvement register'],
      ].map((x) => ({ id: x[0], title: x[1], guidance: x[2], evidenceHint: x[3] })),
    },
  };

  const STATUS = ['Not assessed', 'Compliant', 'Partially compliant', 'Non-compliant', 'Not applicable'];
  const STC = { 'Compliant': 'mint', 'Partially compliant': 'amber', 'Non-compliant': 'coral', 'Not assessed': 'grey', 'Not applicable': 'violet' };

  function ensure() {
    const d = db(); if (!d) return;
    if (!d.compliance) d.compliance = { active: null, confirmed: false, data: {} };
    if (!d.compliance.data) d.compliance.data = {};
  }
  const oi = S.init; S.init = function () { oi.apply(S, arguments); ensure(); }; S.subscribe(ensure);
  const comp = () => { ensure(); return db().compliance; };
  function controlsOf(fw) {
    const c = comp();
    if (!c.data[fw]) c.data[fw] = FW[fw].controls.map((t) => Object.assign({}, t, { status: 'Not assessed', owner: '', due: '', action: '', evidence: '', updated: '' }));
    return c.data[fw];
  }
  ITMS.gov = { FW, controlsOf };

  /* ==================== END-TO-END WORKFLOW PAGE ==================== */
  pages.workflow = {
    title: 'IT Workflow', crumb: 'End-to-end operating model — from plan to dispose, every stage linked live', icon: 'spark', color: '#2f6bff', group: 'Governance',
    render() {
      const d = db(); const s = L.stats();
      const openPR = d.prs.filter((p) => ['Open', 'Partially Ordered'].includes(L.prStatus(p))).length;
      const poAction = d.pos.filter((p) => p.approval === 'Draft' || (p.approval === 'Approved' && L.poReceipt(p) !== 'Received')).length;
      const inStock = s.kpi.inStock, inUse = s.kpi.inUse;
      const openT = (d.hd && d.hd.requests ? d.hd.requests.filter((r) => ['Open', 'Assigned', 'In Progress', 'On Hold'].includes(r.status)).length : 0);
      const compTxt = comp().active ? FW[comp().active].short : 'Not started';
      const bud = (ITMS.budget ? ITMS.budget.plannedByYear(new Date().getFullYear()) : null);
      const budTot = bud ? Object.values(bud).reduce((a, b) => a + b, 0) : 0;
      const stage = (n, t, desc, count, c, href, btn) => `<div class="card glow tilt" style="--c:${c}"><div style="display:flex;gap:10px;align-items:center"><span class="gem" style="width:42px;height:42px">${ic(n)}</span><div><div style="font-size:11px;font-weight:700;color:${c};letter-spacing:.08em">STAGE ${t}</div><h3 style="margin:0;font-size:15px">${desc}</h3></div><span style="margin-left:auto;font:700 22px var(--head)">${count}</span></div><p style="color:var(--muted);font-size:12.5px;margin:8px 0 12px">${ { 1: 'Budget set per category; actuals flow from POs + AMCs.', 2: 'PR raised → one PO per vendor, no re-typing.', 3: 'GRN creates stock: hardware, licences, consumables.', 4: 'Issue to staff; onboarding creates IDs in one click.', 5: 'Tickets, AMCs, renewals and installs keep services live.', 6: 'Frameworks assessed control-by-control with evidence.', 7: 'Return, repair or dispose; custody history retained.' }[t]}</p><button class="btn sm" data-go="${href}">${btn}</button></div>`;
      return `
      <div class="hero"><div class="gem" style="width:56px;height:56px;border-radius:18px;background:rgba(255,255,255,.22)">${ic('spark')}</div>
        <div><h1>End-to-end IT management workflow</h1><p>Plan → Procure → Receive → Deploy → Operate → Govern → Retire — click any stage to work in it. Figures are live.</p></div>
        <div class="hbtns"><button class="btn" data-go="#/budget">${ic('trend')}Budget</button><button class="btn" data-go="#/compliance">${ic('shield')}Compliance</button></div></div>
      <div class="flow" style="margin:4px 0 14px">${['Plan', 'Procure', 'Receive', 'Deploy', 'Operate', 'Govern', 'Retire'].map((x, i) => `<div class="st" style="--c:${['#00a8e8', '#2f6bff', '#1d4ed8', '#3b82f6', '#5b8def', '#7aa5ff', '#ff5c6c'][i]}"><b>${i + 1}</b><span>${x}</span></div>`).join('')}</div>
      <div class="grid g3">
        ${stage('trend', 1, 'Plan — IT budget', money(Math.round(budTot), ''), '#00a8e8', '#/budget', 'Open budget')}
        ${stage('filePlus', 2, 'Procure — requests & orders', openPR + ' open PR · ' + poAction + ' PO to action', '#2f6bff', '#/requests', 'Open procurement')}
        ${stage('box', 3, 'Receive — GRN to stock', s.pipeline.poReceived + ' POs received', '#10d9a0', '#/orders', 'Receive goods')}
        ${stage('users', 4, 'Deploy — issue & onboard', inStock + ' spare · ' + inUse + ' in use', '#2f6bff', '#/lifecycle', 'Onboard / issue')}
        ${stage('bell', 5, 'Operate — helpdesk & AMC', openT + ' open tickets · ' + s.kpi.amcActive + ' AMCs', '#1d4ed8', '#/tickets', 'Open helpdesk')}
        ${stage('shield', 6, 'Govern — policy compliance', compTxt, '#ffb020', '#/compliance', 'Assess compliance')}
        ${stage('undo', 7, 'Retire — return & dispose', s.kpi.disposed + ' disposed · ' + s.kpi.repair + ' in repair', '#ff5c6c', '#/movements', 'Movements')}
      </div>
      <div class="card mt"><h3><span class="pip"></span>How the loop stays closed</h3><p style="color:var(--muted);font-size:13px">A budget funds a <b>Purchase Request</b> → converted to <b>Purchase Order(s)</b> → <b>GRN receipt</b> creates hardware / licence / consumable stock → <b>Issue + onboarding</b> puts assets and AD/biometric/ERP accounts with the employee → <b>Tickets, installs, AMCs</b> operate the estate → <b>Budget actuals</b> and <b>compliance evidence</b> update automatically → <b>Return / transfer / dispose</b> retires items with full custody history. Nothing is re-typed; every document links to the next.</p></div>`;
    },
  };

  /* ==================== COMPLIANCE PAGE ==================== */
  pages.compliance = {
    title: 'Policy Compliance', crumb: 'Pick a framework, confirm, then assess each control one-by-one with owner, actions and evidence', icon: 'shield', color: '#2f6bff', group: 'Governance',
    render() {
      const c = comp(); const d = db();
      // Step 1: choose framework
      if (!c.active || !c.confirmed) {
        const sel = c.active || 'iso27001';
        return `<div class="hero"><div class="gem" style="width:56px;height:56px;border-radius:18px;background:rgba(255,255,255,.22)">${ic('shield')}</div>
          <div><h1>Policy compliance</h1><p>Select a framework and confirm — then assess each control as Compliant / Non-compliant with actions and evidence.</p></div></div>
        <div class="card glow" style="--c:#2f6bff;max-width:860px"><h3><span class="pip"></span>1 · Choose the framework to assess</h3>
          <div class="fgrid"><label class="f full">Framework<select class="in" id="fwSel">${Object.keys(FW).map((k) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${esc(FW[k].name)} (${FW[k].controls.length} controls)</option>`).join('')}</select></label></div>
          <div id="fwDesc" style="margin-top:10px"></div>
          <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap"><button class="btn" data-act="cp.confirm">${ic('check')}Confirm & start assessment</button></div>
          <small style="color:var(--muted)">Confirming initialises the control list for that framework. Switching later keeps previous assessments.</small></div>
        <div class="grid g4 mt" id="fwCards">${Object.keys(FW).map((k) => `<div class="card tilt" style="--c:${FW[k].color};cursor:pointer" data-fw="${k}"><h3><span class="pip"></span>${esc(FW[k].short)}</h3><p style="font-size:12.5px;color:var(--muted)">${esc(FW[k].desc)}</p><b>${FW[k].controls.length} controls</b></div>`).join('')}</div>`;
      }
      const fw = FW[c.active]; const rows = controlsOf(c.active);
      const nC = rows.filter((r) => r.status === 'Compliant').length;
      const nP = rows.filter((r) => r.status === 'Partially compliant').length;
      const nN = rows.filter((r) => r.status === 'Non-compliant').length;
      const nA = rows.filter((r) => r.status === 'Not applicable').length;
      const nT = rows.filter((r) => r.status === 'Not assessed').length;
      const denom = rows.length - nA || 1;
      const pct = Math.round(((nC + nP * 0.5) / denom) * 100);
      const open = rows.filter((r) => ['Non-compliant', 'Partially compliant'].includes(r.status));

      return `
      <div class="hero"><div class="gem" style="width:56px;height:56px;border-radius:18px;background:${fw.color}">${ic('shield')}</div>
        <div><h1>${esc(fw.name)}</h1><p>${esc(fw.desc)} · ${rows.length} controls · evidence required for conformance</p></div>
        <div class="hbtns"><select class="in" id="fwSwap" style="min-width:200px">${Object.keys(FW).map((k) => `<option value="${k}" ${k === c.active ? 'selected' : ''}>${esc(FW[k].name)}</option>`).join('')}</select>
        <button class="btn ghost" data-act="cp.report">${ic('print')}Readiness report</button></div></div>
      <div class="grid g4">
        <div class="card kpi" style="--c:#10d9a0"><div class="gem">${ic('check')}</div><div><div class="v">${nC}/${rows.length}</div><div class="l">Compliant</div><div class="s">${nP} partial · ${nN} non-compliant</div></div></div>
        <div class="card kpi" style="--c:#ffb020"><div class="gem">${ic('alert')}</div><div><div class="v">${open.length}</div><div class="l">Action items open</div><div class="s">non-compliant + partial</div></div></div>
        <div class="card kpi" style="--c:#ff5c6c"><div class="gem">${ic('clock')}</div><div><div class="v">${nT}</div><div class="l">Not yet assessed</div><div class="s">${nA} not applicable</div></div></div>
        <div class="card kpi" style="--c:${fw.color}"><div class="gem">${ic('shield')}</div><div><div class="v">${pct}%</div><div class="l">Readiness score</div><div class="s">compliant + ½ partial</div></div></div>
      </div>
      <div class="grid g-main mt">
        <div class="card glow" style="--c:${fw.color}"><h3><span class="pip"></span>Compliance status</h3>${UI.donut([{ label: 'Compliant', value: nC, color: '#10d9a0' }, { label: 'Partial', value: nP, color: '#ffb020' }, { label: 'Non-compliant', value: nN, color: '#ff5c6c' }, { label: 'Not assessed', value: nT, color: '#b9c6e8' }, { label: 'N/A', value: nA, color: '#2f6bff' }], { big: pct + '%', small: 'ready' })}</div>
        <div class="card"><h3><span class="pip" style="--c:#ff5c6c"></span>Action items — what must be fixed <span class="tag">${open.length}</span></h3>
        ${open.length ? `<div style="max-height:300px;overflow:auto"><table class="t"><thead><tr><th>Control</th><th>Issue / action</th><th>Owner</th><th>Due</th></tr></thead><tbody>${open.map((r) => `<tr><td><b class="mono">${esc(r.id)}</b> ${esc(r.title)}<br>${pill(r.status, STC[r.status])}</td><td>${esc(r.action) || '<span style="color:var(--muted)">— add action —</span>'}</td><td>${esc(r.owner) || '–'}</td><td>${fmtD(r.due) || '–'}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty"><b>No open actions</b>Assess controls below; non-compliant items appear here.</div>'}
        <small style="color:var(--muted)">Tip: work top-to-bottom — open each control, set status, owner, due date, action and the evidence document.</small></div>
      </div>
      <div class="card mt">${UI.table({
        id: 'cp', rows: () => rows, sort: 'id',
        text: (r) => [r.id, r.title, r.guidance, r.owner, r.action, r.evidence].join(' '),
        filters: [{ k: 'status', label: 'Status', options: STATUS }],
        cols: [
          { k: 'id', label: 'Control', mono: true, render: (r) => `<b class="mono">${esc(r.id)}</b>` },
          { k: 'title', label: 'Requirement', render: (r) => `<b>${esc(r.title)}</b><br><small style="color:var(--muted)">${esc(r.guidance)}</small><br><small>Evidence needed: <b>${esc(r.evidenceHint)}</b></small>` },
          { k: 'status', label: 'Current status', render: (r) => pill(r.status, STC[r.status]) },
          { k: 'owner', label: 'Owner', render: (r) => esc(r.owner) || '–' },
          { k: 'due', label: 'Due', render: (r) => fmtD(r.due) || '–' },
          { k: 'action', label: 'Action item', render: (r) => esc((r.action || '').slice(0, 90)) || '–' },
          { k: 'evidence', label: 'Evidence / document', render: (r) => esc((r.evidence || '').slice(0, 90)) || '–' },
        ],
        actions: (r) => `<button class="btn xs" data-act="cp.assess" data-fw="${c.active}" data-id="${esc(r.id)}">${ic('edit')}Assess</button>`,
        toolbar: `<button class="btn ghost" data-act="cp.report">${ic('print')}Readiness report</button><button class="btn ghost" data-act="cp.reset">${ic('refresh')}Re-assess</button>`,
      })}</div>`;
    },
    after() {
      const sel = document.getElementById('fwSel');
      const desc = document.getElementById('fwDesc');
      const paint = () => { if (desc && sel) { const f = FW[sel.value]; desc.innerHTML = `<div class="note-box"><b>${esc(f.name)}</b> — ${esc(f.desc)}<br><small>${f.controls.length} controls, e.g. ${esc(f.controls[0].id)} ${esc(f.controls[0].title)} · ${esc(f.controls[1].id)} ${esc(f.controls[1].title)} …</small></div>`; } };
      if (sel) { paint(); sel.addEventListener('change', paint); }
      document.querySelectorAll('[data-fw]').forEach((el) => el.addEventListener('click', () => { const s = document.getElementById('fwSel'); if (s) { s.value = el.dataset.fw; paint(); } }));
      const sw = document.getElementById('fwSwap');
      if (sw) sw.addEventListener('change', async () => {
        if (await UI.confirm(`Switch to <b>${esc(FW[sw.value].name)}</b>? Your current assessment is kept and you can switch back.`, 'Switch')) { comp().active = sw.value; comp().confirmed = true; controlsOf(sw.value); S.emit(); }
        else sw.value = comp().active;
      });
    },
  };

  UI.on('cp.confirm', async () => {
    const sel = document.getElementById('fwSel');
    const fw = sel ? sel.value : 'iso27001';
    if (!await UI.confirm(`Start assessing <b>${esc(FW[fw].name)}</b> (${FW[fw].controls.length} controls) one-by-one?`, 'Confirm & proceed')) return;
    comp().active = fw; comp().confirmed = true; controlsOf(fw);
    L.log('Compliance', 'Started ' + FW[fw].name, fw); S.emit(); UI.toast('Framework confirmed — assess each control');
  });
  UI.on('cp.reset', async () => {
    if (await UI.confirm('Clear this framework assessment and start over?', 'Re-assess', true)) { comp().data[comp().active] = FW[comp().active].controls.map((t) => Object.assign({}, t, { status: 'Not assessed', owner: '', due: '', action: '', evidence: '', updated: '' })); S.emit(); }
  });
  UI.on('cp.assess', (el) => {
    const rows = controlsOf(el.dataset.fw); const r = rows.find((x) => x.id === el.dataset.id);
    const idx = rows.indexOf(r);
    const prev = rows[idx - 1], next = rows[idx + 1];
    UI.form({
      title: `${r.id} — ${r.title}`, sub: `${FW[el.dataset.fw].name} · control ${idx + 1} of ${rows.length}${prev ? ` · prev: ${prev.id} (${prev.status})` : ''}`,
      icon: 'shield', size: 'lg',
      fields: [
        { section: 'Requirement' },
        { k: 'info', label: 'What this control asks for (read-only)', type: 'textarea', full: true, ro: true },
        { k: 'need', label: 'Document / evidence needed for conformance (read-only)', full: true, ro: true },
        { section: 'Your assessment — go one by one' },
        { k: 'status', label: 'Current status *', type: 'select', blank: false, options: STATUS, req: true },
        { k: 'owner', label: 'Action owner' }, { k: 'due', label: 'Target date', type: 'date' },
        { k: 'action', label: 'Action item (what will you do to conform?)', type: 'textarea', full: true },
        { k: 'evidence', label: 'Evidence document / location (e.g. policy v1.2, ticket HD-001, scan report path)', type: 'textarea', full: true },
      ],
      values: Object.assign({}, r, { info: r.guidance, need: r.evidenceHint }),
      extra: next ? `<div class="note-box">Next up: <b class="mono">${esc(next.id)}</b> ${esc(next.title)} — save to continue.</div>` : '<div class="note-box">This is the last control in this framework.</div>',
      submit: next ? 'Save & next control →' : 'Save assessment',
      onSubmit: (v) => {
        Object.assign(r, { status: v.status, owner: v.owner, due: v.due, action: v.action, evidence: v.evidence, updated: L.today() });
        L.log('Compliance', `${el.dataset.fw} ${r.id} → ${v.status}`, r.id); S.emit(); UI.toast(`${r.id} marked ${v.status}`);
        if (next) setTimeout(() => UI.acts['cp.assess']({ dataset: { fw: el.dataset.fw, id: next.id } }), 150);
      },
    });
  });
  UI.on('cp.report', () => {
    const c = comp(); const fw = FW[c.active]; const rows = controlsOf(c.active);
    const nC = rows.filter((r) => r.status === 'Compliant').length;
    UI.doc(fw.short + ' readiness report', `${UI.docHead(fw.name + ' — readiness report')}<div class="meta"><div><b>Company:</b>${esc(db().company.name)}</div><div><b>Date:</b>${fmtD(L.today())}</div><div><b>Score:</b>${nC}/${rows.length} compliant</div><div><b>Framework:</b>${esc(fw.name)}</div></div>
    <table><thead><tr><th>Control</th><th>Requirement</th><th>Status</th><th>Action item</th><th>Owner / due</th><th>Evidence</th></tr></thead><tbody>
    ${rows.map((r) => `<tr><td>${esc(r.id)}</td><td><b>${esc(r.title)}</b><br><small>${esc(r.guidance)}</small><br><small>Needs: ${esc(r.evidenceHint)}</small></td><td>${esc(r.status)}</td><td>${esc(r.action)}</td><td>${esc(r.owner)} ${fmtD(r.due)}</td><td>${esc(r.evidence)}</td></tr>`).join('')}
    </tbody></table><div class="sig"><div>Assessed by (IT)</div><div>Reviewed by</div><div>Approved by</div></div>`);
  });
})();

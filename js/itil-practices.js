/* ITMS ITIL 4 practices — the practice modules that complete the ITIL spine with
   ITIL-aligned names (not ServiceDesk Plus names). Adds: Major Incident Management,
   Deployment Management, Monitoring & Event Management, Service Level Management,
   IT Availability Management, IT Service Continuity Management, Information Security
   Management, Supplier Management, Continual Improvement, and an IT Asset Management
   hub. Data lives in S.db.sdp.itil (browser localStorage, same as the rest of ITMS).
   Delete is restricted to the Administrator role (ITMS.canDelete). */
(function () {
  const ITMS = window.ITMS, L = ITMS.logic, UI = ITMS.ui, S = ITMS.store;
  const pages = (ITMS.pages = ITMS.pages || {});
  const { esc, icon: ic, pill, fmtNum } = UI;
  const db = () => S.db;
  const H = () => (db() ? db().hd : null);
  const today = () => L.today();
  const now = () => new Date().toISOString();
  const fdt = (s) => (s ? String(s).replace('T', ' ').slice(0, 16) : '');
  const P = (t, c) => pill(t || '—', c || undefined);
  const C = { coral: '#ff5c6c', amber: '#ffb020', mint: '#10d9a0', blue: '#2f6bff', violet: '#6b5cff', cyan: '#00c2ff' };
  const PAL = ['#2f6bff', '#00a8e8', '#10d9a0', '#ffb020', '#ff5c6c', '#6b5cff'];

  /* ================= store ================= */
  const ARRAYS = ['majorIncidents', 'deployments', 'events', 'slm', 'availability', 'outages', 'continuity',
    'continuityTests', 'securityRisks', 'securityIncidents', 'accessReviews', 'supplierEvals', 'improvements', 'audit'];
  const SEQMAP = [['majorinc', 'majorIncidents'], ['deployment', 'deployments'], ['monitoring', 'events'], ['slm', 'slm'],
    ['availability', 'availability'], ['continuity', 'continuity'], ['security', 'securityRisks'], ['supplier', 'supplierEvals'], ['improvement', 'improvements']];
  function ensureItil() {
    const d = db(); if (!d) return;
    let s; try { s = ITMS.sdp.D(); } catch (e) { return; }
    if (!s) return;
    const it = (s.itil = s.itil || {});
    ARRAYS.forEach((k) => { if (!Array.isArray(it[k])) it[k] = []; });
    it.seq = it.seq || {};
    it.masters = Object.assign({
      severities: ['Sev 1 – Critical', 'Sev 2 – High', 'Sev 3 – Medium', 'Sev 4 – Low'],
      environments: ['Production', 'Staging', 'UAT', 'DR', 'Development'],
      outageClasses: ['Unplanned', 'Planned maintenance', 'Degradation'],
      riskTreatments: ['Mitigate', 'Accept', 'Transfer', 'Avoid'],
      improvementSources: ['Incident trend', 'Problem review', 'Audit finding', 'Customer feedback', 'SLA breach', 'Service review'],
      supplierTiers: ['Strategic', 'Tactical', 'Operational'],
      reviewTypes: ['Tabletop', 'Failover test', 'Full DR exercise'],
    }, it.masters || {});
    if (!it.seeded) { it.seeded = true; try { seed(it); } catch (e) { /* never break boot */ } }
    SEQMAP.forEach(([k, a]) => { let mx = 0; (it[a] || []).forEach((r) => { const m = /(\d+)\s*$/.exec(r.id || ''); if (m) mx = Math.max(mx, +m[1]); }); if (!it.seq[k] || it.seq[k] < mx) it.seq[k] = mx; });
  }
  const I = () => { ensureItil(); return ITMS.sdp.D().itil; };

  /* ================= helpers ================= */
  const nid = (k, p, w) => { const s = I().seq; s[k] = (s[k] || 0) + 1; return p + String(s[k]).padStart(w || 4, '0'); };
  const hist = (r, text) => { (r.hist = r.hist || []).unshift({ at: now(), text }); };
  const audit = (text) => { const a = I().audit; a.unshift({ at: now(), text, by: (ITMS.sdp && ITMS.sdp.effRole ? ITMS.sdp.effRole() : 'IT') }); if (a.length > 400) a.length = 400; };
  const notify = (subject, body) => { const s = ITMS.sdp.D(); (s.notiflog = s.notiflog || []).unshift({ id: 'NT-' + Date.now().toString().slice(-6), at: now(), channel: 'Email', to: 'IT Operations', subject, body: body || '' }); if (s.notiflog.length > 300) s.notiflog.length = 300; };
  const logged = (r) => (r.hist || []).length ? `<ul class="timeline">${r.hist.map((h) => `<li><small>${fdt(h.at)}</small><div>${esc(h.text)}</div></li>`).join('')}</ul>` : '<div class="empty">No history yet</div>';
  const delBtn = (id, key) => (ITMS.canDelete && ITMS.canDelete()) ? `<button class="ibtn" style="--c:#ff5c6c" data-act="${key}.del" data-id="${id}" title="Delete (Administrator only)">${ic('trash')}</button>` : '';
  const kpi = (n, l, c, s) => `<div class="card kpi" style="--c:${c}"><div><div class="v">${n}</div><div class="l">${esc(l)}</div>${s ? `<div class="s">${esc(s)}</div>` : ''}</div></div>`;
  const bars = (rows) => { const m = Math.max(1, ...rows.map((r) => r[1])); return rows.map((r) => `<div style="display:flex;align-items:center;gap:10px;margin:6px 0"><span style="width:150px;font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r[0])}">${esc(r[0])}</span><div class="bar3" style="flex:1"><i style="width:${Math.round((r[1] / m) * 100)}%;--c:${r[2] || C.violet}"></i></div><b style="width:34px;text-align:right">${r[1]}</b></div>`).join('') || '<div class="empty">No data</div>'; };
  const statusBars = (rs, order) => bars((order || L.uniq(rs.map((r) => r.status))).map((s, i) => [s, rs.filter((r) => r.status === s).length, PAL[i % PAL.length]]).filter((x) => x[1] || (order || []).includes(x[0])));
  const stageStrip = (stages, rs) => `<div class="card" style="margin-bottom:14px"><div class="flow">${stages.map((s, i) => `<div class="st" style="--c:${PAL[i % PAL.length]}"><b>${rs.filter((r) => r.status === s).length}</b><span>${esc(s)}</span></div>`).join('')}</div></div>`;
  const grid = (a) => `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px 18px">${a.filter((x) => x).map(([k, v]) => `<div><small style="color:var(--muted)">${esc(k)}</small><div><b>${v == null || v === '' ? '—' : v}</b></div></div>`).join('')}</div>`;
  const link = (id, actName, label) => (id ? `<a class="link" data-act="${actName}" data-id="${esc(id)}">${esc(label || id)}</a>` : '—');

  /* option lists (from the live stores) */
  const owners = () => { try { return (H().techs || []).filter((t) => t.active === 'Yes').map((t) => t.name); } catch (e) { return []; } };
  const groupsOpt = () => { try { return H().cfg.groups; } catch (e) { return ['Service Desk (L1)']; } };
  const svcOpts = () => { try { return ITMS.sdp.D().services.map((s) => ({ v: s.id, l: `${s.name} (${s.kind})` })); } catch (e) { return []; } };
  const ciOpts = () => { try { return ITMS.sdp.D().cis.map((c) => ({ v: c.id, l: `${c.id} · ${c.name || c.description || ''}` })); } catch (e) { return []; } };
  const vendorOpts = () => db().vendors.map((v) => ({ v: v.name, l: `${v.name}${v.currency ? ' · ' + v.currency : ''}` }));
  const empOpts = () => db().employees.filter((e) => e.status === 'Active' && !e.sys).map((e) => ({ v: e.no, l: `${e.name} (${e.no})` }));
  const svcName = (id) => { try { const s = ITMS.sdp.D().services.find((x) => x.id === id); return s ? s.name : ''; } catch (e) { return ''; } };

  /* ================= generic practice engine ================= */
  function openDetail(cfg, r) {
    const body = `${grid(cfg.detail ? cfg.detail(r) : [['Status', P(r.status)], ['Priority', r.priority ? P(r.priority) : '—'], ['Owner', esc(r.owner || '—')], ['Created', fdt(r.created)]])}
      <h4 style="margin:16px 0 4px">Summary</h4><div style="white-space:pre-wrap">${esc(r.desc || '—')}</div>
      <h4 style="margin:16px 0 4px">Audit trail</h4>${logged(r)}`;
    const trans = (cfg.transitions || []).filter((t) => t.to !== r.status).map((t) => `<button class="btn sm" data-tr="${esc(t.to)}">${esc(t.label)}</button>`).join('');
    const ov = UI.modal(`<header><span class="gem" style="width:42px;height:42px;border-radius:14px">${ic(cfg.icon)}</span><div><h3>${esc(r.id)} · ${esc(r.title)}</h3><small>${esc(cfg.title)}</small></div><button class="ibtn x" data-x>${ic('x')}</button></header><div class="body">${body}</div><footer style="flex-wrap:wrap;gap:6px">${trans}<button class="btn sm ghost" data-ed>${ic('edit')}Edit</button><button class="btn sm ghost" data-note>${ic('plus')}Add note</button></footer>`, { size: 'lg' });
    ov.addEventListener('click', (e) => {
      if (e.target.closest('[data-x]')) return UI.close(ov);
      if (e.target.closest('[data-ed]')) { UI.close(ov); openForm(cfg, r); return; }
      if (e.target.closest('[data-note]')) { UI.form({ title: 'Add note', icon: 'edit', fields: [{ k: 'text', label: 'Note', type: 'textarea', full: true, req: true }], onSubmit: (v) => { hist(r, 'Note: ' + v.text); S.emit(); UI.toast('Note added'); } }); return; }
      const tr = e.target.closest('[data-tr]'); if (tr) { const from = r.status; r.status = tr.dataset.tr; if ((cfg.transitions || []).some((t) => t.to === r.status)) hist(r, `Status ${from} → ${r.status}`); if (/closed|restored|completed|retired/i.test(r.status)) r.closedAt = now(); audit(`${r.id} → ${r.status}`); notify(`${cfg.title}: ${r.id} → ${r.status}`); S.emit(); UI.close(ov); UI.toast(`${r.id} → ${r.status}`); return; }
    });
  }
  function openForm(cfg, rec) {
    const isNew = !rec;
    const vals = isNew ? Object.assign({}, cfg.defaults ? cfg.defaults() : {}) : Object.assign({}, rec);
    UI.form({
      title: (isNew ? 'New ' : 'Edit ') + cfg.label + (rec ? ' ' + rec.id : ''), sub: cfg.formSub, icon: cfg.icon, size: 'lg',
      fields: cfg.fields(), deps: cfg.deps, values: vals,
      onSubmit: (v) => {
        if (isNew) {
          const r = Object.assign({ hist: [], created: now() }, v);
          r.id = nid(cfg.seqKey || cfg.id, cfg.prefix, cfg.w || 4);
          r.owner = r.owner || owners()[0] || '';
          I()[cfg.coll].unshift(r);
          hist(r, `${cfg.label} ${r.id} created`);
          audit('Created ' + cfg.label + ' ' + r.id);
          notify(`${cfg.title}: ${r.id} raised`, r.title);
          S.emit(); UI.toast(`${r.id} created`);
        } else {
          Object.assign(rec, v); hist(rec, 'Record updated'); audit('Updated ' + rec.id); S.emit(); UI.toast('Saved');
        }
      },
    });
  }
  function practice(cfg) {
    cfg.coll = cfg.coll || cfg.id;
    const rs = () => (I()[cfg.coll] || []);
    const find = (id) => rs().find((r) => r.id === id);
    const key = 'ip.' + cfg.id;
    UI.on(key + '.new', () => openForm(cfg));
    UI.on(key + '.edit', (el) => openForm(cfg, find(el.dataset.id)));
    UI.on(key + '.view', (el) => { const r = find(el.dataset.id); if (r) openDetail(cfg, r); });
    UI.on(key + '.del', async (el) => { if (!ITMS.canDelete()) return UI.toast('Only Administrator can delete records', 'err'); const r = find(el.dataset.id); if (await UI.confirm(`Delete <b>${esc(r.id)}</b>?`, 'Delete', true)) { I()[cfg.coll] = rs().filter((x) => x !== r); audit('Deleted ' + r.id); S.emit(); UI.toast('Deleted'); } });
    if (cfg.rowActions) UI.on(key + '.act', (el) => { const r = find(el.dataset.id); try { cfg.rowActions(el.dataset.a, r, el); } catch (e) { UI.toast(e.message, 'err'); } });
    const acts = (r) => `<button class="ibtn" title="Open" data-act="${key}.view" data-id="${r.id}">${ic('eye')}</button><button class="ibtn" data-act="${key}.edit" data-id="${r.id}">${ic('edit')}</button>${cfg.rowActions ? cfg.rowActionsHtml(r, key) : ''}${delBtn(r.id, key)}`;
    const toolbar = `<button class="btn" data-act="${key}.new">${ic('plus')}New ${esc(cfg.label)}</button>${cfg.tools || ''}`;
    return {
      title: cfg.title, crumb: cfg.crumb, icon: cfg.icon, color: cfg.color, group: 'ITIL Practices',
      render() {
        const rows = rs();
        const kpis = `<div class="grid g4">${(cfg.kpis ? cfg.kpis(rows) : [kpi(rows.length, 'Records', C.blue)]).join('')}</div>`;
        const strip = cfg.stages ? stageStrip(cfg.stages, rows) : '';
        const extra = cfg.extra ? cfg.extra(rows) : '';
        const report = `<div class="grid g2 mt"><div class="card"><h3>Records by status</h3>${statusBars(rows, cfg.stages)}</div><div class="card"><h3>${esc(cfg.reportTitle || 'Reporting')}</h3>${cfg.report ? cfg.report(rows) : bars(cfg.byKey ? (cfg.byKey(rows)) : [])}</div></div>`;
        const table = UI.table({
          id: 'ip' + cfg.id, rows: () => rs().map(cfg.decorate || ((x) => x)), sort: cfg.sort || 'created', dir: -1,
          text: (r) => [r.id, r.title, r.owner, r.category, r.status, r.serviceName].join(' '),
          filters: cfg.filters || [], cols: cfg.cols, actions: acts, toolbar,
        });
        return `${kpis}${strip}${extra}<div class="card mt">${table}</div>${report}`;
      },
    };
  }

  /* ================= 4 · Major Incident Management ================= */
  pages.majorinc = practice({
    id: 'majorinc', coll: 'majorIncidents', prefix: 'MI-', w: 4, label: 'major incident', icon: 'alert', color: '#ff5c6c',
    title: 'Major Incident Management', crumb: 'Declare → assemble response team → restore service → review',
    stages: ['Declared', 'Response assembled', 'Restored', 'Under review', 'Closed'],
    formSub: 'Declare a major incident and drive the response to service restoration',
    defaults: () => ({ status: 'Declared', severity: 'Sev 1 – Critical', priority: 'Critical' }),
    detail: (r) => [['Severity', P(r.severity, 'coral')], ['Status', P(r.status)], ['Commander', esc(r.commander || '—')], ['Service', esc(r.serviceName || r.service)], ['Started', fdt(r.started)], ['Restored', fdt(r.restoredAt)], ['Bridge', esc(r.bridge || '—')], ['Impacted CIs', esc(r.cis || '—')]],
    transitions: [{ label: 'Assemble team', to: 'Response assembled' }, { label: 'Service restored', to: 'Restored' }, { label: 'Start review', to: 'Under review' }, { label: 'Close', to: 'Closed' }],
    fields: () => [
      { k: 'title', label: 'Incident title', req: true, full: true }, { k: 'desc', label: 'Impact & current situation', type: 'textarea', full: true, req: true },
      { k: 'severity', label: 'Severity', type: 'select', options: () => I().masters.severities, blank: false }, { k: 'status', label: 'Status', type: 'select', options: ['Declared', 'Response assembled', 'Restored', 'Under review', 'Closed'], blank: false },
      { k: 'commander', label: 'Incident commander', type: 'select', options: owners }, { k: 'service', label: 'Impacted service', type: 'select', options: svcOpts },
      { k: 'started', label: 'Started', type: 'date' }, { k: 'bridge', label: 'Bridge / war-room details', full: true }, { k: 'cis', label: 'Impacted CIs', full: true }, { k: 'owner', label: 'Owner', type: 'select', options: owners },
      { k: 'review', label: 'Post-incident review notes', type: 'textarea', full: true },
    ],
    decorate: (r) => Object.assign({ serviceName: svcName(r.service) }, r),
    kpis: (rows) => [kpi(rows.filter((r) => r.status !== 'Closed').length, 'Open major incidents', C.coral), kpi(rows.filter((r) => r.severity === 'Sev 1 – Critical').length, 'Sev-1 total', C.amber), kpi(rows.filter((r) => r.status === 'Restored' || r.status === 'Under review').length, 'Awaiting review', C.blue), kpi(rows.filter((r) => r.status === 'Closed').length, 'Closed', C.mint)],
    cols: [{ k: 'id', label: 'ID', mono: true, render: (r) => `<a class="link" data-act="ip.majorinc.view" data-id="${r.id}">${r.id}</a>` }, { k: 'title', label: 'Major incident', render: (r) => `<b>${esc(r.title)}</b>` }, { k: 'severity', label: 'Severity', render: (r) => P(r.severity, 'coral') }, { k: 'serviceName', label: 'Service' }, { k: 'commander', label: 'Commander' }, { k: 'status', label: 'Status', render: (r) => P(r.status) }, { k: 'started', label: 'Started', render: (r) => fdt(r.started) }],
    filters: [{ k: 'status', label: 'Status', options: ['Declared', 'Response assembled', 'Restored', 'Under review', 'Closed'] }, { k: 'severity', label: 'Severity', options: () => I().masters.severities }],
    reportTitle: 'Major incidents by severity', byKey: (rows) => I().masters.severities.map((s) => [s, rows.filter((r) => r.severity === s).length, C.coral]),
    tools: `<button class="btn ghost" data-go="#/incidents">${ic('bell')}All incidents</button>`,
  });

  /* ================= 8 · Deployment Management ================= */
  pages.deployment = practice({
    id: 'deployment', coll: 'deployments', prefix: 'DEP-', w: 4, label: 'deployment', icon: 'upload', color: '#3b82f6',
    title: 'Deployment Management', crumb: 'Plan → test → deploy → verify → roll back if required',
    stages: ['Plan', 'Test', 'Deploy', 'Verify', 'Completed', 'Rolled back'],
    formSub: 'Move a built release/change into the live environment with verification and rollback',
    defaults: () => ({ status: 'Plan', environment: 'Production' }),
    detail: (r) => [['Status', P(r.status)], ['Environment', P(r.environment, 'violet')], ['Release', esc(r.release || '—')], ['Change', esc(r.change || '—')], ['Window', (fdt(r.windowStart) || '—') + ' → ' + (fdt(r.windowEnd) || '—')], ['Result', esc(r.result || '—')], ['Owner', esc(r.owner || '—')]],
    transitions: [{ label: 'Test', to: 'Test' }, { label: 'Deploy', to: 'Deploy' }, { label: 'Verify', to: 'Verify' }, { label: 'Complete', to: 'Completed' }, { label: 'Roll back', to: 'Rolled back' }],
    fields: () => [
      { k: 'title', label: 'Deployment title', req: true, full: true }, { k: 'desc', label: 'Scope & steps', type: 'textarea', full: true },
      { k: 'status', label: 'Status', type: 'select', options: ['Plan', 'Test', 'Deploy', 'Verify', 'Completed', 'Rolled back'], blank: false }, { k: 'environment', label: 'Environment', type: 'select', options: () => I().masters.environments, blank: false },
      { k: 'release', label: 'Release', type: 'select', options: () => (H() && H().releases ? H().releases.map((x) => ({ v: x.id, l: `${x.id} · ${x.title}` })) : []) }, { k: 'change', label: 'Change (CHG)', full: true },
      { k: 'owner', label: 'Deployment owner', type: 'select', options: owners }, { k: 'windowStart', label: 'Window start', type: 'date' }, { k: 'windowEnd', label: 'Window end', type: 'date' },
      { k: 'verify', label: 'Verification steps / acceptance', type: 'textarea', full: true }, { k: 'rollback', label: 'Rollback plan', type: 'textarea', full: true }, { k: 'result', label: 'Outcome', type: 'textarea', full: true },
    ],
    decorate: (r) => Object.assign({}, r),
    kpis: (rows) => [kpi(rows.filter((r) => ['Plan', 'Test', 'Deploy'].includes(r.status)).length, 'In flight', C.blue), kpi(rows.filter((r) => r.status === 'Verify').length, 'Awaiting verification', C.amber), kpi(rows.filter((r) => r.status === 'Completed').length, 'Completed', C.mint), kpi(rows.filter((r) => r.status === 'Rolled back').length, 'Rolled back', C.coral)],
    cols: [{ k: 'id', label: 'ID', mono: true, render: (r) => `<a class="link" data-act="ip.deployment.view" data-id="${r.id}">${r.id}</a>` }, { k: 'title', label: 'Deployment', render: (r) => `<b>${esc(r.title)}</b>` }, { k: 'environment', label: 'Env' }, { k: 'release', label: 'Release' }, { k: 'status', label: 'Status', render: (r) => P(r.status) }, { k: 'owner', label: 'Owner' }, { k: 'windowStart', label: 'Window', render: (r) => fdt(r.windowStart) }],
    filters: [{ k: 'status', label: 'Status', options: ['Plan', 'Test', 'Deploy', 'Verify', 'Completed', 'Rolled back'] }, { k: 'environment', label: 'Environment', options: () => I().masters.environments }],
    rowActions: (a, r) => { if (a !== 'adv') return; r.status = r.status === 'Completed' ? 'Plan' : 'Completed'; hist(r, 'Status set to ' + r.status); S.emit(); },
    rowActionsHtml: (r, key) => `<button class="btn xs ghost" data-act="${key}.act" data-a="adv" data-id="${r.id}">Toggle done</button>`,
  });

  /* ================= 12 · Monitoring & Event Management ================= */
  pages.monitoring = practice({
    id: 'monitoring', coll: 'events', prefix: 'EVT-', w: 5, label: 'event', icon: 'cpu', color: '#00c2ff',
    title: 'Monitoring & Event Management', crumb: 'Monitor → detect → correlate → alert → raise incident if needed',
    stages: ['New', 'Correlated', 'Alerted', 'Incident raised', 'Closed'],
    formSub: 'Capture a monitoring event and promote it to an incident when service is affected',
    defaults: () => ({ status: 'New', severity: 'Medium', source: 'OpManager' }),
    detail: (r) => [['Status', P(r.status)], ['Severity', P(r.severity)], ['Source', esc(r.source || '—')], ['Node', esc(r.node || '—')], ['CI', esc(r.ci || '—')], ['Raised', fdt(r.at)]],
    transitions: [{ label: 'Correlate', to: 'Correlated' }, { label: 'Alert', to: 'Alerted' }, { label: 'Raise incident', to: 'Incident raised' }, { label: 'Close', to: 'Closed' }],
    fields: () => [
      { k: 'title', label: 'Event summary', req: true, full: true }, { k: 'desc', label: 'Details / metric breach', type: 'textarea', full: true },
      { k: 'source', label: 'Monitoring source', type: 'select', options: ['OpManager', 'Zabbix', 'Nagios', 'PRTG', 'Site24x7', 'Cloud monitor', 'Manual'], blank: false }, { k: 'node', label: 'Node / device', req: true },
      { k: 'severity', label: 'Severity', type: 'select', options: ['Critical', 'High', 'Medium', 'Low'], blank: false }, { k: 'status', label: 'Status', type: 'select', options: ['New', 'Correlated', 'Alerted', 'Incident raised', 'Closed'], blank: false },
      { k: 'ci', label: 'Related CI', type: 'select', options: ciOpts }, { k: 'raised', label: 'Ticket raised (REQ)', full: true }, { k: 'owner', label: 'Owner', type: 'select', options: owners },
    ],
    kpis: (rows) => [kpi(rows.filter((r) => r.status !== 'Closed').length, 'Open events', C.coral), kpi(rows.filter((r) => r.severity === 'Critical').length, 'Critical', C.amber), kpi(rows.filter((r) => r.status === 'Incident raised').length, 'Promoted to incident', C.blue), kpi(rows.filter((r) => r.status === 'Closed').length, 'Closed', C.mint)],
    cols: [{ k: 'id', label: 'ID', mono: true, render: (r) => `<a class="link" data-act="ip.monitoring.view" data-id="${r.id}">${r.id}</a>` }, { k: 'title', label: 'Event', render: (r) => `<b>${esc(r.title)}</b>` }, { k: 'source', label: 'Source' }, { k: 'node', label: 'Node' }, { k: 'severity', label: 'Severity', render: (r) => P(r.severity) }, { k: 'status', label: 'Status', render: (r) => P(r.status) }, { k: 'at', label: 'Detected', render: (r) => fdt(r.at) }],
    filters: [{ k: 'status', label: 'Status', options: ['New', 'Correlated', 'Alerted', 'Incident raised', 'Closed'] }, { k: 'severity', label: 'Severity', options: ['Critical', 'High', 'Medium', 'Low'] }, { k: 'source', label: 'Source', options: ['OpManager', 'Zabbix', 'Nagios', 'PRTG', 'Site24x7', 'Cloud monitor', 'Manual'] }],
    rowActions: (a, r) => {
      if (a !== 'inc') return;
      const mk = ITMS.sdp.mkTicket; if (!mk) return UI.toast('Helpdesk engine unavailable', 'err');
      const pr = { Critical: ['High', 'Urgent'], High: ['High', 'High'], Medium: ['Medium', 'Normal'], Low: ['Low', 'Low'] }[r.severity] || ['Medium', 'Normal'];
      const t = mk({ requester: '', subject: `[${r.source}] ${r.node}: ${r.title}`, desc: r.desc || r.title, category: 'Network & Connectivity', impact: pr[0], urgency: pr[1], type: 'Incident', mode: 'Email', source: 'Monitoring (' + r.source + ')' });
      r.status = 'Incident raised'; r.raised = t.id; hist(r, 'Incident ' + t.id + ' raised'); audit('Event ' + r.id + ' → incident ' + t.id); S.emit(); UI.toast(`Incident ${t.id} raised`);
    },
    rowActionsHtml: (r, key) => `<button class="btn xs" data-act="${key}.act" data-a="inc" data-id="${r.id}">Raise incident</button>`,
    tools: `<button class="btn ghost" data-go="#/discovery">${ic('search')}Discovery & network map</button>`,
  });

  /* ================= 13 · Service Level Management ================= */
  pages.slm = practice({
    id: 'slm', coll: 'slm', prefix: 'SLA-', w: 3, label: 'SLA target', icon: 'clock', color: '#1d4ed8',
    title: 'Service Level Management', crumb: 'Define SLA → approve targets → monitor performance → report breaches → improve',
    stages: ['Draft', 'Approved', 'Active', 'At risk', 'Breached'],
    formSub: 'Define and monitor service-level targets per service, with owners and breach reporting',
    defaults: () => ({ status: 'Draft', metric: 'Availability', window: '24x7', target: 99.9 }),
    detail: (r) => [['Status', P(r.status)], ['Service', esc(r.serviceName || r.service)], ['Metric', esc(r.metric || '—')], ['Target', esc(String(r.target) + (r.unit || '%'))], ['Achieved', esc(String(r.achieved == null ? '—' : r.achieved) + (r.achieved == null ? '' : (r.unit || '%')))], ['Window', esc(r.window || '—')], ['Owner', esc(r.owner || '—')]],
    transitions: [{ label: 'Approve', to: 'Approved' }, { label: 'Activate', to: 'Active' }, { label: 'Flag at risk', to: 'At risk' }, { label: 'Record breach', to: 'Breached' }],
    fields: () => [
      { k: 'title', label: 'SLA / target name', req: true, full: true }, { k: 'service', label: 'Service', type: 'select', options: svcOpts, req: true },
      { k: 'metric', label: 'Metric', type: 'select', options: ['Availability', 'Response time', 'Resolution time', 'First-time fix', 'Customer satisfaction'], blank: false },
      { k: 'target', label: 'Target', type: 'number', step: '0.01' }, { k: 'unit', label: 'Unit', type: 'select', options: ['%', 'hours', 'minutes', 'score'], blank: false },
      { k: 'achieved', label: 'Achieved (last period)', type: 'number', step: '0.01' }, { k: 'window', label: 'Service window', type: 'select', options: ['24x7', '8x5', '12x6', 'Business hours'], blank: false },
      { k: 'status', label: 'Status', type: 'select', options: ['Draft', 'Approved', 'Active', 'At risk', 'Breached'], blank: false }, { k: 'owner', label: 'Service owner', type: 'select', options: owners },
      { k: 'breaches', label: 'Breaches (period)', type: 'number' }, { k: 'review', label: 'Service review notes', type: 'textarea', full: true },
    ],
    decorate: (r) => Object.assign({ serviceName: svcName(r.service) }, r),
    kpis: (rows) => [kpi(rows.filter((r) => r.status === 'Active').length, 'Active SLAs', C.mint), kpi(rows.filter((r) => r.status === 'At risk').length, 'At risk', C.amber), kpi(rows.filter((r) => r.status === 'Breached').length, 'Breached', C.coral), kpi(rows.reduce((s, r) => s + (L.num(r.breaches) || 0), 0), 'Total breaches', C.violet)],
    cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'title', label: 'Target', render: (r) => `<b>${esc(r.title)}</b>` }, { k: 'serviceName', label: 'Service' }, { k: 'metric', label: 'Metric' }, { k: 'target', label: 'Target', num: true, render: (r) => esc(String(r.target == null ? '' : r.target) + (r.unit || '')) }, { k: 'achieved', label: 'Achieved', num: true, render: (r) => (r.achieved == null ? '—' : ifClass(r.achieved, r.target) + esc(String(r.achieved) + (r.unit || '')) + '</span>') }, { k: 'status', label: 'Status', render: (r) => P(r.status) }, { k: 'owner', label: 'Owner' }],
    filters: [{ k: 'status', label: 'Status', options: ['Draft', 'Approved', 'Active', 'At risk', 'Breached'] }, { k: 'metric', label: 'Metric', options: ['Availability', 'Response time', 'Resolution time', 'First-time fix', 'Customer satisfaction'] }],
    reportTitle: 'SLA performance', report: (rows) => bars(rows.map((r) => [r.title, L.num(r.breaches) || 0, C.coral])),
  });
  function ifClass(a, t) { return '<span style="color:' + (t != null && L.num(a) >= L.num(t) ? '#10d9a0' : '#ff5c6c') + '">'; }

  /* ================= 14 · IT Availability Management ================= */
  pages.availability = practice({
    id: 'availability', coll: 'availability', prefix: 'AVL-', w: 3, label: 'availability record', icon: 'trend', color: '#10d9a0',
    title: 'IT Availability Management', crumb: 'Define availability targets → monitor → analyse outages → improve',
    stages: ['Target set', 'Monitoring', 'Degraded', 'Recovered', 'Improving'],
    formSub: 'Set availability targets for a service and track achieved availability against them',
    defaults: () => ({ status: 'Target set', targetPct: 99.9 }),
    detail: (r) => [['Status', P(r.status)], ['Service', esc(r.serviceName || r.service)], ['Target', esc(String(r.targetPct) + '%')], ['Achieved', esc(String(r.achievedPct == null ? '—' : r.achievedPct) + '%')], ['Window', esc(r.window || '—')], ['Downtime (min)', esc(r.downtime == null ? '—' : r.downtime)]],
    transitions: [{ label: 'Start monitoring', to: 'Monitoring' }, { label: 'Flag degraded', to: 'Degraded' }, { label: 'Recovered', to: 'Recovered' }, { label: 'Improvement plan', to: 'Improving' }],
    fields: () => [
      { k: 'title', label: 'Record name', req: true, full: true }, { k: 'service', label: 'Service', type: 'select', options: svcOpts, req: true },
      { k: 'targetPct', label: 'Target availability (%)', type: 'number', step: '0.01' }, { k: 'achievedPct', label: 'Achieved (%)', type: 'number', step: '0.01' },
      { k: 'window', label: 'Service window', type: 'select', options: ['24x7', '8x5', '12x6', 'Business hours'], blank: false }, { k: 'downtime', label: 'Downtime this period (minutes)', type: 'number' },
      { k: 'status', label: 'Status', type: 'select', options: ['Target set', 'Monitoring', 'Degraded', 'Recovered', 'Improving'], blank: false }, { k: 'owner', label: 'Service owner', type: 'select', options: owners },
      { k: 'improve', label: 'Improvement actions', type: 'textarea', full: true },
    ],
    decorate: (r) => Object.assign({ serviceName: svcName(r.service) }, r),
    kpis: (rows) => { const wa = rows.filter((r) => r.achievedPct != null && r.achievedPct !== ''); const avg = wa.length ? wa.reduce((s, r) => s + L.num(r.achievedPct), 0) / wa.length : 0; return [kpi(rows.filter((r) => r.status === 'Degraded').length, 'Degraded services', C.coral), kpi(avg.toFixed(2) + '%', 'Average achieved', C.mint), kpi(rows.filter((r) => r.status === 'Improving').length, 'Improvement plans', C.amber), kpi(rows.length, 'Services tracked', C.blue)]; },
    cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'serviceName', label: 'Service' }, { k: 'targetPct', label: 'Target', num: true, render: (r) => esc(String(r.targetPct) + '%') }, { k: 'achievedPct', label: 'Achieved', num: true, render: (r) => (r.achievedPct == null ? '—' : ifClass(r.achievedPct, r.targetPct) + esc(String(r.achievedPct) + '%') + '</span>') }, { k: 'downtime', label: 'Downtime (min)', num: true }, { k: 'status', label: 'Status', render: (r) => P(r.status) }, { k: 'owner', label: 'Owner' }],
    filters: [{ k: 'status', label: 'Status', options: ['Target set', 'Monitoring', 'Degraded', 'Recovered', 'Improving'] }],
    extra: () => { const o = I().outages; return `<div class="card mt"><h3><span class="pip" style="--c:${C.coral}"></span>Outage register <span class="tag">${o.length}</span></h3><table class="t"><thead><tr><th>Ref</th><th>Outage</th><th>Class</th><th class="num">Minutes</th><th>Cause</th><th>Status</th></tr></thead><tbody>${o.map((x) => `<tr><td class="mono">${esc(x.id)}</td><td>${esc(x.title)}</td><td>${esc(x.class || '—')}</td><td class="num">${esc(x.duration == null ? '' : x.duration)}</td><td>${esc(x.cause || '—')}</td><td>${P(x.status)}</td></tr>`).join('') || '<tr><td colspan="6"><div class="empty">No outages recorded</div></td></tr>'}</tbody></table></div>`; },
    reportTitle: 'Target vs achieved', report: (rows) => bars(rows.map((r) => [svcName(r.service) || r.title, L.num(r.achievedPct) || 0, (L.num(r.achievedPct) >= L.num(r.targetPct) ? C.mint : C.coral)])),
  });

  /* ================= 15 · IT Service Continuity Management ================= */
  pages.continuity = practice({
    id: 'continuity', coll: 'continuity', prefix: 'BCP-', w: 3, label: 'continuity plan', icon: 'shield', color: '#6b5cff',
    title: 'IT Service Continuity Management', crumb: 'Assess risks → plan recovery → test continuity → improve plans',
    stages: ['Draft', 'Approved', 'Active', 'Tested', 'Needs update'],
    formSub: 'Hold the recovery plan for each critical service: RTO, RPO, owner and test status',
    defaults: () => ({ status: 'Draft', rto: '4 hours', rpo: '1 hour' }),
    detail: (r) => [['Status', P(r.status)], ['Service', esc(r.serviceName || r.service)], ['RTO', esc(r.rto || '—')], ['RPO', esc(r.rpo || '—')], ['Last test', fdt(r.lastTest)], ['Next test', fdt(r.nextTest)], ['Owner', esc(r.owner || '—')]],
    transitions: [{ label: 'Approve', to: 'Approved' }, { label: 'Activate', to: 'Active' }, { label: 'Mark tested', to: 'Tested' }, { label: 'Flag update', to: 'Needs update' }],
    fields: () => [
      { k: 'title', label: 'Plan name', req: true, full: true }, { k: 'service', label: 'Critical service', type: 'select', options: svcOpts, req: true },
      { k: 'rto', label: 'Recovery time objective (RTO)', type: 'select', options: ['1 hour', '2 hours', '4 hours', '8 hours', '24 hours', '48 hours'], blank: false }, { k: 'rpo', label: 'Recovery point objective (RPO)', type: 'select', options: ['15 minutes', '1 hour', '4 hours', '12 hours', '24 hours'], blank: false },
      { k: 'owner', label: 'Plan owner', type: 'select', options: owners }, { k: 'status', label: 'Status', type: 'select', options: ['Draft', 'Approved', 'Active', 'Tested', 'Needs update'], blank: false },
      { k: 'lastTest', label: 'Last test', type: 'date' }, { k: 'nextTest', label: 'Next test', type: 'date' },
      { k: 'strategy', label: 'Recovery strategy', type: 'textarea', full: true }, { k: 'desc', label: 'Scope & dependencies', type: 'textarea', full: true },
    ],
    decorate: (r) => Object.assign({ serviceName: svcName(r.service) }, r),
    kpis: (rows) => [kpi(rows.filter((r) => ['Active', 'Tested'].includes(r.status)).length, 'Live plans', C.mint), kpi(rows.filter((r) => r.status === 'Needs update').length, 'Needs update', C.coral), kpi(rows.filter((r) => r.lastTest).length, 'Tested at least once', C.blue), kpi(rows.length, 'Plans', C.violet)],
    cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'title', label: 'Plan', render: (r) => `<b>${esc(r.title)}</b>` }, { k: 'serviceName', label: 'Service' }, { k: 'rto', label: 'RTO' }, { k: 'rpo', label: 'RPO' }, { k: 'status', label: 'Status', render: (r) => P(r.status) }, { k: 'lastTest', label: 'Last test', render: (r) => fdt(r.lastTest) }],
    filters: [{ k: 'status', label: 'Status', options: ['Draft', 'Approved', 'Active', 'Tested', 'Needs update'] }],
    extra: () => { const t = I().continuityTests; return `<div class="card mt"><h3><span class="pip" style="--c:${C.violet}"></span>Continuity test register <span class="tag">${t.length}</span></h3><table class="t"><thead><tr><th>Ref</th><th>Plan</th><th>Date</th><th>Type</th><th>Result</th><th>Findings</th></tr></thead><tbody>${t.map((x) => `<tr><td class="mono">${esc(x.id)}</td><td>${esc(x.plan)}</td><td>${fdt(x.date)}</td><td>${esc(x.type)}</td><td>${P(x.result, x.result === 'Passed' ? 'mint' : 'amber')}</td><td>${esc(x.findings || '—')}</td></tr>`).join('') || '<tr><td colspan="6"><div class="empty">No tests recorded</div></td></tr>'}</tbody></table></div>`; },
  });

  /* ================= 16 · Information Security Management ================= */
  pages.security = practice({
    id: 'security', coll: 'securityRisks', prefix: 'RISK-', w: 4, label: 'security risk', icon: 'shield', color: '#ff5c6c',
    title: 'Information Security Management', crumb: 'Identify risks → apply controls → monitor → investigate → remediate',
    stages: ['Identified', 'Assessed', 'Treatment', 'Monitoring', 'Closed'],
    formSub: 'Security risk register with controls, treatment and review — evidence ties to the compliance frameworks',
    defaults: () => ({ status: 'Identified', likelihood: 'Medium', impact: 'Medium', treatment: 'Mitigate' }),
    detail: (r) => [['Status', P(r.status)], ['Category', esc(r.category || '—')], ['Likelihood', esc(r.likelihood || '—')], ['Impact', esc(r.impact || '—')], ['Rating', P(rating(r), rating(r) === 'High' || rating(r) === 'Critical' ? 'coral' : rating(r) === 'Medium' ? 'amber' : 'mint')], ['Treatment', esc(r.treatment || '—')], ['Owner', esc(r.owner || '—')], ['Review', fdt(r.review)]],
    transitions: [{ label: 'Assess', to: 'Assessed' }, { label: 'Treat', to: 'Treatment' }, { label: 'Monitor', to: 'Monitoring' }, { label: 'Close', to: 'Closed' }],
    fields: () => [
      { k: 'title', label: 'Risk / control', req: true, full: true }, { k: 'desc', label: 'Description & affected assets', type: 'textarea', full: true },
      { k: 'category', label: 'Category', type: 'select', options: ['Access control', 'Malware', 'Data loss', 'Vulnerability', 'Insider threat', 'Third party', 'Physical', 'Compliance'], blank: false },
      { k: 'likelihood', label: 'Likelihood', type: 'select', options: ['Low', 'Medium', 'High'], blank: false }, { k: 'impact', label: 'Impact', type: 'select', options: ['Low', 'Medium', 'High'], blank: false },
      { k: 'treatment', label: 'Treatment', type: 'select', options: () => I().masters.riskTreatments, blank: false }, { k: 'status', label: 'Status', type: 'select', options: ['Identified', 'Assessed', 'Treatment', 'Monitoring', 'Closed'], blank: false },
      { k: 'owner', label: 'Risk owner', type: 'select', options: owners }, { k: 'review', label: 'Next review', type: 'date' }, { k: 'controls', label: 'Controls applied', type: 'textarea', full: true }, { k: 'framework', label: 'Framework reference (e.g. ISO A.8.16)', full: true },
    ],
    kpis: (rows) => [kpi(rows.filter((r) => r.status !== 'Closed').length, 'Open risks', C.coral), kpi(rows.filter((r) => ['High', 'Critical'].includes(rating(r))).length, 'High / critical', C.amber), kpi(rows.filter((r) => r.treatment === 'Mitigate').length, 'Being mitigated', C.blue), kpi(secIncidents().filter((i) => i.status !== 'Closed').length, 'Open security incidents', C.violet)],
    cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'title', label: 'Risk', render: (r) => `<b>${esc(r.title)}</b>` }, { k: 'category', label: 'Category' }, { k: 'rating', label: 'Rating', render: (r) => { const x = rating(r); return P(x, ['High', 'Critical'].includes(x) ? 'coral' : x === 'Medium' ? 'amber' : 'mint'); } }, { k: 'treatment', label: 'Treatment' }, { k: 'status', label: 'Status', render: (r) => P(r.status) }, { k: 'owner', label: 'Owner' }],
    filters: [{ k: 'status', label: 'Status', options: ['Identified', 'Assessed', 'Treatment', 'Monitoring', 'Closed'] }, { k: 'category', label: 'Category', options: ['Access control', 'Malware', 'Data loss', 'Vulnerability', 'Insider threat', 'Third party', 'Physical', 'Compliance'] }],
    extra: () => {
      const inc = secIncidents(); const ar = I().accessReviews;
      return `<div class="grid g3 mt"><div class="card"><h3><span class="pip" style="--c:${C.coral}"></span>Security incidents <span class="tag">${inc.length}</span></h3><table class="t"><thead><tr><th>ID</th><th>Incident</th><th>Severity</th><th>Status</th></tr></thead><tbody>${inc.slice(0, 8).map((r) => `<tr><td class="mono">${esc(r.id)}</td><td>${esc(r.subject || r.title)}</td><td>${P(r.priority)}</td><td>${P(r.status)}</td></tr>`).join('') || '<tr><td colspan="4"><div class="empty">None recorded</div></td></tr>'}</tbody></table></div>
      <div class="card"><h3><span class="pip" style="--c:${C.violet}"></span>Access reviews <span class="tag">${ar.length}</span></h3><table class="t"><thead><tr><th>Ref</th><th>System</th><th>Reviewer</th><th>Status</th></tr></thead><tbody>${ar.map((r) => `<tr><td class="mono">${esc(r.id)}</td><td>${esc(r.system)}</td><td>${esc(r.reviewer || '—')}</td><td>${P(r.status)}</td></tr>`).join('') || '<tr><td colspan="4"><div class="empty">None recorded</div></td></tr>'}</tbody></table></div>
      <div class="card"><h3><span class="pip" style="--c:${C.blue}"></span>Controls & frameworks</h3><p style="font-size:12.5px;color:var(--muted)">Assessed control-by-control with owners, actions and evidence in the framework assessment.</p><div style="margin-top:10px"><button class="btn" data-go="#/compliance">${ic('shield')}Open control assessment</button></div></div></div>`;
    },
    reportTitle: 'Risks by rating', report: (rows) => bars(['Low', 'Medium', 'High', 'Critical'].map((r) => [r, rows.filter((x) => rating(x) === r).length, r === 'High' || r === 'Critical' ? C.coral : r === 'Medium' ? C.amber : C.mint])),
  });
  function rating(r) { const L1 = ['Low', 'Medium', 'High'].indexOf(r.likelihood); const I1 = ['Low', 'Medium', 'High'].indexOf(r.impact); const s = L1 + I1; return s >= 4 ? 'Critical' : s === 3 ? 'High' : s === 2 ? 'Medium' : 'Low'; }
  function secIncidents() { try { return (H().requests || []).filter((r) => r.category === 'Security & Compliance'); } catch (e) { return []; } }

  /* ================= 17 · Supplier Management ================= */
  pages.supplier = practice({
    id: 'supplier', coll: 'supplierEvals', prefix: 'SEV-', w: 3, label: 'supplier evaluation', icon: 'truck', color: '#3b82f6',
    title: 'Supplier Management', crumb: 'Register supplier → evaluate → contract → monitor performance → renew / terminate',
    stages: ['Scheduled', 'In progress', 'Evaluated', 'Under review', 'Closed'],
    formSub: 'Score a registered supplier on delivery, quality and support; renewal links to contracts',
    defaults: () => ({ status: 'Scheduled', period: today().slice(0, 4) }),
    detail: (r) => [['Status', P(r.status)], ['Supplier', esc(r.vendor || '—')], ['Period', esc(r.period || '—')], ['Delivery', esc(String(r.delivery == null ? '—' : r.delivery))], ['Quality', esc(String(r.quality == null ? '—' : r.quality))], ['Support', esc(String(r.support == null ? '—' : r.support))], ['Score', esc(String(r.score == null ? '—' : r.score))], ['Rating', P(r.rating)]],
    transitions: [{ label: 'Start', to: 'In progress' }, { label: 'Mark evaluated', to: 'Evaluated' }, { label: 'Under review', to: 'Under review' }, { label: 'Close', to: 'Closed' }],
    fields: () => [
      { k: 'vendor', label: 'Supplier', type: 'select', options: vendorOpts, req: true, full: true }, { k: 'period', label: 'Evaluation period', req: true },
      { k: 'delivery', label: 'Delivery score (1-5)', type: 'number' }, { k: 'quality', label: 'Quality score (1-5)', type: 'number' }, { k: 'support', label: 'Support score (1-5)', type: 'number' },
      { k: 'status', label: 'Status', type: 'select', options: ['Scheduled', 'In progress', 'Evaluated', 'Under review', 'Closed'], blank: false }, { k: 'reviewer', label: 'Reviewer', type: 'select', options: owners },
      { k: 'desc', label: 'Findings / comments', type: 'textarea', full: true }, { k: 'action', label: 'Follow-up action', type: 'textarea', full: true },
    ],
    decorate: (r) => Object.assign({ score: scoreOf(r), rating: ratingOf(scoreOf(r)) }, r),
    kpis: (rows) => [kpi(rows.length, 'Evaluations', C.blue), kpi(rows.filter((r) => ratingOf(scoreOf(r)) === 'Preferred').length, 'Preferred suppliers', C.mint), kpi(rows.filter((r) => ratingOf(scoreOf(r)) === 'Watch').length, 'Watch list', C.amber), kpi(db().vendors.length, 'Registered suppliers', C.violet)],
    cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'vendor', label: 'Supplier', render: (r) => `<b>${esc(r.vendor)}</b>` }, { k: 'period', label: 'Period' }, { k: 'score', label: 'Score', num: true }, { k: 'rating', label: 'Rating', render: (r) => P(r.rating, r.rating === 'Preferred' ? 'mint' : r.rating === 'Watch' ? 'coral' : 'amber') }, { k: 'status', label: 'Status', render: (r) => P(r.status) }, { k: 'reviewer', label: 'Reviewer' }],
    filters: [{ k: 'status', label: 'Status', options: ['Scheduled', 'In progress', 'Evaluated', 'Under review', 'Closed'] }, { k: 'vendor', label: 'Supplier', options: () => db().vendors.map((v) => v.name) }],
    reportTitle: 'Suppliers by rating', report: (rows) => bars(['Preferred', 'Acceptable', 'Watch'].map((r) => [r, rows.filter((x) => ratingOf(scoreOf(x)) === r).length, r === 'Preferred' ? C.mint : r === 'Watch' ? C.coral : C.amber])),
    tools: `<button class="btn ghost" data-go="#/vendors">${ic('users')}Supplier register</button><button class="btn ghost" data-go="#/contracts">${ic('receipt')}Contracts</button>`,
  });
  function scoreOf(r) { const a = [r.delivery, r.quality, r.support].map((x) => L.num(x)).filter((x) => x > 0); return a.length ? Math.round((a.reduce((s, x) => s + x, 0) / a.length) * 10) / 10 : 0; }
  function ratingOf(s) { return s >= 4.5 ? 'Preferred' : s >= 3.5 ? 'Acceptable' : (s ? 'Watch' : 'Acceptable'); }

  /* ================= 18 · Continual Improvement ================= */
  pages.improvement = practice({
    id: 'improvement', coll: 'improvements', prefix: 'CIR-', w: 4, label: 'improvement', icon: 'trend', color: '#10d9a0',
    title: 'Continual Improvement', crumb: 'Identify improvement → assess → prioritise → implement → measure results',
    stages: ['Identified', 'Assessed', 'Prioritised', 'Implementing', 'Measured', 'Closed'],
    formSub: 'The improvement register — every idea owns a benefit, an owner and a measurable outcome',
    defaults: () => ({ status: 'Identified', priority: 'Medium', source: 'Incident trend' }),
    detail: (r) => [['Status', P(r.status)], ['Source', esc(r.source || '—')], ['Priority', P(r.priority)], ['Owner', esc(r.owner || '—')], ['Benefit', esc(r.benefit || '—')], ['Target', fdt(r.target)], ['Measured', esc(r.measured || '—')]],
    transitions: [{ label: 'Assess', to: 'Assessed' }, { label: 'Prioritise', to: 'Prioritised' }, { label: 'Implement', to: 'Implementing' }, { label: 'Measure', to: 'Measured' }, { label: 'Close', to: 'Closed' }],
    fields: () => [
      { k: 'title', label: 'Improvement', req: true, full: true }, { k: 'desc', label: 'Description', type: 'textarea', full: true },
      { k: 'source', label: 'Source', type: 'select', options: () => I().masters.improvementSources, blank: false }, { k: 'priority', label: 'Priority', type: 'select', options: ['Low', 'Medium', 'High', 'Critical'], blank: false },
      { k: 'status', label: 'Status', type: 'select', options: ['Identified', 'Assessed', 'Prioritised', 'Implementing', 'Measured', 'Closed'], blank: false }, { k: 'owner', label: 'Owner', type: 'select', options: owners },
      { k: 'target', label: 'Target date', type: 'date' }, { k: 'benefit', label: 'Expected benefit', full: true }, { k: 'measured', label: 'Measured result', full: true },
    ],
    kpis: (rows) => [kpi(rows.filter((r) => r.status !== 'Closed').length, 'Open improvements', C.blue), kpi(rows.filter((r) => r.status === 'Implementing').length, 'Implementing', C.amber), kpi(rows.filter((r) => r.status === 'Measured' || r.status === 'Closed').length, 'Delivered', C.mint), kpi(rows.filter((r) => r.priority === 'High' || r.priority === 'Critical').length, 'High priority', C.coral)],
    cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'title', label: 'Improvement', render: (r) => `<b>${esc(r.title)}</b>` }, { k: 'source', label: 'Source' }, { k: 'priority', label: 'Priority', render: (r) => P(r.priority) }, { k: 'status', label: 'Status', render: (r) => P(r.status) }, { k: 'owner', label: 'Owner' }, { k: 'target', label: 'Target', render: (r) => fdt(r.target) }],
    filters: [{ k: 'status', label: 'Status', options: ['Identified', 'Assessed', 'Prioritised', 'Implementing', 'Measured', 'Closed'] }, { k: 'source', label: 'Source', options: () => I().masters.improvementSources }, { k: 'priority', label: 'Priority', options: ['Low', 'Medium', 'High', 'Critical'] }],
    reportTitle: 'Improvements by source', report: (rows) => bars(I().masters.improvementSources.map((s) => [s, rows.filter((r) => r.source === s).length, C.mint])),
    tools: `<button class="btn ghost" data-go="#/reportsplus">${ic('trend')}Analytics</button>`,
  });

  /* ================= 10 · IT Asset Management (practice hub) ================= */
  pages.assetmgmt = {
    title: 'IT Asset Management', crumb: 'Procure → receive → assign → maintain → transfer → retire / dispose', icon: 'laptop', color: '#1d4ed8', group: 'ITIL Practices',
    render() {
      const s = L.stats(); const d = db(); const k = s.kpi;
      const card = (go, icon, t, sub, n, c) => `<div class="card glow tilt" style="--c:${c};cursor:pointer" data-go="${go}"><div style="display:flex;gap:10px;align-items:center"><span class="gem" style="width:40px;height:40px">${ic(icon)}</span><div><h3 style="margin:0;font-size:15px">${esc(t)}</h3><small style="color:var(--muted)">${esc(sub)}</small></div><span style="margin-left:auto;font:700 22px var(--head)">${n}</span></div></div>`;
      const flow = ['Procure', 'Receive', 'Assign', 'Maintain', 'Transfer', 'Retire'];
      return `<div class="grid g4">${kpi(k.assets, 'Total assets', C.blue, k.inUse + ' in use · ' + k.inStock + ' spares')}${kpi(k.licences, 'Software licences', C.violet, k.licUsed + ' allocated')}${kpi(k.amcActive, 'Active AMC contracts', C.mint)}${kpi(k.disposed, 'Disposed', C.coral, k.repair + ' under repair')}</div>
      <div class="card mt"><h3><span class="pip"></span>Asset lifecycle</h3><div class="flow">${flow.map((x, i) => `<div class="st" style="--c:${PAL[i % PAL.length]}"><b>${i + 1}</b><span>${esc(x)}</span></div>`).join('')}</div><small style="color:var(--muted)">Assets move through these stages via issue / return / transfer and status changes. Every movement keeps full custody history.</small></div>
      <div class="grid g3 mt">
        ${card('#/hardware', 'laptop', 'Hardware assets', 'Register, warranty, assignment', d.hw.length, '#2f6bff')}
        ${card('#/software', 'box', 'Software licences', 'Entitlement & allocation', d.sw.length, '#6b5cff')}
        ${card('#/consumables', 'box', 'Consumables', 'Stock, reorder & issues', d.cons.length, '#00a8e8')}
        ${card('#/movements', 'swap', 'Movements', 'Issue, return, transfer, dispose', d.moves.length, '#10d9a0')}
        ${card('#/loans', 'swap', 'Asset loans', 'Temporary loans tracking', (ITMS.sdp.D().loans || []).length, '#00c2ff')}
        ${card('#/itemmaster', 'tag', 'Item Master', 'Every item with its GL account', (ITMS.sdp.D().items || []).length, '#3b82f6')}
        ${card('#/amc', 'receipt', 'AMC contracts', 'Maintenance cover & renewals', d.amcs.length, '#ffb020')}
        ${card('#/pmtasks', 'cal', 'Preventive maintenance', 'Scheduled servicing', (ITMS.sdp.D().maint || []).length, '#ff5c6c')}
        ${card('#/discovery', 'search', 'Discovery', 'Network scan & inventory', (ITMS.sdp.D().discovered || []).length, '#2f6bff')}
      </div>
      <div class="card mt"><h3>Assets by type & status</h3>${UI.bars3d(s.byType.map((t) => ({ label: t.type, value: t.total })), {})}</div>`;
    },
  };

  /* ================= seed data ================= */
  function seed(it) {
    const own = (i) => owners()[i % Math.max(1, owners().length)] || 'IT Administrator';
    const svc = (i) => { try { const a = ITMS.sdp.D().services; return a.length ? a[i % a.length].id : ''; } catch (e) { return ''; } };
    const svcNameOf = (id) => svcName(id);
    const ago = (n) => L.addDays(today(), -n);
    const fwd = (n) => L.addDays(today(), n);

    /* Major incidents */
    [
      ['Payment gateway outage — all card payments failing', 'Sev 1 – Critical', 'Restored', 'Visa/Mastercard traffic rejected at the edge firewall', 'Declared at 09:12; bridge opened with network + applications. Failover to secondary gateway completed.', 0],
      ['ERP application slow for all Finance users', 'Sev 2 – High', 'Under review', 'Database instance hitting 100% CPU after month-end batch', 'Response team assembled; batch job throttled; service restored. Review scheduled.', 9],
      ['Corporate Wi-Fi down at HQ floors 2–4', 'Sev 2 – High', 'Closed', 'Core switch line-card failure', 'Restored within 42 minutes by failing over to the secondary switch stack.', 21],
    ].forEach((x, i) => it.majorIncidents.unshift({ id: 'MI-' + String(i + 1).padStart(4, '0'), title: x[0], severity: x[1], status: x[2], desc: x[3], commander: own(i + 1), service: svc(i), started: ago(x[5]), restoredAt: ['Restored', 'Under review', 'Closed'].includes(x[2]) ? ago(x[5]) : '', bridge: 'Teams bridge — IT Ops', cis: '', owner: own(i + 1), review: x[2] === 'Closed' ? x[4] : '', created: ago(x[5]), hist: [{ at: now(), text: 'Major incident declared' }, { at: now(), text: x[4] }] }));

    /* Deployments */
    [
      ['Deploy ERP patch v4.2.3 to Production', 'Deploy', 'Production', 'Completed', 'Verified — no errors in 24h monitoring'],
      ['Roll out EDR agent v7.3 to all endpoints', 'Verify', 'Production', 'Completed', 'Staged rollout 60% complete'],
      ['Email gateway upgrade to Exchange 2019 CU13', 'Test', 'Staging', 'Completed', ''],
      ['Network core firmware upgrade', 'Plan', 'Production', 'Completed', 'Window agreed with business'],
      ['Portal v3.2 release — rolled back', 'Rolled back', 'Production', 'Rolled back', 'Rolled back — login regression found in verification'],
    ].forEach((x, i) => it.deployments.unshift({ id: 'DEP-' + String(i + 1).padStart(4, '0'), title: x[0], status: x[1], environment: x[2], release: '', change: '', owner: own(i), windowStart: ago(i * 3 + 1), windowEnd: ago(i * 3), verify: 'Acceptance tests + smoke test', rollback: 'Restore previous build from artefact store', result: x[4], desc: 'Deployment plan with pre-checks, steps and verification.', created: ago(i * 4 + 2), hist: [{ at: now(), text: 'Deployment planned' }] }));

    /* Monitoring events */
    [
      ['CPU utilisation > 95% on ERP-DB-01', 'OpManager', 'ERP-DB-01', 'Critical', 'Incident raised'],
      ['Disk space low on FILE-SRV-01 (D:)', 'Zabbix', 'FILE-SRV-01', 'High', 'Alerted'],
      ['WAN latency spike on edge link', 'PRTG', 'FW-EDGE-01', 'High', 'Correlated'],
      ['Backup job completed with warnings', 'Site24x7', 'BACKUP-NAS-01', 'Medium', 'New'],
      ['Repeated failed logins on DC', 'Zabbix', 'SRV-DC-01', 'High', 'Correlated'],
      ['SSL certificate expiring in 14 days', 'Nagios', 'PORTAL-WEB-01', 'Medium', 'Alerted'],
    ].forEach((x, i) => it.events.unshift({ id: 'EVT-' + String(i + 1).padStart(5, '0'), title: x[0], source: x[1], node: x[2], severity: x[3], status: x[4], desc: 'Threshold breach detected by ' + x[1] + '.', at: ago(i), ci: '', raised: '', owner: own(i), created: ago(i), hist: [{ at: now(), text: 'Event received from ' + x[1] }] }));

    /* Service level targets */
    [
      ['ERP platform availability', 'Availability', 99.9, '%', 99.95, 'Active', 0],
      ['Email service resolution time', 'Resolution time', 4, 'hours', 3.2, 'Active', 1],
      ['Network incident response', 'Response time', 1, 'hours', 0.8, 'At risk', 3],
      ['Self-service portal availability', 'Availability', 99.5, '%', 99.1, 'Breached', 5],
      ['Service desk first-time fix', 'First-time fix', 80, '%', 84, 'Active', 0],
      ['Customer satisfaction (CSAT)', 'Customer satisfaction', 4.2, 'score', 4.4, 'Active', 0],
    ].forEach((x, i) => it.slm.unshift({ id: 'SLA-' + String(i + 1).padStart(3, '0'), title: x[0], service: svc(i), metric: x[1], target: x[2], unit: x[3], achieved: x[4], status: x[5], breaches: x[6], window: i % 2 ? '8x5' : '24x7', owner: own(i), review: '', created: ago(30 + i), hist: [{ at: now(), text: 'SLA defined' }] }));

    /* Availability records + outages */
    [
      ['ERP platform', 99.9, 99.95, 'Monitoring', 22],
      ['Email service', 99.5, 99.6, 'Monitoring', 65],
      ['Network core', 99.99, 99.98, 'Degraded', 130],
      ['Self-service portal', 99.5, 99.1, 'Improving', 380],
      ['Biometric access control', 99.0, 99.3, 'Recovered', 45],
    ].forEach((x, i) => it.availability.unshift({ id: 'AVL-' + String(i + 1).padStart(3, '0'), title: x[0] + ' availability', service: svc(i), targetPct: x[1], achievedPct: x[2], status: x[3], downtime: x[4], window: '24x7', owner: own(i), improve: x[3] === 'Improving' ? 'Plan switch redundancy upgrade' : '', created: ago(60), hist: [{ at: now(), text: 'Availability target set' }] }));
    [
      ['ERP-DB-01 CPU saturation — 38 min outage', 'Unplanned', 38, 'Runaway batch job'],
      ['Network core line-card failure — 42 min', 'Unplanned', 42, 'Hardware failure'],
      ['Portal patching — planned 30 min', 'Planned maintenance', 30, 'Scheduled maintenance'],
    ].forEach((x, i) => it.outages.unshift({ id: 'OUT-' + String(i + 1).padStart(3, '0'), title: x[0], class: x[1], duration: x[2], cause: x[3], service: svc(i), ci: '', started: ago(i * 7 + 2), ended: ago(i * 7 + 2), status: i === 0 ? 'Open' : 'Closed', created: ago(i * 7 + 2) }));

    /* Continuity plans + tests */
    [
      ['ERP service recovery plan', '4 hours', '1 hour', 'Active', 'Hot standby DB + restore from last backup'],
      ['Email service recovery plan', '2 hours', '15 minutes', 'Tested', 'Cloud mail failover'],
      ['Network core recovery plan', '1 hour', '15 minutes', 'Active', 'Dual-core failover with spare chassis'],
      ['Portal recovery plan', '8 hours', '4 hours', 'Needs update', 'Rebuild from IaC'],
    ].forEach((x, i) => it.continuity.unshift({ id: 'BCP-' + String(i + 1).padStart(3, '0'), title: x[0], service: svc(i), rto: x[1], rpo: x[2], status: x[3], strategy: x[4], lastTest: i % 2 ? ago(90) : ago(200), nextTest: fwd(i % 2 ? 90 : 30), owner: own(i), desc: 'Scope and dependencies for ' + x[0], created: ago(180), hist: [{ at: now(), text: 'Plan created' }] }));
    [
      ['BCP-002', ago(90), 'Failover test', 'Passed', 'Cloud failover completed in 68 minutes'],
      ['BCP-001', ago(200), 'Tabletop', 'Passed', 'Gaps in DB restore steps identified and closed'],
      ['BCP-003', ago(45), 'Full DR exercise', 'Partial', 'Spare chassis not tested — follow-up raised'],
    ].forEach((x, i) => it.continuityTests.unshift({ id: 'BCT-' + String(i + 1).padStart(3, '0'), plan: x[0], date: x[1], type: x[2], result: x[3], findings: x[4], created: x[1] }));

    /* Security risks + access reviews */
    [
      ['Unpatched OS on 3 servers', 'Vulnerability', 'High', 'High', 'Mitigate', 'Treatment', 'A.8.16'],
      ['Shared service account passwords', 'Access control', 'Medium', 'High', 'Mitigate', 'Assessed', 'A.5.17'],
      ['Laptops without full-disk encryption', 'Data loss', 'Medium', 'High', 'Mitigate', 'Monitoring', 'A.8.1'],
      ['No MFA on VPN for vendors', 'Access control', 'High', 'High', 'Mitigate', 'Treatment', 'A.8.5'],
      ['Backup restore never tested', 'Data loss', 'Medium', 'High', 'Mitigate', 'Closed', 'A.8.13'],
    ].forEach((x, i) => it.securityRisks.unshift({ id: 'RISK-' + String(i + 1).padStart(4, '0'), title: x[0], category: x[1], likelihood: x[2], impact: x[3], treatment: x[4], status: x[5], framework: x[6], owner: own(i), review: fwd(30 + i * 10), controls: '', desc: 'Risk identified during security review.', created: ago(40 - i * 5), hist: [{ at: now(), text: 'Risk identified' }] }));
    [
      ['File server & shared folders', 'Information Security Officer', 'Quarterly', 'Clean'],
      ['ERP Finance role', 'Finance Manager', 'Quarterly', 'Two stale accounts disabled'],
      ['VPN & remote access', 'Network Team Lead', 'Monthly', 'One vendor token revoked'],
    ].forEach((x, i) => it.accessReviews.unshift({ id: 'ACR-' + String(i + 1).padStart(3, '0'), system: x[0], reviewer: x[1], date: ago(15 + i * 20), findings: x[3], status: i === 2 ? 'Open' : 'Closed', created: ago(15 + i * 20) }));

    /* Supplier evaluations */
    [
      ['TechSource Trading', 'Delivery', 4, 5, 4, 'Evaluated'],
      ['ProServe Maintenance', 'Response', 4, 4, 5, 'Under review'],
      ['SoftLine Solutions', 'Licensing', 5, 5, 4, 'Evaluated'],
      ['OfficeSupplies Co', 'Consumables', 3, 3, 2, 'Watch'],
    ].forEach((x, i) => it.supplierEvals.unshift({ id: 'SEV-' + String(i + 1).padStart(3, '0'), vendor: x[0], period: String(new Date().getFullYear()), delivery: x[2], quality: x[3], support: x[4], status: x[5], desc: 'Periodic performance review (' + x[1] + ').', reviewer: own(i + 1), action: '', created: ago(20 + i * 12), hist: [{ at: now(), text: 'Evaluation recorded' }] }));

    /* Continual improvements */
    [
      ['Reduce password-reset tickets with self-service reset', 'Incident trend', 'Implementing', 'High', '-40% L1 ticket volume'],
      ['Automate software licence true-up reporting', 'Audit finding', 'Prioritised', 'Medium', 'Accurate entitlement data'],
      ['Single sign-on for all business apps', 'Customer feedback', 'Assessed', 'High', 'Faster onboarding, fewer logins'],
      ['Retire legacy file server', 'Service review', 'Measured', 'Medium', 'Cost & risk reduction'],
      ['Proactive disk-space alerting', 'Incident trend', 'Closed', 'Medium', 'Prevent outages'],
    ].forEach((x, i) => it.improvements.unshift({ id: 'CIR-' + String(i + 1).padStart(4, '0'), title: x[0], source: x[1], status: x[2], priority: x[3], benefit: x[4], owner: own(i + 1), target: fwd(20 + i * 15), measured: i === 3 ? 'File server decommissioned; 18% cost saving' : '', desc: 'Continual improvement register entry.', created: ago(25 + i * 8), hist: [{ at: now(), text: 'Improvement logged' }] }));

    it.audit.unshift({ at: now(), text: 'ITIL practices seeded with sample records', by: 'System' });
  }

  /* ================= wire store hooks ================= */
  const prevInit = S.init;
  S.init = function () { prevInit.apply(S, arguments); try { ensureItil(); } catch (e) { /* never break boot */ } };
  S.subscribe(() => { try { ensureItil(); } catch (e) { /* never break render */ } });

  ITMS.itil = { ensureItil, I, practices: ['majorinc', 'deployment', 'monitoring', 'slm', 'availability', 'continuity', 'security', 'supplier', 'improvement', 'assetmgmt'] };
})();

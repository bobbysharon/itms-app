/* ITMS — IT Service Configuration Management (CMDB)
   ITIL 4 Service Configuration Management practice, aligned to the ManageEngine
   ServiceDesk Plus IT-CMDB capability set (https://www.manageengine.com/products/service-desk/itsm/it-cmdb-software.html).

   This module REPLACES the earlier lightweight CMDB screen. It provides the full
   ten-section structure: Dashboard, Configuration Items, CI Relationships,
   Service Mapping, Discovery & Reconciliation, Change & Configuration History,
   Configuration Baselines, Audits & Compliance, Reports & Analytics and
   CMDB Administration.

   Data lives in S.db.sdp (browser localStorage, same store as the rest of ITMS).
   Delete is restricted to the Administrator role via ITMS.canDelete(). */
(function () {
  const ITMS = window.ITMS, L = ITMS.logic, UI = ITMS.ui, S = ITMS.store;
  const pages = (ITMS.pages = ITMS.pages || {});
  const { esc, pill, icon: ic, fmtNum, fmtDate } = UI;
  const db = () => S.db;
  const H = () => (db() ? db().hd : null);
  const D = () => ITMS.sdp.D();
  const today = () => L.today();
  const now = () => new Date().toISOString();
  const fdt = (s) => (s ? String(s).replace('T', ' ').slice(0, 16) : '');
  const P = (t, c) => pill(t || '—', c || undefined);
  const C = { coral: '#ff5c6c', amber: '#ffb020', mint: '#10d9a0', blue: '#2f6bff', violet: '#2f6bff', cyan: '#00c2ff' };

  const techs = () => (H() && H().techs ? H().techs.filter((t) => t.active === 'Yes').map((t) => t.name) : []);
  const groups = () => (H() && H().cfg && H().cfg.groups ? H().cfg.groups : ['Service Desk (L1)']);
  const empOpts = () => (db() ? db().employees.filter((e) => e.status === 'Active' && !e.sys).map((e) => ({ v: e.no, l: `${e.name} (${e.no})` })) : []);
  const svcNames = () => D().services.map((s) => s.name);
  const uniq = (a) => [...new Set(a.filter(Boolean))];

  /* ---------- CI taxonomy ---------- */
  const CICLS = ['Hardware', 'Software', 'Network', 'Cloud & Virtualization', 'Application', 'Database', 'Storage', 'Service', 'Other'];
  const LC = ['Planned', 'Active', 'Under Maintenance', 'Retired'];
  const ENVS = ['Production', 'Test', 'Development', 'DR', 'Cloud'];
  const CRIT = ['Low', 'Medium', 'High', 'Critical'];
  const RELS = ['depends on', 'runs on', 'hosts', 'connects to', 'supports', 'backs up', 'installed on', 'member of'];

  function classOf(t) {
    const s = String(t || '').toLowerCase();
    if (/server|laptop|desktop|printer|ups|peripheral|workstation|monitor/.test(s)) return 'Hardware';
    if (/network|switch|router|firewall|access point|wifi|firewall/.test(s)) return 'Network';
    if (/cloud|virtual|\bvm\b|container|hypervisor/.test(s)) return 'Cloud & Virtualization';
    if (/database|oracle|sql/.test(s)) return 'Database';
    if (/storage|\bnas\b|\bsan\b|backup/.test(s)) return 'Storage';
    if (/service/.test(s)) return 'Service';
    if (/application|app|software|licence|license/.test(s)) return 'Application';
    return 'Other';
  }
  const lifeOf = (c) => (c.status === 'Live' ? 'Active' : c.status === 'Staged' ? 'Planned' : c.status === 'Retired' ? 'Retired' : (c.lifecycle || c.status || 'Active'));
  const ciById = (id) => D().cis.find((x) => x.id === id);
  const ciName = (id) => { const c = ciById(id); return c ? c.name : (id || '—'); };
  const ciOpts = () => D().cis.map((c) => ({ v: c.id, l: `${c.id} · ${c.name}` }));
  const svcById = (id) => D().services.find((x) => x.id === id);
  const svcOpts = () => D().services.map((s) => ({ v: s.id, l: `${s.name} (${s.kind})` }));

  /* ---------- ids ---------- */
  function uid(key, prefix, w) {
    const s = D(); s.seq = s.seq || {}; const set = new Set();
    Object.keys(s).forEach((k) => { if (Array.isArray(s[k])) s[k].forEach((r) => { if (r && r.id) set.add(r.id); }); });
    let id;
    do { s.seq[key] = (s.seq[key] || 0) + 1; id = prefix + String(s.seq[key]).padStart(w || 3, '0'); } while (set.has(id));
    return id;
  }

  /* ---------- audit / activity log ---------- */
  function logAct(action, detail) {
    D().cmdbActivity.unshift({ id: uid('cact', 'CACT-', 4), at: now(), by: (L.emp(ITMS.sdp.curUser()) || {}).name || ITMS.sdp.effRole(), action, detail });
    if (D().cmdbActivity.length > 400) D().cmdbActivity.length = 400;
    try { L.log('CMDB', action + ' — ' + detail); } catch (e) { /* ignore */ }
  }

  /* =====================================================================
     STORE — ensure + seed
     ===================================================================== */
  const ARRAYS = ['cis', 'links', 'ciTypes', 'relTypes', 'services', 'svcDeps', 'svcSla', 'discSources', 'discJobs',
    'recon', 'dups', 'intgLogs', 'ciHistory', 'relatedChanges', 'unauth', 'drift', 'baselines', 'baseApprove',
    'baseExceptions', 'audits', 'findings', 'capas', 'evidence', 'dqRules', 'cmdbActivity'];

  function enrichCis() {
    const d = D(); const gs = groups(); const svcs = d.services;
    d.cis.forEach((c, i) => {
      c.cls = c.cls || classOf(c.type);
      if (!c.description) c.description = ({ Hardware: 'Physical compute or endpoint device in the estate.', Network: 'Network or perimeter device carrying data traffic.', 'Cloud & Virtualization': 'Hosted or virtualised compute / platform service.', Application: 'Business or platform application.', Database: 'Database instance supporting one or more applications.', Storage: 'Shared storage or backup target.', Service: 'Business or technical service.', Other: 'Configuration item.' }[c.cls] || 'Configuration item.');
      c.lifecycle = c.lifecycle || lifeOf(c);
      c.supportGroup = c.supportGroup || gs[i % Math.max(1, gs.length)] || '';
      c.environment = c.environment || 'Production';
      c.location = c.location || c.site || 'Head Office';
      if (c.businessService == null) c.businessService = svcs.length ? svcs[i % svcs.length].name : '';
      c.criticality = c.criticality || 'Medium';
      c.discoverySource = c.discoverySource || 'Manual';
      c.lastVerified = c.lastVerified || c.created || today();
      c.createdBy = c.createdBy || c.owner || 'system';
      c.updatedBy = c.updatedBy || c.createdBy;
      c.updated = c.updated || c.created || today();
      if (c.serial == null) c.serial = '';
      if (c.version == null) c.version = '';
      if (c.tags == null) c.tags = '';
    });
  }

  function seedCis(s) {
    const ow = (i) => techs()[i % Math.max(1, techs().length)] || '';
    const g = (i) => groups()[i % Math.max(1, groups().length)] || '';
    const mk = (id, name, type, o) => Object.assign({ id, name, type, cls: classOf(type), site: 'Head Office', status: 'Live', created: L.addDays(today(), -o.d || 120) }, o);
    s.cis.push(
      mk('CI-0001', 'CORE-SW-01', 'Network Device', { ip: '10.0.0.1', criticality: 'Critical', owner: ow(2), supportGroup: g(4), environment: 'Production', location: 'Data Centre', description: 'Core layer-3 switch carrying all VLAN traffic.', serial: 'SN-CORE-7781', d: 400 }),
      mk('CI-0002', 'FW-EDGE-01', 'Firewall', { ip: '10.0.0.254', criticality: 'Critical', owner: ow(2), supportGroup: g(4), environment: 'Production', location: 'Data Centre', description: 'Perimeter firewall — internet + SSL VPN termination.', serial: 'SN-FW-2290', d: 380 }),
      mk('CI-0003', 'ERP-APP-01', 'Application', { ip: 'erp.corp.local', criticality: 'High', owner: ow(3), supportGroup: g(1), environment: 'Production', description: 'ERP application server (finance, inventory, procurement).', version: 'v4.2', d: 300 }),
      mk('CI-0004', 'ERP-DB-01', 'Database', { ip: '10.0.1.20', criticality: 'High', owner: ow(3), supportGroup: g(1), environment: 'Production', description: 'ERP database instance.', version: 'PostgreSQL 15', d: 300 }),
      mk('CI-0005', 'VM-CLUSTER-01', 'Cloud Service', { ip: 'vcenter.corp.local', criticality: 'High', owner: ow(4), supportGroup: g(3), environment: 'Production', location: 'Data Centre', description: 'Virtualisation cluster hosting internal workloads.', version: 'vSphere 8', d: 260 }),
      mk('CI-0006', 'FILE-SRV-01', 'Server', { ip: '10.0.1.10', criticality: 'Medium', owner: ow(4), supportGroup: g(3), environment: 'Production', description: 'File and print server.', serial: 'SN-SRV-4451', d: 340 }),
      mk('CI-0007', 'MAIL-GW-01', 'Application', { ip: 'mail.corp.local', criticality: 'High', owner: ow(1), supportGroup: g(1), environment: 'Production', description: 'Mail gateway / relay.', version: 'Exchange 2019', d: 320 }),
      mk('CI-0008', 'LT-042', 'Laptop', { criticality: 'Medium', owner: ow(1), supportGroup: g(0), environment: 'Production', location: 'Branch', description: 'Finance laptop.', serial: 'SN-LT-0042', version: 'Windows 11', d: 90 }),
      mk('CI-0009', 'BACKUP-NAS-01', 'Storage', { ip: '10.0.2.5', criticality: 'High', owner: ow(4), supportGroup: g(3), environment: 'Production', location: 'Data Centre', description: 'NAS used as the primary backup target.', serial: 'SN-NAS-9910', d: 300 }),
      mk('CI-0010', 'PORTAL-WEB-01', 'Application', { ip: 'portal.corp.local', criticality: 'Medium', owner: ow(0), supportGroup: g(1), environment: 'Production', description: 'Self-service portal (IIS).', version: 'v3.1', d: 150 }),
      mk('CI-0011', 'PRINT-SRV-01', 'Server', { ip: '10.0.1.11', criticality: 'Low', owner: ow(4), supportGroup: g(0), environment: 'Production', description: 'Central print queue server.', serial: 'SN-SRV-1120', d: 400 }),
      mk('CI-0012', 'AP-FLOOR3-01', 'Access Point', { ip: '10.0.3.11', criticality: 'Medium', owner: ow(2), supportGroup: g(4), environment: 'Production', location: 'HQ Floor 3', description: 'Wireless access point — HQ floor 3.', serial: 'SN-AP-3301', d: 200 }),
      mk('CI-0013', 'WIN-SRV-2022', 'Operating System', { cls: 'Software', criticality: 'Medium', owner: ow(4), supportGroup: g(3), environment: 'Production', description: 'Windows Server 2022 operating system baseline.', version: '21H2', d: 240 }),
      mk('CI-0014', 'M365-E3-LICENCE', 'Licence', { cls: 'Software', criticality: 'High', owner: ow(1), supportGroup: g(1), environment: 'Cloud', location: 'Cloud (UAE North)', description: 'Microsoft 365 E3 subscription covering all staff.', version: 'E3', d: 210 }),
      mk('CI-0015', 'EDR-ENDPOINT', 'Software', { cls: 'Software', criticality: 'High', owner: ow(2), supportGroup: g(0), environment: 'Production', description: 'Endpoint detection & response agent deployed on all endpoints.', version: 'v7.3', d: 180 })
    );
    s.links.push(
      { id: 'LNK-0001', from: 'CI-0003', rel: 'runs on', to: 'CI-0005', at: L.addDays(today(), -290) },
      { id: 'LNK-0002', from: 'CI-0003', rel: 'depends on', to: 'CI-0004', at: L.addDays(today(), -290) },
      { id: 'LNK-0003', from: 'CI-0004', rel: 'runs on', to: 'CI-0005', at: L.addDays(today(), -290) },
      { id: 'LNK-0004', from: 'CI-0001', rel: 'connects to', to: 'CI-0002', at: L.addDays(today(), -380) },
      { id: 'LNK-0005', from: 'CI-0005', rel: 'connects to', to: 'CI-0001', at: L.addDays(today(), -260) },
      { id: 'LNK-0006', from: 'CI-0006', rel: 'connects to', to: 'CI-0001', at: L.addDays(today(), -340) },
      { id: 'LNK-0007', from: 'CI-0007', rel: 'runs on', to: 'CI-0005', at: L.addDays(today(), -320) },
      { id: 'LNK-0008', from: 'CI-0009', rel: 'backs up', to: 'CI-0005', at: L.addDays(today(), -300) },
      { id: 'LNK-0009', from: 'CI-0010', rel: 'runs on', to: 'CI-0005', at: L.addDays(today(), -150) },
      { id: 'LNK-0010', from: 'CI-0011', rel: 'connects to', to: 'CI-0001', at: L.addDays(today(), -400) },
      { id: 'LNK-0011', from: 'CI-0012', rel: 'connects to', to: 'CI-0001', at: L.addDays(today(), -200) },
      { id: 'LNK-0012', from: 'CI-0013', rel: 'installed on', to: 'CI-0006', at: L.addDays(today(), -240) },
      { id: 'LNK-0013', from: 'CI-0015', rel: 'installed on', to: 'CI-0008', at: L.addDays(today(), -180) },
      { id: 'LNK-0014', from: 'CI-0015', rel: 'installed on', to: 'CI-0006', at: L.addDays(today(), -180) }
    );
  }

  function seedCore(s) {
    const d = D();
    if (!s.cis.length) seedCis(s);

    s.ciTypes = [
      { id: 'CIT-01', name: 'Server', ciClass: 'Hardware', mandatory: 'Serial, Hostname, IP, OS, Owner', attributes: 'hostname, ip, os, cpu, ram, serial', active: 'Yes' },
      { id: 'CIT-02', name: 'Laptop', ciClass: 'Hardware', mandatory: 'Serial, Hostname, Owner', attributes: 'serial, model, os', active: 'Yes' },
      { id: 'CIT-03', name: 'Desktop', ciClass: 'Hardware', mandatory: 'Serial, Hostname, Owner', attributes: 'serial, model, os', active: 'Yes' },
      { id: 'CIT-04', name: 'Network Device', ciClass: 'Network', mandatory: 'Hostname, IP, Firmware, Owner', attributes: 'hostname, ip, firmware, ports', active: 'Yes' },
      { id: 'CIT-05', name: 'Access Point', ciClass: 'Network', mandatory: 'Hostname, IP, Owner', attributes: 'hostname, ip, ssid', active: 'Yes' },
      { id: 'CIT-06', name: 'Firewall', ciClass: 'Network', mandatory: 'Hostname, IP, Rule-set, Owner', attributes: 'hostname, ip, policyCount', active: 'Yes' },
      { id: 'CIT-07', name: 'Storage', ciClass: 'Storage', mandatory: 'Serial, Capacity, Owner', attributes: 'capacityTB, raid, serial', active: 'Yes' },
      { id: 'CIT-08', name: 'Database', ciClass: 'Database', mandatory: 'Version, Instance, Owner', attributes: 'engine, version, instance, sizeGB', active: 'Yes' },
      { id: 'CIT-09', name: 'Application', ciClass: 'Application', mandatory: 'Version, Owner, Business service', attributes: 'version, url, vendor', active: 'Yes' },
      { id: 'CIT-10', name: 'Cloud Service', ciClass: 'Cloud & Virtualization', mandatory: 'Provider, Region, Owner', attributes: 'provider, region, subscription', active: 'Yes' },
      { id: 'CIT-11', name: 'Business Service', ciClass: 'Service', mandatory: 'Owner, Criticality, SLAs', attributes: 'criticality, owner, slas', active: 'Yes' },
      { id: 'CIT-12', name: 'Technical Service', ciClass: 'Service', mandatory: 'Owner, Components', attributes: 'owner, components', active: 'Yes' },
    ];

    s.relTypes = [
      { id: 'REL-01', name: 'depends on', inverse: 'is depended on by', direction: 'Outbound', rules: 'CI → CI (any class)', active: 'Yes' },
      { id: 'REL-02', name: 'runs on', inverse: 'hosts', direction: 'Outbound', rules: 'Application / Database → Server or Cloud', active: 'Yes' },
      { id: 'REL-03', name: 'hosts', inverse: 'runs on', direction: 'Outbound', rules: 'Server / Cloud → Application or Database', active: 'Yes' },
      { id: 'REL-04', name: 'connects to', inverse: 'connects to', direction: 'Bidirectional', rules: 'Network ↔ Network', active: 'Yes' },
      { id: 'REL-05', name: 'supports', inverse: 'is supported by', direction: 'Outbound', rules: 'CI → Service', active: 'Yes' },
      { id: 'REL-06', name: 'backs up', inverse: 'is backed up by', direction: 'Outbound', rules: 'Storage → CI', active: 'Yes' },
      { id: 'REL-07', name: 'installed on', inverse: 'runs', direction: 'Outbound', rules: 'Software → Hardware', active: 'Yes' },
      { id: 'REL-08', name: 'member of', inverse: 'contains', direction: 'Outbound', rules: 'CI → Service or Group', active: 'Yes' },
    ];

    const biz = [
      ['SVC-B01', 'Payroll Processing', 'Business', 'HR Operations', 'Critical', 'Monthly payroll run and employee self-service.'],
      ['SVC-B02', 'ERP (Finance & Inventory)', 'Business', 'IT Operations', 'Critical', 'Core finance, procurement and inventory platform.'],
      ['SVC-B03', 'Enterprise Email', 'Business', 'IT Operations', 'High', 'Corporate email and calendar.'],
      ['SVC-B04', 'File & Print', 'Business', 'Desktop Support (L2)', 'Medium', 'Shared file storage and central printing.'],
      ['SVC-B05', 'Customer Self-Service Portal', 'Business', 'IT Operations', 'Medium', 'Customer-facing service request portal.'],
    ];
    const tech = [
      ['SVC-T01', 'Core Network', 'Technical', 'Network & Infrastructure', 'Critical', 'Switching, routing and perimeter connectivity.'],
      ['SVC-T02', 'Virtualization Platform', 'Technical', 'Network & Infrastructure', 'High', 'Hypervisor cluster hosting internal workloads.'],
      ['SVC-T03', 'Database Platform', 'Technical', 'IT Operations', 'High', 'Shared database instances.'],
      ['SVC-T04', 'Backup & Recovery', 'Technical', 'Network & Infrastructure', 'High', 'Backup target and restore capability.'],
      ['SVC-T05', 'Endpoint Management', 'Technical', 'Desktop Support (L2)', 'Medium', 'Managed laptops, desktops and mobile endpoints.'],
    ];
    const cis = s.cis;
    const byName = (n) => (cis.find((c) => c.name === n) || cis[0] || {}).id;
    const map = {
      'SVC-B01': ['ERP-APP-01', 'ERP-DB-01', 'VM-CLUSTER-01'],
      'SVC-B02': ['ERP-APP-01', 'ERP-DB-01', 'VM-CLUSTER-01', 'CORE-SW-01'],
      'SVC-B03': ['MAIL-GW-01', 'VM-CLUSTER-01'],
      'SVC-B04': ['FILE-SRV-01', 'PRINT-SRV-01', 'CORE-SW-01'],
      'SVC-B05': ['PORTAL-WEB-01', 'VM-CLUSTER-01'],
      'SVC-T01': ['CORE-SW-01', 'FW-EDGE-01', 'AP-FLOOR3-01'],
      'SVC-T02': ['VM-CLUSTER-01'],
      'SVC-T03': ['ERP-DB-01'],
      'SVC-T04': ['BACKUP-NAS-01'],
      'SVC-T05': ['LT-042'],
    };
    s.services = [];
    [...biz, ...tech].forEach((x) => s.services.push({ id: x[0], name: x[1], kind: x[2], owner: x[3], criticality: x[4], description: x[5], status: 'Active', cis: (map[x[0]] || []).map(byName) }));

    s.svcDeps = [];
    s.services.forEach((svc) => svc.cis.forEach((cid, i) => s.svcDeps.push({ id: 'DEP-' + svc.id.slice(4) + '-' + (i + 1), serviceId: svc.id, ciId: cid, role: i === 0 ? 'Primary component' : 'Supporting component' })));
    s.svcDeps.push({ id: 'DEP-B01-B02', serviceId: 'SVC-B01', ciId: 'SVC-B02', role: 'Service dependency' });
    s.svcDeps.push({ id: 'DEP-B03-B01', serviceId: 'SVC-B03', ciId: 'SVC-T01', role: 'Service dependency' });

    s.svcSla = [
      { id: 'SSL-01', serviceId: 'SVC-B02', sla: 'Platinum · 99.9%', target: 'RTO 2h / RPO 15min', owner: 'IT Operations', status: 'Active', review: L.addDays(today(), 60) },
      { id: 'SSL-02', serviceId: 'SVC-B01', sla: 'Platinum · 99.9%', target: 'Payroll run by 25th', owner: 'HR Operations', status: 'Active', review: L.addDays(today(), 30) },
      { id: 'SSL-03', serviceId: 'SVC-B03', sla: 'Gold · 99.5%', target: 'Mail delivery < 5 min', owner: 'IT Operations', status: 'Active', review: L.addDays(today(), 90) },
      { id: 'SSL-04', serviceId: 'SVC-B04', sla: 'Silver · 99%', target: 'Restore within 1 business day', owner: 'Desktop Support (L2)', status: 'Review due', review: L.addDays(today(), -4) },
      { id: 'SSL-05', serviceId: 'SVC-B05', sla: 'Gold · 99.5%', target: 'Portal availability 07:00–22:00', owner: 'IT Operations', status: 'Active', review: L.addDays(today(), 120) },
    ];

    s.discSources = [
      { id: 'DS-01', name: 'Windows Agent', kind: 'Agent', endpoint: 'Agent on managed endpoints', status: 'Active', lastSync: now() },
      { id: 'DS-02', name: 'vCenter / ESXi API', kind: 'API', endpoint: 'https://vcenter.corp.local', status: 'Active', lastSync: now() },
      { id: 'DS-03', name: 'Microsoft 365 / Azure', kind: 'Cloud', endpoint: 'Microsoft Graph API', status: 'Active', lastSync: now() },
      { id: 'DS-04', name: 'Network scan', kind: 'Network scan', endpoint: '10.0.0.0/24, 10.0.1.0/24, 10.0.2.0/24', status: 'Active', lastSync: now() },
      { id: 'DS-05', name: 'Manual entry', kind: 'Manual', endpoint: 'Service desk / CMDB form', status: 'Active', lastSync: '' },
    ];
    s.discJobs = [
      { id: 'DJ-01', name: 'Nightly network sweep', sourceId: 'DS-04', schedule: 'Daily 01:00', scope: 'Core subnets', lastRun: L.addDays(today(), -1), nextRun: today(), found: 12, reconciled: 11, status: 'Completed' },
      { id: 'DJ-02', name: 'vCenter VM synchronisation', sourceId: 'DS-02', schedule: 'Every 6 hours', scope: 'Datacenter DC1', lastRun: now(), nextRun: now(), found: 8, reconciled: 8, status: 'Completed' },
      { id: 'DJ-03', name: 'Endpoint agent check-in', sourceId: 'DS-01', schedule: 'Continuous', scope: 'All managed endpoints', lastRun: now(), nextRun: now(), found: 41, reconciled: 39, status: 'Running' },
      { id: 'DJ-04', name: 'Azure resource import', sourceId: 'DS-03', schedule: 'Weekly Sun 03:00', scope: 'All subscriptions', lastRun: L.addDays(today(), -4), nextRun: L.addDays(today(), 3), found: 6, reconciled: 5, status: 'Completed' },
      { id: 'DJ-05', name: 'Server room walk-down', sourceId: 'DS-05', schedule: 'Monthly', scope: 'HQ rack A–D', lastRun: L.addDays(today(), -20), nextRun: L.addDays(today(), 10), found: 0, reconciled: 0, status: 'Scheduled' },
    ];

    s.recon = [
      { id: 'RCN-01', ciId: byName('CORE-SW-01'), host: 'CORE-SW-01', ip: '10.0.0.1', source: 'Network scan', matchedOn: 'IP + MAC', confidence: 'High', action: 'Auto-match', status: 'Matched' },
      { id: 'RCN-02', ciId: byName('VM-CLUSTER-01'), host: 'vcenter.corp.local', ip: '10.0.2.9', source: 'vCenter API', matchedOn: 'Hostname', confidence: 'High', action: 'Auto-match', status: 'Matched' },
      { id: 'RCN-03', ciId: byName('LT-042'), host: 'LT-042', ip: '10.0.4.42', source: 'Windows Agent', matchedOn: 'Serial', confidence: 'Medium', action: 'Review', status: 'Needs review' },
      { id: 'RCN-04', ciId: '', host: 'unknown-10.0.3.77', ip: '10.0.3.77', source: 'Network scan', matchedOn: '—', confidence: 'Low', action: 'Create CI', status: 'Unmatched' },
      { id: 'RCN-05', ciId: byName('BACKUP-NAS-01'), host: 'backup-nas-01', ip: '10.0.2.5', source: 'Network scan', matchedOn: 'IP', confidence: 'High', action: 'Auto-match', status: 'Matched' },
    ];

    s.dups = [
      { id: 'DUP-01', a: byName('CORE-SW-01'), b: byName('FW-EDGE-01'), kind: 'Similar name', score: 62, status: 'Open' },
      { id: 'DUP-02', a: byName('ERP-DB-01'), b: byName('ERP-APP-01'), kind: 'Shared host / IP range', score: 71, status: 'Open' },
      { id: 'DUP-03', a: byName('FILE-SRV-01'), b: byName('PRINT-SRV-01'), kind: 'Same owner + subnet', score: 55, status: 'Reviewed' },
    ];

    s.intgLogs = [
      { id: 'IL-01', at: now(), kind: 'Discovery', source: 'Network scan', records: 12, imported: 11, failed: 1, status: 'Completed', message: '1 device could not be identified (unknown-10.0.3.77).' },
      { id: 'IL-02', at: now(), kind: 'Sync', source: 'vCenter / ESXi API', records: 8, imported: 8, failed: 0, status: 'Completed', message: 'All VMs matched existing CIs.' },
      { id: 'IL-03', at: now(), kind: 'Import', source: 'CSV (bulk CI import)', records: 25, imported: 25, failed: 0, status: 'Completed', message: 'CI register bulk import.' },
      { id: 'IL-04', at: now(), kind: 'Sync', source: 'Microsoft 365 / Azure', records: 6, imported: 5, failed: 1, status: 'Partial', message: '1 subscription missing region attribute.' },
    ];

    const hist = [
      ['CORE-SW-01', 'Firmware', '16.9.4', '17.3.1', 'Vendor advisory — CVE remediation'],
      ['FW-EDGE-01', 'Rule-set', '312 rules', '318 rules', 'Enable MFA-related VPN rules'],
      ['ERP-APP-01', 'Version', 'v4.1', 'v4.2', 'Quarterly ERP release'],
      ['ERP-DB-01', 'Version', 'PostgreSQL 14', 'PostgreSQL 15', 'Database platform upgrade'],
      ['VM-CLUSTER-01', 'Hosts', '4', '5', 'Added capacity for new workloads'],
      ['FILE-SRV-01', 'Status', 'Active', 'Under Maintenance', 'Disk controller replacement'],
    ];
    s.ciHistory = hist.map((h, i) => ({ id: 'CIH-' + String(i + 1).padStart(3, '0'), ciId: byName(h[0]), at: L.addDays(today(), -(i + 2) * 12), by: techs()[i % Math.max(1, techs().length)] || '', field: h[1], before: h[2], after: h[3], reason: h[4], changeId: '' }));

    const changes = (H() && H().changes) || [];
    s.relatedChanges = [];
    changes.slice(0, 6).forEach((ch, i) => {
      const assets = ch.assets || [];
      const target = assets.length ? (D().cis.find((c) => c.assetId && assets.includes(c.assetId)) || D().cis[i % D().cis.length]) : D().cis[i % D().cis.length];
      if (target) s.relatedChanges.push({ id: 'RC-' + String(i + 1).padStart(3, '0'), ciId: target.id, changeId: ch.id, title: ch.title, status: ch.status, at: ch.created || now() });
    });
    if (!s.relatedChanges.length) s.relatedChanges.push({ id: 'RC-001', ciId: d.cis[0].id, changeId: 'CHG-0001', title: 'Core switch firmware upgrade', status: 'Planning', at: L.addDays(today(), -6) });

    s.unauth = [
      { id: 'UNA-01', ciId: byName('FILE-SRV-01'), at: L.addDays(today(), -9), by: 'Unknown', detail: 'Disk controller replaced without an approved change.', status: 'Investigating' },
      { id: 'UNA-02', ciId: byName('FW-EDGE-01'), at: L.addDays(today(), -15), by: 'Network team', detail: 'Two firewall rules added outside the change window.', status: 'Resolved' },
    ];

    s.drift = [
      { id: 'DRF-01', ciId: byName('FILE-SRV-01'), field: 'Status / hardware', baseline: 'Active · original controller', actual: 'Under Maintenance · controller replaced', detected: L.addDays(today(), -9), severity: 'High', status: 'Open' },
      { id: 'DRF-02', ciId: byName('FW-EDGE-01'), field: 'Rule-set', baseline: '312 rules', actual: '318 rules', detected: L.addDays(today(), -15), severity: 'Medium', status: 'Open' },
      { id: 'DRF-03', ciId: byName('VM-CLUSTER-01'), field: 'Host count', baseline: '4 hosts', actual: '5 hosts', detected: L.addDays(today(), -30), severity: 'Low', status: 'Accepted' },
    ];

    const baseCis = d.cis.slice(0, 6).map((c) => c.id);
    s.baselines = [
      { id: 'BL-01', name: 'Production infrastructure baseline', scope: 'Hardware · Network · Storage', approvedBy: 'CAB', approvedAt: L.addDays(today(), -45), status: 'Approved', cis: baseCis },
      { id: 'BL-02', name: 'Core applications baseline', scope: 'Application · Database', approvedBy: '', approvedAt: '', status: 'Draft', cis: d.cis.filter((c) => ['Application', 'Database'].includes(c.cls)).map((c) => c.id) },
      { id: 'BL-03', name: 'Q3 approved configuration', scope: 'All production CIs', approvedBy: 'CAB', approvedAt: L.addDays(today(), -120), status: 'Approved', cis: d.cis.map((c) => c.id) },
    ];
    s.baseApprove = [
      { id: 'BA-01', baselineId: 'BL-01', approver: 'Change Advisory Board', role: 'Approver', status: 'Approved', at: L.addDays(today(), -45), comment: 'Baseline reflects approved production state.' },
      { id: 'BA-02', baselineId: 'BL-02', approver: 'IT Operations Manager', role: 'Approver', status: 'Pending', at: '', comment: 'Awaiting review of ERP application changes.' },
      { id: 'BA-03', baselineId: 'BL-03', approver: 'Change Advisory Board', role: 'Approver', status: 'Approved', at: L.addDays(today(), -120), comment: 'Q3 baseline approved.' },
    ];
    s.baseExceptions = [
      { id: 'BE-01', baselineId: 'BL-03', ciId: byName('VM-CLUSTER-01'), reason: 'Temporary 5th host for migration project.', approvedBy: 'CAB', expires: L.addDays(today(), 20), status: 'Active' },
      { id: 'BE-02', baselineId: 'BL-01', ciId: byName('FILE-SRV-01'), reason: 'Controller replacement awaiting permanent fix.', approvedBy: 'IT Operations Manager', expires: L.addDays(today(), -2), status: 'Expired' },
    ];

    s.audits = [
      { id: 'AUD-01', name: 'Q3 CI verification — HQ', kind: 'Scheduled', scope: 'All HQ CIs', owner: 'IT Operations', planned: L.addDays(today(), 5), status: 'Planned', verified: 0, total: d.cis.length },
      { id: 'AUD-02', name: 'Network & perimeter audit', kind: 'Scheduled', scope: 'Network CIs', owner: 'Network & Infrastructure', planned: L.addDays(today(), -10), status: 'In progress', verified: 2, total: 4 },
      { id: 'AUD-03', name: 'Application CMDB health check', kind: 'Ad-hoc', scope: 'Application / Database CIs', owner: 'IT Operations', planned: L.addDays(today(), -40), status: 'Completed', verified: 4, total: 4 },
    ];
    s.findings = [
      { id: 'FND-01', auditId: 'AUD-02', ciId: byName('FW-EDGE-01'), severity: 'High', detail: 'Firewall rule-set differs from the approved baseline.', status: 'Open', owner: 'Network & Infrastructure' },
      { id: 'FND-02', auditId: 'AUD-03', ciId: byName('ERP-DB-01'), severity: 'Medium', detail: 'Database version not updated after upgrade.', status: 'Open', owner: 'IT Operations' },
      { id: 'FND-03', auditId: 'AUD-03', ciId: byName('PORTAL-WEB-01'), severity: 'Low', detail: 'Owner field missing on the portal CI.', status: 'Closed', owner: 'IT Operations' },
    ];
    s.capas = [
      { id: 'CAP-01', findingId: 'FND-01', action: 'Reconcile firewall rules with approved baseline and raise a retro change.', owner: 'Network & Infrastructure', due: L.addDays(today(), 7), status: 'In progress', progress: 40 },
      { id: 'CAP-02', findingId: 'FND-02', action: 'Update ERP-DB-01 version attribute and re-verify.', owner: 'IT Operations', due: L.addDays(today(), -3), status: 'Overdue', progress: 10 },
      { id: 'CAP-03', findingId: 'FND-03', action: 'Assign an owner to PORTAL-WEB-01.', owner: 'IT Operations', due: L.addDays(today(), 12), status: 'Planned', progress: 0 },
    ];
    s.evidence = [
      { id: 'EVD-01', title: 'HQ CI verification worksheet', kind: 'Evidence', auditId: 'AUD-03', at: L.addDays(today(), -40), by: 'IT Operations', ref: 'CMDB-AUD-2026-03', status: 'Attached' },
      { id: 'EVD-02', title: 'Network audit approval sign-off', kind: 'Approval', auditId: 'AUD-02', at: L.addDays(today(), -9), by: 'CAB', ref: 'CAB-SIGN-118', status: 'Attached' },
      { id: 'EVD-03', title: 'Baseline exception register', kind: 'Report', auditId: '', at: L.addDays(today(), -2), by: 'IT Operations', ref: 'CMDB-EXC-2026-Q3', status: 'Draft' },
    ];

    s.dqRules = [
      { id: 'DQR-01', name: 'Owner must be set', scope: 'All CIs', rule: 'Owner is mandatory', severity: 'High', active: 'Yes' },
      { id: 'DQR-02', name: 'Support group required', scope: 'All CIs', rule: 'Support group is mandatory', severity: 'Medium', active: 'Yes' },
      { id: 'DQR-03', name: 'Environment must be valid', scope: 'All CIs', rule: 'Environment ∈ {Production, Test, Development, DR, Cloud}', severity: 'Medium', active: 'Yes' },
      { id: 'DQR-04', name: 'Last verified within 180 days', scope: 'All CIs', rule: 'Last verified date not older than 180 days', severity: 'Medium', active: 'Yes' },
      { id: 'DQR-05', name: 'Hardware needs serial / hostname', scope: 'Hardware, Network', rule: 'Serial or hostname present', severity: 'High', active: 'Yes' },
      { id: 'DQR-06', name: 'CI must have a relationship', scope: 'All CIs', rule: 'At least one relationship exists', severity: 'Low', active: 'Yes' },
    ];

    s.cmdbActivity = [
      { id: 'CACT-01', at: now(), by: 'Administrator', action: 'Baseline approved', detail: 'BL-01 Production infrastructure baseline' },
      { id: 'CACT-02', at: now(), by: 'Administrator', action: 'Discovery run', detail: 'DJ-01 Nightly network sweep — 12 devices found' },
      { id: 'CACT-03', at: now(), by: 'Administrator', action: 'CI created', detail: 'CI-0012 AP-FLOOR3-01' },
    ];

    s.cmdb = s.cmdb || {};
    s.cmdb.intg = s.cmdb.intg || {
      erp: { label: 'ERP / Asset & Procurement', linked: 'Yes', ref: 'gyc-by-asset-id', note: 'Asset ID, ownership, lifecycle, warranty' },
      itsm: { label: 'Incident / Problem / Change', linked: 'Yes', ref: 'by CI id', note: 'Affected CI, related incidents, change approval' },
      release: { label: 'Release & Deployment', linked: 'Yes', ref: 'by changed component', note: 'Deployment records and changed components' },
      catalogue: { label: 'Service Catalogue', linked: 'Yes', ref: 'by business service', note: 'Business services and supporting CIs' },
      procurement: { label: 'Procurement & Vendors', linked: 'Yes', ref: 'by supplier / contract', note: 'Supplier, contract, purchase, warranty' },
      hr: { label: 'HR & Organization', linked: 'Yes', ref: 'by employee no.', note: 'Employees, departments, support groups' },
      security: { label: 'Information Security', linked: 'Yes', ref: 'by CI id', note: 'Vulnerabilities, risk classifications, controls' },
      monitoring: { label: 'Monitoring & Events', linked: 'No', ref: '', note: 'Alerts mapped to CIs and services' },
      knowledge: { label: 'Knowledge Management', linked: 'Yes', ref: 'by CI id', note: 'Runbooks, technical documents, procedures' },
    };
    s.cmdb.notif = s.cmdb.notif || {
      onVerify: { label: 'Verification overdue reminder', on: 'Yes', days: 7 },
      onDrift: { label: 'Configuration drift detected', on: 'Yes', days: 0 },
      onUnauth: { label: 'Unauthorized change detected', on: 'Yes', days: 0 },
      onBaseline: { label: 'Baseline approval request', on: 'Yes', days: 0 },
      onFinding: { label: 'Audit finding assigned', on: 'Yes', days: 1 },
      onCapa: { label: 'Corrective action due', on: 'Yes', days: 3 },
    };
    s.cmdb.auditLog = s.cmdb.auditLog || { enabled: 'Yes', retention: '24 months', fields: 'CI id, field, before, after, user, date, reason' };
  }

  function ensureCmdb() {
    const d = db(); if (!d) return;
    const s = (d.sdp = d.sdp || {});
    ARRAYS.forEach((k) => { if (!Array.isArray(s[k])) s[k] = []; });
    if (!s.cmdbSeeded) { s.cmdbSeeded = true; seedCore(s); }
    enrichCis();
  }
  const prevInit = S.init;
  S.init = function () { prevInit.apply(S, arguments); try { ensureCmdb(); } catch (e) { /* never break boot */ } };
  S.subscribe(() => { try { ensureCmdb(); } catch (e) { /* never break render */ } });

  /* ---------- derived helpers ---------- */
  function linksOf(id) { return D().links.filter((l) => l.from === id || l.to === id); }
  function degOf(id) { return D().links.filter((l) => l.from === id || l.to === id).length; }
  function impactOf(id, depth) {
    const d = D(); const seen = new Set([id]); let q = [id];
    for (let i = 0; i < (depth || 6) && q.length; i++) {
      const nx = [];
      d.links.forEach((l) => { if (q.includes(l.from) && !seen.has(l.to)) { seen.add(l.to); nx.push(l.to); } if (q.includes(l.to) && !seen.has(l.from)) { seen.add(l.from); nx.push(l.from); } });
      q = nx;
    }
    return [...seen];
  }
  function missingFields(c) {
    const miss = [];
    if (!c.name) miss.push('CI name'); if (!c.cls) miss.push('CI type'); if (!c.description) miss.push('Description');
    if (!c.owner) miss.push('Owner'); if (!c.supportGroup) miss.push('Support group'); if (!c.environment) miss.push('Environment');
    if (!c.location) miss.push('Location'); if (!c.businessService && c.cls !== 'Service') miss.push('Business service');
    if (!c.criticality) miss.push('Criticality'); if (!c.discoverySource) miss.push('Discovery source');
    if (!c.lastVerified) miss.push('Last verified'); if (c.cls === 'Hardware' && !c.serial && !c.ip) miss.push('Serial / hostname');
    return miss;
  }
  function dqScore(c) { const total = 12; return Math.round(((total - missingFields(c).length) / total) * 100); }
  function overallDq() { const cs = D().cis; if (!cs.length) return 100; return Math.round(cs.reduce((a, c) => a + dqScore(c), 0) / cs.length); }
  function svcHealth(svc) {
    const cs = svc.cis.map(ciById).filter(Boolean);
    if (cs.some((c) => lifeOf(c) === 'Retired')) return 'Degraded';
    if (!cs.length) return 'At risk';
    if (svc.criticality === 'Critical' && cs.length < 2) return 'At risk';
    return 'Healthy';
  }
  function stale(c) { return c.lastVerified && L.diffDays(today(), c.lastVerified) > 180; }

  /* =====================================================================
     NAVIGATION STRUCTURE
     ===================================================================== */
  const SECTIONS = [
    { id: 'overview', label: 'Dashboard & Overview', tabs: [{ id: 'dash', label: 'CMDB Dashboard' }, { id: 'health', label: 'Service Health' }, { id: 'dq', label: 'Data Quality' }] },
    { id: 'ci', label: 'Configuration Items', tabs: [{ id: 'all', label: 'All CIs' }, { id: 'hardware', label: 'Hardware' }, { id: 'software', label: 'Software' }, { id: 'network', label: 'Network' }, { id: 'cloud', label: 'Cloud & Virtualization' }, { id: 'apps', label: 'Applications' }, { id: 'services', label: 'Services' }, { id: 'types', label: 'CI Types & Templates' }, { id: 'lifecycle', label: 'CI Lifecycle' }] },
    { id: 'rels', label: 'CI Relationships', tabs: [{ id: 'register', label: 'Relationship Register' }, { id: 'depmap', label: 'Dependency Map' }, { id: 'impact', label: 'Impact Analysis' }, { id: 'orphan', label: 'Orphaned CIs' }] },
    { id: 'svc', label: 'Service Mapping', tabs: [{ id: 'biz', label: 'Business Services' }, { id: 'tech', label: 'Technical Services' }, { id: 'deps', label: 'Service Dependencies' }, { id: 'sla', label: 'Service-Level Links' }] },
    { id: 'disc', label: 'Discovery & Reconciliation', tabs: [{ id: 'sources', label: 'Discovery Sources' }, { id: 'jobs', label: 'Discovery Jobs' }, { id: 'recon', label: 'Reconciliation' }, { id: 'dups', label: 'Duplicate Detection' }, { id: 'logs', label: 'Import & Integration Logs' }] },
    { id: 'hist', label: 'Change & Configuration History', tabs: [{ id: 'changes', label: 'CI Change History' }, { id: 'related', label: 'Related Changes' }, { id: 'unauth', label: 'Unauthorized Changes' }, { id: 'drift', label: 'Configuration Drift' }] },
    { id: 'base', label: 'Configuration Baselines', tabs: [{ id: 'reg', label: 'Baseline Register' }, { id: 'cmp', label: 'Baseline Comparison' }, { id: 'apr', label: 'Baseline Approval' }, { id: 'exc', label: 'Baseline Exceptions' }] },
    { id: 'audit', label: 'Audits & Compliance', tabs: [{ id: 'verify', label: 'CI Verification' }, { id: 'sched', label: 'Scheduled Audits' }, { id: 'find', label: 'Audit Findings' }, { id: 'capa', label: 'Corrective Actions' }, { id: 'evid', label: 'Evidence & Audit Reports' }] },
    { id: 'reports', label: 'Reports & Analytics', tabs: [{ id: 'inv', label: 'CI Inventory Reports' }, { id: 'dqr', label: 'Data Quality Reports' }, { id: 'dep', label: 'Dependency Reports' }, { id: 'chg', label: 'Change Reports' }, { id: 'comp', label: 'Compliance Reports' }, { id: 'kpi', label: 'KPI Dashboard' }] },
    { id: 'admin', label: 'CMDB Administration', tabs: [{ id: 'cit', label: 'CI Type Configuration' }, { id: 'rel', label: 'Relationship Configuration' }, { id: 'lc', label: 'Lifecycle & Workflow' }, { id: 'dqr', label: 'Data Quality Rules' }, { id: 'roles', label: 'Roles & Permissions' }, { id: 'intg', label: 'Integration Settings' }, { id: 'notif', label: 'Notifications' }, { id: 'alog', label: 'Audit Log Settings' }] },
  ];

  /* =====================================================================
     UI helpers
     ===================================================================== */
  const tbNew = (act, label) => `<button class="btn" data-act="${act}">${ic('plus')}${label}</button>`;
  const tbGhost = (act, label, id) => `<button class="btn ghost" data-act="${act}"${id ? ` data-id="${id}"` : ''}>${label}</button>`;
  const delBtn = (act, id) => (ITMS.canDelete() ? `<button class="ibtn" style="--c:#ff5c6c" title="Delete (Admin only)" data-act="${act}" data-id="${id}">${ic('trash')}</button>` : '');
  const ea = (pre, id) => `<button class="ibtn" data-act="${pre}.edit" data-id="${id}">${ic('edit')}</button>${delBtn(pre + '.del', id)}`;
  const K = (v, l, s, c) => `<div class="card kpi tilt" style="--c:${c || C.blue}"><div class="gem">${ic('cpu')}</div><div><div class="v">${v}</div><div class="l">${l}</div>${s ? `<div class="s">${s}</div>` : ''}</div></div>`;
  const note = (t) => `<div class="note-box" style="margin-bottom:12px">${t}</div>`;
  function delHandler(pre, coll, label) {
    UI.on(pre + '.del', async (el) => {
      if (!ITMS.canDelete()) return UI.toast('Only Administrator can delete records', 'err');
      const rows = D()[coll] || []; const r = rows.find((x) => x.id === el.dataset.id); if (!r) return;
      if (await UI.confirm(`Delete ${esc(label)} <b>${esc(r.name || r.id)}</b>?`, 'Delete', true)) { D()[coll] = rows.filter((x) => x !== r); logAct('Delete', label + ' ' + (r.name || r.id)); S.emit(); }
    });
  }
  function editHandler(pre, coll, fieldsFn, title) {
    UI.on(pre + '.edit', (el) => {
      const r = (D()[coll] || []).find((x) => x.id === el.dataset.id); if (!r) return;
      UI.form({ title: (title || 'Edit') + ' — ' + r.id, icon: 'cpu', size: 'lg', fields: fieldsFn(), values: r, onSubmit: (v) => { Object.assign(r, v); touch(r); logAct('Update', (r.name || r.id)); S.emit(); } });
    });
  }
  function touch(r) { r.updatedBy = (L.emp(ITMS.sdp.curUser()) || {}).name || ITMS.sdp.effRole(); r.updated = today(); }

  /* =====================================================================
     CI FORM
     ===================================================================== */
  function ciFields() {
    return [
      { section: 'Identification' },
      { k: 'name', label: 'CI name', req: true, full: true },
      { k: 'cls', label: 'CI class', type: 'select', options: CICLS, req: true, blank: false },
      { k: 'type', label: 'CI type', type: 'select', options: () => D().ciTypes.filter((t) => t.active === 'Yes').map((t) => t.name), blank: false },
      { k: 'description', label: 'Description / purpose', type: 'textarea', full: true },
      { section: 'Ownership & placement' },
      { k: 'status', label: 'Status / lifecycle', type: 'select', options: LC, blank: false },
      { k: 'owner', label: 'Owner', type: 'select', options: () => techs() },
      { k: 'supportGroup', label: 'Support group', type: 'select', options: () => groups() },
      { k: 'environment', label: 'Environment', type: 'select', options: ENVS, blank: false },
      { k: 'location', label: 'Location', type: 'select', options: () => uniq(['Head Office', 'Branch', 'Data Centre', 'Cloud (UAE North)'].concat(db() ? db().hw.map((a) => a.location) : [])) },
      { k: 'businessService', label: 'Business service', type: 'select', options: () => svcNames() },
      { k: 'criticality', label: 'Criticality', type: 'select', options: CRIT, blank: false },
      { section: 'Technical & traceability' },
      { k: 'ip', label: 'Hostname / IP' },
      { k: 'serial', label: 'Serial / version' },
      { k: 'assetId', label: 'Linked asset', type: 'select', options: () => (db() ? db().hw.map((a) => ({ v: a.id, l: `${a.id} · ${a.desc}` })) : []) },
      { k: 'discoverySource', label: 'Discovery source', type: 'select', options: ['Manual', 'Network scan', 'Agent', 'API', 'Cloud integration'], blank: false },
      { k: 'lastVerified', label: 'Last verified', type: 'date' },
      { k: 'tags', label: 'Tags' },
    ];
  }
  UI.on('cis.new', () => {
    if (!ITMS.sdp.can('create')) return UI.toast('Your role cannot create records', 'err');
    UI.form({ title: 'New configuration item', icon: 'cpu', size: 'lg', fields: ciFields(), values: { cls: 'Hardware', type: 'Server', status: 'Active', environment: 'Production', criticality: 'Medium', discoverySource: 'Manual', lastVerified: today() }, onSubmit: (v) => {
      v.id = uid('ci', 'CI-', 4); v.created = today(); v.createdBy = (L.emp(ITMS.sdp.curUser()) || {}).name || ITMS.sdp.effRole(); v.cls = v.cls || classOf(v.type);
      D().cis.unshift(v); logAct('CI created', v.id + ' ' + v.name); S.emit(); UI.toast('CI created: ' + v.id);
    } });
  });
  UI.on('cis.edit', (el) => {
    const r = ciById(el.dataset.id); if (!r) return;
    UI.form({ title: 'Edit ' + r.id, icon: 'cpu', size: 'lg', fields: ciFields(), values: r, onSubmit: (v) => { const before = Object.assign({}, r); Object.assign(r, v); touch(r); recordHistory(r, before, 'CI attributes edited'); S.emit(); UI.toast('Saved ' + r.id); } });
  });
  UI.on('cis.view', (el) => {
    const c = ciById(el.dataset.id); if (!c) return;
    const rels = linksOf(c.id).map((l) => { const other = l.from === c.id ? l.to : l.from; return `<tr><td>${P(l.rel, 'violet')}</td><td>${esc(ciName(other))}</td><td class="mono">${other}</td></tr>`; }).join('');
    const hist = D().ciHistory.filter((h) => h.ciId === c.id).map((h) => `<tr><td>${h.at}</td><td>${esc(h.field)}</td><td>${esc(h.before)} → <b>${esc(h.after)}</b></td><td>${esc(h.reason)}</td></tr>`).join('');
    UI.modal(`<header><span class="gem" style="width:38px;height:38px;border-radius:13px">${ic('cpu')}</span><div><h3>${esc(c.name)} <small>${c.id}</small></h3><small>${esc(c.cls)} · ${esc(c.type)}</small></div><button class="ibtn x" data-x>${ic('x')}</button></header><div class="body">
      <div class="grid g2">
        <div><table class="t"><tbody>
          <tr><th>Status</th><td>${P(lifeOf(c), lifeOf(c) === 'Active' ? 'mint' : lifeOf(c) === 'Retired' ? 'coral' : 'amber')}</td></tr>
          <tr><th>Owner</th><td>${esc(c.owner || '—')}</td></tr>
          <tr><th>Support group</th><td>${esc(c.supportGroup || '—')}</td></tr>
          <tr><th>Environment</th><td>${esc(c.environment || '—')}</td></tr>
          <tr><th>Location</th><td>${esc(c.location || '—')}</td></tr>
        </tbody></table></div>
        <div><table class="t"><tbody>
          <tr><th>Business service</th><td>${esc(c.businessService || '—')}</td></tr>
          <tr><th>Criticality</th><td>${P(c.criticality)}</td></tr>
          <tr><th>Host / IP</th><td class="mono">${esc(c.ip || '—')}</td></tr>
          <tr><th>Serial / version</th><td class="mono">${esc(c.serial || '—')}</td></tr>
          <tr><th>Discovery source</th><td>${esc(c.discoverySource || '—')}</td></tr>
        </tbody></table></div>
      </div>
      <p style="margin-top:12px;color:var(--muted)">${esc(c.description || '')}</p>
      <div class="grid g2" style="margin-top:6px"><div><h3>Relationships (${linksOf(c.id).length})</h3><table class="t"><thead><tr><th>Type</th><th>CI</th><th>ID</th></tr></thead><tbody>${rels || '<tr><td colspan="3"><div class="empty">No relationships</div></td></tr>'}</tbody></table></div>
      <div><h3>Change history (${D().ciHistory.filter((h) => h.ciId === c.id).length})</h3><table class="t"><thead><tr><th>Date</th><th>Field</th><th>Change</th><th>Reason</th></tr></thead><tbody>${hist || '<tr><td colspan="4"><div class="empty">No changes recorded</div></td></tr>'}</tbody></table></div></div>
      <div style="margin-top:10px;color:var(--muted);font-size:12.5px">Created ${fmtDate(c.created)} by ${esc(c.createdBy || '—')} · last updated ${fmtDate(c.updated)} by ${esc(c.updatedBy || '—')} · last verified ${fmtDate(c.lastVerified)}</div>
    </div><footer><button class="btn ghost" data-x>Close</button><button class="btn" data-act="cis.edit" data-id="${c.id}" data-x>${ic('edit')}Edit CI</button></footer>`, { size: 'xl' });
  });

  function recordHistory(ci, before, reason) {
    const fields = ['name', 'type', 'cls', 'status', 'owner', 'supportGroup', 'environment', 'location', 'businessService', 'criticality', 'ip', 'serial', 'version', 'description', 'discoverySource'];
    fields.forEach((f) => { if (String(before[f] == null ? '' : before[f]) !== String(ci[f] == null ? '' : ci[f])) D().ciHistory.unshift({ id: uid('cih', 'CIH-', 4), ciId: ci.id, at: now(), by: (L.emp(ITMS.sdp.curUser()) || {}).name || ITMS.sdp.effRole(), field: f, before: before[f] || '—', after: ci[f] || '—', reason: reason || 'Manual edit', changeId: '' }); });
  }

  /* =====================================================================
     RELATIONSHIP FORM
     ===================================================================== */
  function relFields() {
    return [
      { k: 'from', label: 'Source CI', type: 'select', options: ciOpts, req: true },
      { k: 'rel', label: 'Relationship type', type: 'select', options: () => D().relTypes.map((r) => r.name), req: true, blank: false },
      { k: 'to', label: 'Target CI', type: 'select', options: ciOpts, req: true },
      { k: 'reason', label: 'Reason / change reference', full: true },
    ];
  }
  UI.on('link.new', () => {
    UI.form({ title: 'Map CI relationship', icon: 'link', fields: relFields(), onSubmit: (v) => {
      if (v.from === v.to) throw new Error('A CI cannot relate to itself');
      const rec = { id: uid('lk', 'LNK-', 4), ...v, at: today(), by: (L.emp(ITMS.sdp.curUser()) || {}).name || ITMS.sdp.effRole() };
      D().links.unshift(rec); logAct('Relationship added', ciName(v.from) + ' ' + v.rel + ' ' + ciName(v.to)); S.emit();
    } });
  });
  delHandler('link', 'links', 'relationship');

  /* =====================================================================
     GENERIC CRUD for simple registers
     ===================================================================== */
  function registerCrud(cfg) {
    UI.on(cfg.newAct, () => {
      UI.form({ title: cfg.title, icon: cfg.icon, size: cfg.size || 'md', fields: cfg.fields(), values: cfg.values || {}, onSubmit: (v) => { v.id = uid(cfg.key, cfg.prefix, cfg.w || 3); Object.assign(v, cfg.fix ? cfg.fix(v) : {}); D()[cfg.coll].unshift(v); logAct(cfg.title + ' added', v.name || v.id); S.emit(); UI.toast(cfg.title + ' saved'); } });
    });
    UI.on(cfg.editAct, (el) => {
      const r = (D()[cfg.coll] || []).find((x) => x.id === el.dataset.id); if (!r) return;
      UI.form({ title: 'Edit ' + (r.name || r.id), icon: cfg.icon, size: cfg.size || 'md', fields: cfg.fields(), values: r, onSubmit: (v) => { Object.assign(r, v); touch(r); logAct(cfg.title + ' updated', r.name || r.id); S.emit(); } });
    });
    delHandler(cfg.editAct.replace('.edit', ''), cfg.coll, cfg.title.toLowerCase());
  }

  /* CI types */
  registerCrud({
    coll: 'ciTypes', key: 'cit', prefix: 'CIT-', w: 2, title: 'CI type', icon: 'cpu', newAct: 'cit.new', editAct: 'cit.edit',
    fields: () => [
      { k: 'name', label: 'CI type name', req: true }, { k: 'ciClass', label: 'CI class', type: 'select', options: CICLS, req: true, blank: false },
      { k: 'mandatory', label: 'Mandatory fields', full: true }, { k: 'attributes', label: 'Attributes / template', full: true },
      { k: 'active', label: 'Active', type: 'select', options: ['Yes', 'No'], blank: false },
    ], values: { ciClass: 'Hardware', active: 'Yes' },
  });
  /* Relationship types */
  registerCrud({
    coll: 'relTypes', key: 'relt', prefix: 'REL-', w: 2, title: 'Relationship type', icon: 'link', newAct: 'reltype.new', editAct: 'reltype.edit',
    fields: () => [
      { k: 'name', label: 'Relationship name', req: true }, { k: 'inverse', label: 'Inverse name' },
      { k: 'direction', label: 'Direction', type: 'select', options: ['Outbound', 'Inbound', 'Bidirectional'], blank: false },
      { k: 'rules', label: 'Allowed class rules', full: true }, { k: 'active', label: 'Active', type: 'select', options: ['Yes', 'No'], blank: false },
    ], values: { direction: 'Outbound', active: 'Yes' },
  });
  /* Business / technical services */
  registerCrud({
    coll: 'services', key: 'svc', prefix: 'SVC-', w: 3, title: 'Service', icon: 'box', size: 'lg', newAct: 'svc.new', editAct: 'svc.edit',
    fields: () => [
      { k: 'name', label: 'Service name', req: true, full: true },
      { k: 'kind', label: 'Service kind', type: 'select', options: ['Business', 'Technical'], req: true, blank: false },
      { k: 'owner', label: 'Service owner', type: 'select', options: () => techs() },
      { k: 'criticality', label: 'Criticality', type: 'select', options: CRIT, blank: false },
      { k: 'status', label: 'Status', type: 'select', options: ['Active', 'Planned', 'Retired'], blank: false },
      { k: 'description', label: 'Description', type: 'textarea', full: true },
      { k: 'cis', label: 'Supporting CIs', type: 'multi', options: ciOpts, full: true },
    ], values: { kind: 'Business', criticality: 'High', status: 'Active', cis: [] },
  });
  /* Discovery sources */
  registerCrud({
    coll: 'discSources', key: 'dsrc', prefix: 'DS-', w: 2, title: 'Discovery source', icon: 'search', newAct: 'dsrc.new', editAct: 'dsrc.edit',
    fields: () => [
      { k: 'name', label: 'Source name', req: true }, { k: 'kind', label: 'Source type', type: 'select', options: ['Agent', 'API', 'Cloud', 'Network scan', 'Manual'], blank: false },
      { k: 'endpoint', label: 'Endpoint / scope', full: true }, { k: 'status', label: 'Status', type: 'select', options: ['Active', 'Paused'], blank: false },
    ], values: { kind: 'Network scan', status: 'Active' }, fix: () => ({ lastSync: '' }),
  });
  /* Discovery jobs */
  registerCrud({
    coll: 'discJobs', key: 'djob', prefix: 'DJ-', w: 2, title: 'Discovery job', icon: 'refresh', newAct: 'djob.new', editAct: 'djob.edit',
    fields: () => [
      { k: 'name', label: 'Job name', req: true }, { k: 'sourceId', label: 'Source', type: 'select', options: () => D().discSources.map((s) => ({ v: s.id, l: s.name })), req: true },
      { k: 'schedule', label: 'Schedule' }, { k: 'scope', label: 'Scope', full: true },
      { k: 'nextRun', label: 'Next run', type: 'date' }, { k: 'status', label: 'Status', type: 'select', options: ['Scheduled', 'Running', 'Completed', 'Failed'], blank: false },
    ], values: { status: 'Scheduled' }, fix: () => ({ found: 0, reconciled: 0, lastRun: '' }),
  });
  /* Baselines */
  registerCrud({
    coll: 'baselines', key: 'bl', prefix: 'BL-', w: 2, title: 'Baseline', icon: 'shield', size: 'lg', newAct: 'base.new', editAct: 'base.edit',
    fields: () => [
      { k: 'name', label: 'Baseline name', req: true, full: true }, { k: 'scope', label: 'Scope', full: true },
      { k: 'approvedBy', label: 'Approved by' }, { k: 'approvedAt', label: 'Approved on', type: 'date' },
      { k: 'status', label: 'Status', type: 'select', options: ['Draft', 'Pending approval', 'Approved', 'Retired'], blank: false },
      { k: 'cis', label: 'CIs in baseline', type: 'multi', options: ciOpts, full: true },
    ], values: { status: 'Draft', cis: [] },
  });
  /* Audits */
  registerCrud({
    coll: 'audits', key: 'aud', prefix: 'AUD-', w: 2, title: 'Audit', icon: 'check', newAct: 'audit.new', editAct: 'audit.edit',
    fields: () => [
      { k: 'name', label: 'Audit name', req: true, full: true },
      { k: 'kind', label: 'Kind', type: 'select', options: ['Scheduled', 'Ad-hoc'], blank: false },
      { k: 'scope', label: 'Scope', full: true }, { k: 'owner', label: 'Owner', type: 'select', options: () => techs() },
      { k: 'planned', label: 'Planned date', type: 'date' }, { k: 'status', label: 'Status', type: 'select', options: ['Planned', 'In progress', 'Completed', 'Cancelled'], blank: false },
    ], values: { kind: 'Scheduled', status: 'Planned' }, fix: () => ({ verified: 0, total: D().cis.length }),
  });
  /* Findings */
  registerCrud({
    coll: 'findings', key: 'fnd', prefix: 'FND-', w: 2, title: 'Audit finding', icon: 'alert', newAct: 'find.new', editAct: 'find.edit',
    fields: () => [
      { k: 'auditId', label: 'Audit', type: 'select', options: () => D().audits.map((a) => ({ v: a.id, l: a.name })), req: true },
      { k: 'ciId', label: 'CI', type: 'select', options: ciOpts }, { k: 'severity', label: 'Severity', type: 'select', options: ['Low', 'Medium', 'High', 'Critical'], blank: false },
      { k: 'detail', label: 'Finding detail', type: 'textarea', full: true }, { k: 'owner', label: 'Owner', type: 'select', options: () => techs() },
      { k: 'status', label: 'Status', type: 'select', options: ['Open', 'In progress', 'Closed'], blank: false },
    ], values: { severity: 'Medium', status: 'Open' },
  });
  /* Corrective actions */
  registerCrud({
    coll: 'capas', key: 'cap', prefix: 'CAP-', w: 2, title: 'Corrective action', icon: 'wrench', newAct: 'capa.new', editAct: 'capa.edit',
    fields: () => [
      { k: 'findingId', label: 'Finding', type: 'select', options: () => D().findings.map((f) => ({ v: f.id, l: f.id + ' · ' + (f.detail || '').slice(0, 40) })), req: true },
      { k: 'action', label: 'Remediation action', type: 'textarea', req: true, full: true },
      { k: 'owner', label: 'Owner', type: 'select', options: () => techs() }, { k: 'due', label: 'Due', type: 'date' },
      { k: 'status', label: 'Status', type: 'select', options: ['Planned', 'In progress', 'Overdue', 'Done'], blank: false },
      { k: 'progress', label: 'Progress %', type: 'number', min: 0 },
    ], values: { status: 'Planned', progress: 0 },
  });
  /* Data quality rules */
  registerCrud({
    coll: 'dqRules', key: 'dqr', prefix: 'DQR-', w: 2, title: 'Data quality rule', icon: 'check', newAct: 'dqr.new', editAct: 'dqr.edit',
    fields: () => [
      { k: 'name', label: 'Rule name', req: true }, { k: 'scope', label: 'Scope', type: 'select', options: () => ['All CIs'].concat(CICLS), blank: false },
      { k: 'rule', label: 'Rule definition', full: true },
      { k: 'severity', label: 'Severity', type: 'select', options: ['Low', 'Medium', 'High'], blank: false },
      { k: 'active', label: 'Active', type: 'select', options: ['Yes', 'No'], blank: false },
    ], values: { scope: 'All CIs', severity: 'Medium', active: 'Yes' },
  });
  /* Baseline exceptions */
  registerCrud({
    coll: 'baseExceptions', key: 'be', prefix: 'BE-', w: 2, title: 'Baseline exception', icon: 'alert', newAct: 'exc.new', editAct: 'exc.edit',
    fields: () => [
      { k: 'baselineId', label: 'Baseline', type: 'select', options: () => D().baselines.map((b) => ({ v: b.id, l: b.name })), req: true },
      { k: 'ciId', label: 'CI', type: 'select', options: ciOpts, req: true },
      { k: 'reason', label: 'Justification', type: 'textarea', full: true },
      { k: 'approvedBy', label: 'Approved by' }, { k: 'expires', label: 'Expires', type: 'date' },
      { k: 'status', label: 'Status', type: 'select', options: ['Active', 'Expired', 'Rejected'], blank: false },
    ], values: { status: 'Active' },
  });
  /* Evidence */
  registerCrud({
    coll: 'evidence', key: 'evd', prefix: 'EVD-', w: 2, title: 'Evidence', icon: 'filePlus', newAct: 'evid.new', editAct: 'evid.edit',
    fields: () => [
      { k: 'title', label: 'Title', req: true, full: true },
      { k: 'kind', label: 'Kind', type: 'select', options: ['Evidence', 'Approval', 'Report'], blank: false },
      { k: 'auditId', label: 'Audit', type: 'select', options: () => D().audits.map((a) => ({ v: a.id, l: a.name })) },
      { k: 'ref', label: 'Reference' }, { k: 'status', label: 'Status', type: 'select', options: ['Draft', 'Attached'], blank: false },
    ], values: { kind: 'Evidence', status: 'Draft' }, fix: () => ({ at: today(), by: (L.emp(ITMS.sdp.curUser()) || {}).name || ITMS.sdp.effRole() }),
  });

  /* ---------- action handlers (approvals / drift / recon / unauth) ---------- */
  UI.on('base.approve', async (el) => {
    const b = D().baselines.find((x) => x.id === el.dataset.id); if (!b) return;
    if (await UI.confirm(`Approve baseline <b>${esc(b.name)}</b>?`, 'Approve')) { b.status = 'Approved'; b.approvedBy = (L.emp(ITMS.sdp.curUser()) || {}).name || ITMS.sdp.effRole(); b.approvedAt = today(); D().baseApprove.filter((a) => a.baselineId === b.id).forEach((a) => { a.status = 'Approved'; a.at = now(); }); logAct('Baseline approved', b.name); S.emit(); UI.toast('Baseline approved'); }
  });
  UI.on('ba.decide', (el) => { const a = D().baseApprove.find((x) => x.id === el.dataset.id); if (!a) return; a.status = el.dataset.val; a.at = now(); logAct('Baseline approval ' + a.status, a.baselineId); S.emit(); });
  UI.on('drift.remedy', (el) => { const r = D().drift.find((x) => x.id === el.dataset.id); if (!r) return; r.status = 'Remediated'; logAct('Drift remediated', r.id); S.emit(); UI.toast('Marked remediated'); });
  UI.on('drift.accept', (el) => { const r = D().drift.find((x) => x.id === el.dataset.id); if (!r) return; r.status = 'Accepted'; logAct('Drift accepted', r.id); S.emit(); });
  UI.on('unauth.resolve', (el) => { const r = D().unauth.find((x) => x.id === el.dataset.id); if (!r) return; r.status = 'Resolved'; logAct('Unauthorized change resolved', r.id); S.emit(); });
  UI.on('recon.act', (el) => {
    const r = D().recon.find((x) => x.id === el.dataset.id); if (!r) return;
    if (r.action === 'Create CI') { const id = uid('ci', 'CI-', 4); D().cis.unshift({ id, name: r.host, type: 'Network Device', cls: 'Network', status: 'Live', lifecycle: 'Active', owner: '', supportGroup: (groups()[0] || ''), environment: 'Production', location: 'Unknown', criticality: 'Medium', discoverySource: r.source, lastVerified: today(), created: today(), createdBy: 'Discovery', ip: r.ip }); r.ciId = id; logAct('CI created from discovery', id + ' ' + r.host); }
    r.status = 'Matched'; r.action = 'Auto-match'; S.emit(); UI.toast('Reconciled');
  });
  UI.on('dups.resolve', (el) => { const r = D().dups.find((x) => x.id === el.dataset.id); if (!r) return; r.status = 'Resolved'; logAct('Duplicate resolved', r.id); S.emit(); });
  UI.on('job.run', (el) => { const j = D().discJobs.find((x) => x.id === el.dataset.id); if (!j) return; j.status = 'Completed'; j.lastRun = now(); j.reconciled = j.found || j.reconciled; D().intgLogs.unshift({ id: uid('il', 'IL-', 3), at: now(), kind: 'Discovery', source: j.name, records: j.found || 0, imported: j.reconciled || 0, failed: 0, status: 'Completed', message: 'Manual run' }); logAct('Discovery job run', j.name); S.emit(); UI.toast('Job completed'); });
  UI.on('ci.verify', (el) => { const c = ciById(el.dataset.id); if (!c) return; c.lastVerified = today(); c.updatedBy = (L.emp(ITMS.sdp.curUser()) || {}).name || ITMS.sdp.effRole(); logAct('CI verified', c.id); S.emit(); UI.toast('Verified ' + c.id); });
  UI.on('audit.run', (el) => { const a = D().audits.find((x) => x.id === el.dataset.id); if (!a) return; a.status = 'Completed'; a.verified = a.total; logAct('Audit completed', a.name); S.emit(); UI.toast('Audit completed'); D().cis.forEach((c) => { c.lastVerified = today(); }); S.emit(); });
  UI.on('capa.progress', (el) => { const r = D().capas.find((x) => x.id === el.dataset.id); if (!r) return; r.progress = Math.min(100, (r.progress || 0) + 25); if (r.progress >= 100) { r.status = 'Done'; r.progress = 100; } S.emit(); });
  UI.on('intg.toggle', (el) => { const k = el.dataset.k; const it = D().cmdb.intg[k]; if (!it) return; it.linked = it.linked === 'Yes' ? 'No' : 'Yes'; logAct('Integration ' + it.linked, it.label); S.emit(); });
  UI.on('cmdb.intg', () => {
    const intg = D().cmdb.intg;
    UI.form({ title: 'Integration settings', icon: 'link', size: 'lg', fields: Object.keys(intg).map((k) => ({ k, label: intg[k].label, type: 'select', options: ['Yes', 'No'], blank: false })), values: Object.keys(intg).reduce((a, k) => { a[k] = intg[k].linked; return a; }, {}), onSubmit: (v) => { Object.keys(intg).forEach((k) => { intg[k].linked = v[k]; }); logAct('Integration settings updated', 'CMDB integrations'); S.emit(); UI.toast('Integration settings saved'); } });
  });
  UI.on('cmdb.notif', () => {
    const n = D().cmdb.notif;
    const fields = []; Object.keys(n).forEach((k) => { fields.push({ k: k + '_on', label: n[k].label, type: 'select', options: ['Yes', 'No'], blank: false }); });
    UI.form({ title: 'CMDB notifications', icon: 'bell', size: 'lg', fields, values: Object.keys(n).reduce((a, k) => { a[k + '_on'] = n[k].on; return a; }, {}), onSubmit: (v) => { Object.keys(n).forEach((k) => { n[k].on = v[k + '_on']; }); logAct('Notification settings updated', 'CMDB notifications'); S.emit(); UI.toast('Notification settings saved'); } });
  });
  UI.on('cmdb.alog', () => {
    const a = D().cmdb.auditLog;
    UI.form({ title: 'Audit log settings', icon: 'filePlus', fields: [{ k: 'enabled', label: 'Activity tracking', type: 'select', options: ['Yes', 'No'], blank: false }, { k: 'retention', label: 'Retention', type: 'select', options: ['6 months', '12 months', '24 months', '36 months'], blank: false }], values: a, onSubmit: (v) => { Object.assign(a, v); logAct('Audit log settings updated', 'CMDB audit log'); S.emit(); UI.toast('Audit log settings saved'); } });
  });
  UI.on('cmdb.exportTemplate', (el) => {
    const cls = el.dataset.cls || 'Hardware';
    const cols = ['CI ID', 'CI Name', 'CI Type', 'Description', 'Status', 'Owner', 'Support Group', 'Environment', 'Location', 'Business Service', 'Criticality', 'Discovery Source', 'Last Verified'];
    UI.download('cmdb-' + cls.toLowerCase().replace(/\W+/g, '-') + '-template.csv', '﻿' + [cols.join(',')].concat([cols.map(() => '').join(',')]).join('\n'), 'text/csv');
    UI.toast('Template downloaded');
  });
  UI.on('cmdb.reconcile', () => {
    // reconcile discovered devices against CIs
    const d = D(); const disc = (d.discovered || []).filter((x) => String(x.status).startsWith('New'));
    let matched = 0, created = 0;
    disc.forEach((x) => {
      const hit = d.cis.find((c) => (c.ip && c.ip === x.ip) || (c.name && c.name.toLowerCase() === String(x.host || '').toLowerCase()));
      if (hit) { matched++; x.status = 'Reconciled → ' + hit.id; } else { created++; const id = uid('ci', 'CI-', 4); d.cis.unshift({ id, name: x.host || ('DISCOVERED-' + id), type: x.type || 'Server', cls: classOf(x.type), status: 'Live', lifecycle: 'Active', owner: '', supportGroup: (groups()[0] || ''), environment: 'Production', location: 'Discovered', criticality: 'Medium', discoverySource: 'Network scan', lastVerified: today(), created: today(), createdBy: 'Discovery', ip: x.ip || '', serial: x.mac || '' }); x.status = 'Imported → ' + id; }
    });
    d.intgLogs.unshift({ id: uid('il', 'IL-', 3), at: now(), kind: 'Reconciliation', source: 'CMDB', records: disc.length, imported: matched + created, failed: 0, status: 'Completed', message: `${matched} matched to existing CIs, ${created} created.` });
    logAct('Reconciliation run', matched + ' matched, ' + created + ' created'); S.emit(); UI.toast(`Reconciled: ${matched} matched, ${created} created`);
  });

  /* =====================================================================
     RENDER HELPERS
     ===================================================================== */
  function ciTable(id, rowsFn, opts) {
    opts = opts || {};
    return UI.table({
      id, rows: rowsFn, sort: opts.sort || 'id', text: (r) => [r.id, r.name, r.type, r.cls, r.owner, r.businessService, r.location, r.ip].join(' '),
      filters: [{ k: 'cls', label: 'Class', options: CICLS }, { k: 'lifecycle', label: 'Status', options: LC }, { k: 'criticality', label: 'Criticality', options: CRIT }, { k: 'environment', label: 'Environment', options: ENVS }],
      cols: [
        { k: 'id', label: 'CI ID', mono: true },
        { k: 'name', label: 'CI Name', render: (r) => `<b class="link" data-act="cis.view" data-id="${r.id}" style="cursor:pointer">${esc(r.name)}</b><br><small>${esc(r.type)}</small>` },
        { k: 'cls', label: 'Class' },
        { k: 'lifecycle', label: 'Status', render: (r) => P(lifeOf(r), lifeOf(r) === 'Active' ? 'mint' : lifeOf(r) === 'Retired' ? 'coral' : 'amber') },
        { k: 'criticality', label: 'Criticality', render: (r) => P(r.criticality) },
        { k: 'owner', label: 'Owner' },
        { k: 'businessService', label: 'Business service' },
        { k: 'environment', label: 'Env.' },
        { k: 'discoverySource', label: 'Source' },
      ],
      actions: (r) => `<button class="ibtn" data-act="cis.view" data-id="${r.id}" title="View">${ic('eye')}</button>${ea('cis', r.id)}`,
      toolbar: tbNew('cis.new', 'New CI') + (opts.extraToolbar || '') + ' <button class="btn ghost" data-act="cmdb.exportTemplate" data-cls="' + (opts.cls || '') + '">' + ic('download') + 'Template</button>',
      empty: opts.empty || 'No CIs in this class yet.',
    });
  }

  function statusDonutData() {
    const d = D();
    return [
      { label: 'Active', value: d.cis.filter((c) => lifeOf(c) === 'Active').length, color: C.mint },
      { label: 'Planned', value: d.cis.filter((c) => lifeOf(c) === 'Planned').length, color: C.blue },
      { label: 'Under Maintenance', value: d.cis.filter((c) => lifeOf(c) === 'Under Maintenance').length, color: C.amber },
      { label: 'Retired', value: d.cis.filter((c) => lifeOf(c) === 'Retired').length, color: C.coral },
    ].filter((x) => x.value);
  }
  function classBars() {
    const d = D();
    return CICLS.map((cl, i) => ({ label: cl === 'Cloud & Virtualization' ? 'Cloud & Virt.' : cl, value: d.cis.filter((c) => c.cls === cl).length, color: UI.PAL[i % 8], href: '#/cmdb' })).filter((x) => x.value);
  }
  function radialMap(center, depth) {
    const d = D(); const links = d.links; const levels = [[center]]; const seen = new Set([center]);
    for (let i = 0; i < depth; i++) { const nx = new Set(); levels[i].forEach((id) => links.forEach((l) => { if (l.from === id && !seen.has(l.to)) { seen.add(l.to); nx.add(l.to); } if (l.to === id && !seen.has(l.from)) { seen.add(l.from); nx.add(l.from); } })); levels.push([...nx]); if (!nx.size) break; }
    const W = 820, Hh = 500, cx = W / 2, cy = Hh / 2; const pos = { [center]: { x: cx, y: cy } }; const radii = [0, 150, 220];
    for (let L = 1; L < levels.length; L++) { const arr = levels[L]; arr.forEach((id, i) => { const a = -Math.PI / 2 + (i / (arr.length || 1)) * Math.PI * 2 + L * 0.55; const r = radii[Math.min(L, radii.length - 1)]; pos[id] = { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }; }); }
    const edges = links.filter((l) => pos[l.from] && pos[l.to]);
    const draw = (id) => { const c = ciById(id); if (!c) return ''; const p = pos[id]; const w = 150, h = 46; const col = c.cls === 'Service' ? C.violet : c.id === center ? C.coral : C.blue; return `<g><rect x="${p.x - w / 2}" y="${p.y - h / 2}" rx="10" width="${w}" height="${h}" fill="#fff" stroke="${col}" stroke-width="2.5" style="filter:drop-shadow(0 6px 10px rgba(47,107,255,.18))"/><text x="${p.x}" y="${p.y - 4}" text-anchor="middle" font-size="11.5" font-weight="700" fill="#181c3a">${esc(String(c.name).slice(0, 20))}</text><text x="${p.x}" y="${p.y + 11}" text-anchor="middle" font-size="9.5" fill="#7077a1">${esc(c.type)} · ${esc(lifeOf(c))}</text><title>${esc(c.name)} (${c.id})</title></g>`; };
    const line = (l) => { const a = pos[l.from], b = pos[l.to]; return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#c7cdf0" stroke-width="1.8"/><text x="${(a.x + b.x) / 2}" y="${(a.y + b.y) / 2}" text-anchor="middle" font-size="9" fill="#9aa0c6">${esc(l.rel)}</text>`; };
    return `<svg viewBox="0 0 ${W} ${Hh}" width="100%" style="max-height:520px;display:block">${edges.map(line).join('')}${Object.keys(pos).map(draw).join('')}</svg>`;
  }

  /* =====================================================================
     TAB RENDERERS
     ===================================================================== */
  function tab(secId, tabId) {
    const d = D();
    const sel = (k, def) => UI.tab['cmdb_' + k] || def;

    if (secId === 'overview') {
      if (tabId === 'dash') {
        const active = d.cis.filter((c) => lifeOf(c) === 'Active').length;
        const retired = d.cis.filter((c) => lifeOf(c) === 'Retired').length;
        const critical = d.cis.filter((c) => c.criticality === 'Critical').length;
        const pending = d.drift.filter((x) => x.status === 'Open').length + d.unauth.filter((x) => x.status !== 'Resolved').length + d.capas.filter((x) => x.status !== 'Done').length + d.findings.filter((x) => x.status !== 'Closed').length;
        const todayH = L.addDays(today(), 1); const overdueVerify = d.cis.filter((c) => c.lastVerified && L.diffDays(today(), c.lastVerified) > 365).length;
        return `<div class="grid g4">${K(d.cis.length, 'Total CIs', `${d.services.length} services · ${d.links.length} relationships`, C.blue)}${K(active, 'Active CIs', `${retired} retired`, C.mint)}${K(critical, 'Critical CIs', 'business-impact critical', C.coral)}${K(overallDq() + '%', 'Data quality', 'completeness score', overallDq() >= 85 ? C.mint : C.amber)}</div>
        <div class="grid g3 mt">${K(pending, 'Pending actions', 'drift · findings · CAPA', pending ? C.amber : C.mint)}${K(d.dups.filter((x) => x.status === 'Open').length, 'Duplicate candidates', 'open to review', C.violet)}${K(d.recon.filter((x) => x.status !== 'Matched').length, 'Recon. exceptions', 'discovery to reconcile', C.cyan)}</div>
        <div class="grid g2 mt">
          <div class="card"><h3><span class="pip"></span>Configuration items by class</h3>${UI.bars3d(classBars(), { h: 240 })}</div>
          <div class="card"><h3><span class="pip" style="--c:${C.mint}"></span>CI lifecycle status</h3>${UI.donut(statusDonutData(), { big: d.cis.length, small: 'CIs', size: 210 })}</div>
        </div>
        <div class="grid g2 mt">
          <div class="card"><h3>Pending actions</h3>
            <div class="grid g2">${[['Configuration drift', d.drift.filter((x) => x.status === 'Open').length, '#/cmdb', C.amber], ['Unauthorized changes', d.unauth.filter((x) => x.status !== 'Resolved').length, '#/cmdb', C.coral], ['Open findings', d.findings.filter((x) => x.status !== 'Closed').length, '#/cmdb', C.violet], ['Corrective actions', d.capas.filter((x) => x.status !== 'Done').length, '#/cmdb', C.blue]].map(([l, n, h, c2]) => `<div class="card" style="--c:${c2};border-left:4px solid ${c2}"><div class="v" style="font:700 22px var(--head)">${n}</div><small>${l}</small></div>`).join('')}</div>
          </div>
          <div class="card"><h3>Recent CMDB activity</h3><table class="t"><thead><tr><th>When</th><th>By</th><th>Action</th><th>Detail</th></tr></thead><tbody>${d.cmdbActivity.slice(0, 8).map((a) => `<tr><td>${fmtDate(a.at)}</td><td>${esc(a.by || '—')}</td><td>${esc(a.action)}</td><td>${esc(a.detail)}</td></tr>`).join('') || '<tr><td colspan="4"><div class="empty">No activity</div></td></tr>'}</tbody></table></div>
        </div>`;
      }
      if (tabId === 'health') {
        const rows = d.services.map((s) => ({ s, health: svcHealth(s), cCount: s.cis.length }));
        const alerts = [];
        d.links.forEach((l) => { const a = ciById(l.from), b = ciById(l.to); if (!a || !b) alerts.push(`Relationship ${l.id} references a missing CI`); else if (lifeOf(a) === 'Retired' || lifeOf(b) === 'Retired') alerts.push(`${a.name} ↔ ${b.name}: one side is retired`); });
        d.services.forEach((s) => { if (!s.cis.length) alerts.push(`${s.name} has no supporting CIs mapped`); });
        return note('Service Health shows the operational state of every business and technical service, the CIs that support it, and dependency alerts.') +
          `<div class="grid g4">${K(d.services.filter((s) => svcHealth(s) === 'Healthy').length, 'Healthy services', '', C.mint)}${K(d.services.filter((s) => svcHealth(s) === 'Degraded').length, 'Degraded', '', C.coral)}${K(d.services.filter((s) => svcHealth(s) === 'At risk').length, 'At risk', '', C.amber)}${K(alerts.length, 'Dependency alerts', '', alerts.length ? C.coral : C.mint)}</div>
          <div class="card mt">${UI.table({ id: 'cmHealth', rows: () => rows, sort: 's', text: (r) => r.s.name, cols: [{ k: 's', label: 'Service', render: (r) => `<b>${esc(r.s.name)}</b><br><small>${esc(r.s.kind)}</small>` }, { k: 'health', label: 'Health', render: (r) => P(r.health, r.health === 'Healthy' ? 'mint' : r.health === 'Degraded' ? 'coral' : 'amber') }, { k: 'cCount', label: 'Supporting CIs', num: true, render: (r) => r.cCount }, { k: 'crit', label: 'Criticality', render: (r) => P(r.s.criticality) }, { k: 'owner', label: 'Owner', render: (r) => esc(r.s.owner || '—') }], actions: (r) => `<button class="btn xs ghost" data-go="#/cmdb">${ic('eye')}Map</button>` })}</div>
          <div class="card mt"><h3>Dependency alerts (${alerts.length})</h3>${alerts.length ? `<ul>${alerts.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : '<div class="empty">No dependency alerts — every service is supported and every relationship points to a live CI.</div>'}</div>`;
      }
      // dq
      const miss = d.cis.filter((c) => missingFields(c).length).map((c) => ({ c, miss: missingFields(c) }));
      const dupOpen = d.dups.filter((x) => x.status === 'Open');
      const staleRows = d.cis.filter(stale);
      const orphanRows = d.cis.filter((c) => degOf(c.id) === 0);
      return note(`Data quality is assessed against ${d.dqRules.filter((r) => r.active === 'Yes').length} active rules: mandatory fields, duplicates, stale records and orphaned CIs.`) +
        `<div class="grid g4">${K(overallDq() + '%', 'Completeness', 'all CIs', overallDq() >= 85 ? C.mint : C.amber)}${K(miss.length, 'CIs with missing fields', '', miss.length ? C.amber : C.mint)}${K(dupOpen.length, 'Duplicate candidates', '', dupOpen.length ? C.violet : C.mint)}${K(staleRows.length, 'Stale (not verified in 180d)', '', staleRows.length ? C.amber : C.mint)}</div>
        <div class="grid g2 mt">
          <div class="card"><h3>Missing mandatory fields</h3>${UI.table({ id: 'cmDq1', rows: () => miss, sort: 'c', text: (r) => r.c.name + r.miss.join(' '), cols: [{ k: 'c', label: 'CI', render: (r) => `<b>${esc(r.c.name)}</b><br><small>${r.c.id}</small>` }, { k: 'miss', label: 'Missing', render: (r) => r.miss.map((m) => P(m, 'amber')).join(' ') }, { k: 'score', label: 'Score', num: true, render: (r) => dqScore(r.c) + '%' }], actions: (r) => `<button class="btn xs ghost" data-act="cis.edit" data-id="${r.c.id}">Fix</button>` })}</div>
          <div class="card"><h3>Duplicate candidates</h3>${UI.table({ id: 'cmDq2', rows: () => dupOpen, cols: [{ k: 'a', label: 'CI A', render: (r) => esc(ciName(r.a)) }, { k: 'b', label: 'CI B', render: (r) => esc(ciName(r.b)) }, { k: 'kind', label: 'Reason' }, { k: 'score', label: 'Match %', num: true }], actions: (r) => `<button class="btn xs" data-act="dups.resolve" data-id="${r.id}">Resolve</button>` })}</div>
        </div>
        <div class="card mt"><h3>Stale & orphaned CIs</h3>${UI.table({ id: 'cmDq3', rows: () => staleRows.concat(orphanRows.filter((o) => !stale(o))), text: (r) => r.name + r.id, cols: [{ k: 'id', label: 'CI ID', mono: true }, { k: 'name', label: 'Name' }, { k: 'lastVerified', label: 'Last verified', render: (r) => fmtDate(r.lastVerified) || '—' }, { k: 'links', label: 'Relationships', num: true, render: (r) => degOf(r.id) }, { k: 'issue', label: 'Issue', render: (r) => (stale(r) ? P('Stale', 'amber') : '') + (degOf(r.id) === 0 ? ' ' + P('Orphan', 'coral') : '') }], actions: (r) => `<button class="btn xs" data-act="ci.verify" data-id="${r.id}">Verify</button>` })}</div>`;
    }

    if (secId === 'ci') {
      if (tabId === 'all') return ciTable('cmCiAll', () => d.cis);
      if (tabId === 'services') {
        return note('Service CIs — the business and technical services the estate delivers. Open <b>Service Mapping</b> to attach supporting components and SLAs.') +
          `<div class="card">${UI.table({ id: 'cmCiServices', rows: () => d.services, sort: 'id', text: (r) => r.name + r.owner + r.criticality, filters: [{ k: 'kind', label: 'Kind', options: ['Business', 'Technical'] }, { k: 'criticality', label: 'Criticality', options: CRIT }], cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'name', label: 'Service', render: (r) => `<b>${esc(r.name)}</b><br><small>${esc(r.description || '')}</small>` }, { k: 'kind', label: 'Kind', render: (r) => P(r.kind, 'violet') }, { k: 'owner', label: 'Owner' }, { k: 'criticality', label: 'Criticality', render: (r) => P(r.criticality) }, { k: 'cis', label: 'Components', num: true, render: (r) => r.cis.length }, { k: 'health', label: 'Health', render: (r) => P(svcHealth(r), svcHealth(r) === 'Healthy' ? 'mint' : svcHealth(r) === 'Degraded' ? 'coral' : 'amber') }], actions: (r) => ea('svc', r.id), toolbar: tbNew('svc.new', 'New service') })}</div>`;
      }
      const clsMap = { hardware: 'Hardware', software: 'Software', network: 'Network', cloud: 'Cloud & Virtualization', apps: 'Application' };
      if (clsMap[tabId]) return ciTable('cmCi_' + tabId, () => d.cis.filter((c) => c.cls === clsMap[tabId]), { cls: clsMap[tabId], empty: `No ${clsMap[tabId]} CIs yet — add one to populate this register.` });
      if (tabId === 'types') return note('CI types define the classes, mandatory fields and attribute templates used across the CMDB. Add a type to make it selectable on every new CI.') +
        `<div class="card">${UI.table({ id: 'cmCit', rows: () => d.ciTypes, sort: 'id', text: (r) => r.name + r.ciClass, filters: [{ k: 'ciClass', label: 'Class', options: CICLS }, { k: 'active', label: 'Active', options: ['Yes', 'No'] }], cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'name', label: 'CI type', render: (r) => `<b>${esc(r.name)}</b>` }, { k: 'ciClass', label: 'Class' }, { k: 'mandatory', label: 'Mandatory fields' }, { k: 'attributes', label: 'Attributes' }, { k: 'active', label: 'Active', render: (r) => P(r.active === 'Yes' ? 'Accepted' : 'Draft') }], actions: (r) => ea('cit', r.id), toolbar: tbNew('cit.new', 'New CI type') })}</div>`;
      if (tabId === 'lifecycle') {
        return note('CI lifecycle — where every configuration item sits between registration and retirement.') +
          `<div class="grid g4">${LC.map((st, i) => K(d.cis.filter((c) => lifeOf(c) === st).length, st, '', [C.blue, C.mint, C.amber, C.coral][i])).join('')}</div>
          <div class="card mt"><h3>Items by lifecycle stage</h3>${UI.table({ id: 'cmLife', rows: () => d.cis, sort: 'id', text: (r) => r.name + r.type + r.owner, filters: [{ k: 'lifecycle', label: 'Stage', options: LC }], cols: [{ k: 'id', label: 'CI ID', mono: true }, { k: 'name', label: 'Name' }, { k: 'cls', label: 'Class' }, { k: 'lifecycle', label: 'Stage', render: (r) => P(lifeOf(r), lifeOf(r) === 'Active' ? 'mint' : lifeOf(r) === 'Retired' ? 'coral' : 'amber') }, { k: 'owner', label: 'Owner' }, { k: 'updated', label: 'Last updated', render: (r) => fmtDate(r.updated) }], actions: (r) => `<button class="btn xs ghost" data-act="cis.edit" data-id="${r.id}">Change stage</button>` })}</div>`;
      }
    }

    if (secId === 'rels') {
      if (tabId === 'register') {
        return `<div class="card"><div style="margin-bottom:10px">${tbNew('link.new', 'Map relationship')}</div>${UI.table({ id: 'cmRel', rows: () => d.links, sort: 'id', text: (r) => r.from + r.to + r.rel + ciName(r.from) + ciName(r.to), filters: [{ k: 'rel', label: 'Type', options: RELS }], cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'from', label: 'Source CI', render: (r) => `<b>${esc(ciName(r.from))}</b><br><small>${r.from}</small>` }, { k: 'rel', label: 'Relationship', render: (r) => P(r.rel, 'violet') }, { k: 'to', label: 'Target CI', render: (r) => `<b>${esc(ciName(r.to))}</b><br><small>${r.to}</small>` }, { k: 'at', label: 'Mapped', render: (r) => fmtDate(r.at) }], actions: (r) => delBtn('link.del', r.id) })}</div>`;
      }
      if (tabId === 'depmap') {
        const center = sel('mapCenter', (d.cis[0] || {}).id); const depth = +sel('mapDepth', 2);
        return note('Dependency map — the selected CI in the centre with its connected CIs around it.') +
          `<div class="card"><div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:10px"><label>Centre CI <select class="in" data-cm="mapCenter" style="width:auto;display:inline-block">${d.cis.map((c) => `<option value="${c.id}" ${c.id === center ? 'selected' : ''}>${esc(c.id)} · ${esc(c.name)}</option>`).join('')}</select></label><label>Depth <select class="in" data-cm="mapDepth" style="width:auto;display:inline-block">${[1, 2, 3].map((n) => `<option value="${n}" ${n === depth ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div>${d.cis.length ? radialMap(center, depth) : '<div class="empty">Add CIs to see the map</div>'}</div>`;
      }
      if (tabId === 'impact') {
        const center = sel('impCenter', (d.cis[0] || {}).id);
        const ids = impactOf(center, 6); const affected = ids.map(ciById).filter(Boolean);
        const svcs = d.services.filter((s) => s.cis.some((id) => ids.includes(id)));
        return note('Impact analysis — everything a change or outage on the selected CI could touch. Attach this list as evidence to a change request.') +
          `<div class="card"><label>CI <select class="in" data-cm="impCenter" style="width:auto;display:inline-block;margin-bottom:10px">${d.cis.map((c) => `<option value="${c.id}" ${c.id === center ? 'selected' : ''}>${esc(c.id)} · ${esc(c.name)}</option>`).join('')}</select></label></div>
          <div class="grid g3 mt">${K(affected.length - 1, 'Impacted CIs', 'within 6 hops', C.coral)}${K(svcs.length, 'Business/technical services', 'potentially affected', C.violet)}${K(affected.filter((c) => c.criticality === 'Critical').length, 'Critical CIs', 'in the blast radius', C.amber)}</div>
          <div class="card mt"><h3>Affected configuration items</h3><div class="grid g3">${affected.map((c) => `<div class="card" style="border-left:4px solid ${c.id === center ? C.coral : C.blue}"><b>${esc(c.name)}</b><br><small>${c.id} · ${esc(c.cls)} · ${esc(c.criticality)}</small><div style="margin-top:6px">${P(lifeOf(c), lifeOf(c) === 'Active' ? 'mint' : 'amber')}</div></div>`).join('') || '<div class="empty">Add CIs first</div>'}</div></div>
          <div class="card mt"><h3>Affected services</h3>${svcs.length ? `<table class="t"><thead><tr><th>Service</th><th>Kind</th><th>Criticality</th><th>Health</th></tr></thead><tbody>${svcs.map((s) => `<tr><td><b>${esc(s.name)}</b></td><td>${esc(s.kind)}</td><td>${P(s.criticality)}</td><td>${P(svcHealth(s))}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">No services depend on this CI</div>'}</div>
          <div style="margin-top:10px"><button class="btn ghost" data-go="#/itil">Attach to a change request →</button></div>`;
      }
      // orphan
      const orph = d.cis.filter((c) => degOf(c.id) === 0);
      return note(`Orphaned CIs — ${orph.length} record(s) with no relationship at all. Relationships are what make the CMDB useful for impact analysis.`) +
        `<div class="card">${UI.table({ id: 'cmOrph', rows: () => orph, sort: 'id', text: (r) => r.name + r.type, cols: [{ k: 'id', label: 'CI ID', mono: true }, { k: 'name', label: 'Name' }, { k: 'cls', label: 'Class' }, { k: 'type', label: 'Type' }, { k: 'owner', label: 'Owner' }, { k: 'criticality', label: 'Criticality', render: (r) => P(r.criticality) }], actions: (r) => `<button class="btn xs" data-act="link.new">${ic('plus')}Relate</button>`, toolbar: tbNew('link.new', 'Map relationship'), empty: 'No orphaned CIs — every configuration item has at least one relationship.' })}</div>`;
    }

    if (secId === 'svc') {
      if (tabId === 'biz' || tabId === 'tech') {
        const kind = tabId === 'biz' ? 'Business' : 'Technical';
        const rows = d.services.filter((s) => s.kind === kind);
        return `<div class="card">${UI.table({ id: 'cmSvc_' + tabId, rows: () => rows, sort: 'id', text: (r) => r.name + r.owner + r.criticality, filters: [{ k: 'criticality', label: 'Criticality', options: CRIT }, { k: 'status', label: 'Status', options: ['Active', 'Planned', 'Retired'] }], cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'name', label: 'Service', render: (r) => `<b>${esc(r.name)}</b><br><small>${esc(r.description || '')}</small>` }, { k: 'owner', label: 'Owner' }, { k: 'criticality', label: 'Criticality', render: (r) => P(r.criticality) }, { k: 'cis', label: 'Supporting CIs', num: true, render: (r) => r.cis.length }, { k: 'health', label: 'Health', render: (r) => P(svcHealth(r), svcHealth(r) === 'Healthy' ? 'mint' : svcHealth(r) === 'Degraded' ? 'coral' : 'amber') }, { k: 'status', label: 'Status', render: (r) => P(r.status === 'Active' ? 'Accepted' : 'Draft') }], actions: (r) => ea('svc', r.id), toolbar: tbNew('svc.new', 'New service') })}</div>`;
      }
      if (tabId === 'deps') {
        return note('Service dependencies — which configuration items support each service. This is the link that turns infrastructure into services.') +
          `<div class="card">${UI.table({ id: 'cmSvcDep', rows: () => d.svcDeps, sort: 'serviceId', text: (r) => svcName(r.serviceId) + ciName(r.ciId) + r.role, filters: [{ k: 'role', label: 'Role', options: ['Primary component', 'Supporting component', 'Service dependency'] }], cols: [{ k: 'serviceId', label: 'Service', render: (r) => `<b>${esc(svcName(r.serviceId))}</b><br><small>${r.serviceId}</small>` }, { k: 'ciId', label: 'Component', render: (r) => esc(ciName(r.ciId)) + (r.ciId.indexOf('SVC') === 0 ? ' ' + P('Service', 'violet') : '') }, { k: 'role', label: 'Role' }], actions: (r) => (ITMS.canDelete() ? `<button class="ibtn" style="--c:#ff5c6c" data-act="dep.del" data-id="${r.id}">${ic('trash')}</button>` : ''), toolbar: tbNew('svc.new', 'New service') })}</div>`;
      }
      // sla
      return note('Service-level links — the SLA reference and commitments attached to each service.') +
        `<div class="card">${UI.table({ id: 'cmSvcSla', rows: () => d.svcSla, sort: 'id', text: (r) => svcName(r.serviceId) + r.sla, cols: [{ k: 'serviceId', label: 'Service', render: (r) => esc(svcName(r.serviceId)) }, { k: 'sla', label: 'SLA' }, { k: 'target', label: 'Commitment' }, { k: 'owner', label: 'Owner' }, { k: 'review', label: 'Next review', render: (r) => (r.review < today() ? P('Overdue', 'coral') + ' ' : '') + fmtDate(r.review) }, { k: 'status', label: 'Status', render: (r) => P(r.status, r.status === 'Active' ? 'mint' : 'amber') }], actions: (r) => (ITMS.canDelete() ? `<button class="ibtn" style="--c:#ff5c6c" data-act="ssla.del" data-id="${r.id}">${ic('trash')}</button>` : '') })}</div>`;
    }

    if (secId === 'disc') {
      if (tabId === 'sources') return `<div class="card">${UI.table({ id: 'cmDs', rows: () => d.discSources, sort: 'id', text: (r) => r.name + r.kind + r.endpoint, filters: [{ k: 'kind', label: 'Type', options: ['Agent', 'API', 'Cloud', 'Network scan', 'Manual'] }], cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'name', label: 'Source', render: (r) => `<b>${esc(r.name)}</b>` }, { k: 'kind', label: 'Type' }, { k: 'endpoint', label: 'Endpoint / scope' }, { k: 'lastSync', label: 'Last sync', render: (r) => fdt(r.lastSync) || '—' }, { k: 'status', label: 'Status', render: (r) => P(r.status, r.status === 'Active' ? 'mint' : 'amber') }], actions: (r) => ea('dsrc', r.id), toolbar: tbNew('dsrc.new', 'New source') })}</div>`;
      if (tabId === 'jobs') return `<div class="card">${UI.table({ id: 'cmDj', rows: () => d.discJobs, sort: 'id', text: (r) => r.name + r.scope, filters: [{ k: 'status', label: 'Status', options: ['Scheduled', 'Running', 'Completed', 'Failed'] }], cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'name', label: 'Job', render: (r) => `<b>${esc(r.name)}</b><br><small>${esc(dsName(r.sourceId))}</small>` }, { k: 'schedule', label: 'Schedule' }, { k: 'lastRun', label: 'Last run', render: (r) => fdt(r.lastRun) || '—' }, { k: 'nextRun', label: 'Next run', render: (r) => fmtDate(r.nextRun) || '—' }, { k: 'found', label: 'Found', num: true }, { k: 'reconciled', label: 'Reconciled', num: true }, { k: 'status', label: 'Status', render: (r) => P(r.status, r.status === 'Completed' ? 'mint' : r.status === 'Running' ? 'blue' : r.status === 'Failed' ? 'coral' : 'amber') }], actions: (r) => `<button class="btn xs" data-act="job.run" data-id="${r.id}">Run</button>${ea('djob', r.id)}`, toolbar: tbNew('djob.new', 'New job') + ' <button class="btn mint" data-act="cmdb.reconcile">' + ic('refresh') + 'Reconcile now</button>' })}</div>`;
      if (tabId === 'recon') return note('Reconciliation — match discovered records to existing CIs and decide what to do with the remainder.') +
        `<div class="card"><div style="margin-bottom:10px"><button class="btn mint" data-act="cmdb.reconcile">${ic('refresh')}Run reconciliation</button></div>${UI.table({ id: 'cmRcn', rows: () => d.recon, sort: 'id', text: (r) => r.host + r.ip + r.source, filters: [{ k: 'status', label: 'Status', options: ['Matched', 'Needs review', 'Unmatched'] }, { k: 'source', label: 'Source', options: () => uniq(d.recon.map((x) => x.source)) }], cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'host', label: 'Discovered host', render: (r) => `<b>${esc(r.host)}</b>` }, { k: 'ip', label: 'IP', mono: true }, { k: 'source', label: 'Source' }, { k: 'matchedOn', label: 'Matched on' }, { k: 'confidence', label: 'Confidence', render: (r) => P(r.confidence, r.confidence === 'High' ? 'mint' : r.confidence === 'Medium' ? 'amber' : 'coral') }, { k: 'ciName', label: 'Matched CI', render: (r) => (r.ciId ? esc(ciName(r.ciId)) : '—') }, { k: 'status', label: 'Status', render: (r) => P(r.status, r.status === 'Matched' ? 'mint' : r.status === 'Unmatched' ? 'coral' : 'amber') }], actions: (r) => (r.status !== 'Matched' ? `<button class="btn xs" data-act="recon.act" data-id="${r.id}">${esc(r.action)}</button>` : ''), toolbar: '' })}</div>`;
      if (tabId === 'dups') return note('Duplicate detection — candidate duplicate CIs identified by name similarity, shared hosts or shared attributes.') +
        `<div class="card">${UI.table({ id: 'cmDup', rows: () => d.dups, sort: 'id', text: (r) => ciName(r.a) + ciName(r.b) + r.kind, filters: [{ k: 'status', label: 'Status', options: ['Open', 'Reviewed', 'Resolved'] }], cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'a', label: 'CI A', render: (r) => `<b>${esc(ciName(r.a))}</b><br><small>${r.a}</small>` }, { k: 'b', label: 'CI B', render: (r) => `<b>${esc(ciName(r.b))}</b><br><small>${r.b}</small>` }, { k: 'kind', label: 'Match reason' }, { k: 'score', label: 'Match %', num: true }, { k: 'status', label: 'Status', render: (r) => P(r.status, r.status === 'Open' ? 'amber' : r.status === 'Resolved' ? 'mint' : 'blue') }], actions: (r) => (r.status !== 'Resolved' ? `<button class="btn xs" data-act="dups.resolve" data-id="${r.id}">Resolve</button>` : '') })}</div>`;
      // logs
      return `<div class="card">${UI.table({ id: 'cmIl', rows: () => d.intgLogs, sort: 'at', dir: -1, text: (r) => r.source + r.kind + r.message, filters: [{ k: 'kind', label: 'Kind', options: () => uniq(d.intgLogs.map((x) => x.kind)) }, { k: 'status', label: 'Status', options: ['Completed', 'Partial', 'Failed'] }], cols: [{ k: 'at', label: 'When', render: (r) => fdt(r.at) }, { k: 'kind', label: 'Kind' }, { k: 'source', label: 'Source' }, { k: 'records', label: 'Records', num: true }, { k: 'imported', label: 'Imported', num: true }, { k: 'failed', label: 'Failed', num: true, render: (r) => (r.failed ? P(r.failed, 'coral') : '0') }, { k: 'status', label: 'Status', render: (r) => P(r.status, r.status === 'Completed' ? 'mint' : r.status === 'Partial' ? 'amber' : 'coral') }, { k: 'message', label: 'Result' }], actions: () => '' })}</div>`;
    }

    if (secId === 'hist') {
      if (tabId === 'changes') return note('CI change history — who changed what, when, and why. Every edit made in the CMDB is recorded here.') +
        `<div class="card">${UI.table({ id: 'cmHist', rows: () => d.ciHistory, sort: 'at', dir: -1, text: (r) => ciName(r.ciId) + r.field + r.before + r.after + r.by, filters: [{ k: 'by', label: 'By', options: () => uniq(d.ciHistory.map((x) => x.by)) }], cols: [{ k: 'at', label: 'When', render: (r) => fmtDate(r.at) }, { k: 'ciId', label: 'CI', render: (r) => esc(ciName(r.ciId)) }, { k: 'field', label: 'Field' }, { k: 'before', label: 'Before' }, { k: 'after', label: 'After', render: (r) => `<b>${esc(r.after)}</b>` }, { k: 'by', label: 'By' }, { k: 'reason', label: 'Reason' }], actions: () => '' })}</div>`;
      if (tabId === 'related') return note('Related changes — change requests that touch configuration items.') +
        `<div class="card">${UI.table({ id: 'cmRelChg', rows: () => d.relatedChanges, sort: 'at', dir: -1, text: (r) => r.changeId + r.title + ciName(r.ciId), cols: [{ k: 'changeId', label: 'Change', mono: true }, { k: 'title', label: 'Title', render: (r) => `<b>${esc(r.title)}</b>` }, { k: 'ciId', label: 'Affected CI', render: (r) => esc(ciName(r.ciId)) }, { k: 'status', label: 'Status', render: (r) => P(r.status, 'violet') }, { k: 'at', label: 'Raised', render: (r) => fmtDate(r.at) }], actions: (r) => `<button class="btn xs ghost" data-go="#/itil">Open change</button>` })}</div>`;
      if (tabId === 'unauth') return note('Unauthorized changes — configuration changes detected without an approved change record.') +
        `<div class="card">${UI.table({ id: 'cmUnauth', rows: () => d.unauth, sort: 'at', dir: -1, text: (r) => ciName(r.ciId) + r.detail, filters: [{ k: 'status', label: 'Status', options: ['Investigating', 'Resolved'] }], cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'ciId', label: 'CI', render: (r) => esc(ciName(r.ciId)) }, { k: 'detail', label: 'Detected change' }, { k: 'by', label: 'Attributed to' }, { k: 'at', label: 'Detected', render: (r) => fmtDate(r.at) }, { k: 'status', label: 'Status', render: (r) => P(r.status, r.status === 'Resolved' ? 'mint' : 'coral') }], actions: (r) => (r.status !== 'Resolved' ? `<button class="btn xs" data-act="unauth.resolve" data-id="${r.id}">Resolve</button>` : '') })}</div>`;
      // drift
      return note('Configuration drift — where the actual state differs from the approved baseline.') +
        `<div class="card">${UI.table({ id: 'cmDrift', rows: () => d.drift, sort: 'detected', dir: -1, text: (r) => ciName(r.ciId) + r.field + r.actual, filters: [{ k: 'severity', label: 'Severity', options: ['Low', 'Medium', 'High'] }, { k: 'status', label: 'Status', options: ['Open', 'Accepted', 'Remediated'] }], cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'ciId', label: 'CI', render: (r) => esc(ciName(r.ciId)) }, { k: 'field', label: 'Attribute' }, { k: 'baseline', label: 'Approved baseline' }, { k: 'actual', label: 'Actual state', render: (r) => `<b>${esc(r.actual)}</b>` }, { k: 'severity', label: 'Severity', render: (r) => P(r.severity) }, { k: 'status', label: 'Status', render: (r) => P(r.status, r.status === 'Open' ? 'amber' : r.status === 'Remediated' ? 'mint' : 'blue') }], actions: (r) => (r.status === 'Open' ? `<button class="btn xs" data-act="drift.remedy" data-id="${r.id}">Remediate</button> <button class="btn xs ghost" data-act="drift.accept" data-id="${r.id}">Accept</button>` : '') })}</div>`;
    }

    if (secId === 'base') {
      if (tabId === 'reg') return note('Baseline register — approved snapshots of configuration used for comparison and audit.') +
        `<div class="card">${UI.table({ id: 'cmBase', rows: () => d.baselines, sort: 'id', text: (r) => r.name + r.scope + r.approvedBy, filters: [{ k: 'status', label: 'Status', options: ['Draft', 'Pending approval', 'Approved', 'Retired'] }], cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'name', label: 'Baseline', render: (r) => `<b>${esc(r.name)}</b><br><small>${esc(r.scope)}</small>` }, { k: 'cis', label: 'CIs', num: true, render: (r) => (r.cis || []).length }, { k: 'approvedBy', label: 'Approved by' }, { k: 'approvedAt', label: 'Approved on', render: (r) => fmtDate(r.approvedAt) || '—' }, { k: 'status', label: 'Status', render: (r) => P(r.status, r.status === 'Approved' ? 'mint' : r.status === 'Draft' ? 'violet' : 'amber') }], actions: (r) => (r.status !== 'Approved' ? `<button class="btn xs" data-act="base.approve" data-id="${r.id}">Approve</button>` : '') + ea('base', r.id), toolbar: tbNew('base.new', 'New baseline') })}</div>`;
      if (tabId === 'cmp') {
        const bid = sel('cmpBaseline', (d.baselines[0] || {}).id);
        const b = d.baselines.find((x) => x.id === bid);
        const rows = b ? b.cis.map(ciById).filter(Boolean).map((c) => ({ c, drift: d.drift.find((x) => x.ciId === c.id && x.status === 'Open') })) : [];
        return note('Baseline comparison — current state of every CI in the baseline against the approved configuration.') +
          `<div class="card"><label>Baseline <select class="in" data-cm="cmpBaseline" style="width:auto;display:inline-block;margin-bottom:10px">${d.baselines.map((x) => `<option value="${x.id}" ${x.id === bid ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>${b ? `<div class="grid g3">${K(rows.filter((r) => !r.drift).length, 'Matches baseline', '', C.mint)}${K(rows.filter((r) => r.drift).length, 'Deviations', 'drift detected', C.coral)}${K(rows.length, 'CIs in baseline', '', C.blue)}</div>
          <table class="t" style="margin-top:10px"><thead><tr><th>CI</th><th>Current status</th><th>Deviation</th></tr></thead><tbody>${rows.map((r) => `<tr><td><b>${esc(r.c.name)}</b><br><small>${r.c.id}</small></td><td>${P(lifeOf(r.c))}</td><td>${r.drift ? P(r.drift.field + ': ' + r.drift.actual, 'amber') : P('Matches baseline', 'mint')}</td></tr>`).join('') || '<tr><td colspan="3"><div class="empty">No CIs in this baseline</div></td></tr>'}</tbody></table>` : '<div class="empty">Select a baseline</div>'}</div>`;
      }
      if (tabId === 'apr') return note('Baseline approval — the approval workflow and responsible users for each baseline.') +
        `<div class="card">${UI.table({ id: 'cmBA', rows: () => d.baseApprove, sort: 'id', text: (r) => (blName(r.baselineId)) + r.approver, filters: [{ k: 'status', label: 'Status', options: ['Pending', 'Approved', 'Rejected'] }], cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'baselineId', label: 'Baseline', render: (r) => esc(blName(r.baselineId)) }, { k: 'approver', label: 'Approver' }, { k: 'role', label: 'Role' }, { k: 'at', label: 'Decided', render: (r) => fdt(r.at) || '—' }, { k: 'status', label: 'Status', render: (r) => P(r.status, r.status === 'Approved' ? 'mint' : r.status === 'Rejected' ? 'coral' : 'amber') }, { k: 'comment', label: 'Comment' }], actions: (r) => (r.status === 'Pending' ? `<button class="btn xs" data-act="ba.decide" data-id="${r.id}" data-val="Approved">Approve</button> <button class="btn xs ghost" data-act="ba.decide" data-id="${r.id}" data-val="Rejected">Reject</button>` : '') })}</div>`;
      // exceptions
      return note('Baseline exceptions — approved deviations from an approved baseline, with justification and expiry.') +
        `<div class="card">${UI.table({ id: 'cmExc', rows: () => d.baseExceptions, sort: 'id', text: (r) => ciName(r.ciId) + r.reason, filters: [{ k: 'status', label: 'Status', options: ['Active', 'Expired', 'Rejected'] }], cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'baselineId', label: 'Baseline', render: (r) => esc(blName(r.baselineId)) }, { k: 'ciId', label: 'CI', render: (r) => esc(ciName(r.ciId)) }, { k: 'reason', label: 'Justification' }, { k: 'approvedBy', label: 'Approved by' }, { k: 'expires', label: 'Expires', render: (r) => (r.expires < today() ? P('Expired', 'coral') : fmtDate(r.expires)) }, { k: 'status', label: 'Status', render: (r) => P(r.status, r.status === 'Active' ? 'mint' : 'coral') }], actions: (r) => ea('exc', r.id), toolbar: tbNew('exc.new', 'New exception') })}</div>`;
    }

    if (secId === 'audit') {
      if (tabId === 'verify') {
        const rows = d.cis.map((c) => ({ c, old: c.lastVerified, miss: missingFields(c) }));
        return note('CI verification — check each record against the actual environment and stamp the verification date.') +
          `<div class="grid g3">${K(d.cis.length, 'CIs to verify', '', C.blue)}${K(d.cis.filter((c) => stale(c)).length, 'Overdue (> 180 days)', '', C.coral)}${K(d.cis.filter((c) => !stale(c)).length, 'Verified recently', '', C.mint)}</div>
          <div class="card mt">${UI.table({ id: 'cmVerify', rows: () => rows, sort: 'c', text: (r) => r.c.name + r.c.id, filters: [{ k: 'cls', label: 'Class', options: CICLS, get: (r) => r.c.cls }], cols: [{ k: 'c', label: 'CI', render: (r) => `<b>${esc(r.c.name)}</b><br><small>${r.c.id}</small>` }, { k: 'owner', label: 'Owner', render: (r) => esc(r.c.owner || '—') }, { k: 'lastVerified', label: 'Last verified', render: (r) => (stale(r.c) ? P('Stale', 'amber') + ' ' : '') + (fmtDate(r.c.lastVerified) || '—') }, { k: 'miss', label: 'Missing fields', render: (r) => r.miss.length ? r.miss.map((m) => P(m, 'amber')).join(' ') : P('Complete', 'mint') }], actions: (r) => `<button class="btn xs" data-act="ci.verify" data-id="${r.c.id}">Verify now</button>` })}</div>`;
      }
      if (tabId === 'sched') return `<div class="card">${UI.table({ id: 'cmAudits', rows: () => d.audits, sort: 'planned', text: (r) => r.name + r.scope + r.owner, filters: [{ k: 'status', label: 'Status', options: ['Planned', 'In progress', 'Completed', 'Cancelled'] }], cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'name', label: 'Audit', render: (r) => `<b>${esc(r.name)}</b><br><small>${esc(r.scope)}</small>` }, { k: 'kind', label: 'Kind', render: (r) => P(r.kind, 'violet') }, { k: 'owner', label: 'Owner' }, { k: 'planned', label: 'Planned', render: (r) => fmtDate(r.planned) }, { k: 'progress', label: 'Verified', num: true, render: (r) => r.verified + ' / ' + r.total }, { k: 'status', label: 'Status', render: (r) => P(r.status, r.status === 'Completed' ? 'mint' : r.status === 'In progress' ? 'blue' : 'amber') }], actions: (r) => (r.status !== 'Completed' ? `<button class="btn xs" data-act="audit.run" data-id="${r.id}">Run audit</button>` : '') + ea('audit', r.id), toolbar: tbNew('audit.new', 'New audit') })}</div>`;
      if (tabId === 'find') return `<div class="card">${UI.table({ id: 'cmFind', rows: () => d.findings, sort: 'id', text: (r) => r.detail + ciName(r.ciId), filters: [{ k: 'severity', label: 'Severity', options: ['Low', 'Medium', 'High', 'Critical'] }, { k: 'status', label: 'Status', options: ['Open', 'In progress', 'Closed'] }], cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'auditId', label: 'Audit', render: (r) => esc(audName(r.auditId)) }, { k: 'ciId', label: 'CI', render: (r) => esc(ciName(r.ciId)) }, { k: 'severity', label: 'Severity', render: (r) => P(r.severity) }, { k: 'detail', label: 'Finding' }, { k: 'owner', label: 'Owner' }, { k: 'status', label: 'Status', render: (r) => P(r.status, r.status === 'Closed' ? 'mint' : r.status === 'Open' ? 'coral' : 'amber') }], actions: (r) => ea('find', r.id), toolbar: tbNew('find.new', 'New finding') })}</div>`;
      if (tabId === 'capa') return note('Corrective actions — owners, deadlines and remediation status for every open finding.') +
        `<div class="card">${UI.table({ id: 'cmCapa', rows: () => d.capas, sort: 'due', text: (r) => r.action + r.owner, filters: [{ k: 'status', label: 'Status', options: ['Planned', 'In progress', 'Overdue', 'Done'] }], cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'findingId', label: 'Finding', mono: true }, { k: 'action', label: 'Action' }, { k: 'owner', label: 'Owner' }, { k: 'due', label: 'Due', render: (r) => (r.due < today() && r.status !== 'Done' ? P('Overdue', 'coral') + ' ' : '') + fmtDate(r.due) }, { k: 'progress', label: 'Progress', num: true, render: (r) => r.progress + '%' }, { k: 'status', label: 'Status', render: (r) => P(r.status, r.status === 'Done' ? 'mint' : r.status === 'Overdue' ? 'coral' : 'amber') }], actions: (r) => (r.status !== 'Done' ? `<button class="btn xs" data-act="capa.progress" data-id="${r.id}">+25%</button>` : '') + ea('capa', r.id), toolbar: tbNew('capa.new', 'New action') })}</div>`;
      // evid
      return `<div class="card">${UI.table({ id: 'cmEvid', rows: () => d.evidence, sort: 'at', dir: -1, text: (r) => r.title + r.ref, filters: [{ k: 'kind', label: 'Kind', options: ['Evidence', 'Approval', 'Report'] }], cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'title', label: 'Evidence / report', render: (r) => `<b>${esc(r.title)}</b>` }, { k: 'kind', label: 'Kind', render: (r) => P(r.kind, 'violet') }, { k: 'auditId', label: 'Audit', render: (r) => esc(audName(r.auditId)) }, { k: 'ref', label: 'Reference', mono: true }, { k: 'by', label: 'By' }, { k: 'at', label: 'Date', render: (r) => fmtDate(r.at) }, { k: 'status', label: 'Status', render: (r) => P(r.status, r.status === 'Attached' ? 'mint' : 'violet') }], actions: (r) => ea('evid', r.id), toolbar: tbNew('evid.new', 'Add evidence') })}</div>`;
    }

    if (secId === 'reports') {
      const clsCount = CICLS.map((cl) => ({ cls: cl, n: d.cis.filter((c) => c.cls === cl).length, active: d.cis.filter((c) => c.cls === cl && lifeOf(c) === 'Active').length, retired: d.cis.filter((c) => c.cls === cl && lifeOf(c) === 'Retired').length })).filter((r) => r.n);
      if (tabId === 'inv') {
        const byEnv = ENVS.map((e) => ({ e, n: d.cis.filter((c) => c.environment === e).length })).filter((x) => x.n);
        const byOwner = uniq(d.cis.map((c) => c.owner)).map((o) => ({ o, n: d.cis.filter((c) => c.owner === o).length })).sort((a, b) => b.n - a.n);
        const byLoc = uniq(d.cis.map((c) => c.location)).map((o) => ({ o, n: d.cis.filter((c) => c.location === o).length }));
        return note('CI inventory reports — counts by class, environment, location and owner.') +
          `<div class="card">${UI.table({ id: 'cmRepInv', rows: () => clsCount, sort: 'n', dir: -1, text: (r) => r.cls, cols: [{ k: 'cls', label: 'CI class' }, { k: 'n', label: 'Total', num: true }, { k: 'active', label: 'Active', num: true }, { k: 'retired', label: 'Retired', num: true }], toolbar: `<button class="btn ghost sm" data-act="csv" data-id="cmRepInv">${ic('download')}CSV</button>` })}</div>
          <div class="grid g3 mt"><div class="card"><h3>By environment</h3><table class="t"><tbody>${byEnv.map((x) => `<tr><td>${esc(x.e)}</td><td class="num">${x.n}</td></tr>`).join('')}</tbody></table></div><div class="card"><h3>By owner</h3><table class="t"><tbody>${byOwner.slice(0, 8).map((x) => `<tr><td>${esc(x.o || '—')}</td><td class="num">${x.n}</td></tr>`).join('')}</tbody></table></div><div class="card"><h3>By location</h3><table class="t"><tbody>${byLoc.map((x) => `<tr><td>${esc(x.o || '—')}</td><td class="num">${x.n}</td></tr>`).join('')}</tbody></table></div></div>`;
      }
      if (tabId === 'dqr') {
        const rows = d.cis.map((c) => ({ c, miss: missingFields(c).length, score: dqScore(c) })).sort((a, b) => a.score - b.score);
        return `<div class="grid g4">${K(overallDq() + '%', 'Average completeness', '', overallDq() >= 85 ? C.mint : C.amber)}${K(rows.filter((r) => r.miss === 0).length, 'Complete records', '', C.mint)}${K(rows.filter((r) => r.miss > 0).length, 'Incomplete records', '', C.amber)}${K(d.dups.filter((x) => x.status === 'Open').length, 'Open duplicates', '', C.violet)}</div>
          <div class="card mt">${UI.table({ id: 'cmRepDq', rows: () => rows, sort: 'score', text: (r) => r.c.name, cols: [{ k: 'c', label: 'CI', render: (r) => `<b>${esc(r.c.name)}</b><br><small>${r.c.id}</small>` }, { k: 'cls', label: 'Class', render: (r) => esc(r.c.cls) }, { k: 'miss', label: 'Missing fields', num: true }, { k: 'score', label: 'Completeness', num: true, render: (r) => r.score + '%' }, { k: 'stale', label: 'Verified', render: (r) => (stale(r.c) ? P('Stale', 'amber') : P('Current', 'mint')) }], toolbar: `<button class="btn ghost sm" data-act="csv" data-id="cmRepDq">${ic('download')}CSV</button>` })}</div>`;
      }
      if (tabId === 'dep') {
        const fanIn = d.cis.map((c) => ({ c, n: d.links.filter((l) => l.to === c.id).length })).sort((a, b) => b.n - a.n).slice(0, 12);
        const svcDep = d.services.map((s) => ({ s, n: s.cis.length })).sort((a, b) => b.n - a.n);
        return note('Dependency reports — the most-depended-on CIs (single points of failure) and services by component count.') +
          `<div class="grid g2"><div class="card"><h3>Most depended-on CIs</h3><table class="t"><thead><tr><th>CI</th><th>Dependents</th></tr></thead><tbody>${fanIn.map((r) => `<tr><td><b>${esc(r.c.name)}</b><br><small>${r.c.id} · ${esc(r.c.cls)}</small></td><td class="num">${r.n}</td></tr>`).join('')}</tbody></table></div>
          <div class="card"><h3>Services by components</h3><table class="t"><thead><tr><th>Service</th><th>Components</th></tr></thead><tbody>${svcDep.map((r) => `<tr><td><b>${esc(r.s.name)}</b><br><small>${esc(r.s.kind)}</small></td><td class="num">${r.n}</td></tr>`).join('')}</tbody></table></div></div>`;
      }
      if (tabId === 'chg') {
        const byField = uniq(d.ciHistory.map((h) => h.field)).map((f) => ({ f, n: d.ciHistory.filter((h) => h.field === f).length }));
        return `<div class="grid g3">${K(d.ciHistory.length, 'Configuration changes', '', C.blue)}${K(d.unauth.length, 'Unauthorized changes', '', C.coral)}${K(d.drift.filter((x) => x.status === 'Open').length, 'Open drift', '', C.amber)}</div>
          <div class="grid g2 mt"><div class="card"><h3>Changes by attribute</h3><table class="t"><tbody>${byField.map((x) => `<tr><td>${esc(x.f)}</td><td class="num">${x.n}</td></tr>`).join('') || '<tr><td><div class="empty">No changes</div></td></tr>'}</tbody></table></div>
          <div class="card"><h3>Recent changes</h3><table class="t"><thead><tr><th>When</th><th>CI</th><th>Field</th></tr></thead><tbody>${d.ciHistory.slice(0, 8).map((h) => `<tr><td>${fmtDate(h.at)}</td><td>${esc(ciName(h.ciId))}</td><td>${esc(h.field)}</td></tr>`).join('') || '<tr><td colspan="3"><div class="empty">No changes</div></td></tr>'}</tbody></table></div></div>`;
      }
      if (tabId === 'comp') {
        const sev = ['Critical', 'High', 'Medium', 'Low'].map((s) => ({ s, n: d.findings.filter((f) => f.severity === s).length }));
        const verRate = d.cis.length ? Math.round((d.cis.filter((c) => !stale(c)).length / d.cis.length) * 100) : 100;
        return `<div class="grid g4">${K(verRate + '%', 'Verification rate', 'verified in last 180d', verRate >= 80 ? C.mint : C.amber)}${K(d.audits.filter((a) => a.status === 'Completed').length + '/' + d.audits.length, 'Audits completed', '', C.blue)}${K(d.findings.filter((f) => f.status !== 'Closed').length, 'Open findings', '', C.coral)}${K(d.capas.filter((c) => c.status === 'Overdue').length, 'Overdue actions', '', C.coral)}</div>
          <div class="grid g2 mt"><div class="card"><h3>Findings by severity</h3>${UI.bars3d(sev.map((x) => ({ label: x.s, value: x.n, color: x.s === 'Critical' ? C.coral : x.s === 'High' ? C.amber : C.blue })), { h: 220 })}</div>
          <div class="card"><h3>Audit verification</h3><table class="t"><thead><tr><th>Audit</th><th>Verified</th><th>Status</th></tr></thead><tbody>${d.audits.map((a) => `<tr><td>${esc(a.name)}</td><td class="num">${a.verified} / ${a.total}</td><td>${P(a.status, a.status === 'Completed' ? 'mint' : 'amber')}</td></tr>`).join('')}</tbody></table></div></div>`;
      }
      // kpi
      const verRate = d.cis.length ? Math.round((d.cis.filter((c) => !stale(c)).length / d.cis.length) * 100) : 100;
      const relCoverage = d.cis.length ? Math.round((d.cis.filter((c) => degOf(c.id) > 0).length / d.cis.length) * 100) : 100;
      const svcCoverage = d.services.length ? Math.round((d.services.filter((s) => s.cis.length).length / d.services.length) * 100) : 100;
      return `<div class="grid g4">${K(d.cis.length, 'CIs under management', '', C.blue)}${K(overallDq() + '%', 'Completeness', 'data quality', C.mint)}${K(relCoverage + '%', 'Relationship coverage', 'CIs with relationships', relCoverage >= 80 ? C.mint : C.amber)}${K(verRate + '%', 'Verification rate', '', C.blue)}</div>
        <div class="grid g3 mt"><div class="card"><h3>Completeness</h3><div style="text-align:center">${UI.ring(overallDq(), C.mint, overallDq() + '%')}</div></div><div class="card"><h3>Relationship coverage</h3><div style="text-align:center">${UI.ring(relCoverage, C.blue, relCoverage + '%')}</div></div><div class="card"><h3>Service mapping</h3><div style="text-align:center">${UI.ring(svcCoverage, C.violet, svcCoverage + '%')}</div></div></div>
        <div class="card mt"><h3>Key performance indicators</h3><table class="t"><tbody>
          <tr><td>Accuracy (no open drift / duplicate)</td><td class="num">${Math.max(0, 100 - (d.drift.filter((x) => x.status === 'Open').length + d.dups.filter((x) => x.status === 'Open').length))}%</td></tr>
          <tr><td>Verification rate (last 180 days)</td><td class="num">${verRate}%</td></tr>
          <tr><td>Relationship coverage</td><td class="num">${relCoverage}%</td></tr>
          <tr><td>Service mapping coverage</td><td class="num">${svcCoverage}%</td></tr>
          <tr><td>Open corrective actions</td><td class="num">${d.capas.filter((c) => c.status !== 'Done').length}</td></tr>
        </tbody></table></div>`;
    }

    if (secId === 'admin') {
      if (tabId === 'cit') return `<div class="card">${UI.table({ id: 'cmAdmCit', rows: () => d.ciTypes, sort: 'id', text: (r) => r.name + r.ciClass, cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'name', label: 'CI type' }, { k: 'ciClass', label: 'Class' }, { k: 'mandatory', label: 'Mandatory fields' }, { k: 'active', label: 'Active', render: (r) => P(r.active === 'Yes' ? 'Accepted' : 'Draft') }], actions: (r) => ea('cit', r.id), toolbar: tbNew('cit.new', 'New CI type') })}</div>`;
      if (tabId === 'rel') return `<div class="card">${UI.table({ id: 'cmAdmRel', rows: () => d.relTypes, sort: 'id', text: (r) => r.name + r.rules, cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'name', label: 'Relationship' }, { k: 'inverse', label: 'Inverse' }, { k: 'direction', label: 'Direction' }, { k: 'rules', label: 'Allowed classes' }, { k: 'active', label: 'Active', render: (r) => P(r.active === 'Yes' ? 'Accepted' : 'Draft') }], actions: (r) => ea('reltype', r.id), toolbar: tbNew('reltype.new', 'New relationship type') })}</div>`;
      if (tabId === 'lc') {
        const stages = [['Planned', 'Registration complete, awaiting activation'], ['Active', 'In service and supported'], ['Under Maintenance', 'Temporarily out of service for maintenance'], ['Retired', 'Withdrawn — retained for history only']];
        return note('Lifecycle & workflow — the statuses a CI moves through and how the CMDB records each transition.') +
          `<div class="card"><table class="t"><thead><tr><th>Stage</th><th>Meaning</th><th>CIs</th><th>Allowed next</th></tr></thead><tbody>${stages.map(([st, desc], i) => `<tr><td>${P(st, ['violet', 'mint', 'amber', 'coral'][i])}</td><td>${esc(desc)}</td><td class="num">${d.cis.filter((c) => lifeOf(c) === st).length}</td><td>${esc(i < stages.length - 1 ? stages[i + 1][0] : '—')}</td></tr>`).join('')}</tbody></table>
          <div style="margin-top:10px;color:var(--muted);font-size:12.5px">Every lifecycle transition is recorded in CI change history with the user, date and reason. Approvals are required for moves into Active for Critical CIs.</div></div>`;
      }
      if (tabId === 'dqr') return `<div class="card">${UI.table({ id: 'cmAdmDqr', rows: () => d.dqRules, sort: 'id', text: (r) => r.name + r.rule, filters: [{ k: 'severity', label: 'Severity', options: ['Low', 'Medium', 'High'] }, { k: 'active', label: 'Active', options: ['Yes', 'No'] }], cols: [{ k: 'id', label: 'ID', mono: true }, { k: 'name', label: 'Rule' }, { k: 'scope', label: 'Scope' }, { k: 'rule', label: 'Definition' }, { k: 'severity', label: 'Severity', render: (r) => P(r.severity) }, { k: 'active', label: 'Active', render: (r) => P(r.active === 'Yes' ? 'Accepted' : 'Draft') }], actions: (r) => ea('dqr', r.id), toolbar: tbNew('dqr.new', 'New rule') })}</div>`;
      if (tabId === 'roles') return note('Roles & permissions are governed centrally by <b>People &amp; Identity → Roles &amp; Access</b>. The CMDB exposes the role matrix here for convenience; edits take effect there.') +
        `<div class="card">${UI.table({ id: 'cmAdmRoles', rows: () => d.roles, sort: 'id', text: (r) => r.name, cols: [{ k: 'name', label: 'Role' }, { k: 'scope', label: 'Scope' }, { k: 'perms', label: 'CMDB permissions', render: (r) => (r.perms || []).map((x) => `<span class="pill p-blue">${esc(x)}</span>`).join(' ') }], actions: (r) => `<button class="btn xs ghost" data-go="#/roles">Open roles</button>`, toolbar: `<button class="btn ghost" data-go="#/roles">${ic('shield')}Roles &amp; Access</button>` })}</div>`;
      if (tabId === 'intg') {
        const intg = d.cmdb.intg;
        return note('Integration settings — link CMDB CIs to the rest of the ERP by id, never by re-typing master data.') +
          `<div class="card">${UI.table({ id: 'cmAdmIntg', rows: () => Object.keys(intg).map((k) => Object.assign({ id: k }, intg[k])), sort: 'id', text: (r) => r.label + r.note, cols: [{ k: 'label', label: 'ERP module', render: (r) => `<b>${esc(r.label)}</b><br><small>${esc(r.note)}</small>` }, { k: 'ref', label: 'Link key' }, { k: 'linked', label: 'Linked', render: (r) => P(r.linked === 'Yes' ? 'Accepted' : 'Draft') }], actions: (r) => `<button class="btn xs ${r.linked === 'Yes' ? 'ghost' : ''}" data-act="intg.toggle" data-k="${r.id}">${r.linked === 'Yes' ? 'Disable' : 'Enable'}</button>`, toolbar: `<button class="btn" data-act="cmdb.intg">${ic('link')}Edit integrations</button>` })}</div>`;
      }
      if (tabId === 'notif') {
        const n = d.cmdb.notif;
        return `<div class="card">${UI.table({ id: 'cmAdmNotif', rows: () => Object.keys(n).map((k) => Object.assign({ id: k }, n[k])), sort: 'id', text: (r) => r.label, cols: [{ k: 'label', label: 'Notification' }, { k: 'on', label: 'Enabled', render: (r) => P(r.on === 'Yes' ? 'Accepted' : 'Draft') }], actions: () => '', toolbar: `<button class="btn" data-act="cmdb.notif">${ic('bell')}Edit notifications</button>` })}</div>`;
      }
      // alog
      const al = d.cmdb.auditLog;
      return note(`Audit log settings — activity tracking is <b>${al.enabled === 'Yes' ? 'on' : 'off'}</b>, retained for <b>${esc(al.retention)}</b>.`) +
        `<div class="card"><div style="margin-bottom:10px"><button class="btn" data-act="cmdb.alog">${ic('filePlus')}Edit audit log settings</button></div>${UI.table({ id: 'cmAdmLog', rows: () => d.cmdbActivity, sort: 'at', dir: -1, text: (r) => r.action + r.detail + r.by, filters: [{ k: 'by', label: 'By', options: () => uniq(d.cmdbActivity.map((x) => x.by)) }], cols: [{ k: 'at', label: 'When', render: (r) => fdt(r.at) }, { k: 'by', label: 'User' }, { k: 'action', label: 'Action' }, { k: 'detail', label: 'Detail' }], actions: () => '' })}</div>`;
    }

    return '<div class="empty">Section not found</div>';
  }

  /* small name resolvers used above */
  function svcName(id) { const s = svcById(id); return s ? s.name : (id || '—'); }
  function dsName(id) { const s = D().discSources.find((x) => x.id === id); return s ? s.name : (id || '—'); }
  function blName(id) { const b = D().baselines.find((x) => x.id === id); return b ? b.name : (id || '—'); }
  function audName(id) { const a = D().audits.find((x) => x.id === id); return a ? a.name : (id || '—'); }
  UI.on('dep.del', async (el) => { if (!ITMS.canDelete()) return UI.toast('Only Administrator can delete records', 'err'); if (await UI.confirm('Remove this service dependency?', 'Remove', true)) { D().svcDeps = D().svcDeps.filter((x) => x.id !== el.dataset.id); logAct('Service dependency removed', el.dataset.id); S.emit(); } });
  UI.on('ssla.del', async (el) => { if (!ITMS.canDelete()) return UI.toast('Only Administrator can delete records', 'err'); if (await UI.confirm('Remove this service-level link?', 'Remove', true)) { D().svcSla = D().svcSla.filter((x) => x.id !== el.dataset.id); logAct('Service-level link removed', el.dataset.id); S.emit(); } });

  /* =====================================================================
     PAGE
     ===================================================================== */
  pages.cmdb = {
    title: 'Configuration Management (CMDB)',
    crumb: 'ITIL Service Configuration Management — CIs, relationships, services, discovery, baselines and audits',
    icon: 'cpu', color: '#2f6bff',
    render() {
      const d = D();
      const sec = SECTIONS.find((x) => x.id === (UI.tab.cmdb || 'overview')) || SECTIONS[0];
      const tabId = sec.tabs.some((t) => t.id === UI.tab.cmdbSub) ? UI.tab.cmdbSub : sec.tabs[0].id;
      UI.tab.cmdb = sec.id; UI.tab.cmdbSub = tabId;
      let body;
      try { body = tab(sec.id, tabId); } catch (e) { console.error('CMDB tab error', e); body = `<div class="card"><div class="empty"><b>This view could not render</b>${esc(e.message)}</div></div>`; }
      return `<div class="note-box" style="margin-bottom:10px"><b>Configuration Management (CMDB — Configuration Management Database)</b> — the ITIL 4 Service Configuration Management practice. Every configuration item, its relationships, the services it supports and its governance history live here; changes, incidents and assets link back by id.</div>
      ${UI.tabs('cmdb', SECTIONS.map((s) => ({ id: s.id, label: s.label })))}
      <div class="card" style="margin-top:10px">${UI.tabs('cmdbSub', sec.tabs.map((t) => ({ id: t.id, label: t.label })))}<div style="margin-top:12px">${body}</div></div>`;
    },
    after() {
      document.querySelectorAll('select[data-cm]').forEach((s) => {
        s.onchange = () => { UI.tab['cmdb_' + s.dataset.cm] = s.value; S.emit(); };
      });
    },
  };

  ITMS.cmdb = { ensureCmdb, SECTIONS, classOf, missingFields, dqScore, overallDq };
})();

/* ITMS IT Budget — plan vs actual, current vs previous year, variance analysis */
(function () {
  const ITMS = window.ITMS, L = ITMS.logic, UI = ITMS.ui, S = ITMS.store, pages = (ITMS.pages = ITMS.pages || {});
  const { esc, fmtNum, money, pill, icon: ic } = UI;
  const fmtD = (s) => UI.fmtDate(s);
  const db = () => S.db;

  const CATS = ['Hardware', 'Software & Licences', 'Consumables', 'AMC & Maintenance', 'Network & Infrastructure', 'Cloud & Services', 'Security', 'Staffing & Training', 'Other'];
  const CAT_COLOR = { 'Hardware': '#2f6bff', 'Software & Licences': '#1d4ed8', 'Consumables': '#00a8e8', 'AMC & Maintenance': '#10d9a0', 'Network & Infrastructure': '#3b82f6', 'Cloud & Services': '#00c2ff', 'Security': '#ff5c6c', 'Staffing & Training': '#5b8def', 'Other': '#64748b' };

  function ensure() {
    const d = db(); if (!d) return;
    if (!d.budgets) d.budgets = [];
    if (!d.budgetSeeded && (d.employees || []).length) {
      const cur = new Date().getFullYear();
      const sample = {};
      sample[cur - 1] = { 'Hardware': 180000, 'Software & Licences': 90000, 'Consumables': 18000, 'AMC & Maintenance': 35000, 'Network & Infrastructure': 45000, 'Cloud & Services': 60000, 'Security': 30000, 'Staffing & Training': 25000, 'Other': 12000 };
      sample[cur] = { 'Hardware': 210000, 'Software & Licences': 105000, 'Consumables': 20000, 'AMC & Maintenance': 42000, 'Network & Infrastructure': 55000, 'Cloud & Services': 75000, 'Security': 40000, 'Staffing & Training': 30000, 'Other': 15000 };
      Object.keys(sample).forEach((y) => {
        CATS.forEach((c) => {
          d.budgets.push({ id: 'BG-' + y + '-' + c.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X'), year: +y, category: c, planned: sample[y][c] || 0, extra: 0, notes: 'Sample budget — edit me' });
        });
      });
      d.budgetSeeded = true;
    }
  }
  const oi = S.init; S.init = function () { oi.apply(S, arguments); ensure(); }; S.subscribe(ensure);

  /* ---------- actuals computed live from POs + AMCs ---------- */
  function lineCat(itemType) {
    if (itemType === 'Hardware') return 'Hardware';
    if (itemType === 'Software') return 'Software & Licences';
    if (itemType === 'Consumable') return 'Consumables';
    return 'Other';
  }
  function actualsByYear(year) {
    const out = {}; CATS.forEach((c) => (out[c] = 0));
    const d = db();
    (d.pos || []).forEach((p) => {
      if (!p.date || !String(p.date).startsWith(String(year))) return;
      if (p.approval === 'Cancelled' || p.approval === 'Rejected') return;
      (p.lines || []).forEach((l) => {
        const t = L.lineTotals(p, l);
        out[lineCat(l.itemType)] += t.incl;
      });
    });
    (d.amcs || []).forEach((c) => {
      if (c.start && String(c.start).startsWith(String(year))) out['AMC & Maintenance'] += (+c.cost || 0);
    });
    // manual top-ups / non-PO spend recorded on the budget row itself
    (d.budgets || []).filter((b) => +b.year === +year).forEach((b) => { out[b.category] = (out[b.category] || 0) + (+b.extra || 0); });
    Object.keys(out).forEach((k) => (out[k] = Math.round(out[k] * 100) / 100));
    return out;
  }
  function plannedByYear(year) {
    const out = {}; CATS.forEach((c) => (out[c] = 0));
    (db().budgets || []).filter((b) => +b.year === +year).forEach((b) => { out[b.category] += (+b.planned || 0); });
    return out;
  }
  function years() {
    const s = new Set((db().budgets || []).map((b) => +b.year));
    (db().pos || []).forEach((p) => { if (p.date) s.add(+String(p.date).slice(0, 4)); });
    if (!s.size) s.add(new Date().getFullYear());
    return [...s].sort();
  }

  ITMS.budget = { CATS, actualsByYear, plannedByYear, years };

  /* ---------- page ---------- */
  pages.budget = {
    title: 'IT Budget', crumb: 'Set the plan, track actuals live from POs + AMCs, compare years and variances', icon: 'trend', color: '#00a8e8', group: 'Governance',
    render() {
      const d = db();
      const ys = years();
      let yr = +(ITMS.nav.params.year || ys[ys.length - 1]);
      if (!ys.includes(yr)) yr = ys[ys.length - 1];
      const prev = ys.filter((y) => y < yr).pop();
      const planned = plannedByYear(yr), actual = actualsByYear(yr);
      const pPrev = prev ? plannedByYear(prev) : null, aPrev = prev ? actualsByYear(prev) : null;
      const totP = CATS.reduce((s, c) => s + (planned[c] || 0), 0);
      const totA = CATS.reduce((s, c) => s + (actual[c] || 0), 0);
      const totPrevP = prev ? CATS.reduce((s, c) => s + (pPrev[c] || 0), 0) : 0;
      const totPrevA = prev ? CATS.reduce((s, c) => s + (aPrev[c] || 0), 0) : 0;
      const util = totP ? (totA / totP) * 100 : 0;

      const rows = CATS.map((c) => {
        const p = planned[c] || 0, a = actual[c] || 0, v = Math.round((p - a) * 100) / 100;
        const vp = p ? Math.round((v / p) * 1000) / 10 : 0;
        const pp = prev ? pPrev[c] || 0 : 0, ap = prev ? aPrev[c] || 0 : 0;
        const yoyP = pp ? Math.round(((p - pp) / pp) * 1000) / 10 : null;
        const yoyA = ap ? Math.round(((a - ap) / ap) * 1000) / 10 : null;
        const st = a > p && p > 0 ? pill('Over budget', 'coral') : !p ? pill('No budget', 'grey') : util >= 0 && a / (p || 1) >= 0.9 ? pill('Watch', 'amber') : pill('On track', 'mint');
        return { c, p, a, v, vp, pp, ap, yoyP, yoyA, st };
      });

      const barItems = CATS.map((c) => ({ label: c, value: planned[c] || 0, color: CAT_COLOR[c] }));
      const barA = CATS.map((c) => ({ label: c, value: actual[c] || 0, color: CAT_COLOR[c] }));
      const donut = [
        { label: 'Spent', value: Math.round(totA), color: util > 100 ? '#ff5c6c' : '#00c2ff' },
        { label: 'Remaining', value: Math.max(0, Math.round(totP - totA)), color: '#ecebfb' },
      ];

      const yoyLine = (v) => (v == null ? '<span style="color:var(--muted)">–</span>' : `<b style="color:${v > 0 ? '#10d9a0' : v < 0 ? '#ff5c6c' : 'inherit'}">${v > 0 ? '+' : ''}${v}%</b>`);

      return `
      <div class="hero"><div class="gem" style="width:56px;height:56px;border-radius:18px;background:rgba(255,255,255,.22)">${ic('trend')}</div>
        <div><h1>IT Budget ${yr}${prev ? ` <small style="font-weight:500;opacity:.75">vs ${prev}</small>` : ''}</h1>
        <p>${esc(d.company.name)} · ${esc(d.company.currency)} · Actuals computed live from approved POs + AMC contracts + manual adjustments</p></div>
        <div class="hbtns"><select class="in" id="byr" style="min-width:130px">${ys.map((y) => `<option value="${y}" ${y === yr ? 'selected' : ''}>FY ${y}</option>`).join('')}</select>
        <button class="btn" data-act="bg.new" data-year="${yr}">${ic('plus')}Set budget line</button>
        <button class="btn ghost" data-act="bg.copy" data-year="${yr}">${ic('download')}Copy ${prev || yr - 1} → ${yr}</button>
        <button class="btn ghost" data-act="bg.print" data-year="${yr}">${ic('print')}Report</button></div></div>

      <div class="grid g4">
        <div class="card kpi tilt" style="--c:#00a8e8"><div class="gem">${ic('tag')}</div><div><div class="v">${money(Math.round(totP), d.company.currency)}</div><div class="l">Planned ${yr}</div><div class="s">${prev ? `FY ${prev}: ${money(Math.round(totPrevP), '')} (${totPrevP ? (((totP - totPrevP) / totPrevP) * 100).toFixed(1) : '–'}%)` : 'No previous year'}</div></div></div>
        <div class="card kpi tilt" style="--c:${util > 100 ? '#ff5c6c' : '#2f6bff'}"><div class="gem">${ic('cart')}</div><div><div class="v">${money(Math.round(totA), d.company.currency)}</div><div class="l">Actual ${yr} (live)</div><div class="s">${prev ? `FY ${prev}: ${money(Math.round(totPrevA), '')}` : 'POs + AMC + adjustments'}</div></div></div>
        <div class="card kpi tilt" style="--c:${totP - totA < 0 ? '#ff5c6c' : '#10d9a0'}"><div class="gem">${ic('check')}</div><div><div class="v">${money(Math.round(totP - totA), d.company.currency)}</div><div class="l">Variance (P − A)</div><div class="s">${totP ? ((totP - totA) / totP * 100).toFixed(1) + '% of plan remaining' : 'Set a plan first'}</div></div></div>
        <div class="card kpi tilt" style="--c:#ffb020"><div class="gem">${ic('clock')}</div><div><div class="v">${util.toFixed(1)}%</div><div class="l">Budget utilisation</div><div class="s">${util > 100 ? 'Over budget — review spend' : util >= 90 ? 'Almost fully utilised' : 'Within plan'}</div></div></div>
      </div>

      <div class="grid g-main mt">
        <div class="card glow" style="--c:#00a8e8"><h3><span class="pip"></span>Planned vs Actual by category — FY ${yr}<span class="tag">${esc(d.company.currency)}</span></h3>
          ${rows.map((r) => `<div style="display:grid;grid-template-columns:170px 1fr 120px;gap:10px;align-items:center;margin:8px 0"><span style="font-size:12.5px;font-weight:600">${esc(r.c)}</span>
            <div><div class="bar3" style="height:12px"><i style="--c:${CAT_COLOR[r.c]};width:${totP ? Math.max(2, (r.p / Math.max(totP, totA)) * 100) : 0}%;opacity:.45" title="Planned ${fmtNum(r.p, 0)}"></i></div>
            <div class="bar3" style="height:12px;margin-top:3px"><i style="--c:${r.a > r.p && r.p > 0 ? '#ff5c6c' : CAT_COLOR[r.c]};width:${Math.max(totP, totA) ? Math.max(2, (r.a / Math.max(totP, totA)) * 100) : 0}%" title="Actual ${fmtNum(r.a, 0)}"></i></div></div>
            <span style="font-size:12px;text-align:right"><b>P:</b> ${fmtNum(Math.round(r.p))}<br><b>A:</b> ${fmtNum(Math.round(r.a))}</span></div>`).join('')}
          <div class="legend"><span><i style="--c:#b9c6e8;opacity:.6"></i>Planned (faded)</span><span><i style="--c:#00a8e8"></i>Actual (solid · red when over)</span></div></div>
        <div class="card glow" style="--c:#2f6bff"><h3><span class="pip"></span>Overall utilisation</h3><div style="text-align:center">${UI.ring(Math.min(100, util), util > 100 ? '#ff5c6c' : '#00c2ff', util.toFixed(0) + '%')}<div style="font-weight:700;margin-top:6px">${money(Math.round(totA))} of ${money(Math.round(totP))}</div><small style="color:var(--muted)">Planned vs Actual · FY ${yr}</small></div>
          <h3 style="margin-top:14px"><span class="pip" style="--c:#10d9a0"></span>How actuals are built</h3><small style="color:var(--muted)">PO lines (incl. VAT) grouped by item type → Hardware / Software / Consumables · AMC contract value → AMC &amp; Maintenance · anything else + your manual “additional actual” → its category. Edit a row to add off-system spend.</small></div>
      </div>

      <div class="card mt"><h3><span class="pip"></span>Year-on-year comparison ${prev ? `— FY ${prev} vs FY ${yr}` : ''}<span class="tag">P = planned · A = actual · Var = P − A</span></h3>
        <div class="twrap"><table class="t"><thead><tr><th>Category</th><th class="num">P ${prev || ''}</th><th class="num">A ${prev || ''}</th><th class="num">P ${yr}</th><th class="num">A ${yr}</th><th class="num">Var ${yr}</th><th class="num">Var %</th><th>Status</th><th class="num">Δ Planned YoY</th><th class="num">Δ Actual YoY</th></tr></thead><tbody>
        ${rows.map((r) => `<tr><td><b>${esc(r.c)}</b></td><td class="num">${prev ? fmtNum(Math.round(r.pp)) : '–'}</td><td class="num">${prev ? fmtNum(Math.round(r.ap)) : '–'}</td><td class="num"><b>${fmtNum(Math.round(r.p))}</b></td><td class="num"><b>${fmtNum(Math.round(r.a))}</b></td><td class="num" style="color:${r.v < 0 ? 'var(--coral)' : 'var(--mint)'}"><b>${fmtNum(Math.round(r.v))}</b></td><td class="num">${r.p ? r.vp + '%' : '–'}</td><td>${r.st}</td><td class="num">${prev ? yoyLine(r.yoyP) : '–'}</td><td class="num">${prev ? yoyLine(r.yoyA) : '–'}</td></tr>`).join('')}
        </tbody><tfoot><tr><td><b>Total (${esc(d.company.currency)})</b></td><td class="num"><b>${prev ? fmtNum(Math.round(totPrevP)) : '–'}</b></td><td class="num"><b>${prev ? fmtNum(Math.round(totPrevA)) : '–'}</b></td><td class="num"><b>${fmtNum(Math.round(totP))}</b></td><td class="num"><b>${fmtNum(Math.round(totA))}</b></td><td class="num"><b>${fmtNum(Math.round(totP - totA))}</b></td><td class="num"><b>${totP ? (((totP - totA) / totP) * 100).toFixed(1) + '%' : '–'}</b></td><td>${util > 100 ? pill('Over budget', 'coral') : pill('Within plan', 'mint')}</td><td class="num">${prev && totPrevP ? yoyLine(Math.round(((totP - totPrevP) / totPrevP) * 1000) / 10) : '–'}</td><td class="num">${prev && totPrevA ? yoyLine(Math.round(((totA - totPrevA) / totPrevA) * 1000) / 10) : '–'}</td></tr></tfoot></table></div></div>

      <div class="card mt">${UI.table({
        id: 'bg', rows: () => d.budgets.filter((b) => +b.year === +yr), sort: 'category',
        text: (r) => [r.id, r.category, r.notes].join(' '),
        filters: [{ k: 'category', label: 'Category', options: CATS }],
        cols: [
          { k: 'id', label: 'ID', mono: true }, { k: 'category', label: 'Category', render: (r) => `<b>${esc(r.category)}</b>` },
          { k: 'planned', label: 'Planned', num: true, render: (r) => fmtNum(+r.planned || 0, 2) },
          { k: 'live', label: 'Live actual (PO+AMC)', num: true, val: (r) => { const a = actualsByYear(yr); return Math.round((a[r.category] - (+r.extra || 0)) * 100) / 100; }, render: (r) => fmtNum(actual[r.category] - (+r.extra || 0), 2) },
          { k: 'extra', label: 'Additional actual', num: true, render: (r) => fmtNum(+r.extra || 0, 2) },
          { k: 'actual', label: 'Total actual', num: true, val: (r) => actual[r.category] || 0, render: (r) => `<b>${fmtNum(actual[r.category] || 0, 2)}</b>` },
          { k: 'var', label: 'Difference (P−A)', num: true, val: (r) => Math.round(((+r.planned || 0) - (actual[r.category] || 0)) * 100) / 100, render: (r) => { const v = (+r.planned || 0) - (actual[r.category] || 0); return `<b style="color:${v < 0 ? 'var(--coral)' : 'var(--mint)'}">${fmtNum(v, 2)}</b>`; } },
          { k: 'notes', label: 'Notes' },
        ],
        actions: (r) => `<button class="ibtn" data-act="bg.edit" data-id="${r.id}" title="Edit">${ic('edit')}</button>${(typeof ITMS!=='undefined'&&ITMS.canDelete&&ITMS.canDelete())?'<button class="ibtn" style="--c:#ff5c6c" data-act="bg.del" data-id="'+r.id+'" title="Delete (Admin only)">'+ic('trash')+'</button>':''}`,
        toolbar: `<button class="btn" data-act="bg.new" data-year="${yr}">${ic('plus')}Set budget line</button>`,
        foot: (rr) => `<tr><td colspan="2">Total FY ${yr}</td><td class="num">${fmtNum(rr.reduce((s, r) => s + (+r.planned || 0), 0), 2)}</td><td></td><td></td><td class="num">${fmtNum(totA, 2)}</td><td class="num">${fmtNum(totP - totA, 2)}</td><td></td></tr>`,
      })}</div>`;
    },
    after() {
      const s = document.getElementById('byr');
      if (s) s.addEventListener('change', () => { location.hash = '#/budget?year=' + s.value; });
    },
  };

  const bgFields = (yr) => [
    { k: 'year', label: 'Financial year', type: 'number', req: true, min: 2000 },
    { k: 'category', label: 'Category', type: 'select', blank: false, options: CATS, req: true },
    { k: 'planned', label: 'Planned budget (' + db().company.currency + ')', type: 'number', step: '0.01', min: 0, req: true },
    { k: 'extra', label: 'Additional actual — off-system spend', type: 'number', step: '0.01', hint: 'Added to live PO+AMC actual' },
    { k: 'notes', label: 'Notes / assumptions', full: true },
  ];
  UI.on('bg.new', (el) => {
    const yr = +(el.dataset.year || new Date().getFullYear());
    UI.form({ title: 'Set budget line', sub: 'FY ' + yr, icon: 'trend', fields: bgFields(yr), values: { year: yr, category: 'Hardware', planned: 0, extra: 0 }, onSubmit: (v) => {
      v.year = +v.year; v.planned = +v.planned || 0; v.extra = +v.extra || 0;
      if (db().budgets.some((b) => +b.year === v.year && b.category === v.category)) throw new Error('That category already has a line for FY ' + v.year + ' — edit it instead.');
      v.id = 'BG-' + v.year + '-' + String(db().budgets.length + 1).padStart(3, '0');
      db().budgets.push(v); L.log('Budget', `FY ${v.year} ${v.category} planned ${v.planned}`, v.id); S.emit(); UI.toast('Budget line saved');
    } });
  });
  UI.on('bg.edit', (el) => {
    const b = db().budgets.find((x) => x.id === el.dataset.id);
    UI.form({ title: 'Edit ' + b.id, sub: `FY ${b.year} · ${b.category}`, icon: 'edit', fields: bgFields(b.year), values: b, onSubmit: (v) => { Object.assign(b, { year: +v.year, category: v.category, planned: +v.planned || 0, extra: +v.extra || 0, notes: v.notes }); S.emit(); UI.toast('Budget updated'); } });
  });
  UI.on('bg.del', async (el) => { if (!ITMS.canDelete()) return UI.toast('Only Administrator can delete records', 'err'); if (await UI.confirm('Delete this budget line?', 'Delete', true)) { db().budgets = db().budgets.filter((x) => x.id !== el.dataset.id); S.emit(); } });
  UI.on('bg.copy', async (el) => {
    const yr = +el.dataset.year; const ys = years().filter((y) => y < yr); const src = ys[ys.length - 1] || yr - 1;
    if (!await UI.confirm(`Copy all FY ${src} planned figures to FY ${yr}? Existing FY ${yr} lines are kept.`, 'Copy')) return;
    const have = new Set(db().budgets.filter((b) => +b.year === yr).map((b) => b.category));
    db().budgets.filter((b) => +b.year === src).forEach((b) => {
      if (!have.has(b.category)) db().budgets.push({ id: 'BG-' + yr + '-' + String(db().budgets.length + 1).padStart(3, '0'), year: yr, category: b.category, planned: +b.planned || 0, extra: 0, notes: 'Carried from FY ' + src });
    });
    S.emit(); UI.toast('Budget copied');
  });
  UI.on('bg.print', (el) => {
    const yr = +el.dataset.year; const prev = years().filter((y) => y < yr).pop();
    const planned = plannedByYear(yr), actual = actualsByYear(yr);
    const totP = CATS.reduce((s, c) => s + (planned[c] || 0), 0), totA = CATS.reduce((s, c) => s + (actual[c] || 0), 0);
    UI.doc('IT Budget Report FY ' + yr, `${UI.docHead('IT Budget Report — FY ' + yr)}<div class="meta"><div><b>Company:</b>${esc(db().company.name)}</div><div><b>Currency:</b>${esc(db().company.currency)}</div><div><b>Date:</b>${fmtD(L.today())}</div><div><b>Compared with:</b>${prev ? 'FY ' + prev : '—'}</div></div>
    <table><thead><tr><th>Category</th><th class="r">Planned</th><th class="r">Actual</th><th class="r">Difference</th><th class="r">Var %</th></tr></thead><tbody>
    ${CATS.map((c) => { const p = planned[c] || 0, a = actual[c] || 0, v = p - a; return `<tr><td>${esc(c)}</td><td class="r">${fmtNum(p, 2)}</td><td class="r">${fmtNum(a, 2)}</td><td class="r">${fmtNum(v, 2)}</td><td class="r">${p ? ((v / p) * 100).toFixed(1) + '%' : '–'}</td></tr>`; }).join('')}
    </tbody><tfoot><tr><td><b>Total</b></td><td class="r"><b>${fmtNum(totP, 2)}</b></td><td class="r"><b>${fmtNum(totA, 2)}</b></td><td class="r"><b>${fmtNum(totP - totA, 2)}</b></td><td></td></tr></tfoot></table>
    <p><b>Method:</b> Actuals = approved PO lines (incl. VAT) + AMC contract values starting in FY ${yr} + manual additional actuals. Amount in words (planned total): ${esc(UI.amountWords(totP, db().company.currency))}.</p><div class="sig"><div>Prepared by (IT)</div><div>Finance approval</div><div>Management approval</div></div>`);
  });
})();

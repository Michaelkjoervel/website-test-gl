/* ============================================================
   views.js — Page views for Green Light Tidstracking
   ============================================================ */

/* ----------------- LOGIN ----------------- */
function viewLogin() {
  const users = DB.Users.list();
  return `
    <div class="login-page">
      <div class="login-card">
        <div class="login-brand">
          <div class="brand-dot">gl</div>
          <div>
            <h1>green light a/s</h1>
            <p>Tidstracking</p>
          </div>
        </div>
        <div class="login-title">Velkommen tilbage</div>
        <div class="login-sub">Log ind med dine initialer for at fortsætte.</div>

        <form id="login-form" class="form">
          <div class="field">
            <label for="initials">Initialer</label>
            <input id="initials" name="initials" autocomplete="off" autocapitalize="characters"
                   placeholder="fx MKJ" maxlength="4" required />
            <div class="hint">Tryk på dine initialer nedenfor for hurtig login.</div>
          </div>
          <button class="btn btn-primary btn-block" type="submit">Log ind</button>
        </form>

        <div class="section-title" style="margin-top:24px;">Hurtigt valg</div>
        <div class="initials-grid">
          ${users.map(u => `
            <div class="initials-pill ${u.role === 'admin' ? 'admin' : ''}" data-action="quick-login" data-initials="${UI.attr(u.initials)}">
              ${UI.escapeHtml(u.initials)}
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

/* ----------------- DASHBOARD ----------------- */
function viewDashboard(user) {
  const cases = DB.Cases.list();
  const activeCases = cases.filter(c => c.status === 'Aktiv' || c.status === 'På pause');
  const closedCases = cases.filter(c => ['Vundet','Tabt','Afsluttet'].includes(c.status));

  const avgAll = DB.Calc.averageHoursPerCase(cases);
  const avgActive = DB.Calc.averageHoursPerCase(activeCases);
  const avgClosed = DB.Calc.averageHoursPerCase(closedCases);
  const avgSales = DB.Calc.averageDeptHoursPerCase('Salg', cases);
  const avgTech  = DB.Calc.averageDeptHoursPerCase('Teknisk afdeling', cases);
  const ratio = (avgTech > 0) ? (avgSales / avgTech).toFixed(2).replace('.', ',') : '—';
  const avgPo = DB.Calc.averageTimeToPo(cases);

  const hoursByDept = DB.Calc.hoursByDepartment();
  const casesByPhase = DB.Calc.casesByPhase();
  const top = DB.Calc.topCasesByHours(10, cases);
  const recent = DB.TimeEntries.list().slice(0, 10);

  const myFavCases = cases.filter(c => c.favorite).slice(0, 5);

  return `
    <div class="page-header">
      <div>
        <div class="page-title">Dashboard</div>
        <div class="page-subtitle">Hej ${UI.escapeHtml(user.initials)} — overblik over sager og tidsforbrug.</div>
      </div>
      <div class="flex-row">
        <a href="#/cases/new" class="btn btn-primary">+ Ny sag</a>
        <a href="#/time" class="btn btn-accent">Registrér tid</a>
      </div>
    </div>

    <!-- Quick time entry -->
    <div class="quick-time" style="margin-bottom:20px;">
      <div class="card-header" style="margin-bottom:10px;">
        <div>
          <div class="card-title">Hurtig tidsregistrering</div>
          <div class="card-subtitle">Vælg sag, antal timer og kort note. Gemmes med dags dato.</div>
        </div>
      </div>
      <form id="quick-time-form" class="quick-time-row">
        <div class="field">
          <label>Sag</label>
          <select name="case_id" required>${UI.caseOptions(null, { includeBlank: true })}</select>
        </div>
        <div class="field">
          <label>Timer</label>
          <input name="hours" type="text" inputmode="decimal" placeholder="0,5" required />
        </div>
        <div class="field">
          <label>Note</label>
          <input name="description" type="text" placeholder="Kort beskrivelse" />
        </div>
        <button class="btn btn-primary" type="submit">Gem</button>
      </form>
    </div>

    <!-- KPI -->
    <div class="kpi-grid">
      ${UI.KpiCard({ label: 'Aktive sager', value: activeCases.length, sub: `${cases.length} sager total`, accent: true })}
      ${UI.KpiCard({ label: 'Gennemsnit per sag', value: Fmt.formatHours(avgAll), unit: 't', sub: `Aktive ${Fmt.formatHours(avgActive)} t · Afsluttede ${Fmt.formatHours(avgClosed)} t` })}
      ${UI.KpiCard({ label: 'Gns. salgstid/sag', value: Fmt.formatHours(avgSales), unit: 't', sub: `Teknisk: ${Fmt.formatHours(avgTech)} t · Salg/Teknisk: ${ratio}` })}
      ${UI.KpiCard({ label: 'Gns. time to PO', value: avgPo === null ? '—' : Fmt.formatHours(avgPo), unit: avgPo === null ? '' : 'dage', sub: avgPo === null ? 'Der er endnu ikke nok data til at beregne gennemsnitlig time to PO.' : '' })}
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <div class="card-title">Timer fordelt på afdeling</div>
          <div class="card-subtitle">Samlet på alle sager</div>
        </div>
        ${UI.BarChart(hoursByDept)}
      </div>
      <div class="card">
        <div class="card-header">
          <div class="card-title">Sager fordelt på fase</div>
        </div>
        ${UI.BarChartCount(casesByPhase)}
      </div>
    </div>

    <div style="height:16px;"></div>

    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <div class="card-title">Top 10 sager efter tidsforbrug</div>
        </div>
        ${top.length === 0 ? UI.EmptyState('Ingen sager endnu.') : `
          <div class="table-wrap" style="border:none;">
            <table class="gl">
              <thead><tr><th>Sag</th><th>Kunde</th><th>Status</th><th class="right">Timer</th></tr></thead>
              <tbody>
                ${top.map(c => `
                  <tr data-href="#/cases/${UI.attr(c.id)}">
                    <td><b>${UI.escapeHtml(c.title)}</b><div class="muted small">${UI.escapeHtml(c.case_number)}</div></td>
                    <td>${UI.escapeHtml(c.customer_name)}</td>
                    <td>${UI.StatusBadge(c.status)}</td>
                    <td class="right num">${Fmt.formatHours(c.totalHours)} t</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
      <div class="card">
        <div class="card-header">
          <div class="card-title">Seneste aktivitet</div>
          <div class="card-subtitle">10 seneste tidsregistreringer</div>
        </div>
        ${recent.length === 0 ? UI.EmptyState('Ingen tidsregistreringer endnu.') : `
          <div class="activity-list">
            ${recent.map(e => {
              const c = DB.Cases.get(e.case_id);
              const u = DB.Users.get(e.user_id);
              return `
                <div class="activity-item" ${c ? `data-href="#/cases/${UI.attr(c.id)}" style="cursor:pointer;"` : ''}>
                  <div class="icon-circle">${UI.escapeHtml(u ? u.initials : '?')}</div>
                  <div class="activity-meta">
                    <div class="activity-title">${Fmt.formatHours(e.hours)} t på ${UI.escapeHtml(c ? c.title : 'sag slettet')}</div>
                    <div class="activity-sub">${UI.escapeHtml(e.department)} · ${UI.escapeHtml(e.phase)} · ${Fmt.formatDate(e.entry_date)}${e.description ? ' · ' + UI.escapeHtml(e.description) : ''}</div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    </div>

    ${myFavCases.length ? `
      <div style="height:16px;"></div>
      <div class="card">
        <div class="card-header"><div class="card-title">★ Favorit-sager</div></div>
        <div class="activity-list">
          ${myFavCases.map(c => `
            <div class="activity-item" data-href="#/cases/${UI.attr(c.id)}" style="cursor:pointer;">
              <div class="icon-circle">★</div>
              <div class="activity-meta">
                <div class="activity-title">${UI.escapeHtml(c.title)}</div>
                <div class="activity-sub">${UI.escapeHtml(c.customer_name)} · ${UI.escapeHtml(c.phase)} · ${UI.StatusBadge(c.status)}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
  `;
}

/* ----------------- CASES LIST ----------------- */
function viewCases(filters = {}) {
  const all = DB.Cases.list();
  let filtered = all;

  if (filters.q) {
    const q = filters.q.toLowerCase();
    filtered = filtered.filter(c =>
      c.title.toLowerCase().includes(q) ||
      c.customer_name.toLowerCase().includes(q) ||
      (c.case_number || '').toLowerCase().includes(q)
    );
  }
  if (filters.status) filtered = filtered.filter(c => c.status === filters.status);
  if (filters.phase)  filtered = filtered.filter(c => c.phase === filters.phase);
  if (filters.dept)   filtered = filtered.filter(c => c.primary_department === filters.dept);
  if (filters.responsible) filtered = filtered.filter(c => c.responsible_user_id === filters.responsible);
  if (filters.user)   filtered = filtered.filter(c => DB.TimeEntries.byCase(c.id).some(t => t.user_id === filters.user));
  if (filters.customer) filtered = filtered.filter(c => c.customer_name.toLowerCase().includes(filters.customer.toLowerCase()));
  if (filters.dateFrom) filtered = filtered.filter(c => new Date(c.created_at) >= new Date(filters.dateFrom));
  if (filters.dateTo)   filtered = filtered.filter(c => new Date(c.created_at) <= new Date(filters.dateTo + 'T23:59:59'));
  if (filters.result === 'won')  filtered = filtered.filter(c => c.result === 'won');
  if (filters.result === 'lost') filtered = filtered.filter(c => c.result === 'lost');

  const withHours = filtered.map(c => ({ ...c, totalHours: DB.Calc.totalHoursForCase(c.id) }));

  switch (filters.sort) {
    case 'oldest': withHours.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)); break;
    case 'most_hours': withHours.sort((a, b) => b.totalHours - a.totalHours); break;
    case 'least_hours': withHours.sort((a, b) => a.totalHours - b.totalHours); break;
    case 'status': withHours.sort((a, b) => a.status.localeCompare(b.status)); break;
    case 'phase': withHours.sort((a, b) => CONSTS.PHASES.indexOf(a.phase) - CONSTS.PHASES.indexOf(b.phase)); break;
    case 'customer': withHours.sort((a, b) => a.customer_name.localeCompare(b.customer_name)); break;
    case 'newest':
    default: withHours.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  return `
    <div class="page-header">
      <div>
        <div class="page-title">Sager</div>
        <div class="page-subtitle">${all.length} sager i alt · ${filtered.length} vist</div>
      </div>
      <div class="flex-row">
        <button class="btn" data-action="export-cases">Eksportér CSV</button>
        <a href="#/cases/new" class="btn btn-primary">+ Ny sag</a>
      </div>
    </div>

    <form id="cases-filter" class="filter-panel">
      <div class="filter-field filter-search">
        <label>Søg</label>
        <input name="q" value="${UI.attr(filters.q || '')}" placeholder="Søg sagsnavn, kunde eller sagsnr." />
      </div>
      <div class="filter-field">
        <label>Status</label>
        <select name="status">${UI.statusOptions(filters.status, { includeBlank: true })}</select>
      </div>
      <div class="filter-field">
        <label>Fase</label>
        <select name="phase">${UI.phaseOptions(filters.phase, { includeBlank: true })}</select>
      </div>
      <div class="filter-field">
        <label>Afdeling</label>
        <select name="dept">${UI.deptOptions(filters.dept, { includeBlank: true })}</select>
      </div>
      <div class="filter-field">
        <label>Ansvarlig</label>
        <select name="responsible"><option value="">Alle</option>${UI.userOptions(filters.responsible)}</select>
      </div>
      <div class="filter-field">
        <label>Bruger har tid</label>
        <select name="user"><option value="">Alle</option>${UI.userOptions(filters.user)}</select>
      </div>
      <div class="filter-field">
        <label>Resultat</label>
        <select name="result">
          <option value="">Alle</option>
          <option value="won" ${filters.result === 'won' ? 'selected' : ''}>Vundet</option>
          <option value="lost" ${filters.result === 'lost' ? 'selected' : ''}>Tabt</option>
        </select>
      </div>
      <div class="filter-field">
        <label>Kunde</label>
        <input name="customer" value="${UI.attr(filters.customer || '')}" placeholder="Kundenavn" />
      </div>
      <div class="filter-field">
        <label>Fra dato</label>
        <input name="dateFrom" type="date" value="${UI.attr(filters.dateFrom || '')}" />
      </div>
      <div class="filter-field">
        <label>Til dato</label>
        <input name="dateTo" type="date" value="${UI.attr(filters.dateTo || '')}" />
      </div>
      <div class="filter-field">
        <label>Sortér</label>
        <select name="sort">
          <option value="newest" ${filters.sort === 'newest' || !filters.sort ? 'selected' : ''}>Nyeste først</option>
          <option value="oldest" ${filters.sort === 'oldest' ? 'selected' : ''}>Ældste først</option>
          <option value="most_hours" ${filters.sort === 'most_hours' ? 'selected' : ''}>Mest tid brugt</option>
          <option value="least_hours" ${filters.sort === 'least_hours' ? 'selected' : ''}>Mindst tid brugt</option>
          <option value="status" ${filters.sort === 'status' ? 'selected' : ''}>Status</option>
          <option value="phase" ${filters.sort === 'phase' ? 'selected' : ''}>Fase</option>
          <option value="customer" ${filters.sort === 'customer' ? 'selected' : ''}>Kunde</option>
        </select>
      </div>
      <div class="filter-clear">
        <button type="button" class="btn btn-ghost btn-sm" data-action="clear-filters">Nulstil</button>
      </div>
    </form>

    <div class="table-wrap">
      <table class="gl">
        <thead>
          <tr>
            <th></th>
            <th>Sag</th>
            <th>Kunde</th>
            <th>Status</th>
            <th>Fase</th>
            <th>Ansvarlig</th>
            <th>Oprettet</th>
            <th>PO-dato</th>
            <th>Afsluttet</th>
            <th class="right">Timer</th>
          </tr>
        </thead>
        <tbody>
          ${withHours.length === 0 ? `<tr><td colspan="10">${UI.EmptyState('Ingen sager matcher filtrene.')}</td></tr>` :
            withHours.map(c => {
              const resp = DB.Users.get(c.responsible_user_id);
              return `
                <tr data-href="#/cases/${UI.attr(c.id)}">
                  <td>${UI.StarBtn(c.id, c.favorite)}</td>
                  <td>
                    <b>${UI.escapeHtml(c.title)}</b>
                    <div class="muted small">${UI.escapeHtml(c.case_number)}</div>
                  </td>
                  <td>${UI.escapeHtml(c.customer_name)}</td>
                  <td>${UI.StatusBadge(c.status)}</td>
                  <td>${UI.escapeHtml(c.phase)}</td>
                  <td>${resp ? UI.escapeHtml(resp.initials) : '—'}</td>
                  <td class="small">${Fmt.formatDate(c.created_at)}</td>
                  <td class="small">${Fmt.formatDate(c.po_date)}</td>
                  <td class="small">${Fmt.formatDate(c.closed_at)}</td>
                  <td class="right num">${Fmt.formatHours(c.totalHours)} t</td>
                </tr>
              `;
            }).join('')
          }
        </tbody>
      </table>
    </div>
  `;
}

/* ----------------- CREATE CASE ----------------- */
function viewCreateCase(currentUser) {
  return `
    <div class="page-header">
      <div>
        <div class="page-title">Opret ny sag</div>
        <div class="page-subtitle">En sag oprettes som “Aktiv” med dags dato.</div>
      </div>
      <a href="#/cases" class="btn">← Tilbage</a>
    </div>

    <div class="card" style="max-width:760px;">
      <form id="create-case-form" class="form">
        <div class="form-grid">
          <div class="field">
            <label>Sagsnavn <span class="req">*</span></label>
            <input name="title" required placeholder="fx Belysning til ny produktionshal" />
          </div>
          <div class="field">
            <label>Kundenavn <span class="req">*</span></label>
            <input name="customer_name" required placeholder="fx Kunde A/S" />
          </div>
        </div>
        <div class="field">
          <label>Kort beskrivelse</label>
          <textarea name="description" placeholder="Hvad handler sagen om?"></textarea>
        </div>
        <div class="form-grid">
          <div class="field">
            <label>Ansvarlig bruger</label>
            <select name="responsible_user_id">${UI.userOptions(currentUser.id)}</select>
          </div>
          <div class="field">
            <label>Primær afdeling <span class="req">*</span></label>
            <select name="primary_department" required>${UI.deptOptions(currentUser.department)}</select>
          </div>
          <div class="field">
            <label>Startfase</label>
            <select name="phase">${UI.phaseOptions('Opstartsfase')}</select>
          </div>
          <div class="field">
            <label>Estimeret værdi (kr.)</label>
            <input name="estimated_value" type="number" min="0" step="1000" placeholder="Valgfrit" />
          </div>
        </div>
        <div class="field">
          <label>Noter</label>
          <textarea name="notes" placeholder="Valgfrit"></textarea>
        </div>
        <div class="form-actions">
          <a href="#/cases" class="btn">Annullér</a>
          <button class="btn btn-primary" type="submit">Opret sag</button>
        </div>
      </form>
    </div>
  `;
}

/* ----------------- CASE DETAIL ----------------- */
function viewCaseDetail(caseId, currentUser, tab = 'time') {
  const c = DB.Cases.get(caseId);
  if (!c) {
    return `
      <div class="page-header"><div class="page-title">Sag ikke fundet</div></div>
      <a href="#/cases" class="btn">← Tilbage til sagsoversigt</a>
    `;
  }

  const responsible = DB.Users.get(c.responsible_user_id);
  const creator = DB.Users.get(c.created_by_user_id);
  const total = DB.Calc.totalHoursForCase(caseId);
  const byDept = DB.Calc.hoursByDepartmentForCase(caseId);
  const byUser = DB.Calc.hoursByUserForCase(caseId);
  const byPhase = DB.Calc.hoursByPhaseForCase(caseId);
  const entries = DB.TimeEntries.byCase(caseId);
  const log = DB.ActivityLog.byCase(caseId);
  const comments = DB.Comments.byCase(caseId);

  const canEdit = currentUser.role === 'admin' || c.created_by_user_id === currentUser.id;
  const isOpen = ['Aktiv', 'På pause'].includes(c.status);

  // KPI cards for time
  const totalsRow = `
    <div class="kpi-grid">
      ${UI.KpiCard({ label: 'Samlet tid', value: Fmt.formatHours(total), unit: 't', accent: true })}
      ${UI.KpiCard({ label: 'Salg', value: Fmt.formatHours(byDept['Salg'] || 0), unit: 't' })}
      ${UI.KpiCard({ label: 'Teknisk', value: Fmt.formatHours(byDept['Teknisk afdeling'] || 0), unit: 't' })}
      ${UI.KpiCard({ label: 'Lager', value: Fmt.formatHours(byDept['Lager'] || 0), unit: 't' })}
      ${UI.KpiCard({ label: 'Administration', value: Fmt.formatHours(byDept['Administration'] || 0), unit: 't' })}
      ${UI.KpiCard({ label: 'Marketing', value: Fmt.formatHours(byDept['Marketing'] || 0), unit: 't' })}
      ${UI.KpiCard({ label: 'Ledelse', value: Fmt.formatHours(byDept['Ledelse'] || 0), unit: 't' })}
    </div>
  `;

  // Time entry form
  const addTimeForm = `
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">Registrér tid på sagen</div>
          <div class="card-subtitle">Automatisk tilknyttet din afdeling, kan overstyres.</div>
        </div>
      </div>
      <form id="case-time-form" class="form">
        <div class="form-grid">
          <div class="field">
            <label>Dato <span class="req">*</span></label>
            <input name="entry_date" type="date" value="${UI.attr(Fmt.todayIso())}" required />
          </div>
          <div class="field">
            <label>Timer <span class="req">*</span></label>
            <input name="hours" type="text" inputmode="decimal" placeholder="fx 1,5" required />
          </div>
          <div class="field">
            <label>Fase</label>
            <select name="phase">${UI.phaseOptions(c.phase)}</select>
          </div>
          <div class="field">
            <label>Afdeling</label>
            <select name="department">${UI.deptOptions(currentUser.department)}</select>
          </div>
        </div>
        <div class="field">
          <label>Kort beskrivelse</label>
          <input name="description" placeholder="Hvad blev der lavet?" />
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit">Gem tid</button>
        </div>
      </form>
    </div>
  `;

  // Build user-distribution dataset (for chart)
  const userHoursData = {};
  Object.entries(byUser).forEach(([uid, h]) => {
    const u = DB.Users.get(uid);
    userHoursData[u ? u.initials : 'Slettet bruger'] = h;
  });

  const tabs = `
    <div class="tabs">
      <div class="tab ${tab === 'time' ? 'active' : ''}" data-tab="time">Tidsregistreringer (${entries.length})</div>
      <div class="tab ${tab === 'breakdown' ? 'active' : ''}" data-tab="breakdown">Fordelinger</div>
      <div class="tab ${tab === 'comments' ? 'active' : ''}" data-tab="comments">Kommentarer (${comments.length})</div>
      <div class="tab ${tab === 'log' ? 'active' : ''}" data-tab="log">Aktivitetslog</div>
    </div>
  `;

  let tabBody = '';
  if (tab === 'time') {
    tabBody = `
      ${addTimeForm}
      <div style="height:16px;"></div>
      <div class="card">
        <div class="card-header"><div class="card-title">Alle tidsregistreringer</div></div>
        ${entries.length === 0 ? UI.EmptyState('Ingen tid registreret endnu.') : `
          <div class="table-wrap" style="border:none;">
            <table class="gl">
              <thead><tr><th>Dato</th><th>Bruger</th><th>Afdeling</th><th>Fase</th><th>Beskrivelse</th><th class="right">Timer</th><th></th></tr></thead>
              <tbody>
                ${entries.map(e => {
                  const u = DB.Users.get(e.user_id);
                  const canDel = currentUser.role === 'admin' || e.user_id === currentUser.id;
                  return `
                    <tr>
                      <td class="small">${Fmt.formatDate(e.entry_date)}</td>
                      <td>${u ? UI.escapeHtml(u.initials) : '—'}</td>
                      <td>${UI.DeptBadge(e.department)}</td>
                      <td class="small">${UI.escapeHtml(e.phase)}</td>
                      <td class="small">${UI.escapeHtml(e.description || '—')}</td>
                      <td class="right num">${Fmt.formatHours(e.hours)} t</td>
                      <td class="right">
                        ${canDel ? `<button class="btn btn-ghost btn-sm" data-action="delete-time" data-id="${UI.attr(e.id)}">Slet</button>` : ''}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;
  } else if (tab === 'breakdown') {
    tabBody = `
      <div class="grid-2">
        <div class="card">
          <div class="card-header"><div class="card-title">Timer pr. afdeling</div></div>
          ${UI.BarChart(byDept)}
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title">Timer pr. fase</div></div>
          ${UI.BarChart(byPhase)}
        </div>
      </div>
      <div style="height:16px;"></div>
      <div class="card">
        <div class="card-header"><div class="card-title">Timer pr. bruger</div></div>
        ${Object.keys(userHoursData).length === 0 ? UI.EmptyState('Ingen tid registreret.') : UI.BarChart(userHoursData)}
      </div>
    `;
  } else if (tab === 'comments') {
    tabBody = `
      <div class="card">
        <div class="card-header"><div class="card-title">Tilføj kommentar</div></div>
        <form id="comment-form" class="form">
          <div class="field">
            <textarea name="text" placeholder="Skriv en kommentar..." required></textarea>
          </div>
          <div class="form-actions">
            <button class="btn btn-primary" type="submit">Gem kommentar</button>
          </div>
        </form>
      </div>
      <div style="height:16px;"></div>
      ${comments.length === 0 ? UI.EmptyState('Ingen kommentarer endnu.') : `
        <div>
          ${comments.map(cm => {
            const u = DB.Users.get(cm.user_id);
            const canDel = currentUser.role === 'admin' || cm.user_id === currentUser.id;
            return `
              <div class="comment">
                <div class="comment-head">
                  <span class="comment-author">${u ? UI.escapeHtml(u.initials) : '—'}</span>
                  <span>${Fmt.formatDateTime(cm.created_at)}
                    ${canDel ? ` · <a href="#" data-action="delete-comment" data-id="${UI.attr(cm.id)}">Slet</a>` : ''}
                  </span>
                </div>
                <div class="comment-text">${UI.escapeHtml(cm.text)}</div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    `;
  } else if (tab === 'log') {
    tabBody = `
      <div class="card">
        <div class="card-header"><div class="card-title">Aktivitetslog</div></div>
        ${log.length === 0 ? UI.EmptyState('Ingen aktivitet endnu.') : `
          <div class="activity-list">
            ${log.map(l => {
              const u = DB.Users.get(l.user_id);
              return `
                <div class="activity-item">
                  <div class="icon-circle">${u ? UI.escapeHtml(u.initials) : '?'}</div>
                  <div class="activity-meta">
                    <div class="activity-title">${UI.escapeHtml(l.action_type)}</div>
                    <div class="activity-sub">${UI.escapeHtml(l.description)} · ${Fmt.formatDateTime(l.created_at)}</div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    `;
  }

  return `
    <div class="page-header">
      <div class="detail-head" style="margin:0;">
        <div class="crumbs"><a href="#/cases">Sager</a> · ${UI.escapeHtml(c.case_number)}</div>
        <div class="title-row">
          ${UI.StarBtn(c.id, c.favorite)}
          <h1>${UI.escapeHtml(c.title)}</h1>
          ${UI.StatusBadge(c.status)}
          <span class="customer">${UI.escapeHtml(c.customer_name)}</span>
        </div>
      </div>
      <div class="detail-actions">
        ${isOpen ? `
          <button class="btn btn-accent" data-action="mark-won" data-case="${UI.attr(c.id)}">Markér som vundet</button>
          <button class="btn" data-action="mark-lost" data-case="${UI.attr(c.id)}">Markér som tabt</button>
          <button class="btn" data-action="set-status" data-case="${UI.attr(c.id)}">Skift status</button>
        ` : `
          ${canEdit ? `<button class="btn" data-action="set-status" data-case="${UI.attr(c.id)}">Skift status</button>` : ''}
        `}
        ${currentUser.role === 'admin' ? `
          <button class="btn" data-action="edit-case" data-case="${UI.attr(c.id)}">Redigér</button>
          <button class="btn btn-danger" data-action="delete-case" data-case="${UI.attr(c.id)}">Slet</button>
        ` : ''}
      </div>
    </div>

    <div class="card" style="padding:16px 20px; margin-bottom:16px;">
      <div class="section-title">Fase</div>
      ${UI.PhaseProgress(c.phase, { caseId: c.id, interactive: canEdit })}
    </div>

    <div class="detail-meta">
      <div><div class="label">Sagsnummer</div><div class="value">${UI.escapeHtml(c.case_number)}</div></div>
      <div><div class="label">Oprettet</div><div class="value">${Fmt.formatDate(c.created_at)}</div></div>
      <div><div class="label">Oprettet af</div><div class="value">${creator ? UI.escapeHtml(creator.initials) : '—'}</div></div>
      <div><div class="label">Ansvarlig</div><div class="value">${responsible ? UI.escapeHtml(responsible.initials) : '—'}</div></div>
      <div><div class="label">Primær afdeling</div><div class="value">${UI.escapeHtml(c.primary_department)}</div></div>
      <div><div class="label">Estimeret værdi</div><div class="value">${Fmt.formatCurrency(c.estimated_value)}</div></div>
      <div><div class="label">PO-dato</div><div class="value">${Fmt.formatDate(c.po_date)}</div></div>
      <div><div class="label">Afsluttet</div><div class="value">${Fmt.formatDate(c.closed_at)}</div></div>
    </div>

    ${c.description ? `<div class="note" style="margin-bottom:16px;">${UI.escapeHtml(c.description)}</div>` : ''}
    ${c.notes ? `<div class="note" style="margin-bottom:16px;">📝 ${UI.escapeHtml(c.notes)}</div>` : ''}
    ${c.result === 'won' ? `<div class="won-info" style="margin-bottom:16px;">✓ Vundet. PO-dato: ${Fmt.formatDate(c.po_date)}</div>` : ''}
    ${c.result === 'lost' ? `<div class="lost-reason" style="margin-bottom:16px;">✗ Tabt. Årsag: ${UI.escapeHtml(c.lost_reason || '—')}</div>` : ''}

    ${totalsRow}

    ${tabs}
    ${tabBody}
  `;
}

/* ----------------- TIME (all entries / quick entry) ----------------- */
function viewTime(currentUser, filters = {}) {
  const allCases = DB.Cases.list();
  let entries = DB.TimeEntries.list();

  if (filters.case_id) entries = entries.filter(e => e.case_id === filters.case_id);
  if (filters.user) entries = entries.filter(e => e.user_id === filters.user);
  if (filters.dept) entries = entries.filter(e => e.department === filters.dept);
  if (filters.phase) entries = entries.filter(e => e.phase === filters.phase);
  if (filters.dateFrom) entries = entries.filter(e => e.entry_date >= filters.dateFrom);
  if (filters.dateTo) entries = entries.filter(e => e.entry_date <= filters.dateTo);

  const total = DB.Calc.totalHours(entries);

  return `
    <div class="page-header">
      <div>
        <div class="page-title">Tidsregistrering</div>
        <div class="page-subtitle">Registrér tid på en sag — vises for alle.</div>
      </div>
      <div class="flex-row">
        <button class="btn" data-action="export-time">Eksportér CSV</button>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px;">
      <div class="card-header">
        <div>
          <div class="card-title">Ny tidsregistrering</div>
          <div class="card-subtitle">Afdeling sættes automatisk til ${UI.escapeHtml(currentUser.department)} — kan overstyres.</div>
        </div>
      </div>
      <form id="time-form" class="form">
        <div class="form-grid">
          <div class="field">
            <label>Sag <span class="req">*</span></label>
            <select name="case_id" required>${UI.caseOptions(null, { includeBlank: true })}</select>
          </div>
          <div class="field">
            <label>Dato <span class="req">*</span></label>
            <input name="entry_date" type="date" value="${UI.attr(Fmt.todayIso())}" required />
          </div>
          <div class="field">
            <label>Timer <span class="req">*</span></label>
            <input name="hours" type="text" inputmode="decimal" placeholder="fx 1,5" required />
            <div class="hint">Decimaler ok: 0,25 · 0,5 · 1 · 1,5 · 3,75</div>
          </div>
          <div class="field">
            <label>Fase</label>
            <select name="phase">${UI.phaseOptions(null, { includeBlank: true, blankLabel: 'Sagens nuværende fase' })}</select>
          </div>
          <div class="field">
            <label>Afdeling</label>
            <select name="department">${UI.deptOptions(currentUser.department)}</select>
          </div>
          <div class="field" style="grid-column: 1 / -1;">
            <label>Kort beskrivelse</label>
            <input name="description" placeholder="Hvad blev der lavet?" />
          </div>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit">Gem tid</button>
        </div>
      </form>
    </div>

    <form id="time-filter" class="filter-panel">
      <div class="filter-field filter-search">
        <label>Sag</label>
        <select name="case_id">${UI.caseOptions(filters.case_id, { includeBlank: true, blankLabel: 'Alle sager' })}</select>
      </div>
      <div class="filter-field">
        <label>Bruger</label>
        <select name="user"><option value="">Alle</option>${UI.userOptions(filters.user)}</select>
      </div>
      <div class="filter-field">
        <label>Afdeling</label>
        <select name="dept">${UI.deptOptions(filters.dept, { includeBlank: true })}</select>
      </div>
      <div class="filter-field">
        <label>Fase</label>
        <select name="phase">${UI.phaseOptions(filters.phase, { includeBlank: true })}</select>
      </div>
      <div class="filter-field">
        <label>Fra dato</label>
        <input name="dateFrom" type="date" value="${UI.attr(filters.dateFrom || '')}" />
      </div>
      <div class="filter-field">
        <label>Til dato</label>
        <input name="dateTo" type="date" value="${UI.attr(filters.dateTo || '')}" />
      </div>
      <div class="filter-clear">
        <button type="button" class="btn btn-ghost btn-sm" data-action="clear-filters">Nulstil</button>
      </div>
    </form>

    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">${entries.length} registreringer · ${Fmt.formatHours(total)} t total</div>
        </div>
      </div>
      ${entries.length === 0 ? UI.EmptyState('Ingen registreringer matcher filtrene.') : `
        <div class="table-wrap" style="border:none;">
          <table class="gl">
            <thead><tr><th>Dato</th><th>Sag</th><th>Bruger</th><th>Afdeling</th><th>Fase</th><th>Beskrivelse</th><th class="right">Timer</th><th></th></tr></thead>
            <tbody>
              ${entries.map(e => {
                const c = DB.Cases.get(e.case_id);
                const u = DB.Users.get(e.user_id);
                const canDel = currentUser.role === 'admin' || e.user_id === currentUser.id;
                return `
                  <tr>
                    <td class="small">${Fmt.formatDate(e.entry_date)}</td>
                    <td ${c ? `data-href="#/cases/${UI.attr(c.id)}" style="cursor:pointer;"` : ''}>
                      ${c ? UI.escapeHtml(c.title) : '—'}
                      <div class="muted small">${c ? UI.escapeHtml(c.customer_name) : ''}</div>
                    </td>
                    <td>${u ? UI.escapeHtml(u.initials) : '—'}</td>
                    <td>${UI.DeptBadge(e.department)}</td>
                    <td class="small">${UI.escapeHtml(e.phase)}</td>
                    <td class="small">${UI.escapeHtml(e.description || '—')}</td>
                    <td class="right num">${Fmt.formatHours(e.hours)} t</td>
                    <td class="right">
                      ${canDel ? `<button class="btn btn-ghost btn-sm" data-action="delete-time" data-id="${UI.attr(e.id)}">Slet</button>` : ''}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;
}

/* ----------------- REPORTS ----------------- */
function viewReports(filters = {}) {
  const cases = DB.Cases.list();
  const entries = DB.TimeEntries.list();

  let filteredEntries = entries;
  let filteredCases = cases;

  if (filters.dateFrom) {
    filteredEntries = filteredEntries.filter(e => e.entry_date >= filters.dateFrom);
    filteredCases = filteredCases.filter(c => c.created_at.slice(0, 10) >= filters.dateFrom || (c.closed_at && c.closed_at.slice(0,10) >= filters.dateFrom));
  }
  if (filters.dateTo) {
    filteredEntries = filteredEntries.filter(e => e.entry_date <= filters.dateTo);
    filteredCases = filteredCases.filter(c => c.created_at.slice(0,10) <= filters.dateTo || (c.closed_at && c.closed_at.slice(0,10) <= filters.dateTo));
  }

  const totalHours = DB.Calc.totalHours(filteredEntries);
  const byDept = DB.Calc.hoursByDepartment(filteredEntries);
  const byPhase = DB.Calc.hoursByPhase(filteredEntries);
  const byUser = DB.Calc.hoursByUser(filteredEntries);

  // Won/Lost hours
  const wonCaseIds = new Set(cases.filter(c => c.result === 'won').map(c => c.id));
  const lostCaseIds = new Set(cases.filter(c => c.result === 'lost').map(c => c.id));
  const wonHours = filteredEntries.filter(e => wonCaseIds.has(e.case_id)).reduce((s, e) => s + e.hours, 0);
  const lostHours = filteredEntries.filter(e => lostCaseIds.has(e.case_id)).reduce((s, e) => s + e.hours, 0);

  const avgPo = DB.Calc.averageTimeToPo(cases);
  const avgPerCase = DB.Calc.averageHoursPerCase(cases);

  const createdInPeriod = filters.dateFrom || filters.dateTo
    ? cases.filter(c => {
        const d = c.created_at.slice(0, 10);
        if (filters.dateFrom && d < filters.dateFrom) return false;
        if (filters.dateTo && d > filters.dateTo) return false;
        return true;
      }).length
    : cases.length;

  const closedInPeriod = filters.dateFrom || filters.dateTo
    ? cases.filter(c => {
        if (!c.closed_at) return false;
        const d = c.closed_at.slice(0, 10);
        if (filters.dateFrom && d < filters.dateFrom) return false;
        if (filters.dateTo && d > filters.dateTo) return false;
        return true;
      }).length
    : cases.filter(c => !!c.closed_at).length;

  const userRows = Object.entries(byUser)
    .map(([uid, h]) => ({ user: DB.Users.get(uid), h }))
    .filter(r => r.user)
    .sort((a, b) => b.h - a.h);

  return `
    <div class="page-header">
      <div>
        <div class="page-title">Rapporter</div>
        <div class="page-subtitle">Filtrér og eksportér tidsdata.</div>
      </div>
      <div class="flex-row">
        <button class="btn" data-action="export-cases">Eksportér sager (CSV)</button>
        <button class="btn" data-action="export-time">Eksportér tid (CSV)</button>
        <button class="btn btn-primary" data-action="export-dashboard">Dashboard-data (CSV)</button>
      </div>
    </div>

    <form id="reports-filter" class="filter-panel">
      <div class="filter-field">
        <label>Fra dato</label>
        <input name="dateFrom" type="date" value="${UI.attr(filters.dateFrom || '')}" />
      </div>
      <div class="filter-field">
        <label>Til dato</label>
        <input name="dateTo" type="date" value="${UI.attr(filters.dateTo || '')}" />
      </div>
      <div class="filter-clear">
        <button type="button" class="btn btn-ghost btn-sm" data-action="clear-filters">Nulstil</button>
      </div>
    </form>

    <div class="kpi-grid">
      ${UI.KpiCard({ label: 'Samlet tid i periode', value: Fmt.formatHours(totalHours), unit: 't', accent: true })}
      ${UI.KpiCard({ label: 'Tid på vundne sager', value: Fmt.formatHours(wonHours), unit: 't' })}
      ${UI.KpiCard({ label: 'Tid på tabte sager', value: Fmt.formatHours(lostHours), unit: 't' })}
      ${UI.KpiCard({ label: 'Gns. time to PO', value: avgPo === null ? '—' : Fmt.formatHours(avgPo), unit: avgPo === null ? '' : 'dage' })}
      ${UI.KpiCard({ label: 'Gns. tid per sag', value: Fmt.formatHours(avgPerCase), unit: 't' })}
      ${UI.KpiCard({ label: 'Sager oprettet', value: createdInPeriod })}
      ${UI.KpiCard({ label: 'Sager afsluttet', value: closedInPeriod })}
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-header"><div class="card-title">Timer fordelt på afdeling</div></div>
        ${UI.BarChart(byDept)}
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Timer fordelt på fase</div></div>
        ${UI.BarChart(byPhase)}
      </div>
    </div>

    <div style="height:16px;"></div>

    <div class="card">
      <div class="card-header"><div class="card-title">Timer fordelt på bruger</div></div>
      ${userRows.length === 0 ? UI.EmptyState('Ingen data.') : `
        <div class="table-wrap" style="border:none;">
          <table class="gl">
            <thead><tr><th>Bruger</th><th>Afdeling</th><th class="right">Timer</th></tr></thead>
            <tbody>
              ${userRows.map(r => `
                <tr>
                  <td><b>${UI.escapeHtml(r.user.initials)}</b></td>
                  <td>${UI.DeptBadge(r.user.department)}</td>
                  <td class="right num">${Fmt.formatHours(r.h)} t</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;
}

/* ----------------- ADMIN ----------------- */
function viewAdmin() {
  const users = DB.Users.list();
  return `
    <div class="page-header">
      <div>
        <div class="page-title">Admin</div>
        <div class="page-subtitle">Brugere og data-administration.</div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <div class="card-title">Brugere</div>
        </div>
        <form id="add-user-form" class="form" style="margin-bottom:16px;">
          <div class="form-grid">
            <div class="field">
              <label>Initialer</label>
              <input name="initials" maxlength="4" placeholder="fx ABC" required style="text-transform:uppercase;" />
            </div>
            <div class="field">
              <label>Afdeling</label>
              <select name="department" required>${UI.deptOptions(null)}</select>
            </div>
          </div>
          <div class="form-grid">
            <div class="field">
              <label>Navn (valgfrit)</label>
              <input name="name" placeholder="Fulde navn" />
            </div>
            <div class="field">
              <label>Rolle</label>
              <select name="role">
                <option value="user">Bruger</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div class="form-actions">
            <button class="btn btn-primary" type="submit">Tilføj bruger</button>
          </div>
        </form>

        <div class="table-wrap" style="border:none;">
          <table class="gl">
            <thead><tr><th>Initialer</th><th>Afdeling</th><th>Rolle</th><th></th></tr></thead>
            <tbody>
              ${users.map(u => `
                <tr>
                  <td><b>${UI.escapeHtml(u.initials)}</b></td>
                  <td>${UI.DeptBadge(u.department)}</td>
                  <td>${u.role === 'admin' ? '<b>Admin</b>' : 'Bruger'}</td>
                  <td class="right">
                    ${u.initials !== 'MKJ' ? `<button class="btn btn-ghost btn-sm" data-action="delete-user" data-id="${UI.attr(u.id)}">Slet</button>` : '<span class="muted small">Hovedadmin</span>'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">Data</div>
          <div class="card-subtitle">Eksportér eller nulstil.</div>
        </div>
        <div style="display:flex; flex-direction:column; gap:10px;">
          <button class="btn" data-action="export-cases">Eksportér alle sager (CSV)</button>
          <button class="btn" data-action="export-time">Eksportér alle tidsregistreringer (CSV)</button>
          <button class="btn" data-action="export-json">Eksportér rå data (JSON)</button>
          <hr class="sep" />
          <button class="btn btn-danger" data-action="reset-data">Nulstil database (slet alt)</button>
          <div class="muted small">OBS: Sletter alle sager, tider, kommentarer og log. Brugerne genoprettes ved næste reload.</div>
        </div>
      </div>
    </div>
  `;
}

/* expose */
window.Views = {
  viewLogin, viewDashboard, viewCases, viewCreateCase, viewCaseDetail,
  viewTime, viewReports, viewAdmin
};

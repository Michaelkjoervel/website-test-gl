/* ============================================================
   components.js — Reusable UI components (HTML strings)
   ============================================================ */

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function attr(s) { return escapeHtml(s); }

/* ----------------- KPI card ----------------- */
function KpiCard({ label, value, unit = '', sub = '', accent = false }) {
  return `
    <div class="kpi ${accent ? 'kpi-accent' : ''}">
      <div class="kpi-label">${escapeHtml(label)}</div>
      <div class="kpi-value">${escapeHtml(value)}${unit ? `<span class="unit">${escapeHtml(unit)}</span>` : ''}</div>
      ${sub ? `<div class="kpi-sub">${escapeHtml(sub)}</div>` : ''}
    </div>
  `;
}

/* ----------------- Status badge ----------------- */
function StatusBadge(status) {
  const map = {
    'Aktiv': 'badge-active',
    'På pause': 'badge-paused',
    'Vundet': 'badge-won',
    'Tabt': 'badge-lost',
    'Afsluttet': 'badge-closed'
  };
  return `<span class="badge ${map[status] || 'badge-active'}">${escapeHtml(status)}</span>`;
}

/* ----------------- Dept badge ----------------- */
function DeptBadge(name) {
  return `<span class="dept-badge">${escapeHtml(name)}</span>`;
}

/* ----------------- Phase progress ----------------- */
function PhaseProgress(currentPhase, { caseId = null, interactive = false } = {}) {
  const idx = CONSTS.PHASES.indexOf(currentPhase);
  let html = '<div class="phase-bar">';
  CONSTS.PHASES.forEach((p, i) => {
    const cls = i < idx ? 'done' : (i === idx ? 'current' : '');
    html += `
      <div class="phase-step ${cls}" data-phase="${attr(p)}" data-case="${attr(caseId || '')}" ${interactive ? 'data-action="set-phase"' : ''} title="${attr(p)}">
        <div class="dot"></div>
        <div class="label">${escapeHtml(p)}</div>
      </div>`;
    if (i < CONSTS.PHASES.length - 1) {
      html += `<div class="phase-connector ${i < idx ? 'done' : ''}"></div>`;
    }
  });
  html += '</div>';
  return html;
}

/* ----------------- Avatar ----------------- */
function Avatar(initials, size = 'sm') {
  return `<span class="avatar" style="${size === 'lg' ? 'width:40px;height:40px;font-size:14px;' : ''}">${escapeHtml(initials || '?')}</span>`;
}

/* ----------------- Bar chart ----------------- */
function BarChart(data, { unit = 't' } = {}) {
  const entries = Object.entries(data);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return `
    <div class="bar-chart">
      ${entries.map(([label, value]) => {
        const pct = (value / max) * 100;
        return `
          <div class="bar-row">
            <div class="label">${escapeHtml(label)}</div>
            <div class="bar-track"><div class="bar-fill" style="width:${pct.toFixed(1)}%"></div></div>
            <div class="value">${Fmt.formatHours(value)} ${escapeHtml(unit)}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function BarChartCount(data) {
  const entries = Object.entries(data);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return `
    <div class="bar-chart">
      ${entries.map(([label, value]) => {
        const pct = (value / max) * 100;
        return `
          <div class="bar-row">
            <div class="label">${escapeHtml(label)}</div>
            <div class="bar-track"><div class="bar-fill" style="width:${pct.toFixed(1)}%"></div></div>
            <div class="value">${value}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/* ----------------- Empty state ----------------- */
function EmptyState(text) {
  return `<div class="empty-state">${escapeHtml(text)}</div>`;
}

/* ----------------- Star (favorite) ----------------- */
function StarBtn(caseId, isFav) {
  return `<button class="fav-btn ${isFav ? 'is-fav' : ''}" data-action="toggle-fav" data-case="${attr(caseId)}" title="${isFav ? 'Fjern favorit' : 'Marker som favorit'}">★</button>`;
}

/* ----------------- Select options ----------------- */
function userOptions(selectedId, { includeBlank = false, blankLabel = 'Vælg bruger' } = {}) {
  const users = DB.Users.list();
  let html = '';
  if (includeBlank) html += `<option value="">${escapeHtml(blankLabel)}</option>`;
  users.forEach(u => {
    html += `<option value="${attr(u.id)}" ${u.id === selectedId ? 'selected' : ''}>${escapeHtml(u.initials)} — ${escapeHtml(u.department)}</option>`;
  });
  return html;
}

function deptOptions(selected, { includeBlank = false, blankLabel = 'Alle afdelinger' } = {}) {
  let html = '';
  if (includeBlank) html += `<option value="">${escapeHtml(blankLabel)}</option>`;
  CONSTS.DEPARTMENTS.forEach(d => {
    html += `<option value="${attr(d)}" ${d === selected ? 'selected' : ''}>${escapeHtml(d)}</option>`;
  });
  return html;
}

function phaseOptions(selected, { includeBlank = false, blankLabel = 'Alle faser' } = {}) {
  let html = '';
  if (includeBlank) html += `<option value="">${escapeHtml(blankLabel)}</option>`;
  CONSTS.PHASES.forEach(p => {
    html += `<option value="${attr(p)}" ${p === selected ? 'selected' : ''}>${escapeHtml(p)}</option>`;
  });
  return html;
}

function statusOptions(selected, { includeBlank = false, blankLabel = 'Alle statusser' } = {}) {
  let html = '';
  if (includeBlank) html += `<option value="">${escapeHtml(blankLabel)}</option>`;
  CONSTS.STATUSES.forEach(s => {
    html += `<option value="${attr(s)}" ${s === selected ? 'selected' : ''}>${escapeHtml(s)}</option>`;
  });
  return html;
}

function caseOptions(selectedId, { includeBlank = true, blankLabel = 'Vælg sag' } = {}) {
  const cases = DB.Cases.list();
  let html = '';
  if (includeBlank) html += `<option value="">${escapeHtml(blankLabel)}</option>`;
  cases.forEach(c => {
    html += `<option value="${attr(c.id)}" ${c.id === selectedId ? 'selected' : ''}>${escapeHtml(c.case_number)} · ${escapeHtml(c.title)} — ${escapeHtml(c.customer_name)}</option>`;
  });
  return html;
}

/* ----------------- Sidebar ----------------- */
function Sidebar(currentRoute, currentUser) {
  const isAdmin = currentUser && currentUser.role === 'admin';
  const items = [
    { route: '#/dashboard', label: 'Dashboard', icon: iconDashboard() },
    { route: '#/cases',     label: 'Sager',     icon: iconCases() },
    { route: '#/cases/new', label: 'Opret sag', icon: iconPlus() },
    { route: '#/time',      label: 'Tidsregistrering', icon: iconClock() },
    { route: '#/reports',   label: 'Rapporter', icon: iconReport() }
  ];
  if (isAdmin) items.push({ route: '#/admin', label: 'Admin', icon: iconShield() });

  return `
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-brand">
        <div class="brand-dot">gl</div>
        <div class="brand-text">green<span class="light">·light</span></div>
      </div>
      <nav class="nav-section">
        <div class="nav-section-label">Menu</div>
        ${items.map(it => `
          <a href="${it.route}" class="nav-link ${currentRoute.startsWith(it.route) || (it.route === '#/cases' && currentRoute.startsWith('#/cases/') && currentRoute !== '#/cases/new') ? 'active' : ''}">
            <span class="nav-icon">${it.icon}</span>
            <span>${escapeHtml(it.label)}</span>
          </a>
        `).join('')}
      </nav>

      <div class="sidebar-footer">
        ${currentUser ? `
          <div class="user-chip">
            ${Avatar(currentUser.initials)}
            <div class="meta">
              <span class="name">${escapeHtml(currentUser.initials)}</span>
              <span class="role">${escapeHtml(currentUser.department)} · ${currentUser.role === 'admin' ? 'Admin' : 'Bruger'}</span>
            </div>
            <button class="logout-btn" data-action="logout">Log ud</button>
          </div>
        ` : ''}
      </div>
    </aside>
  `;
}

/* ----------------- Icons ----------------- */
function iconDashboard() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>`;
}
function iconCases() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h18M5 7v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>`;
}
function iconPlus() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>`;
}
function iconClock() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`;
}
function iconReport() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></svg>`;
}
function iconShield() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3z"/><path d="M9 12l2 2 4-4"/></svg>`;
}
function iconHamburger() {
  return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`;
}

/* expose */
window.UI = {
  escapeHtml, attr,
  KpiCard, StatusBadge, DeptBadge, PhaseProgress, Avatar,
  BarChart, BarChartCount, EmptyState, StarBtn,
  userOptions, deptOptions, phaseOptions, statusOptions, caseOptions,
  Sidebar,
  iconHamburger
};

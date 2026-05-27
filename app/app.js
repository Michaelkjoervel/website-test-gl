/* ============================================================
   app.js — Main app: router, auth, event handlers
   ============================================================ */

const SESSION_KEY = 'gl-tidstracking-session';

/* ----------------- Auth ----------------- */
/* Cloud-mode  : Supabase Auth (email + adgangskode). Den indloggede
                 brugers profil findes i users-tabellen via email.
   Lokal mode  : simpel initial-login gemt i localStorage.            */
const Auth = {
  _cloudUser: null, // cached profile-row i cloud-mode

  current() {
    if (DB.isCloud()) {
      return Auth._cloudUser || null;
    }
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const { userId } = JSON.parse(raw);
      return DB.Users.get(userId) || null;
    } catch { return null; }
  },

  // Lokal mode
  login(initials) {
    const u = DB.Users.getByInitials(initials);
    if (!u) throw new Error('Ukendt initialer. Tjek staveform.');
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: u.id, ts: Date.now() }));
    return u;
  },

  // Cloud mode
  async loginCloud(email, password) {
    await window.Cloud.signIn(email, password);
    await DB.hydrate();
    return Auth.resolveCloudProfile(email);
  },

  // Find profil-rækken i users-tabellen der matcher den indloggede email.
  resolveCloudProfile(email) {
    const all = DB.Users.list();
    const match = all.find(u => (u.email || '').toLowerCase() === String(email).toLowerCase());
    if (!match) {
      throw new Error('Din login virker, men der findes ingen brugerprofil med din email. Kontakt admin.');
    }
    Auth._cloudUser = match;
    return match;
  },

  async logout() {
    if (DB.isCloud()) {
      Auth._cloudUser = null;
      await window.Cloud.signOut();
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  },

  // Genskab session ved sideindlæsning (kun cloud).
  async restoreCloudSession() {
    if (!DB.isCloud()) return null;
    const session = await window.Cloud.getSession();
    if (!session) return null;
    const email = session.user ? session.user.email : null;
    if (!email) return null;
    await DB.hydrate();
    try {
      return Auth.resolveCloudProfile(email);
    } catch {
      return null;
    }
  }
};

/* ----------------- Toast ----------------- */
function toast(message, type = 'info', duration = 2400) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(20px)';
    setTimeout(() => el.remove(), 200);
  }, duration);
}

/* ----------------- Modal ----------------- */
function showModal({ title, body, actions = [] }) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal">
        <div class="modal-head">
          <div class="modal-title">${UI.escapeHtml(title)}</div>
          <button class="modal-close" data-modal-close>&times;</button>
        </div>
        <div class="modal-body">${body}</div>
        <div class="modal-foot">
          ${actions.map((a, i) => `<button class="btn ${a.cls || ''}" data-modal-action="${i}">${UI.escapeHtml(a.label)}</button>`).join('')}
        </div>
      </div>
    </div>
  `;
  const close = () => { root.innerHTML = ''; };
  root.querySelectorAll('[data-modal-close]').forEach(b => b.addEventListener('click', close));
  root.querySelector('.modal-backdrop').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-backdrop')) close();
  });
  actions.forEach((a, i) => {
    root.querySelector(`[data-modal-action="${i}"]`).addEventListener('click', () => {
      const result = a.onClick ? a.onClick(root) : null;
      if (result !== false) close();
    });
  });
  return close;
}

/* ----------------- Router ----------------- */
const Router = {
  parseHash() {
    const h = window.location.hash || '#/dashboard';
    const [path, query = ''] = h.split('?');
    const params = {};
    new URLSearchParams(query).forEach((v, k) => { params[k] = v; });
    return { path, params };
  },
  navigate(hash) {
    if (window.location.hash === hash) {
      render();
    } else {
      window.location.hash = hash;
    }
  }
};

/* ----------------- CSV Export ----------------- */
function downloadCsv(filename, rows) {
  const csv = rows.map(row => row.map(cell => {
    if (cell === null || cell === undefined) return '';
    const s = String(cell);
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes(';')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }).join(';')).join('\n');

  // BOM for Excel
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportCasesCsv() {
  const cases = DB.Cases.list();
  const rows = [[
    'Sagsnummer', 'Sagsnavn', 'Kunde', 'Status', 'Resultat', 'Fase',
    'Primær afdeling', 'Oprettet af', 'Ansvarlig', 'Oprettet dato',
    'PO dato', 'Afsluttet', 'Estimeret værdi', 'Samlet timer',
    'Time to PO (dage)', 'Tabsårsag', 'Beskrivelse', 'Noter'
  ]];
  cases.forEach(c => {
    const creator = DB.Users.get(c.created_by_user_id);
    const resp = DB.Users.get(c.responsible_user_id);
    rows.push([
      c.case_number, c.title, c.customer_name, c.status, c.result || '',
      c.phase, c.primary_department,
      creator ? creator.initials : '', resp ? resp.initials : '',
      Fmt.formatDate(c.created_at), Fmt.formatDate(c.po_date), Fmt.formatDate(c.closed_at),
      c.estimated_value || '',
      DB.Calc.totalHoursForCase(c.id),
      DB.Calc.timeToPoDays(c) ?? '',
      c.lost_reason || '',
      c.description || '',
      c.notes || ''
    ]);
  });
  downloadCsv(`gl-sager-${Fmt.todayIso()}.csv`, rows);
}

function exportTimeCsv() {
  const entries = DB.TimeEntries.list();
  const rows = [[
    'Dato', 'Sag', 'Sagsnummer', 'Kunde', 'Bruger', 'Afdeling', 'Fase',
    'Timer', 'Beskrivelse', 'Oprettet', 'Senest opdateret'
  ]];
  entries.forEach(e => {
    const c = DB.Cases.get(e.case_id);
    const u = DB.Users.get(e.user_id);
    rows.push([
      Fmt.formatDate(e.entry_date),
      c ? c.title : '',
      c ? c.case_number : '',
      c ? c.customer_name : '',
      u ? u.initials : '',
      e.department,
      e.phase,
      e.hours,
      e.description || '',
      Fmt.formatDateTime(e.created_at),
      Fmt.formatDateTime(e.updated_at)
    ]);
  });
  downloadCsv(`gl-tid-${Fmt.todayIso()}.csv`, rows);
}

function exportDashboardCsv(filters = {}) {
  const cases = DB.Cases.list();
  let entries = DB.TimeEntries.list();
  if (filters.dateFrom) entries = entries.filter(e => e.entry_date >= filters.dateFrom);
  if (filters.dateTo) entries = entries.filter(e => e.entry_date <= filters.dateTo);

  const byDept = DB.Calc.hoursByDepartment(entries);
  const byPhase = DB.Calc.hoursByPhase(entries);
  const byUser = DB.Calc.hoursByUser(entries);

  const rows = [];
  rows.push(['Rapport', `Green Light Tidstracking - ${Fmt.todayIso()}`]);
  if (filters.dateFrom || filters.dateTo) {
    rows.push(['Periode', `${filters.dateFrom || 'start'} til ${filters.dateTo || 'i dag'}`]);
  }
  rows.push([]);
  rows.push(['KPI', 'Værdi']);
  rows.push(['Antal sager', cases.length]);
  rows.push(['Aktive sager', cases.filter(c => c.status === 'Aktiv' || c.status === 'På pause').length]);
  rows.push(['Vundne', cases.filter(c => c.result === 'won').length]);
  rows.push(['Tabte', cases.filter(c => c.result === 'lost').length]);
  rows.push(['Samlet timer', DB.Calc.totalHours(entries)]);
  rows.push(['Gns. timer per sag', DB.Calc.averageHoursPerCase(cases).toFixed(2)]);
  rows.push(['Gns. time to PO', DB.Calc.averageTimeToPo(cases) === null ? 'Ingen data' : DB.Calc.averageTimeToPo(cases).toFixed(1)]);
  rows.push([]);
  rows.push(['Afdeling', 'Timer']);
  Object.entries(byDept).forEach(([d, h]) => rows.push([d, h]));
  rows.push([]);
  rows.push(['Fase', 'Timer']);
  Object.entries(byPhase).forEach(([p, h]) => rows.push([p, h]));
  rows.push([]);
  rows.push(['Bruger', 'Initialer', 'Afdeling', 'Timer']);
  Object.entries(byUser).forEach(([uid, h]) => {
    const u = DB.Users.get(uid);
    if (u) rows.push([u.name || u.initials, u.initials, u.department, h]);
  });

  downloadCsv(`gl-dashboard-${Fmt.todayIso()}.csv`, rows);
}

function exportJson() {
  const data = DB.Admin.exportJson();
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gl-data-${Fmt.todayIso()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ----------------- Render ----------------- */
function render() {
  const user = Auth.current();
  const { path, params } = Router.parseHash();

  if (!user) {
    document.getElementById('app').innerHTML = Views.viewLogin();
    bindLogin();
    return;
  }

  // Admin-route guard
  if (path === '#/admin' && user.role !== 'admin') {
    Router.navigate('#/dashboard');
    return;
  }

  let main = '';
  if (path === '#/dashboard' || path === '#' || path === '') {
    main = Views.viewDashboard(user);
  } else if (path === '#/cases') {
    main = Views.viewCases(params);
  } else if (path === '#/cases/new') {
    main = Views.viewCreateCase(user);
  } else if (path.startsWith('#/cases/')) {
    const id = path.replace('#/cases/', '');
    main = Views.viewCaseDetail(id, user, params.tab || 'time');
  } else if (path === '#/time') {
    main = Views.viewTime(user, params);
  } else if (path === '#/reports') {
    main = Views.viewReports(params);
  } else if (path === '#/admin') {
    main = Views.viewAdmin();
  } else {
    main = `<div class="card"><b>Siden findes ikke.</b> <a href="#/dashboard">Til dashboard</a></div>`;
  }

  document.getElementById('app').innerHTML = `
    ${UI.Sidebar(path, user)}
    <div class="sidebar-backdrop" id="sidebar-backdrop"></div>
    <main class="main">
      <div class="mobile-top">
        <button class="menu-toggle" id="menu-toggle" aria-label="Menu">${UI.iconHamburger()}</button>
        <div style="font-weight:600;">green·light tidstracking</div>
      </div>
      ${main}
    </main>
  `;

  // Wrap in app-shell
  const appEl = document.getElementById('app');
  appEl.className = 'app-shell';

  bindGlobal();
  bindPage(path, user, params);
}

/* ----------------- Bindings ----------------- */
function bindLogin() {
  document.getElementById('app').className = '';
  const form = document.getElementById('login-form');

  if (DB.isCloud()) {
    // Cloud: email + adgangskode
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = form.email.value.trim();
      const password = form.password.value;
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = 'Logger ind...';
      try {
        const u = await Auth.loginCloud(email, password);
        toast('Velkommen ' + u.initials, 'success');
        if (!window.location.hash || window.location.hash === '#/') window.location.hash = '#/dashboard';
        render();
      } catch (err) {
        toast(err.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Log ind';
      }
    });
    return;
  }

  // Lokal: initialer
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const initials = form.initials.value.trim();
    try {
      Auth.login(initials);
      toast('Velkommen ' + initials.toUpperCase(), 'success');
      Router.navigate('#/dashboard');
      render();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
  document.querySelectorAll('[data-action="quick-login"]').forEach(el => {
    el.addEventListener('click', () => {
      const initials = el.dataset.initials;
      try {
        Auth.login(initials);
        toast('Velkommen ' + initials, 'success');
        Router.navigate('#/dashboard');
        render();
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  });
}

function bindGlobal() {
  // Logout
  document.querySelectorAll('[data-action="logout"]').forEach(el => {
    el.addEventListener('click', async () => {
      await Auth.logout();
      toast('Logget ud', 'info');
      window.location.hash = '#/dashboard'; // lander på login da der ikke er bruger
      render();
    });
  });

  // Row clicks
  document.querySelectorAll('[data-href]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('button, a, [data-action]')) return;
      window.location.hash = el.dataset.href;
    });
  });

  // Toggle favorite
  document.querySelectorAll('[data-action="toggle-fav"]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = el.dataset.case;
      DB.Cases.toggleFavorite(id);
      render();
    });
  });

  // Sidebar mobile toggle
  const toggle = document.getElementById('menu-toggle');
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (toggle && sidebar && backdrop) {
    toggle.addEventListener('click', () => {
      sidebar.classList.add('open');
      backdrop.classList.add('open');
    });
    backdrop.addEventListener('click', () => {
      sidebar.classList.remove('open');
      backdrop.classList.remove('open');
    });
  }
}

function bindPage(path, user, params) {
  const main = document.querySelector('.main');
  if (!main) return;

  // Dashboard: quick time entry
  const qf = document.getElementById('quick-time-form');
  if (qf) {
    qf.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(qf);
      try {
        DB.TimeEntries.create({
          case_id: fd.get('case_id'),
          user_id: user.id,
          department: user.department,
          phase: null, // will use case's current phase
          entry_date: Fmt.todayIso(),
          hours: fd.get('hours'),
          description: fd.get('description')
        });
        toast('Tid gemt', 'success');
        render();
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  }

  // Cases page: filter form
  const cf = document.getElementById('cases-filter');
  if (cf) {
    const update = () => {
      const fd = new FormData(cf);
      const q = new URLSearchParams();
      for (const [k, v] of fd.entries()) {
        if (v !== '' && v !== null) q.set(k, v);
      }
      window.location.hash = '#/cases?' + q.toString();
    };
    cf.addEventListener('change', update);
    cf.addEventListener('submit', (e) => { e.preventDefault(); update(); });
    const clear = cf.querySelector('[data-action="clear-filters"]');
    if (clear) clear.addEventListener('click', () => { window.location.hash = '#/cases'; });
  }

  // Time filter
  const tf = document.getElementById('time-filter');
  if (tf) {
    const update = () => {
      const fd = new FormData(tf);
      const q = new URLSearchParams();
      for (const [k, v] of fd.entries()) {
        if (v !== '' && v !== null) q.set(k, v);
      }
      window.location.hash = '#/time?' + q.toString();
    };
    tf.addEventListener('change', update);
    tf.addEventListener('submit', (e) => { e.preventDefault(); update(); });
    const clear = tf.querySelector('[data-action="clear-filters"]');
    if (clear) clear.addEventListener('click', () => { window.location.hash = '#/time'; });
  }

  // Reports filter
  const rf = document.getElementById('reports-filter');
  if (rf) {
    const update = () => {
      const fd = new FormData(rf);
      const q = new URLSearchParams();
      for (const [k, v] of fd.entries()) {
        if (v !== '' && v !== null) q.set(k, v);
      }
      window.location.hash = '#/reports?' + q.toString();
    };
    rf.addEventListener('change', update);
    rf.addEventListener('submit', (e) => { e.preventDefault(); update(); });
    const clear = rf.querySelector('[data-action="clear-filters"]');
    if (clear) clear.addEventListener('click', () => { window.location.hash = '#/reports'; });
  }

  // Create case form
  const ccf = document.getElementById('create-case-form');
  if (ccf) {
    ccf.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(ccf);
      try {
        const c = DB.Cases.create({
          title: fd.get('title'),
          customer_name: fd.get('customer_name'),
          description: fd.get('description'),
          created_by_user_id: user.id,
          responsible_user_id: fd.get('responsible_user_id') || user.id,
          primary_department: fd.get('primary_department'),
          phase: fd.get('phase') || 'Opstartsfase',
          estimated_value: fd.get('estimated_value') ? Number(fd.get('estimated_value')) : null,
          notes: fd.get('notes')
        });
        toast('Sag oprettet: ' + c.case_number, 'success');
        Router.navigate('#/cases/' + c.id);
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  }

  // Case detail: time form
  const ctf = document.getElementById('case-time-form');
  if (ctf) {
    const caseId = path.replace('#/cases/', '');
    ctf.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(ctf);
      try {
        DB.TimeEntries.create({
          case_id: caseId,
          user_id: user.id,
          department: fd.get('department') || user.department,
          phase: fd.get('phase') || null,
          entry_date: fd.get('entry_date'),
          hours: fd.get('hours'),
          description: fd.get('description')
        });
        toast('Tid gemt', 'success');
        render();
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  }

  // Time page: form
  const timeForm = document.getElementById('time-form');
  if (timeForm) {
    timeForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(timeForm);
      try {
        DB.TimeEntries.create({
          case_id: fd.get('case_id'),
          user_id: user.id,
          department: fd.get('department') || user.department,
          phase: fd.get('phase') || null,
          entry_date: fd.get('entry_date'),
          hours: fd.get('hours'),
          description: fd.get('description')
        });
        toast('Tid gemt', 'success');
        render();
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  }

  // Delete time entries
  main.querySelectorAll('[data-action="delete-time"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      showModal({
        title: 'Slet tidsregistrering?',
        body: '<p>Denne handling kan ikke fortrydes.</p>',
        actions: [
          { label: 'Annullér', cls: '' },
          { label: 'Slet', cls: 'btn-danger', onClick: () => {
              DB.TimeEntries.remove(id);
              toast('Tidsregistrering slettet', 'success');
              render();
            }
          }
        ]
      });
    });
  });

  // Set phase from progress bar
  main.querySelectorAll('[data-action="set-phase"]').forEach(step => {
    step.addEventListener('click', () => {
      const caseId = step.dataset.case;
      const phase = step.dataset.phase;
      if (!caseId || !phase) return;
      try {
        DB.Cases.update(caseId, { phase }, user.id);
        toast('Fase opdateret til ' + phase, 'success');
        render();
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  });

  // Tabs
  main.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => {
      const tab = t.dataset.tab;
      const q = new URLSearchParams();
      q.set('tab', tab);
      window.location.hash = path + '?' + q.toString();
    });
  });

  // Comment form
  const commentForm = document.getElementById('comment-form');
  if (commentForm) {
    const caseId = path.replace('#/cases/', '');
    commentForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(commentForm);
      try {
        DB.Comments.add({ case_id: caseId, user_id: user.id, text: fd.get('text') });
        toast('Kommentar tilføjet', 'success');
        render();
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  }

  // Delete comment
  main.querySelectorAll('[data-action="delete-comment"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const id = btn.dataset.id;
      DB.Comments.remove(id);
      toast('Kommentar slettet', 'info');
      render();
    });
  });

  // Case status actions
  main.querySelectorAll('[data-action="mark-won"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const caseId = btn.dataset.case;
      showModal({
        title: 'Markér sag som vundet',
        body: `
          <div class="field">
            <label>PO-dato</label>
            <input id="po-date-input" type="date" value="${Fmt.todayIso()}" />
          </div>
        `,
        actions: [
          { label: 'Annullér' },
          { label: 'Markér som vundet', cls: 'btn-primary', onClick: (root) => {
              const po = root.querySelector('#po-date-input').value || Fmt.todayIso();
              DB.Cases.setWon(caseId, { po_date: po }, user.id);
              toast('Sag markeret som vundet', 'success');
              render();
            }
          }
        ]
      });
    });
  });

  main.querySelectorAll('[data-action="mark-lost"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const caseId = btn.dataset.case;
      showModal({
        title: 'Markér sag som tabt',
        body: `
          <div class="field">
            <label>Kort årsag</label>
            <textarea id="lost-reason-input" placeholder="Hvorfor tabte vi sagen?"></textarea>
          </div>
        `,
        actions: [
          { label: 'Annullér' },
          { label: 'Markér som tabt', cls: 'btn-danger', onClick: (root) => {
              const reason = root.querySelector('#lost-reason-input').value || '';
              DB.Cases.setLost(caseId, { lost_reason: reason }, user.id);
              toast('Sag markeret som tabt', 'info');
              render();
            }
          }
        ]
      });
    });
  });

  main.querySelectorAll('[data-action="set-status"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const caseId = btn.dataset.case;
      const c = DB.Cases.get(caseId);
      showModal({
        title: 'Skift status',
        body: `
          <div class="field">
            <label>Status</label>
            <select id="status-input">${UI.statusOptions(c.status)}</select>
          </div>
        `,
        actions: [
          { label: 'Annullér' },
          { label: 'Gem', cls: 'btn-primary', onClick: (root) => {
              const status = root.querySelector('#status-input').value;
              if (status === 'Afsluttet' && !c.closed_at) {
                DB.Cases.close(caseId, user.id);
              } else {
                DB.Cases.update(caseId, { status }, user.id);
              }
              toast('Status opdateret', 'success');
              render();
            }
          }
        ]
      });
    });
  });

  main.querySelectorAll('[data-action="edit-case"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const caseId = btn.dataset.case;
      const c = DB.Cases.get(caseId);
      showModal({
        title: 'Redigér sag',
        body: `
          <form id="edit-case-form" class="form">
            <div class="field"><label>Sagsnavn</label><input name="title" value="${UI.attr(c.title)}" required /></div>
            <div class="field"><label>Kunde</label><input name="customer_name" value="${UI.attr(c.customer_name)}" required /></div>
            <div class="field"><label>Beskrivelse</label><textarea name="description">${UI.escapeHtml(c.description || '')}</textarea></div>
            <div class="form-grid">
              <div class="field"><label>Ansvarlig</label><select name="responsible_user_id">${UI.userOptions(c.responsible_user_id)}</select></div>
              <div class="field"><label>Primær afdeling</label><select name="primary_department">${UI.deptOptions(c.primary_department)}</select></div>
              <div class="field"><label>Fase</label><select name="phase">${UI.phaseOptions(c.phase)}</select></div>
              <div class="field"><label>Estimeret værdi</label><input name="estimated_value" type="number" value="${c.estimated_value ?? ''}" /></div>
            </div>
            <div class="field"><label>Noter</label><textarea name="notes">${UI.escapeHtml(c.notes || '')}</textarea></div>
          </form>
        `,
        actions: [
          { label: 'Annullér' },
          { label: 'Gem', cls: 'btn-primary', onClick: (root) => {
              const form = root.querySelector('#edit-case-form');
              const fd = new FormData(form);
              try {
                DB.Cases.update(caseId, {
                  title: fd.get('title'),
                  customer_name: fd.get('customer_name'),
                  description: fd.get('description'),
                  responsible_user_id: fd.get('responsible_user_id'),
                  primary_department: fd.get('primary_department'),
                  phase: fd.get('phase'),
                  estimated_value: fd.get('estimated_value') ? Number(fd.get('estimated_value')) : null,
                  notes: fd.get('notes')
                }, user.id);
                toast('Sag opdateret', 'success');
                render();
              } catch (err) {
                toast(err.message, 'error');
                return false;
              }
            }
          }
        ]
      });
    });
  });

  main.querySelectorAll('[data-action="delete-case"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const caseId = btn.dataset.case;
      showModal({
        title: 'Slet sag?',
        body: '<p>Hele sagen inkl. tidsregistreringer, kommentarer og log slettes. Dette kan ikke fortrydes.</p>',
        actions: [
          { label: 'Annullér' },
          { label: 'Slet sag', cls: 'btn-danger', onClick: () => {
              DB.Cases.remove(caseId);
              toast('Sag slettet', 'info');
              Router.navigate('#/cases');
            }
          }
        ]
      });
    });
  });

  // Export buttons
  main.querySelectorAll('[data-action="export-cases"]').forEach(btn => {
    btn.addEventListener('click', () => exportCasesCsv());
  });
  main.querySelectorAll('[data-action="export-time"]').forEach(btn => {
    btn.addEventListener('click', () => exportTimeCsv());
  });
  main.querySelectorAll('[data-action="export-dashboard"]').forEach(btn => {
    btn.addEventListener('click', () => exportDashboardCsv(params));
  });
  main.querySelectorAll('[data-action="export-json"]').forEach(btn => {
    btn.addEventListener('click', () => exportJson());
  });

  // Admin
  const addUserForm = document.getElementById('add-user-form');
  if (addUserForm) {
    addUserForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(addUserForm);
      try {
        DB.Users.create({
          initials: fd.get('initials').toUpperCase(),
          name: fd.get('name') || fd.get('initials').toUpperCase(),
          department: fd.get('department'),
          role: fd.get('role') || 'user',
          email: fd.get('email') || null
        });
        toast('Bruger oprettet', 'success');
        render();
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  }

  main.querySelectorAll('[data-action="delete-user"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const u = DB.Users.get(id);
      if (!u) return;
      showModal({
        title: 'Slet bruger?',
        body: `<p>Brugeren <b>${UI.escapeHtml(u.initials)}</b> slettes. Sager og tider knyttet til brugeren forbliver i systemet (kan ikke længere logge ind).</p>`,
        actions: [
          { label: 'Annullér' },
          { label: 'Slet', cls: 'btn-danger', onClick: () => {
              DB.Users.remove(id);
              toast('Bruger slettet', 'info');
              render();
            }
          }
        ]
      });
    });
  });

  main.querySelectorAll('[data-action="reset-data"]').forEach(btn => {
    btn.addEventListener('click', () => {
      showModal({
        title: 'Nulstil database?',
        body: '<p><b>Alt</b> data slettes: sager, tider, kommentarer og aktivitetslog. Brugere genoprettes ved næste reload.</p>',
        actions: [
          { label: 'Annullér' },
          { label: 'Nulstil alt', cls: 'btn-danger', onClick: () => {
              try {
                DB.Admin.resetAll();
                toast('Database nulstillet — genindlæser...', 'info');
                setTimeout(() => location.reload(), 800);
              } catch (err) {
                toast(err.message, 'error');
              }
            }
          }
        ]
      });
    });
  });
}

/* ----------------- Navigation & boot ----------------- */
// I cloud-mode hentes friske data fra serveren før hver visning, så
// medarbejdere ser hinandens opdateringer. Igangværende skrivninger
// afventes først, så vi ikke overskriver en netop gemt ændring.
async function navigate() {
  if (DB.isCloud() && Auth.current()) {
    try {
      if (window.Cloud) await window.Cloud.flush();
      await DB.hydrate();
      // Genfind profil-reference efter hydrering (objektet er nyt).
      if (Auth._cloudUser) Auth.resolveCloudProfile(Auth._cloudUser.email);
    } catch (err) {
      toast('Kunne ikke hente data: ' + err.message, 'error');
    }
  }
  render();
}

async function boot() {
  // Vis cloud-fejl fra baggrundsskrivninger.
  window.addEventListener('gl-cloud-error', (e) => {
    toast('Synk-fejl: ' + (e.detail || 'ukendt fejl'), 'error');
  });

  if (DB.isCloud()) {
    try {
      const u = await Auth.restoreCloudSession();
      if (u && (!window.location.hash || window.location.hash === '#/')) {
        window.location.hash = '#/dashboard';
      }
    } catch (err) {
      console.error('Session-gendannelse fejlede:', err);
    }
  }
  render();
}

window.addEventListener('hashchange', navigate);
document.addEventListener('DOMContentLoaded', boot);

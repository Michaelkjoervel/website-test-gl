/* ============================================================
   db.js — Data layer for Green Light Tidstracking
   Storage: localStorage (struktureret som en relationel DB)
   ============================================================
   Senere migration: hver tabel mapper direkte til en
   Postgres/Supabase-tabel, og DB.<entity>.list/get/create/...
   svarer til repository-laget i en server-implementering.
   ============================================================ */

const STORAGE_KEY = 'gl-tidstracking-v1';

const DEPARTMENTS = [
  'Marketing',
  'Ledelse',
  'Salg',
  'Teknisk afdeling',
  'Lager',
  'Administration'
];

const PHASES = [
  'Opstartsfase',
  'Tilbudsfase',
  'Præsentationsfase',
  'Beslutningsfase',
  'Eksekveringsfase',
  'Afslutningsfase'
];

const STATUSES = ['Aktiv', 'På pause', 'Vundet', 'Tabt', 'Afsluttet'];

const ACTIONS = {
  CASE_CREATED: 'Sag oprettet',
  PHASE_CHANGED: 'Fase ændret',
  STATUS_CHANGED: 'Status ændret',
  TIME_LOGGED: 'Tid registreret',
  CASE_WON: 'Sag vundet',
  CASE_LOST: 'Sag tabt',
  CASE_CLOSED: 'Sag afsluttet',
  COMMENT_ADDED: 'Kommentar tilføjet'
};

function nowIso() {
  return new Date().toISOString();
}

function uid(prefix = 'id') {
  return prefix + '_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error('Kunne ikke læse data fra localStorage:', e);
    return null;
  }
}

function saveStore(store) {
  store.meta = store.meta || {};
  store.meta.updated_at = nowIso();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function emptyStore() {
  return {
    users: [],
    cases: [],
    time_entries: [],
    activity_log: [],
    comments: [],
    meta: { version: 1, created_at: nowIso(), seeded: false }
  };
}

let _store = window.GL_CLOUD ? emptyStore() : (loadStore() || emptyStore());

/* ------------------------------------------------------------
   Persistence routing
   ------------------------------------------------------------
   LOKAL mode  : hele _store gemmes i localStorage.
   CLOUD mode  : den enkelte række skrives til Supabase (write-
                 through). _store er en in-memory cache der
                 hydreres fra serveren via hydrate().
   ------------------------------------------------------------ */
function isCloud() {
  return !!(window.GL_CLOUD && window.Cloud);
}

// Hent al data ind i cachen. I lokal mode læses fra localStorage.
async function hydrate() {
  if (isCloud()) {
    _store = await window.Cloud.fetchAll();
  } else {
    _store = loadStore() || emptyStore();
  }
  return _store;
}

// Skriv (insert eller update) én række.
function syncUpsert(table, row) {
  if (isCloud()) {
    window.Cloud.upsert(table, stripClientOnly(table, row));
  } else {
    saveStore(_store);
  }
}

// Slet én række.
function syncRemove(table, id) {
  if (isCloud()) {
    window.Cloud.remove(table, id);
  } else {
    saveStore(_store);
  }
}

// Felter der kun giver mening lokalt fjernes inden de sendes til DB.
function stripClientOnly(table, row) {
  const clone = { ...row };
  if (table === 'cases') {
    // 'favorite' findes som kolonne; intet at fjerne pt.
  }
  return clone;
}

function persist() {
  if (!isCloud()) saveStore(_store);
}

/* ------------------------------------------------------------
   Users
   ------------------------------------------------------------ */
const Users = {
  list() {
    return [..._store.users].sort((a, b) => a.initials.localeCompare(b.initials));
  },
  get(id) {
    return _store.users.find(u => u.id === id);
  },
  getByInitials(initials) {
    if (!initials) return null;
    return _store.users.find(
      u => u.initials.toUpperCase() === String(initials).toUpperCase()
    );
  },
  create({ initials, name, department, role = 'user', email = null }) {
    if (!initials) throw new Error('Initialer mangler');
    if (Users.getByInitials(initials)) throw new Error('Initialer findes allerede');
    if (!DEPARTMENTS.includes(department)) throw new Error('Ugyldig afdeling');
    const user = {
      id: uid('usr'),
      initials: initials.toUpperCase(),
      name: name || initials.toUpperCase(),
      department,
      role,
      email: email || null,
      created_at: nowIso(),
      updated_at: nowIso()
    };
    _store.users.push(user);
    syncUpsert('users', user);
    return user;
  },
  update(id, patch) {
    const u = Users.get(id);
    if (!u) throw new Error('Bruger ikke fundet');
    Object.assign(u, patch, { updated_at: nowIso() });
    syncUpsert('users', u);
    return u;
  },
  remove(id) {
    _store.users = _store.users.filter(u => u.id !== id);
    syncRemove('users', id);
  }
};

/* ------------------------------------------------------------
   Cases
   ------------------------------------------------------------ */
const Cases = {
  list() {
    return [..._store.cases].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );
  },
  get(id) {
    return _store.cases.find(c => c.id === id);
  },
  nextCaseNumber() {
    const year = new Date().getFullYear();
    const prefix = `GL-${year}-`;
    const sameYear = _store.cases
      .map(c => c.case_number)
      .filter(n => typeof n === 'string' && n.startsWith(prefix))
      .map(n => parseInt(n.slice(prefix.length), 10))
      .filter(n => !isNaN(n));
    const next = (sameYear.length ? Math.max(...sameYear) : 0) + 1;
    return prefix + String(next).padStart(3, '0');
  },
  create({
    title,
    customer_name,
    description = '',
    created_by_user_id,
    responsible_user_id,
    primary_department,
    phase = 'Opstartsfase',
    estimated_value = null,
    notes = ''
  }) {
    if (!title) throw new Error('Sagsnavn er påkrævet');
    if (!customer_name) throw new Error('Kundenavn er påkrævet');
    if (!PHASES.includes(phase)) throw new Error('Ugyldig fase');
    if (!DEPARTMENTS.includes(primary_department)) throw new Error('Ugyldig primær afdeling');
    const c = {
      id: uid('case'),
      case_number: Cases.nextCaseNumber(),
      title,
      customer_name,
      description,
      created_by_user_id,
      responsible_user_id: responsible_user_id || created_by_user_id,
      primary_department,
      phase,
      status: 'Aktiv',
      estimated_value: estimated_value === '' ? null : estimated_value,
      created_at: nowIso(),
      po_date: null,
      closed_at: null,
      result: null,
      lost_reason: null,
      notes,
      favorite: false,
      updated_at: nowIso()
    };
    _store.cases.push(c);
    syncUpsert('cases', c);
    ActivityLog.add({
      case_id: c.id,
      user_id: created_by_user_id,
      action_type: ACTIONS.CASE_CREATED,
      description: `Oprettede sag “${c.title}”`
    });
    return c;
  },
  update(id, patch, actorUserId) {
    const c = Cases.get(id);
    if (!c) throw new Error('Sag ikke fundet');
    const before = { ...c };
    Object.assign(c, patch, { updated_at: nowIso() });
    syncUpsert('cases', c);
    if (patch.phase && patch.phase !== before.phase) {
      ActivityLog.add({
        case_id: c.id, user_id: actorUserId,
        action_type: ACTIONS.PHASE_CHANGED,
        description: `Fase: ${before.phase} → ${c.phase}`
      });
    }
    if (patch.status && patch.status !== before.status) {
      ActivityLog.add({
        case_id: c.id, user_id: actorUserId,
        action_type: ACTIONS.STATUS_CHANGED,
        description: `Status: ${before.status} → ${c.status}`
      });
    }
    return c;
  },
  setWon(id, { po_date }, actorUserId) {
    const c = Cases.get(id);
    if (!c) throw new Error('Sag ikke fundet');
    c.status = 'Vundet';
    c.result = 'won';
    c.po_date = po_date || nowIso().slice(0, 10);
    c.closed_at = nowIso();
    c.updated_at = nowIso();
    syncUpsert('cases', c);
    ActivityLog.add({
      case_id: c.id, user_id: actorUserId,
      action_type: ACTIONS.CASE_WON,
      description: `Sag vundet. PO dato: ${c.po_date}`
    });
    return c;
  },
  setLost(id, { lost_reason }, actorUserId) {
    const c = Cases.get(id);
    if (!c) throw new Error('Sag ikke fundet');
    c.status = 'Tabt';
    c.result = 'lost';
    c.lost_reason = lost_reason || '';
    c.closed_at = nowIso();
    c.updated_at = nowIso();
    syncUpsert('cases', c);
    ActivityLog.add({
      case_id: c.id, user_id: actorUserId,
      action_type: ACTIONS.CASE_LOST,
      description: `Sag tabt. Årsag: ${c.lost_reason || '—'}`
    });
    return c;
  },
  close(id, actorUserId) {
    const c = Cases.get(id);
    if (!c) throw new Error('Sag ikke fundet');
    c.status = 'Afsluttet';
    c.closed_at = nowIso();
    c.updated_at = nowIso();
    syncUpsert('cases', c);
    ActivityLog.add({
      case_id: c.id, user_id: actorUserId,
      action_type: ACTIONS.CASE_CLOSED,
      description: `Sag afsluttet`
    });
    return c;
  },
  toggleFavorite(id) {
    const c = Cases.get(id);
    if (!c) return;
    c.favorite = !c.favorite;
    c.updated_at = nowIso();
    syncUpsert('cases', c);
    return c;
  },
  remove(id) {
    _store.cases = _store.cases.filter(c => c.id !== id);
    _store.time_entries = _store.time_entries.filter(t => t.case_id !== id);
    _store.activity_log = _store.activity_log.filter(a => a.case_id !== id);
    _store.comments = _store.comments.filter(c => c.case_id !== id);
    // Cloud: FK ON DELETE CASCADE fjerner relaterede rækker automatisk.
    syncRemove('cases', id);
  }
};

/* ------------------------------------------------------------
   TimeEntries
   ------------------------------------------------------------ */
const TimeEntries = {
  list() {
    return [..._store.time_entries].sort(
      (a, b) => new Date(b.entry_date) - new Date(a.entry_date)
    );
  },
  get(id) {
    return _store.time_entries.find(t => t.id === id);
  },
  byCase(caseId) {
    return _store.time_entries
      .filter(t => t.case_id === caseId)
      .sort((a, b) => new Date(b.entry_date) - new Date(a.entry_date));
  },
  byUser(userId) {
    return _store.time_entries
      .filter(t => t.user_id === userId)
      .sort((a, b) => new Date(b.entry_date) - new Date(a.entry_date));
  },
  create({ case_id, user_id, department, phase, entry_date, hours, description = '' }) {
    if (!case_id) throw new Error('Sag skal vælges');
    const c = Cases.get(case_id);
    if (!c) throw new Error('Sag ikke fundet');
    if (!user_id) throw new Error('Bruger mangler');
    const user = Users.get(user_id);
    if (!user) throw new Error('Bruger ikke fundet');
    const finalDepartment = department || user.department;
    if (!DEPARTMENTS.includes(finalDepartment)) throw new Error('Ugyldig afdeling');
    const finalPhase = phase || c.phase;
    if (!PHASES.includes(finalPhase)) throw new Error('Ugyldig fase');
    if (!entry_date) throw new Error('Dato skal angives');
    const h = parseFloat(String(hours).replace(',', '.'));
    if (isNaN(h)) throw new Error('Timer skal være et tal');
    if (h <= 0) throw new Error('Timer skal være større end 0');
    if (h > 24) throw new Error('Timer kan ikke overstige 24 på én dag');
    const entry = {
      id: uid('te'),
      case_id,
      user_id,
      department: finalDepartment,
      phase: finalPhase,
      entry_date,
      hours: h,
      description,
      created_at: nowIso(),
      updated_at: nowIso()
    };
    _store.time_entries.push(entry);
    syncUpsert('time_entries', entry);
    ActivityLog.add({
      case_id: case_id,
      user_id: user_id,
      action_type: ACTIONS.TIME_LOGGED,
      description: `Registrerede ${h.toString().replace('.', ',')} t (${finalDepartment})`
    });
    return entry;
  },
  update(id, patch) {
    const t = TimeEntries.get(id);
    if (!t) throw new Error('Tidsregistrering ikke fundet');
    if (patch.hours !== undefined) {
      const h = parseFloat(String(patch.hours).replace(',', '.'));
      if (isNaN(h) || h <= 0) throw new Error('Timer skal være større end 0');
      patch.hours = h;
    }
    Object.assign(t, patch, { updated_at: nowIso() });
    syncUpsert('time_entries', t);
    return t;
  },
  remove(id) {
    _store.time_entries = _store.time_entries.filter(t => t.id !== id);
    syncRemove('time_entries', id);
  }
};

/* ------------------------------------------------------------
   ActivityLog
   ------------------------------------------------------------ */
const ActivityLog = {
  list() {
    return [..._store.activity_log].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );
  },
  byCase(caseId) {
    return _store.activity_log
      .filter(a => a.case_id === caseId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },
  add({ case_id, user_id, action_type, description }) {
    const entry = {
      id: uid('log'),
      case_id,
      user_id,
      action_type,
      description,
      created_at: nowIso()
    };
    _store.activity_log.push(entry);
    syncUpsert('activity_log', entry);
    return entry;
  }
};

/* ------------------------------------------------------------
   Comments
   ------------------------------------------------------------ */
const Comments = {
  byCase(caseId) {
    return _store.comments
      .filter(c => c.case_id === caseId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },
  add({ case_id, user_id, text }) {
    if (!text || !text.trim()) throw new Error('Kommentaren må ikke være tom');
    const comment = {
      id: uid('cmt'),
      case_id,
      user_id,
      text: text.trim(),
      created_at: nowIso()
    };
    _store.comments.push(comment);
    syncUpsert('comments', comment);
    ActivityLog.add({
      case_id, user_id,
      action_type: ACTIONS.COMMENT_ADDED,
      description: 'Kommentar tilføjet'
    });
    return comment;
  },
  remove(id) {
    _store.comments = _store.comments.filter(c => c.id !== id);
    syncRemove('comments', id);
  }
};

/* ------------------------------------------------------------
   Calculations
   ------------------------------------------------------------ */
const Calc = {
  totalHoursForCase(caseId) {
    return TimeEntries.byCase(caseId).reduce((sum, t) => sum + t.hours, 0);
  },
  hoursByDepartmentForCase(caseId) {
    const out = {};
    DEPARTMENTS.forEach(d => out[d] = 0);
    TimeEntries.byCase(caseId).forEach(t => { out[t.department] = (out[t.department] || 0) + t.hours; });
    return out;
  },
  hoursByUserForCase(caseId) {
    const out = {};
    TimeEntries.byCase(caseId).forEach(t => { out[t.user_id] = (out[t.user_id] || 0) + t.hours; });
    return out;
  },
  hoursByPhaseForCase(caseId) {
    const out = {};
    PHASES.forEach(p => out[p] = 0);
    TimeEntries.byCase(caseId).forEach(t => { out[t.phase] = (out[t.phase] || 0) + t.hours; });
    return out;
  },
  totalHours(entries = TimeEntries.list()) {
    return entries.reduce((sum, t) => sum + t.hours, 0);
  },
  hoursByDepartment(entries = TimeEntries.list()) {
    const out = {};
    DEPARTMENTS.forEach(d => out[d] = 0);
    entries.forEach(t => { out[t.department] = (out[t.department] || 0) + t.hours; });
    return out;
  },
  hoursByUser(entries = TimeEntries.list()) {
    const out = {};
    entries.forEach(t => { out[t.user_id] = (out[t.user_id] || 0) + t.hours; });
    return out;
  },
  hoursByPhase(entries = TimeEntries.list()) {
    const out = {};
    PHASES.forEach(p => out[p] = 0);
    entries.forEach(t => { out[t.phase] = (out[t.phase] || 0) + t.hours; });
    return out;
  },
  casesByPhase(cases = Cases.list()) {
    const out = {};
    PHASES.forEach(p => out[p] = 0);
    cases.forEach(c => { out[c.phase] = (out[c.phase] || 0) + 1; });
    return out;
  },
  casesByStatus(cases = Cases.list()) {
    const out = {};
    STATUSES.forEach(s => out[s] = 0);
    cases.forEach(c => { out[c.status] = (out[c.status] || 0) + 1; });
    return out;
  },
  averageHoursPerCase(cases = Cases.list()) {
    if (!cases.length) return 0;
    const total = cases.reduce((s, c) => s + Calc.totalHoursForCase(c.id), 0);
    return total / cases.length;
  },
  averageDeptHoursPerCase(department, cases = Cases.list()) {
    if (!cases.length) return 0;
    let total = 0;
    cases.forEach(c => {
      TimeEntries.byCase(c.id).forEach(t => {
        if (t.department === department) total += t.hours;
      });
    });
    return total / cases.length;
  },
  timeToPoDays(caseObj) {
    if (!caseObj.po_date || !caseObj.created_at) return null;
    const start = new Date(caseObj.created_at);
    const end = new Date(caseObj.po_date);
    const diff = (end - start) / (1000 * 60 * 60 * 24);
    return diff < 0 ? null : Math.round(diff * 10) / 10;
  },
  averageTimeToPo(cases = Cases.list()) {
    const withPo = cases.filter(c => c.po_date);
    if (!withPo.length) return null;
    const sum = withPo.reduce((s, c) => s + (Calc.timeToPoDays(c) || 0), 0);
    return sum / withPo.length;
  },
  topCasesByHours(limit = 10, cases = Cases.list()) {
    return cases
      .map(c => ({ ...c, totalHours: Calc.totalHoursForCase(c.id) }))
      .sort((a, b) => b.totalHours - a.totalHours)
      .slice(0, limit);
  }
};

/* ------------------------------------------------------------
   Reset / Export
   ------------------------------------------------------------ */
const Admin = {
  resetAll() {
    if (isCloud()) {
      // I cloud-mode nulstilles data via SQL i Supabase, ikke fra klienten.
      throw new Error('Nulstilling sker i Supabase i cloud-mode (se SETUP.md).');
    }
    _store = emptyStore();
    persist();
  },
  exportJson() {
    return JSON.stringify(_store, null, 2);
  },
  importJson(json) {
    const obj = JSON.parse(json);
    _store = obj;
    persist();
  },
  setSeeded() {
    if (isCloud()) return;
    _store.meta.seeded = true;
    persist();
  },
  isSeeded() {
    return !!(_store.meta && _store.meta.seeded);
  }
};

/* ------------------------------------------------------------
   Helpers exposed to UI
   ------------------------------------------------------------ */
function formatHours(h) {
  if (h === null || h === undefined || isNaN(h)) return '0';
  const rounded = Math.round(h * 100) / 100;
  return rounded.toFixed(2).replace(/\.?0+$/, '').replace('.', ',');
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('da-DK', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleString('da-DK', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
}

function formatCurrency(n) {
  if (n === null || n === undefined || n === '') return '—';
  const v = Number(n);
  if (isNaN(v)) return '—';
  return v.toLocaleString('da-DK', { maximumFractionDigits: 0 }) + ' kr.';
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/* expose */
window.DB = { Users, Cases, TimeEntries, ActivityLog, Comments, Calc, Admin, hydrate, isCloud };
window.CONSTS = { DEPARTMENTS, PHASES, STATUSES, ACTIONS };
window.Fmt = { formatHours, formatDate, formatDateTime, formatCurrency, todayIso };

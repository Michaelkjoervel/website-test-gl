-- ============================================================
--  green light tidstracking — Supabase schema
-- ------------------------------------------------------------
--  Kør hele dette script i Supabase:
--    Dashboard → SQL Editor → New query → indsæt → Run
--
--  Det opretter tabeller, sikkerhedsregler (RLS) og de 11
--  brugerprofiler. Login-konti (email + adgangskode) oprettes
--  separat under Authentication → Users (se SETUP.md).
-- ============================================================

-- ---------- Tabeller ----------

create table if not exists public.users (
  id          text primary key,
  initials    text not null unique,
  name        text,
  department  text not null,
  role        text not null default 'user',
  email       text unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.cases (
  id                   text primary key,
  case_number          text,
  title                text not null,
  customer_name        text not null,
  description          text,
  created_by_user_id   text references public.users(id) on delete set null,
  responsible_user_id  text references public.users(id) on delete set null,
  primary_department   text not null,
  phase                text not null,
  status               text not null default 'Aktiv',
  estimated_value      numeric,
  created_at           timestamptz not null default now(),
  po_date              date,
  closed_at            timestamptz,
  result               text,
  lost_reason          text,
  notes                text,
  favorite             boolean not null default false,
  updated_at           timestamptz not null default now()
);

create table if not exists public.time_entries (
  id          text primary key,
  case_id     text not null references public.cases(id) on delete cascade,
  user_id     text references public.users(id) on delete set null,
  department  text not null,
  phase       text not null,
  entry_date  date not null,
  hours       numeric not null check (hours > 0),
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.activity_log (
  id          text primary key,
  case_id     text references public.cases(id) on delete cascade,
  user_id     text references public.users(id) on delete set null,
  action_type text not null,
  description text,
  created_at  timestamptz not null default now()
);

create table if not exists public.comments (
  id          text primary key,
  case_id     text not null references public.cases(id) on delete cascade,
  user_id     text references public.users(id) on delete set null,
  text        text not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_time_entries_case on public.time_entries(case_id);
create index if not exists idx_activity_case on public.activity_log(case_id);
create index if not exists idx_comments_case on public.comments(case_id);

-- ---------- Row Level Security ----------
-- Intern MVP: alle der er logget ind (authenticated) må læse og
-- skrive. Rolle-regler (kun admin må slette mm.) håndhæves i app'en.
-- Stram dette til senere hvis I vil have håndhævelse på databaseniveau.

alter table public.users        enable row level security;
alter table public.cases        enable row level security;
alter table public.time_entries enable row level security;
alter table public.activity_log enable row level security;
alter table public.comments     enable row level security;

do $$
declare t text;
begin
  foreach t in array array['users','cases','time_entries','activity_log','comments']
  loop
    execute format('drop policy if exists "auth_all_select" on public.%I;', t);
    execute format('drop policy if exists "auth_all_insert" on public.%I;', t);
    execute format('drop policy if exists "auth_all_update" on public.%I;', t);
    execute format('drop policy if exists "auth_all_delete" on public.%I;', t);

    execute format('create policy "auth_all_select" on public.%I for select to authenticated using (true);', t);
    execute format('create policy "auth_all_insert" on public.%I for insert to authenticated with check (true);', t);
    execute format('create policy "auth_all_update" on public.%I for update to authenticated using (true) with check (true);', t);
    execute format('create policy "auth_all_delete" on public.%I for delete to authenticated using (true);', t);
  end loop;
end $$;

-- ---------- Brugerprofiler (de 11 medarbejdere) ----------
-- MKJ er admin. Emails matcher login-kontiene i Authentication.
-- Ret emails her hvis I bruger et andet domæne.

insert into public.users (id, initials, name, department, role, email) values
  ('usr_jmd', 'JMD', 'JMD', 'Ledelse',          'user',  'jmd@green-light.dk'),
  ('usr_jas', 'JAS', 'JAS', 'Salg',             'user',  'jas@green-light.dk'),
  ('usr_mkj', 'MKJ', 'MKJ', 'Ledelse',          'admin', 'mkj@green-light.dk'),
  ('usr_sha', 'SHA', 'SHA', 'Salg',             'user',  'sha@green-light.dk'),
  ('usr_bfa', 'BFA', 'BFA', 'Teknisk afdeling', 'user',  'bfa@green-light.dk'),
  ('usr_kha', 'KHA', 'KHA', 'Teknisk afdeling', 'user',  'kha@green-light.dk'),
  ('usr_can', 'CAN', 'CAN', 'Administration',   'user',  'can@green-light.dk'),
  ('usr_jep', 'JEP', 'JEP', 'Salg',             'user',  'jep@green-light.dk'),
  ('usr_mda', 'MDA', 'MDA', 'Marketing',        'user',  'mda@green-light.dk'),
  ('usr_kma', 'KMA', 'KMA', 'Lager',            'user',  'kma@green-light.dk'),
  ('usr_alh', 'ALH', 'ALH', 'Administration',   'user',  'alh@green-light.dk')
on conflict (id) do update set
  initials   = excluded.initials,
  department = excluded.department,
  role       = excluded.role,
  email      = excluded.email;

-- ============================================================
--  VALGFRI demo-data — slet denne blok hvis I vil starte tomt.
-- ============================================================

insert into public.cases
  (id, case_number, title, customer_name, description, created_by_user_id,
   responsible_user_id, primary_department, phase, status, estimated_value,
   created_at, po_date, closed_at, result, notes, favorite)
values
  ('case_demo1', 'GL-2026-001', 'Kontorbelysning til administrationsbygning',
   'Nordvest Ejendomme A/S', 'Renovering af belysning med DALI-styring.',
   'usr_jas', 'usr_jas', 'Salg', 'Eksekveringsfase', 'Vundet', 480000,
   now() - interval '64 days', (now() - interval '30 days')::date,
   now() - interval '30 days', 'won', 'DALI broadcast styring.', false),
  ('case_demo2', 'GL-2026-002', 'Industribelysning til lagerhal',
   'Skagen Logistik ApS', 'LED highbay til 8000 m² lager med sensorstyring.',
   'usr_sha', 'usr_sha', 'Salg', 'Tilbudsfase', 'Aktiv', 720000,
   now() - interval '22 days', null, null, null, 'Stor energibesparelse.', false),
  ('case_demo3', 'GL-2026-003', 'ATEX belysning til produktionsområde',
   'Esbjerg Kemi A/S', 'ATEX zone 1 belysning til kemisk produktion.',
   'usr_jep', 'usr_jep', 'Salg', 'Præsentationsfase', 'Aktiv', 1250000,
   now() - interval '41 days', null, null, null, 'Mulighed for serviceaftale.', false)
on conflict (id) do nothing;

insert into public.time_entries
  (id, case_id, user_id, department, phase, entry_date, hours, description, created_at)
values
  ('te_d1', 'case_demo1', 'usr_jas', 'Salg',             'Opstartsfase',      (now() - interval '60 days')::date, 2.5, 'Kundemøde og behovsafdækning', now() - interval '60 days'),
  ('te_d2', 'case_demo1', 'usr_bfa', 'Teknisk afdeling', 'Tilbudsfase',       (now() - interval '50 days')::date, 4,   'Lysberegning og produktvalg',  now() - interval '50 days'),
  ('te_d3', 'case_demo1', 'usr_kha', 'Teknisk afdeling', 'Eksekveringsfase',  (now() - interval '10 days')::date, 6,   'Montagesupport on-site',       now() - interval '10 days'),
  ('te_d4', 'case_demo2', 'usr_sha', 'Salg',             'Opstartsfase',      (now() - interval '21 days')::date, 1.5, 'Site survey',                  now() - interval '21 days'),
  ('te_d5', 'case_demo2', 'usr_kha', 'Teknisk afdeling', 'Tilbudsfase',       (now() - interval '18 days')::date, 3,   'Lysberegning DIALux',          now() - interval '18 days'),
  ('te_d6', 'case_demo3', 'usr_jep', 'Salg',             'Opstartsfase',      (now() - interval '40 days')::date, 2,   'Indledende møde og krav',      now() - interval '40 days'),
  ('te_d7', 'case_demo3', 'usr_bfa', 'Teknisk afdeling', 'Tilbudsfase',       (now() - interval '36 days')::date, 5,   'ATEX dokumentation',           now() - interval '36 days'),
  ('te_d8', 'case_demo3', 'usr_mda', 'Marketing',        'Præsentationsfase', (now() - interval '22 days')::date, 1.5, 'Kundepræsentation klargjort',  now() - interval '22 days')
on conflict (id) do nothing;

insert into public.activity_log (id, case_id, user_id, action_type, description, created_at)
values
  ('log_d1', 'case_demo1', 'usr_jas', 'Sag oprettet', 'Oprettede sag', now() - interval '64 days'),
  ('log_d2', 'case_demo1', 'usr_jas', 'Sag vundet',   'Sag vundet. PO dato registreret', now() - interval '30 days'),
  ('log_d3', 'case_demo2', 'usr_sha', 'Sag oprettet', 'Oprettede sag', now() - interval '22 days'),
  ('log_d4', 'case_demo3', 'usr_jep', 'Sag oprettet', 'Oprettede sag', now() - interval '41 days')
on conflict (id) do nothing;

-- Færdig. Tjek tabellerne under Table Editor.

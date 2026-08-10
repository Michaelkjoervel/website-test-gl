-- =============================================================================
-- green light · Salgscoach — datamodel, adgang og rettigheder
-- -----------------------------------------------------------------------------
-- Kør dette script i Supabase: Dashboard → SQL Editor → New query →
-- indsæt hele filen → Run. Scriptet kan køres igen uden skade (idempotent):
-- alt oprettes med "if not exists", og hver politik droppes før den genskabes.
-- To kørsler i træk giver samme resultat som én — ingen dubletter, ingen fejl.
--
-- VIGTIGT: scriptet RØRER IKKE de eksisterende tabeller fra supabase/schema.sql
-- (viz_fixtures, viz_visualizations, estimator_pricing). De kører videre i
-- produktion præcis som før; her lægges kun nye coach_*-tabeller ovenpå i det
-- samme Supabase-projekt, så holdet beholder ét fælles login.
--
-- Scriptet opretter fem tabeller:
--   coach_users      – holdet: initialer, navn, rolle (sælger eller leder)
--   coach_sessions   – én række pr. træningssession (samtale + feedback)
--   coach_profiles   – sælgerens udviklingsprofil (mønstre, signaler, anbefalinger)
--   coach_documents  – uploadet kundemateriale + materialeanalyse
--   coach_manual     – uploadet salgsmanual, der overskriver den indbyggede
--
-- Domænet ligger i jsonb-kolonnen "data" og følger typerne i
-- salgscoach/src/lib/types.ts (TrainingSession, SellerProfile, SalesDocument …).
-- Kolonnerne udenom er kun dem, vi skal kunne filtrere, sortere og sikre på.
--
-- Adgangsmodellen i én sætning:
--   Sælgeren ejer sine egne data. Lederen må LÆSE sessioner og profiler for at
--   kunne coache — men aldrig læse andres kundemateriale, og aldrig skrive i
--   andres rækker.
--
-- Bemærk: rettigheder på tabelniveau (grant select/insert/…) kommer automatisk
-- fra Supabases default privileges i schema public — præcis som for de
-- eksisterende viz_*-tabeller. Beskyttelsen sker i Row Level Security nedenfor.
-- =============================================================================


-- =============================================================================
-- 1) Tabeller
-- =============================================================================

-- Holdet. Én række pr. bruger, med samme id som Supabase-loginnet, så
-- auth.uid() altid kan slås direkte op her.
create table if not exists public.coach_users (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  initials    text unique,                                  -- JAS, ALH, KMA, HRN, MKJ …
  name        text,
  role        text not null default 'saelger'
              constraint coach_users_role_check check (role in ('saelger', 'leder')),
  active      boolean not null default true,                -- fratrådte deaktiveres, slettes ikke
  created_at  timestamptz not null default now()
);

-- Én træningssession = én samtale med coachen, inkl. transskription og feedback.
-- id er tekst, fordi appen selv danner id'et (samme mønster som viz_*).
create table if not exists public.coach_sessions (
  id               text primary key,
  seller_id        uuid default auth.uid(),                 -- ejeren; sættes automatisk ved insert
  seller_initials  text,                                    -- kopi til hurtige lister og ledelsesoverblik
  data             jsonb not null,                          -- TrainingSession
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Udviklingsprofilen. Én række pr. sælger — derfor er seller_id primærnøgle.
create table if not exists public.coach_profiles (
  seller_id   uuid primary key default auth.uid(),
  initials    text unique,
  data        jsonb not null,                               -- SellerProfile
  updated_at  timestamptz not null default now()
);

-- Uploadet kundemateriale (tilbud, præsentationer) og coachens analyse af det.
-- Fortroligt: se adgangsafsnittet — kun sælgeren selv kan se sine egne rækker.
create table if not exists public.coach_documents (
  id               text primary key,
  seller_id        uuid default auth.uid(),
  seller_initials  text,
  data             jsonb not null,                          -- SalesDocument (inkl. MaterialAnalysis)
  created_at       timestamptz not null default now()
);

-- Salgsmanualen. Serveren har en indbygget kernemanual; uploader en leder en
-- nyere version her, bruger appen den i stedet. Flere versioner må gerne ligge
-- side om side — appen henter den senest uploadede.
create table if not exists public.coach_manual (
  id           text primary key,
  version      text,
  name         text,
  data         jsonb not null,                              -- ManualDocumentMeta + ManualPrinciple[]
  uploaded_by  uuid references auth.users (id) on delete set null,
  uploaded_at  timestamptz not null default now()
);


-- =============================================================================
-- 2) Indeks
-- -----------------------------------------------------------------------------
-- Kun de opslag appen rent faktisk laver: sælgerens egen historik (nyeste
-- først), opslag på initialer i ledelsesoverblikket, og materialelisten.
-- =============================================================================

create index if not exists coach_sessions_seller_created_idx
  on public.coach_sessions (seller_id, created_at desc);

create index if not exists coach_sessions_initials_idx
  on public.coach_sessions (seller_initials);

create index if not exists coach_documents_seller_idx
  on public.coach_documents (seller_id);

-- initials er allerede unique (og dermed indekseret) på coach_profiles; dette
-- indeks er taget med for at gøre adgangsmønsteret eksplicit. Tabellen har én
-- række pr. sælger, så omkostningen er reelt nul.
create index if not exists coach_profiles_initials_idx
  on public.coach_profiles (initials);


-- =============================================================================
-- 3) updated_at holdes ajour
-- -----------------------------------------------------------------------------
-- Vi genbruger triggerfunktionen fra visualiseringsværktøjet. Body'en er ORD
-- FOR ORD den samme som i supabase/schema.sql, så "create or replace" er
-- harmløst, uanset hvilket af de to scripts der er kørt først eller sidst.
-- =============================================================================

create or replace function public.viz_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists coach_sessions_touch on public.coach_sessions;
create trigger coach_sessions_touch before update on public.coach_sessions
  for each row execute function public.viz_touch_updated_at();

drop trigger if exists coach_profiles_touch on public.coach_profiles;
create trigger coach_profiles_touch before update on public.coach_profiles
  for each row execute function public.viz_touch_updated_at();


-- =============================================================================
-- 4) coach_is_manager() — én kilde til sandhed om "er brugeren leder?"
-- -----------------------------------------------------------------------------
-- Funktionen slår den kaldende bruger op i coach_users og svarer true, hvis
-- rollen er 'leder' OG kontoen er aktiv (en deaktiveret leder mister adgangen).
--
-- Tre detaljer der skal være som de er:
--   1) security definer — funktionen kører som ejeren (postgres) og rammer
--      derfor ikke Row Level Security på coach_users. Det er præcis dét, der
--      forhindrer uendelig rekursion, når politikkerne PÅ coach_users selv
--      kalder funktionen. Derfor sætter vi bevidst heller ikke
--      "force row level security" på coach_users.
--   2) set search_path = '' — søgestien låses, så ingen kan snyde funktionen
--      til at ramme en anden tabel ved at lave sit eget skema. Alt er derfor
--      fuldt kvalificeret (public.coach_users, auth.uid()).
--   3) stable — resultatet er konstant inden for én sætning, så Postgres må
--      genbruge det i stedet for at kalde funktionen pr. række.
-- =============================================================================

create or replace function public.coach_is_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.coach_users u
    where u.id = auth.uid()
      and u.role = 'leder'
      and u.active
  );
$$;

comment on function public.coach_is_manager() is
  'True hvis den kaldende bruger er aktiv leder i coach_users. Security definer, så politikker på coach_users ikke rekurserer.';

-- Funktionen røber kun noget om kalderen selv, men vi holder alligevel
-- rettighederne stramme.
revoke all on function public.coach_is_manager() from public;
grant execute on function public.coach_is_manager() to authenticated;
grant execute on function public.coach_is_manager() to service_role;


-- =============================================================================
-- 5) Row Level Security slås til på alle fem tabeller
-- -----------------------------------------------------------------------------
-- Uden dette ville anon-nøglen (som ligger offentligt i JS-bundlen) kunne læse
-- alt. Med det afvises enhver forespørgsel, der ikke matcher en politik.
-- =============================================================================

alter table public.coach_users     enable row level security;
alter table public.coach_sessions  enable row level security;
alter table public.coach_profiles  enable row level security;
alter table public.coach_documents enable row level security;
alter table public.coach_manual    enable row level security;


-- =============================================================================
-- 6) Politikker
-- -----------------------------------------------------------------------------
-- Alle politikker er skrevet "to authenticated": anonyme kald rammer ingen
-- politik og får derfor intet ud.
--
-- auth.uid() og coach_is_manager() pakkes ind i (select …). Det er ikke pynt:
-- Postgres beregner dem så én gang pr. sætning i stedet for én gang pr. række.
-- =============================================================================

-- ---------------------------------------------------------------- coach_users
-- Hele holdet må LÆSE listen: initialer og navne bruges overalt i UI'et
-- (hvem har kørt en session, hvem står en profil for, hvem er leder).
-- Skrivning er strammere:
--   · man må rette sin egen række (navn, e-mail, initialer)
--   · en leder må oprette og rette alle rækker og sætte roller
--   · man kan IKKE forfremme sig selv — se WITH CHECK nedenfor
drop policy if exists "team select coach users" on public.coach_users;
drop policy if exists "self or manager insert coach users" on public.coach_users;
drop policy if exists "self or manager update coach users" on public.coach_users;
drop policy if exists "manager delete coach users" on public.coach_users;

create policy "team select coach users" on public.coach_users
  for select to authenticated
  using (true);

-- En ny sælger må oprette sin EGEN række ved første login (så holdet ikke går i
-- stå, hvis lederen ikke er ved tasterne) — men kun med rollen 'saelger'.
-- Alle andre rækker kræver leder.
create policy "self or manager insert coach users" on public.coach_users
  for insert to authenticated
  with check (
    (select public.coach_is_manager())
    or (id = (select auth.uid()) and role = 'saelger')
  );

-- USING bestemmer HVILKE rækker man må røre, WITH CHECK hvordan de må se ud
-- BAGEFTER. Her lukkes hullet med rolle-eskalering: en almindelig sælger må
-- kun efterlade sin egen række med role = 'saelger'. Forsøger man at sætte
-- role = 'leder' på sig selv, fejler WITH CHECK, og opdateringen afvises.
-- Kun en leder (der allerede ER leder) kan flytte roller.
create policy "self or manager update coach users" on public.coach_users
  for update to authenticated
  using (
    (select public.coach_is_manager())
    or id = (select auth.uid())
  )
  with check (
    (select public.coach_is_manager())
    or (id = (select auth.uid()) and role = 'saelger')
  );

-- Vi sletter helst ikke brugere (historikken skal kunne læses bagud) — sæt
-- active = false i stedet. Skal en række alligevel væk, kræver det en leder.
create policy "manager delete coach users" on public.coach_users
  for delete to authenticated
  using ((select public.coach_is_manager()));


-- ------------------------------------------------------------- coach_sessions
-- Sælgeren har fuld råderet over sine egne sessioner.
-- Lederen må LÆSE alle sessioner — det er hele pointen med værktøjet: han skal
-- kunne coache på det, der faktisk blev sagt. Men LÆSE er også alt: der er
-- bevidst ingen insert/update/delete-politik for ledere. En leder skal aldrig
-- kunne rette eller slette i en sælgers træningshistorik, hverken ved et uheld
-- eller med vilje — ellers kan sælgeren ikke stole på materialet.
drop policy if exists "own or manager select sessions" on public.coach_sessions;
drop policy if exists "own insert sessions" on public.coach_sessions;
drop policy if exists "own update sessions" on public.coach_sessions;
drop policy if exists "own delete sessions" on public.coach_sessions;

create policy "own or manager select sessions" on public.coach_sessions
  for select to authenticated
  using (
    seller_id = (select auth.uid())
    or (select public.coach_is_manager())
  );

create policy "own insert sessions" on public.coach_sessions
  for insert to authenticated
  with check (seller_id = (select auth.uid()));

create policy "own update sessions" on public.coach_sessions
  for update to authenticated
  using (seller_id = (select auth.uid()))
  with check (seller_id = (select auth.uid()));

create policy "own delete sessions" on public.coach_sessions
  for delete to authenticated
  using (seller_id = (select auth.uid()));


-- ------------------------------------------------------------- coach_profiles
-- Samme princip som sessioner: sælgeren ejer og vedligeholder sin egen profil,
-- lederen må læse den for at kunne følge udviklingen — men ikke skrive i den.
-- Udviklingsprofilen er coachens vurdering af sælgeren; kan en leder redigere
-- den, er den ikke længere troværdig.
drop policy if exists "own or manager select profiles" on public.coach_profiles;
drop policy if exists "own insert profiles" on public.coach_profiles;
drop policy if exists "own update profiles" on public.coach_profiles;
drop policy if exists "own delete profiles" on public.coach_profiles;

create policy "own or manager select profiles" on public.coach_profiles
  for select to authenticated
  using (
    seller_id = (select auth.uid())
    or (select public.coach_is_manager())
  );

create policy "own insert profiles" on public.coach_profiles
  for insert to authenticated
  with check (seller_id = (select auth.uid()));

create policy "own update profiles" on public.coach_profiles
  for update to authenticated
  using (seller_id = (select auth.uid()))
  with check (seller_id = (select auth.uid()));

create policy "own delete profiles" on public.coach_profiles
  for delete to authenticated
  using (seller_id = (select auth.uid()));


-- ------------------------------------------------------------ coach_documents
-- HER STOPPER LEDERENS INDSIGT — og det er et bevidst valg.
--
-- coach_documents indeholder materiale, sælgeren har uploadet om en konkret
-- kunde: tilbud, priser, mødenoter, præsentationer. Det er kundens materiale
-- lige så meget som green lights, og det er lagt ind for ÉT formål: at coachen
-- kan gennemgå det med den sælger, der har uploadet det.
--
-- Derfor gælder der ingen leder-undtagelse på denne tabel. Ingen — heller ikke
-- en leder — kan læse en anden sælgers uploadede kundemateriale. En sælger
-- skal kunne lægge et helt reelt kundetilbud ind uden at tænke over, hvem der
-- ellers kigger med; ellers uploader man kun det ufarlige, og så er analysen
-- ingenting værd. Vil lederen se materialet, må han bede sælgeren om det.
--
-- Bemærk: coach_is_manager() optræder bevidst IKKE i nogen af de fire
-- politikker herunder. Det er ikke en forglemmelse.
drop policy if exists "own select documents" on public.coach_documents;
drop policy if exists "own insert documents" on public.coach_documents;
drop policy if exists "own update documents" on public.coach_documents;
drop policy if exists "own delete documents" on public.coach_documents;

create policy "own select documents" on public.coach_documents
  for select to authenticated
  using (seller_id = (select auth.uid()));

create policy "own insert documents" on public.coach_documents
  for insert to authenticated
  with check (seller_id = (select auth.uid()));

create policy "own update documents" on public.coach_documents
  for update to authenticated
  using (seller_id = (select auth.uid()))
  with check (seller_id = (select auth.uid()));

create policy "own delete documents" on public.coach_documents
  for delete to authenticated
  using (seller_id = (select auth.uid()));


-- --------------------------------------------------------------- coach_manual
-- Manualen er fælles viden: alle skal kunne læse den, for coachen bruger den i
-- hver eneste session. Kun en leder må lægge en ny version op eller fjerne en
-- gammel — manualen er ledelsens dokument.
drop policy if exists "team select manual" on public.coach_manual;
drop policy if exists "manager insert manual" on public.coach_manual;
drop policy if exists "manager update manual" on public.coach_manual;
drop policy if exists "manager delete manual" on public.coach_manual;

create policy "team select manual" on public.coach_manual
  for select to authenticated
  using (true);

create policy "manager insert manual" on public.coach_manual
  for insert to authenticated
  with check ((select public.coach_is_manager()));

create policy "manager update manual" on public.coach_manual
  for update to authenticated
  using ((select public.coach_is_manager()))
  with check ((select public.coach_is_manager()));

create policy "manager delete manual" on public.coach_manual
  for delete to authenticated
  using ((select public.coach_is_manager()));


-- =============================================================================
-- 7) Holdet — klar-til-brug skabelon (kør den manuelt, ikke automatisk)
-- -----------------------------------------------------------------------------
-- Rækkerne i coach_users KAN ikke seedes blindt herfra: id skal være det
-- rigtige uuid fra auth.users, og det findes først, når personen er oprettet
-- som bruger i Supabase (Dashboard → Authentication → Users → Add user, eller
-- ved første login via magic link).
--
-- Fremgangsmåde:
--   1) Opret de fem brugere under Authentication → Users med deres
--      green-light-mails.
--   2) Kør opslaget herunder for at se, at de findes:
--
--        select id, email from auth.users order by email;
--
--   3) Ret e-mail, navn og initialer i blokken herunder, fjern kommentar-
--      tegnene (markér blokken og tryk Ctrl+/ i SQL Editoren) og kør den.
--      Blokken slår selv uuid'et op på e-mailen, så der er intet at copy-paste.
--      Den kan køres igen — "on conflict" opdaterer bare rækken.
--
-- --- KLIP HER ---------------------------------------------------------------
--
-- insert into public.coach_users (id, email, initials, name, role, active)
-- select u.id, lower(u.email), v.initials, v.name, v.role, true
-- from (values
--         ('jas@green-light.dk', 'JAS', 'Fornavn Efternavn', 'saelger'),
--         ('alh@green-light.dk', 'ALH', 'Fornavn Efternavn', 'saelger'),
--         ('kma@green-light.dk', 'KMA', 'Fornavn Efternavn', 'saelger'),
--         ('hrn@green-light.dk', 'HRN', 'Fornavn Efternavn', 'saelger'),
--         ('mkj@green-light.dk', 'MKJ', 'Fornavn Efternavn', 'leder')
--      ) as v(email, initials, name, role)
-- join auth.users u on lower(u.email) = v.email
-- on conflict (id) do update
--   set email    = excluded.email,
--       initials = excluded.initials,
--       name     = excluded.name,
--       role     = excluded.role,
--       active   = excluded.active;
--
-- --- KLIP HER ---------------------------------------------------------------
--
-- BEMÆRK: mkj@green-light.dk skal have role = 'leder'. Det er den eneste konto,
-- der som udgangspunkt kan se ledelsesoverblikket, uploade en ny salgsmanual og
-- rette i holdlisten. Uden mindst én leder kan ingen forfremme nogen — politikken
-- ovenfor forhindrer med vilje, at man giver sig selv rollen. Skal en leder
-- udpeges bagefter, gøres det her fra SQL Editoren (som kører uden om RLS):
--
--   update public.coach_users set role = 'leder' where lower(email) = 'mkj@green-light.dk';
--
-- Og en fratrådt sælger deaktiveres frem for at blive slettet, så historikken
-- bevares:
--
--   update public.coach_users set active = false where initials = 'XXX';


-- =============================================================================
-- 8) Verifikation
-- -----------------------------------------------------------------------------
-- Kør gerne disse efter installationen. De ændrer intet.
--
-- a) Er RLS slået til, og fik alle fem tabeller deres fire politikker?
--    Kører automatisk til sidst i dette script — se resultatet nedenfor.
--
-- b) Hvilke politikker findes, og hvad tillader de?
--
--      select tablename, policyname, cmd, qual, with_check
--      from pg_policies
--      where schemaname = 'public' and tablename like 'coach\_%'
--      order by tablename, cmd, policyname;
--
-- c) Er jeg leder? (kør som indlogget bruger via appen/REST — i SQL Editoren
--    er auth.uid() null, så svaret er altid false her)
--
--      select public.coach_is_manager();
--
-- d) Holdlisten og rollerne:
--
--      select initials, name, role, active from public.coach_users order by initials;
--
-- e) Røgtest af fortroligheden: logget ind som sælger skal disse to give
--    NØJAGTIG det samme tal — man ser kun sit eget materiale:
--
--      select count(*) from public.coach_documents;
--      select count(*) from public.coach_documents where seller_id = auth.uid();
--
--    Og en leder skal se alle sessioner, men stadig kun sit eget materiale:
--
--      select count(*) from public.coach_sessions;   -- alle
--      select count(*) from public.coach_documents;  -- kun egne
-- =============================================================================

select
  c.relname                                   as tabel,
  c.relrowsecurity                            as rls_aktiv,
  (select count(*) from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = c.relname)            as antal_politikker
from pg_class c
where c.relnamespace = 'public'::regnamespace
  and c.relname in ('coach_users', 'coach_sessions', 'coach_profiles',
                    'coach_documents', 'coach_manual')
order by c.relname;

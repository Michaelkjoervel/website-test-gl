-- =============================================================================
-- green light · visualiseringsværktøj — fælles katalog & backup
-- -----------------------------------------------------------------------------
-- Kør dette script ÉN gang i Supabase: Dashboard → SQL Editor → New query →
-- indsæt hele filen → Run. Scriptet kan køres igen uden skade (idempotent).
--
-- Det opretter to tabeller, hvor appen gemmer:
--   viz_fixtures        – armaturkataloget ("Universet")
--   viz_visualizations  – gemte kundevisualiseringer (inkl. billeder)
--
-- Adgang: KUN loggede-ind brugere (teamet) kan læse/skrive. Anonyme kald
-- afvises af Row Level Security, selvom anon-nøglen er offentlig.
-- =============================================================================

create table if not exists public.viz_fixtures (
  id          text primary key,
  data        jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid default auth.uid()
);

create table if not exists public.viz_visualizations (
  id          text primary key,
  data        jsonb not null,
  updated_at  timestamptz not null default now(),
  created_by  uuid default auth.uid()
);

alter table public.viz_fixtures enable row level security;
alter table public.viz_visualizations enable row level security;

-- Hele teamet (alle loggede-ind brugere) deler data.
drop policy if exists "team select fixtures" on public.viz_fixtures;
drop policy if exists "team insert fixtures" on public.viz_fixtures;
drop policy if exists "team update fixtures" on public.viz_fixtures;
drop policy if exists "team delete fixtures" on public.viz_fixtures;
create policy "team select fixtures" on public.viz_fixtures for select to authenticated using (true);
create policy "team insert fixtures" on public.viz_fixtures for insert to authenticated with check (true);
create policy "team update fixtures" on public.viz_fixtures for update to authenticated using (true) with check (true);
create policy "team delete fixtures" on public.viz_fixtures for delete to authenticated using (true);

drop policy if exists "team select viz" on public.viz_visualizations;
drop policy if exists "team insert viz" on public.viz_visualizations;
drop policy if exists "team update viz" on public.viz_visualizations;
drop policy if exists "team delete viz" on public.viz_visualizations;
create policy "team select viz" on public.viz_visualizations for select to authenticated using (true);
create policy "team insert viz" on public.viz_visualizations for insert to authenticated with check (true);
create policy "team update viz" on public.viz_visualizations for update to authenticated using (true) with check (true);
create policy "team delete viz" on public.viz_visualizations for delete to authenticated using (true);

-- Hold updated_at ajour ved opdateringer.
create or replace function public.viz_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists viz_fixtures_touch on public.viz_fixtures;
create trigger viz_fixtures_touch before update on public.viz_fixtures
  for each row execute function public.viz_touch_updated_at();

drop trigger if exists viz_visualizations_touch on public.viz_visualizations;
create trigger viz_visualizations_touch before update on public.viz_visualizations
  for each row execute function public.viz_touch_updated_at();

-- =============================================================================
-- estimator_pricing — fortroligt prisgrundlag til estimatværktøjet
-- -----------------------------------------------------------------------------
-- Rigtige armatur- og tilvalgspriser gemmes HER og hentes først efter login.
-- De ligger dermed hverken i repoet eller i den offentlige JS-bundle; koden
-- indeholder kun ufarlige placeholder-priser som fallback.
-- Én række pr. konfiguration; appen bruger id 'default'.
-- =============================================================================

create table if not exists public.estimator_pricing (
  id          text primary key,
  config      jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid default auth.uid()
);

alter table public.estimator_pricing enable row level security;

drop policy if exists "team select pricing" on public.estimator_pricing;
drop policy if exists "team insert pricing" on public.estimator_pricing;
drop policy if exists "team update pricing" on public.estimator_pricing;
drop policy if exists "team delete pricing" on public.estimator_pricing;
create policy "team select pricing" on public.estimator_pricing for select to authenticated using (true);
create policy "team insert pricing" on public.estimator_pricing for insert to authenticated with check (true);
create policy "team update pricing" on public.estimator_pricing for update to authenticated using (true) with check (true);
create policy "team delete pricing" on public.estimator_pricing for delete to authenticated using (true);

drop trigger if exists estimator_pricing_touch on public.estimator_pricing;
create trigger estimator_pricing_touch before update on public.estimator_pricing
  for each row execute function public.viz_touch_updated_at();

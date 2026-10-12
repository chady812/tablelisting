-- =============================================================================
--  tablelisting — Supabase / PostgreSQL migration
--  Owners (apartments) + Clients for real-estate contact management.
--
--  Apply with the Supabase SQL Editor, or via the CLI:
--      supabase db push
--      psql "$DATABASE_URL" -f schema.sql
-- =============================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "pg_trgm";    -- gin_trgm_ops search indexes

-- -----------------------------------------------------------------------------
--  Tables
--
--  Status columns use `text` + a CHECK constraint rather than a Postgres ENUM so
--  a new status can be added later with a single ALTER TABLE without needing an
--  ALTER TYPE migration.
-- -----------------------------------------------------------------------------

create table if not exists public.owners (
  id             uuid         primary key default gen_random_uuid(),
  property_name  text         not null,
  owner_name     text         not null,
  phone          text,
  price          numeric(12,2),
  location       text,
  status         text         not null default 'available'
                 check (status in ('available', 'rented', 'pending')),
  notes          text,
  created_at     timestamptz  not null default now(),
  updated_at     timestamptz  not null default now()
);

create table if not exists public.clients (
  id                uuid        primary key default gen_random_uuid(),
  client_name       text        not null,
  phone             text,
  budget            numeric(12,2),
  preferences       text,
  desired_location  text,
  status            text        not null default 'looking'
                    check (status in ('looking', 'matched', 'closed')),
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
--  updated_at maintenance
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists owners_set_updated_at on public.owners;
create trigger owners_set_updated_at
  before update on public.owners
  for each row execute function public.set_updated_at();

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
--  Indexes
--  · B-tree for status filtering and newest-first ordering.
--  · GIN (trigram) for ILIKE `%term%` live search on every searchable text
--    column, so the search-as-you-type bar stays fast past a few thousand rows.
-- -----------------------------------------------------------------------------

create index if not exists owners_status_idx     on public.owners (status);
create index if not exists owners_created_at_idx on public.owners (created_at desc);
create index if not exists clients_status_idx    on public.clients (status);
create index if not exists clients_created_at_idx on public.clients (created_at desc);

create index if not exists owners_property_name_trgm_idx
  on public.owners using gin (property_name gin_trgm_ops);
create index if not exists owners_owner_name_trgm_idx
  on public.owners using gin (owner_name gin_trgm_ops);
create index if not exists owners_phone_trgm_idx
  on public.owners using gin (phone gin_trgm_ops);
create index if not exists owners_location_trgm_idx
  on public.owners using gin (location gin_trgm_ops);

create index if not exists clients_client_name_trgm_idx
  on public.clients using gin (client_name gin_trgm_ops);
create index if not exists clients_phone_trgm_idx
  on public.clients using gin (phone gin_trgm_ops);
create index if not exists clients_desired_location_trgm_idx
  on public.clients using gin (desired_location gin_trgm_ops);
create index if not exists clients_preferences_trgm_idx
  on public.clients using gin (preferences gin_trgm_ops);

-- -----------------------------------------------------------------------------
--  Row Level Security
--
--  ⚠️  These policies are intentionally wide so the app works out of the box with
--     only a public anon/publishable key and no auth UI. That means anyone with
--     the key can read and write these two tables — fine for a personal tool on
--     localhost, NOT fine on the public internet.
--
--  To lock it down before deploying, replace them with a user-owned column:
--
--      alter table public.owners add column owner_id uuid references auth.users(id);
--      drop policy "owners public access" on public.owners;
--      create policy "own rows only" on public.owners
--        for all to authenticated
--        using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
-- -----------------------------------------------------------------------------

alter table public.owners enable row level security;
alter table public.clients enable row level security;

drop policy if exists "owners public access" on public.owners;
create policy "owners public access"
  on public.owners for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "clients public access" on public.clients;
create policy "clients public access"
  on public.clients for all
  to anon, authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.owners to anon, authenticated;
grant select, insert, update, delete on public.clients to anon, authenticated;

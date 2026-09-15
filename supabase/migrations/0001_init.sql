-- SocialLens — initial schema
-- Tokens are NEVER stored in plaintext: see token_encrypted (pgsodium / app-level AES-GCM).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id          uuid primary key default gen_random_uuid(),
  email       text unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- instagram_accounts
-- ---------------------------------------------------------------------------
create type public.account_type as enum ('BUSINESS', 'CREATOR', 'PERSONAL', 'UNKNOWN');

create table if not exists public.instagram_accounts (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.users(id) on delete cascade,
  instagram_account_id  text not null unique,
  username              text not null,
  name                  text,
  profile_picture_url   text,
  account_type          public.account_type not null default 'UNKNOWN',
  media_count           integer not null default 0,
  followers_count       integer not null default 0,
  follows_count         integer not null default 0,
  -- AES-256-GCM ciphertext (base64: iv || ciphertext || tag) produced by the edge function
  token_encrypted       text not null,
  token_expires_at      timestamptz,
  connected_at          timestamptz not null default now(),
  last_sync_at          timestamptz,
  updated_at            timestamptz not null default now()
);
create index if not exists instagram_accounts_user_idx on public.instagram_accounts(user_id);

-- ---------------------------------------------------------------------------
-- app sessions (opaque tokens handed to the mobile app; never the IG token)
-- ---------------------------------------------------------------------------
create table if not exists public.app_sessions (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.users(id) on delete cascade,
  instagram_account_id  uuid not null references public.instagram_accounts(id) on delete cascade,
  token_hash            text not null unique,          -- sha256(session token)
  expires_at            timestamptz not null,
  created_at            timestamptz not null default now(),
  last_seen_at          timestamptz
);

-- ---------------------------------------------------------------------------
-- media_snapshots
-- ---------------------------------------------------------------------------
create type public.media_type as enum ('IMAGE', 'VIDEO', 'REEL', 'CAROUSEL_ALBUM', 'UNKNOWN');

create table if not exists public.media_snapshots (
  id                    uuid primary key default gen_random_uuid(),
  instagram_account_id  uuid not null references public.instagram_accounts(id) on delete cascade,
  instagram_media_id    text not null,
  media_type            public.media_type not null default 'UNKNOWN',
  permalink             text,
  thumbnail_url         text,
  media_url             text,
  caption               text,
  timestamp             timestamptz,
  created_at            timestamptz not null default now(),
  unique (instagram_account_id, instagram_media_id)
);

-- ---------------------------------------------------------------------------
-- metric_snapshots (history → period charts)
-- ---------------------------------------------------------------------------
create table if not exists public.metric_snapshots (
  id                    uuid primary key default gen_random_uuid(),
  instagram_account_id  uuid not null references public.instagram_accounts(id) on delete cascade,
  instagram_media_id    text,
  metric_name           text not null,
  metric_value          numeric not null,
  snapshot_time         timestamptz not null default now()
);
create index if not exists metric_snapshots_lookup_idx
  on public.metric_snapshots(instagram_account_id, metric_name, snapshot_time desc);

-- ---------------------------------------------------------------------------
-- simulation (optional cloud backup of the on-device overlay)
-- ---------------------------------------------------------------------------
create table if not exists public.simulation_profiles (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.users(id) on delete cascade,
  instagram_account_id  uuid not null references public.instagram_accounts(id) on delete cascade,
  name                  text not null,
  is_active             boolean not null default false,
  created_at            timestamptz not null default now()
);

create table if not exists public.simulation_values (
  id                      uuid primary key default gen_random_uuid(),
  simulation_profile_id   uuid not null references public.simulation_profiles(id) on delete cascade,
  instagram_media_id      text,
  metric_name             text not null,
  original_value          numeric not null,
  simulated_value         numeric not null,
  updated_at              timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- recommendations
-- ---------------------------------------------------------------------------
create table if not exists public.recommendations (
  id                    uuid primary key default gen_random_uuid(),
  instagram_account_id  uuid not null references public.instagram_accounts(id) on delete cascade,
  instagram_media_id    text,
  recommendation_type   text not null,
  title                 text not null,
  description           text not null,
  priority              integer not null default 5,
  created_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- rate limiting for edge functions
-- ---------------------------------------------------------------------------
create table if not exists public.rate_limits (
  key          text primary key,     -- e.g. "ip:1.2.3.4:public-profile"
  window_start timestamptz not null,
  count        integer not null default 0
);

-- ---------------------------------------------------------------------------
-- RLS: everything is accessed through edge functions using the service role.
-- Direct client access is denied by default.
-- ---------------------------------------------------------------------------
alter table public.users               enable row level security;
alter table public.instagram_accounts  enable row level security;
alter table public.app_sessions        enable row level security;
alter table public.media_snapshots     enable row level security;
alter table public.metric_snapshots    enable row level security;
alter table public.simulation_profiles enable row level security;
alter table public.simulation_values   enable row level security;
alter table public.recommendations     enable row level security;
alter table public.rate_limits         enable row level security;

-- updated_at trigger
create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger users_updated_at before update on public.users
  for each row execute procedure public.set_updated_at();
create trigger instagram_accounts_updated_at before update on public.instagram_accounts
  for each row execute procedure public.set_updated_at();


create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  full_name text,
  organization text,
  account_space text not null default 'public',
  is_email_verified boolean not null default false,
  is_suspicious boolean not null default false,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists email_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  fp_hash text not null,
  ip_hash text not null,
  user_agent_hash text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create unique index if not exists uq_devices_user_fp on devices(user_id, fp_hash);
create index if not exists idx_devices_fp on devices(fp_hash);
create index if not exists idx_devices_ip on devices(ip_hash);

create table if not exists wallets (
  user_id uuid primary key references users(id) on delete cascade,
  plan_code text not null default 'FREE',
  status text not null default 'pending_verification',
  tickets_ai integer not null default 0,
  tickets_expert integer not null default 0,
  public_dossiers_used integer not null default 0,
  private_dossiers_used integer not null default 0,
  public_dossiers_limit integer not null default 1,
  private_dossiers_limit integer not null default 1,
  private_users_limit integer not null default 1,
  trial_started_at timestamptz,
  trial_expires_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table wallets add column if not exists plan_code text not null default 'FREE';
alter table wallets add column if not exists status text not null default 'pending_verification';
alter table wallets add column if not exists public_dossiers_used integer not null default 0;
alter table wallets add column if not exists private_dossiers_used integer not null default 0;
alter table wallets add column if not exists public_dossiers_limit integer not null default 1;
alter table wallets add column if not exists private_dossiers_limit integer not null default 1;
alter table wallets add column if not exists private_users_limit integer not null default 1;
alter table wallets add column if not exists trial_started_at timestamptz;
alter table wallets add column if not exists trial_expires_at timestamptz;

create table if not exists usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  kind text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_usage_user on usage_logs(user_id, created_at desc);

create table if not exists expert_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  email text not null,
  objective text not null,
  expectations text not null,
  context text,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

create table if not exists mission_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  email text not null,
  subject text not null,
  description text not null,
  status text not null default 'new',
  created_at timestamptz not null default now()
);


alter table users add column if not exists account_space text not null default 'public';

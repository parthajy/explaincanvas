-- Lifecycle emails (welcome, tips, win-back, streak, weekly recap), credit claims and preferences.
alter table account_settings add column if not exists marketing_email boolean not null default true;
alter table account_settings add column if not exists unsub_token text not null default encode(gen_random_bytes(16), 'hex');
create unique index if not exists account_settings_unsub_token_idx on account_settings(unsub_token);

create table if not exists email_log (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references users(id) on delete cascade,
  kind text not null,
  key text not null unique,
  sent boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists email_log_account_idx on email_log(account_id, created_at desc);

create table if not exists credit_claims (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references users(id) on delete cascade,
  token text not null unique,
  credits int not null,
  kind text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  claimed_at timestamptz
);
create index if not exists credit_claims_account_idx on credit_claims(account_id, created_at desc);

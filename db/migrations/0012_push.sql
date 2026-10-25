-- Web push subscriptions, one row per browser/app install.
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  failures int not null default 0
);
create index if not exists push_subscriptions_account_idx on push_subscriptions(account_id);

-- Visualise: initial schema for plain PostgreSQL (DigitalOcean Managed Postgres in production).
-- All access is from the server with one database role. No row-level security: ownership is
-- checked in application code before every write and read.
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ---------- accounts and auth ----------
create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);
create unique index users_email_idx on users (lower(email));

create table sessions (
  id text primary key,                     -- 64 hex chars from 32 random bytes
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  user_agent text
);
create index sessions_user_idx on sessions(user_id);
create index sessions_expires_idx on sessions(expires_at);

create table auth_tokens (
  token_hash text primary key,             -- sha256 of the link token
  email text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index auth_tokens_email_idx on auth_tokens(lower(email), created_at desc);

create table account_settings (
  account_id uuid primary key references users(id) on delete cascade,
  timezone text not null default 'Asia/Kolkata',
  auto_topup_enabled boolean not null default false,
  auto_topup_pack_code text,
  auto_topup_monthly_cap_paise integer not null default 0,
  updated_at timestamptz not null default now()
);

create table students (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references users(id) on delete cascade,
  name text not null,
  class_level smallint not null check (class_level between 1 and 12),
  board text not null default 'CBSE',
  created_at timestamptz not null default now()
);
create index students_account_idx on students(account_id);

create table parent_contacts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references users(id) on delete cascade,
  phone_e164 text not null,
  whatsapp_consent boolean not null default false,
  consent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (account_id, phone_e164)
);

-- ---------- chat ----------
create table chats (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references users(id) on delete cascade,
  student_id uuid references students(id) on delete set null,
  title text not null default 'New chat',
  starred boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create index chats_account_recent_idx on chats(account_id, last_message_at desc);

create type message_role as enum ('user', 'assistant', 'system');

create table messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references chats(id) on delete cascade,
  account_id uuid not null references users(id) on delete cascade,
  role message_role not null,
  content text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  explanation_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index messages_chat_idx on messages(chat_id, created_at);
create index messages_chat_updated_idx on messages(chat_id, updated_at);

-- ---------- explanations ----------
create type explanation_status as enum
  ('queued','routing','teaching','verifying','rendering','ready','failed','cancelled');
create type explanation_source as enum ('generated','library','followup');

create table explanations (
  id uuid primary key default gen_random_uuid(),
  request_id text not null unique,
  chat_id uuid not null references chats(id) on delete cascade,
  account_id uuid not null references users(id) on delete cascade,
  student_id uuid references students(id) on delete set null,
  user_message_id uuid references messages(id) on delete set null,
  assistant_message_id uuid references messages(id) on delete set null,
  status explanation_status not null default 'queued',
  source explanation_source,
  format text,
  subject text,
  class_level smallint,
  concept_key text,
  concept_title text,
  scene jsonb,
  scene_version smallint,
  library_lesson_id uuid,
  hints jsonb not null default '{}'::jsonb,
  credits_quoted integer not null default 0,
  credits_charged integer,
  cost_paise integer not null default 0,
  model_usage jsonb not null default '[]'::jsonb,
  error jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index explanations_chat_idx on explanations(chat_id, created_at);
create index explanations_chat_updated_idx on explanations(chat_id, updated_at);
create index explanations_account_idx on explanations(account_id, created_at desc);
alter table messages
  add constraint messages_explanation_fk foreign key (explanation_id)
  references explanations(id) on delete set null;

-- ---------- library ----------
create type lesson_status as enum ('candidate','validated','published','retired');

create table library_lessons (
  id uuid primary key default gen_random_uuid(),
  concept_key text not null,
  concept_title text not null,
  subject text not null,
  class_level smallint not null,
  board text not null default 'CBSE',
  format text not null,
  title text not null,
  scene jsonb not null,
  scene_version smallint not null,
  status lesson_status not null default 'candidate',
  quality_score numeric(4,2),
  source_explanation_id uuid references explanations(id) on delete set null,
  serve_count integer not null default 0,
  created_at timestamptz not null default now(),
  validated_at timestamptz,
  retired_at timestamptz
);
create index library_concept_idx on library_lessons(concept_key, class_level, format) where status in ('validated','published');
create index library_title_trgm_idx on library_lessons using gin (concept_title gin_trgm_ops);
alter table explanations
  add constraint explanations_library_fk foreign key (library_lesson_id)
  references library_lessons(id) on delete set null;

create or replace function library_find(p_concept_key text, p_class smallint, p_format text)
returns setof library_lessons language sql stable as $$
  select * from library_lessons
  where concept_key = p_concept_key and format = p_format
    and status in ('validated','published')
    and abs(class_level - p_class) <= 1
  order by (class_level = p_class) desc, status = 'published' desc, quality_score desc nulls last, serve_count desc
  limit 1;
$$;

-- ---------- learning ----------
create table check_results (
  id uuid primary key default gen_random_uuid(),
  explanation_id uuid not null references explanations(id) on delete cascade,
  account_id uuid not null references users(id) on delete cascade,
  student_id uuid references students(id) on delete set null,
  answer text not null,
  passed boolean not null,
  reason text,
  created_at timestamptz not null default now()
);
create index check_results_student_idx on check_results(student_id, created_at desc);

create table streaks (
  student_id uuid primary key references students(id) on delete cascade,
  current_days integer not null default 0,
  longest_days integer not null default 0,
  last_passed_on date
);

create table parent_reports (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references users(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  report_date date not null,
  body text not null,
  status text not null default 'pending',
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (student_id, report_date)
);

-- ---------- billing ----------
create type subscription_status as enum ('active','past_due','cancelled','expired');

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references users(id) on delete cascade,
  plan_code text not null,
  status subscription_status not null default 'active',
  period_start timestamptz not null,
  period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  provider text not null default 'manual',
  provider_subscription_id text,
  next_credit_grant_at timestamptz,
  grants_made integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index subscriptions_one_active_idx on subscriptions(account_id) where status in ('active','past_due');

create type payment_status as enum ('created','paid','failed','refunded');

create table payments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('subscription','topup')),
  item_code text not null,
  amount_paise integer not null,
  gst_paise integer not null,
  total_paise integer not null,
  currency text not null default 'INR',
  provider text not null,
  provider_order_id text unique,
  provider_payment_id text,
  status payment_status not null default 'created',
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_account_idx on payments(account_id, created_at desc);

create table webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  event_type text,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text,
  unique (provider, event_id)
);

-- ---------- credits: append-only ledger with FIFO grant allocation ----------
create type ledger_entry_type as enum
  ('grant','topup','reserve','settle','release','refund','expire','adjust');

create table credit_ledger (
  id bigserial primary key,
  account_id uuid not null references users(id) on delete cascade,
  entry_type ledger_entry_type not null,
  amount integer not null,               -- positive adds credits, negative removes
  bucket text not null default 'plan',   -- plan | topup | streak | free | promo | mixed
  ref_type text,
  ref_id text,
  idempotency_key text not null unique,
  expires_at timestamptz,                -- grants only
  note text,
  created_at timestamptz not null default now(),
  check ((entry_type in ('grant','topup','refund','release','adjust') and amount >= 0)
      or (entry_type in ('reserve','settle','expire','adjust') and amount <= 0))
);
create index credit_ledger_account_idx on credit_ledger(account_id, created_at);
create index credit_ledger_ref_idx on credit_ledger(ref_type, ref_id);
create index credit_ledger_grants_idx on credit_ledger(account_id, expires_at) where amount > 0;

create table credit_allocations (
  id bigserial primary key,
  entry_id bigint not null references credit_ledger(id) on delete cascade,
  grant_id bigint not null references credit_ledger(id) on delete cascade,
  amount integer not null
);
create index credit_allocations_grant_idx on credit_allocations(grant_id);
create index credit_allocations_entry_idx on credit_allocations(entry_id);

create or replace function credits_lock_account(p_account uuid) returns void
language sql as $$ select pg_advisory_xact_lock(hashtext('credits:' || p_account::text)); $$;

create or replace view credit_grants_v as
select g.id as grant_id, g.account_id, g.bucket, g.expires_at, g.created_at,
       g.amount as granted,
       g.amount - coalesce((select sum(a.amount) from credit_allocations a where a.grant_id = g.id), 0) as remaining
from credit_ledger g
where g.amount > 0 and g.entry_type in ('grant','topup','refund','adjust');

create or replace function credits_balance(p_account uuid) returns integer
language sql stable as $$
  select coalesce(sum(greatest(remaining, 0)), 0)::integer
  from credit_grants_v
  where account_id = p_account and (expires_at is null or expires_at > now());
$$;

create or replace function credits_grant(
  p_account uuid, p_amount integer, p_bucket text, p_ref_type text, p_ref_id text,
  p_key text, p_expires_at timestamptz default null, p_note text default null,
  p_type ledger_entry_type default 'grant'
) returns bigint language plpgsql as $$
declare v_id bigint;
begin
  if p_amount <= 0 then raise exception 'grant amount must be positive'; end if;
  perform credits_lock_account(p_account);
  select id into v_id from credit_ledger where idempotency_key = p_key;
  if v_id is not null then return v_id; end if;
  insert into credit_ledger(account_id, entry_type, amount, bucket, ref_type, ref_id, idempotency_key, expires_at, note)
  values (p_account, p_type, p_amount, p_bucket, p_ref_type, p_ref_id, p_key, p_expires_at, p_note)
  returning id into v_id;
  return v_id;
end $$;

create or replace function credits_debit_internal(
  p_account uuid, p_amount integer, p_type ledger_entry_type,
  p_ref_type text, p_ref_id text, p_key text, p_buckets text[] default null, p_note text default null
) returns bigint language plpgsql as $$
declare v_id bigint; v_left integer := p_amount; g record; v_take integer;
begin
  if p_amount <= 0 then raise exception 'debit amount must be positive'; end if;
  perform credits_lock_account(p_account);
  select id into v_id from credit_ledger where idempotency_key = p_key;
  if v_id is not null then return v_id; end if;
  if credits_balance(p_account) < p_amount then
    raise exception 'insufficient_credits' using errcode = 'P0001';
  end if;
  insert into credit_ledger(account_id, entry_type, amount, bucket, ref_type, ref_id, idempotency_key, note)
  values (p_account, p_type, -p_amount, 'mixed', p_ref_type, p_ref_id, p_key, p_note)
  returning id into v_id;
  for g in
    select grant_id, remaining from credit_grants_v
    where account_id = p_account and remaining > 0
      and (expires_at is null or expires_at > now())
      and (p_buckets is null or bucket = any(p_buckets))
    order by expires_at asc nulls last, created_at asc
  loop
    exit when v_left <= 0;
    v_take := least(g.remaining, v_left);
    insert into credit_allocations(entry_id, grant_id, amount) values (v_id, g.grant_id, v_take);
    v_left := v_left - v_take;
  end loop;
  if v_left > 0 then
    raise exception 'insufficient_credits' using errcode = 'P0001';
  end if;
  return v_id;
end $$;

create or replace function credits_reserve(
  p_account uuid, p_amount integer, p_ref_type text, p_ref_id text, p_key text, p_buckets text[] default null
) returns bigint language plpgsql as $$
begin
  return credits_debit_internal(p_account, p_amount, 'reserve', p_ref_type, p_ref_id, p_key, p_buckets, 'reserve');
end $$;

create or replace function credits_release(
  p_account uuid, p_ref_type text, p_ref_id text, p_amount integer, p_key text
) returns bigint language plpgsql as $$
declare v_id bigint; v_left integer := p_amount; a record; v_give integer; v_reserved integer;
begin
  if p_amount <= 0 then raise exception 'release amount must be positive'; end if;
  perform credits_lock_account(p_account);
  select id into v_id from credit_ledger where idempotency_key = p_key;
  if v_id is not null then return v_id; end if;
  select coalesce(-sum(amount),0) into v_reserved from credit_ledger
    where account_id = p_account and ref_type = p_ref_type and ref_id = p_ref_id and entry_type in ('reserve','settle');
  select v_reserved - coalesce(sum(amount),0) into v_reserved from credit_ledger
    where account_id = p_account and ref_type = p_ref_type and ref_id = p_ref_id and entry_type = 'release';
  if p_amount > v_reserved then
    raise exception 'release exceeds outstanding reservation (% > %)', p_amount, v_reserved;
  end if;
  insert into credit_ledger(account_id, entry_type, amount, bucket, ref_type, ref_id, idempotency_key, note)
  values (p_account, 'release', p_amount, 'mixed', p_ref_type, p_ref_id, p_key, 'release')
  returning id into v_id;
  for a in
    select al.grant_id, sum(al.amount) as taken
    from credit_allocations al
    join credit_ledger e on e.id = al.entry_id
    where e.account_id = p_account and e.ref_type = p_ref_type and e.ref_id = p_ref_id
    group by al.grant_id having sum(al.amount) > 0
    order by max(al.id) desc
  loop
    exit when v_left <= 0;
    v_give := least(a.taken, v_left);
    insert into credit_allocations(entry_id, grant_id, amount) values (v_id, a.grant_id, -v_give);
    v_left := v_left - v_give;
  end loop;
  return v_id;
end $$;

create or replace function credits_settle(
  p_account uuid, p_ref_type text, p_ref_id text, p_final integer, p_key text
) returns void language plpgsql as $$
declare v_outstanding integer;
begin
  if p_final < 0 then raise exception 'final amount must be >= 0'; end if;
  perform credits_lock_account(p_account);
  if exists (select 1 from credit_ledger where idempotency_key = p_key) then return; end if;
  select coalesce(-sum(case when entry_type in ('reserve','settle') then amount else 0 end),0)
       - coalesce(sum(case when entry_type = 'release' then amount else 0 end),0)
    into v_outstanding
    from credit_ledger where account_id = p_account and ref_type = p_ref_type and ref_id = p_ref_id;
  if p_final > v_outstanding then
    perform credits_debit_internal(p_account, p_final - v_outstanding, 'settle', p_ref_type, p_ref_id, p_key, null, 'settle top-up');
  elsif p_final < v_outstanding then
    perform credits_release(p_account, p_ref_type, p_ref_id, v_outstanding - p_final, p_key);
  else
    insert into credit_ledger(account_id, entry_type, amount, bucket, ref_type, ref_id, idempotency_key, note)
    values (p_account, 'adjust', 0, 'mixed', p_ref_type, p_ref_id, p_key, 'settle exact');
  end if;
end $$;

create or replace function credits_expire_due() returns integer language plpgsql as $$
declare g record; n integer := 0; v_id bigint;
begin
  for g in
    select * from credit_grants_v where expires_at is not null and expires_at <= now() and remaining > 0
  loop
    perform credits_lock_account(g.account_id);
    insert into credit_ledger(account_id, entry_type, amount, bucket, ref_type, ref_id, idempotency_key, note)
    values (g.account_id, 'expire', -g.remaining, g.bucket, 'grant', g.grant_id::text, 'expire:' || g.grant_id, 'expired')
    on conflict (idempotency_key) do nothing
    returning id into v_id;
    if v_id is not null then
      insert into credit_allocations(entry_id, grant_id, amount) values (v_id, g.grant_id, g.remaining);
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- ---------- durable job queue ----------
create type job_status as enum ('queued','running','succeeded','failed','dead');

create table jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  payload jsonb not null,
  idempotency_key text not null unique,
  status job_status not null default 'queued',
  priority smallint not null default 0,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  run_after timestamptz not null default now(),
  locked_by text,
  locked_at timestamptz,
  heartbeat_at timestamptz,
  last_error text,
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index jobs_ready_idx on jobs(status, run_after, priority desc, created_at) where status = 'queued';
create index jobs_running_idx on jobs(heartbeat_at) where status = 'running';

create or replace function jobs_enqueue(
  p_kind text, p_payload jsonb, p_key text, p_priority smallint default 0, p_run_after timestamptz default now(), p_max_attempts integer default 3
) returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into jobs(kind, payload, idempotency_key, priority, run_after, max_attempts)
  values (p_kind, p_payload, p_key, p_priority, p_run_after, p_max_attempts)
  on conflict (idempotency_key) do update set updated_at = now()
  returning id into v_id;
  return v_id;
end $$;

create or replace function jobs_claim(p_worker text, p_kinds text[], p_limit integer default 1)
returns setof jobs language plpgsql as $$
begin
  return query
  with picked as (
    select id from jobs
    where status = 'queued' and run_after <= now() and kind = any(p_kinds)
    order by priority desc, created_at
    for update skip locked
    limit p_limit
  )
  update jobs j
    set status = 'running', locked_by = p_worker, locked_at = now(), heartbeat_at = now(),
        attempts = j.attempts + 1, updated_at = now()
  from picked where j.id = picked.id
  returning j.*;
end $$;

create or replace function jobs_claim_one(p_id uuid, p_worker text)
returns setof jobs language plpgsql as $$
begin
  return query
  update jobs j
    set status = 'running', locked_by = p_worker, locked_at = now(), heartbeat_at = now(),
        attempts = j.attempts + 1, updated_at = now()
  where j.id = p_id and j.status = 'queued' and j.run_after <= now()
  returning j.*;
end $$;

create or replace function jobs_heartbeat(p_id uuid, p_worker text) returns boolean language sql as $$
  update jobs set heartbeat_at = now(), updated_at = now()
  where id = p_id and locked_by = p_worker and status = 'running' returning true;
$$;

create or replace function jobs_complete(p_id uuid, p_worker text, p_result jsonb default null) returns void language sql as $$
  update jobs set status = 'succeeded', result = p_result, locked_by = null, locked_at = null, updated_at = now()
  where id = p_id and locked_by = p_worker and status = 'running';
$$;

create or replace function jobs_fail(p_id uuid, p_worker text, p_error text, p_retryable boolean default true) returns void language plpgsql as $$
declare j jobs;
begin
  select * into j from jobs where id = p_id and locked_by = p_worker for update;
  if j.id is null then return; end if;
  if p_retryable and j.attempts < j.max_attempts then
    update jobs set status = 'queued', last_error = p_error, locked_by = null, locked_at = null,
      run_after = now() + make_interval(secs => least(300, power(2, j.attempts) * 5)), updated_at = now()
    where id = p_id;
  else
    update jobs set status = 'dead', last_error = p_error, locked_by = null, locked_at = null, updated_at = now()
    where id = p_id;
  end if;
end $$;

create or replace function jobs_reap_stale(p_stale_seconds integer default 120) returns integer language plpgsql as $$
declare n integer;
begin
  with stale as (
    update jobs set status = case when attempts < max_attempts then 'queued'::job_status else 'dead'::job_status end,
      last_error = coalesce(last_error, '') || ' [reaped: worker heartbeat lost]', locked_by = null, locked_at = null, updated_at = now()
    where status = 'running' and heartbeat_at < now() - make_interval(secs => p_stale_seconds)
    returning 1
  ) select count(*) into n from stale;
  return n;
end $$;

-- ---------- usage / observability ----------
create table usage_events (
  id bigserial primary key,
  account_id uuid references users(id) on delete set null,
  explanation_id uuid references explanations(id) on delete set null,
  stage text not null,
  model text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_read_tokens integer not null default 0,
  cache_write_tokens integer not null default 0,
  cost_paise integer not null default 0,
  latency_ms integer,
  created_at timestamptz not null default now()
);
create index usage_events_expl_idx on usage_events(explanation_id);

-- ---------- triggers ----------
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger chats_touch before update on chats for each row execute function touch_updated_at();
create trigger messages_touch before update on messages for each row execute function touch_updated_at();
create trigger explanations_touch before update on explanations for each row execute function touch_updated_at();
create trigger subscriptions_touch before update on subscriptions for each row execute function touch_updated_at();
create trigger payments_touch before update on payments for each row execute function touch_updated_at();

-- Students and parents can report a wrong explanation. Reports pull the lesson from the library until reviewed.
create table if not exists lesson_reports (
  id uuid primary key default gen_random_uuid(),
  explanation_id uuid not null references explanations(id) on delete cascade,
  account_id uuid references users(id) on delete set null,
  reason text not null,
  detail text,
  status text not null default 'open',
  created_at timestamptz not null default now()
);
create index if not exists lesson_reports_open_idx on lesson_reports(status, created_at desc);

-- NCERT mapping on explanations and library lessons; explanation language; safety events.
alter table explanations add column if not exists ncert_chapter smallint;
alter table explanations add column if not exists ncert_ref text;
alter table explanations add column if not exists language text not null default 'english';
alter table library_lessons add column if not exists ncert_chapter smallint;
create index if not exists library_lessons_chapter_idx on library_lessons(class_level, subject, ncert_chapter) where status = 'published';

create table if not exists safety_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references users(id) on delete cascade,
  kind text not null,          -- profanity | unsafe_intent | unsafe_image | blocked
  source text not null,        -- chat | student_name | chat_title | image
  sample text,
  created_at timestamptz not null default now()
);
create index if not exists safety_events_account_idx on safety_events(account_id, created_at desc);

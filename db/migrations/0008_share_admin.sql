-- Share links for explanations (read-only public page) and report resolution.
alter table explanations add column if not exists share_token text;
create unique index if not exists explanations_share_token_idx on explanations(share_token) where share_token is not null;
alter table lesson_reports add column if not exists resolved_at timestamptz;
alter table lesson_reports add column if not exists resolution text;

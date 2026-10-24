-- Exact-question cache: the same question (normalised) at the same class is generated once.
alter table explanations add column if not exists question_hash text;
create index if not exists explanations_question_hash_idx on explanations(question_hash) where status = 'ready' and scene is not null;

-- Stable message order. Rows created inside one transaction share a timestamp; the sequence does not.
alter table messages add column if not exists seq bigserial;
create index if not exists messages_chat_seq_idx on messages(chat_id, seq);

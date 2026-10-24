-- Dodo Payments: remember the customer id for portal links; session id lives in payments.provider_order_id.
alter table users add column if not exists dodo_customer_id text;
create index if not exists users_dodo_customer_idx on users(dodo_customer_id) where dodo_customer_id is not null;
alter table subscriptions add column if not exists provider_status text;
alter table subscriptions add column if not exists cancelled_at timestamptz;

-- Keep payment records when an account is deleted (accounting), detached from the user.
alter table payments alter column account_id drop not null;
alter table payments drop constraint if exists payments_account_id_fkey;
alter table payments add constraint payments_account_id_fkey foreign key (account_id) references users(id) on delete set null;

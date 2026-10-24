-- Parent report goes by email (Resend) to the account's address. Opt-out flag per account.
alter table account_settings add column if not exists parent_report_email boolean not null default true;
alter table parent_reports add column if not exists channel text not null default 'email';

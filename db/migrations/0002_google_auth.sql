-- Google sign-in: link accounts to a Google subject, keep the profile picture.
alter table users add column if not exists google_sub text;
alter table users add column if not exists avatar_url text;
create unique index if not exists users_google_sub_idx on users(google_sub) where google_sub is not null;

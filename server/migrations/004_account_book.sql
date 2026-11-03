-- Which book an account belongs to. Existing accounts are personal; 'both' = used for either.
alter table accounts
  add column book text not null default 'personal' check (book in ('personal', 'business', 'both'));

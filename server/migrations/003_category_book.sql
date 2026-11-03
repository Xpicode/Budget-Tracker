-- Which book a category is offered in. 'both' = personal and business (e.g. Transport).
alter table categories
  add column book text not null default 'both' check (book in ('personal', 'business', 'both'));

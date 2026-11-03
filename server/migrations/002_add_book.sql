-- Which book a transaction (or the rule that creates it) belongs to: personal money or the business.
alter table transactions
  add column book text not null default 'personal' check (book in ('personal', 'business'));

alter table recurring_rules
  add column book text not null default 'personal' check (book in ('personal', 'business'));

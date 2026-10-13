create table users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  password_hash text not null,
  created_at    timestamptz not null default now()
);

create table accounts (
  id                    uuid primary key,
  user_id               uuid not null references users(id),
  name                  text not null,
  opening_balance_cents bigint not null default 0,
  archived              boolean not null default false,
  created_at            timestamptz not null,
  updated_at            timestamptz not null,
  deleted_at            timestamptz,
  server_updated_at     timestamptz not null default now()
);

create table categories (
  id                uuid primary key,
  user_id           uuid not null references users(id),
  name              text not null,
  type              text not null check (type in ('income','expense')),
  icon              text,
  color             text,
  created_at        timestamptz not null,
  updated_at        timestamptz not null,
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now()
);

create table transactions (
  id                uuid primary key,
  user_id           uuid not null references users(id),
  account_id        uuid not null,
  category_id       uuid,
  to_account_id     uuid,
  type              text not null check (type in ('income','expense','transfer')),
  amount_cents      bigint not null check (amount_cents > 0),
  txn_date          date not null,
  note              text,
  created_at        timestamptz not null,
  updated_at        timestamptz not null,
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now()
);

create table budgets (
  id                uuid primary key,
  user_id           uuid not null references users(id),
  category_id       uuid not null,
  month             text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  limit_cents       bigint not null check (limit_cents > 0),
  created_at        timestamptz not null,
  updated_at        timestamptz not null,
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now()
);

create table recurring_rules (
  id                uuid primary key,
  user_id           uuid not null references users(id),
  account_id        uuid not null,
  category_id       uuid,
  type              text not null check (type in ('income','expense')),
  amount_cents      bigint not null check (amount_cents > 0),
  frequency         text not null check (frequency in ('daily','weekly','monthly')),
  next_run_date     date not null,
  note              text,
  created_at        timestamptz not null,
  updated_at        timestamptz not null,
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now()
);

create index on accounts        (user_id, server_updated_at);
create index on categories      (user_id, server_updated_at);
create index on transactions    (user_id, server_updated_at);
create index on budgets         (user_id, server_updated_at);
create index on recurring_rules (user_id, server_updated_at);

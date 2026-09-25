-- Per-account data: preferences, spot wallet and its transaction history.
-- Every row is scoped by user_id and every query filters on it server-side.

create table if not exists user_settings (
  user_id text primary key references "user" ("id") on delete cascade,
  lang text not null default 'ru',
  country text not null default 'OTHER',
  favorites jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

create table if not exists wallet_positions (
  id text primary key,
  user_id text not null references "user" ("id") on delete cascade,
  base text not null,
  symbol text not null,
  qty double precision not null check (qty > 0),
  entry double precision not null check (entry > 0),
  opened_at timestamptz not null default now(),
  unique (user_id, symbol)
);

create table if not exists wallet_transactions (
  id text primary key,
  user_id text not null references "user" ("id") on delete cascade,
  side text not null check (side in ('buy', 'sell')),
  base text not null,
  symbol text not null,
  qty double precision not null check (qty > 0),
  price double precision not null check (price > 0),
  realized_pnl double precision,
  note text,
  at timestamptz not null default now()
);

create index if not exists wallet_transactions_user_idx on wallet_transactions (user_id, at desc);

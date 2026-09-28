-- Price and signal alerts delivered through the site's Telegram bot, and
-- screener filters members save for later.

create table if not exists telegram_links (
  user_id text primary key references "user" ("id") on delete cascade,
  chat_id bigint not null unique,
  username text,
  linked_at timestamptz not null default now()
);

-- One-time codes behind the "Connect Telegram" deep link.
create table if not exists telegram_link_codes (
  code text primary key,
  user_id text not null references "user" ("id") on delete cascade,
  expires_at timestamptz not null
);

create table if not exists alerts (
  id text primary key,
  user_id text not null references "user" ("id") on delete cascade,
  symbol text not null,
  coin_id text,
  kind text not null,
  value double precision,
  -- Last observed condition for alerts that fire on a change (signal, RSI zone, big move).
  state text,
  active boolean not null default true,
  fired_count integer not null default 0,
  last_fired_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists alerts_user_idx on alerts (user_id, created_at desc);
create index if not exists alerts_active_idx on alerts (active);

create table if not exists saved_screens (
  id text primary key,
  user_id text not null references "user" ("id") on delete cascade,
  name text not null,
  filters jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists saved_screens_user_idx on saved_screens (user_id, created_at desc);

-- Plans, daily AI usage, referrals and payments.

create table if not exists user_plan (
  user_id text primary key references "user" ("id") on delete cascade,
  -- 'free' | 'pro' | 'max'; a paid plan is active while plan_until is in the future.
  plan text not null default 'free',
  plan_until timestamptz,
  trial_until timestamptz,
  ref_code text not null unique,
  referred_by text,
  ref_bonus_days integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_plan_referred_by_idx on user_plan (referred_by);

create table if not exists ai_usage (
  user_id text not null references "user" ("id") on delete cascade,
  day date not null,
  kind text not null,
  count integer not null default 0,
  primary key (user_id, day, kind)
);

create table if not exists payments (
  id text primary key,
  user_id text not null references "user" ("id") on delete cascade,
  plan text not null,
  period text not null,
  amount numeric(12, 2) not null,
  currency text not null default 'usd',
  provider text not null,
  status text not null default 'pending',
  external_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists payments_user_idx on payments (user_id, created_at desc);

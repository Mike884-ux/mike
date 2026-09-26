-- People who asked to buy a plan while online payment was not live yet.
create table if not exists waitlist (
  email text primary key,
  user_id text references "user" ("id") on delete set null,
  plan text not null default 'pro',
  period text not null default 'month',
  created_at timestamptz not null default now(),
  granted_at timestamptz
);

create index if not exists waitlist_created_idx on waitlist (created_at desc);

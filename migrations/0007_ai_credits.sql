-- An additional shared monthly ceiling, independent of daily request limits.
create table if not exists ai_credits (
  user_id text not null references "user" (id) on delete cascade,
  month date not null,
  used integer not null default 0 check (used >= 0),
  primary key (user_id, month)
);

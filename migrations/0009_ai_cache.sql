-- Finished AI answers shared between members for a few minutes, so a hundred
-- people opening the same coin cost one request, and the answer survives a restart.
create table if not exists ai_cache (
  key text primary key,
  value jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_cache_created_at_idx on ai_cache (created_at);

-- Real AI requests made by the whole site per day (UTC): a hard ceiling on spend.
create table if not exists ai_site_usage (
  day date primary key,
  count integer not null default 0 check (count >= 0)
);

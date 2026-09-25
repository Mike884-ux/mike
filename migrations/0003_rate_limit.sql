-- Better Auth rate-limit counters (rateLimit.storage = "database"), keyed by
-- client IP + path. In-memory counters don't work on serverless: every
-- instance would count separately.
create table if not exists "rateLimit" (
  "id" text not null primary key,
  "key" text not null unique,
  "count" integer not null,
  "lastRequest" bigint not null
);

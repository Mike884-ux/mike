-- Site-wide settings the owner connects from /admin (e.g. the Dodo Payments
-- product and webhook created automatically), stored instead of typed into
-- the host's environment variables.
create table if not exists app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

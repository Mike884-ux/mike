-- Clicks through to the exchanges, per day, exchange and visitor country: which partner links earn.
create table if not exists exchange_clicks (
  day date not null,
  exchange text not null,
  country text not null,
  count integer not null default 0,
  primary key (day, exchange, country)
);

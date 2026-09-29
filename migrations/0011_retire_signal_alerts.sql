-- Indicator "signal change" alerts are retired: the site shows the AI's call instead.
update alerts set active = false where kind = 'signal' and active;

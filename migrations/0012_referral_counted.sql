-- A friend counts toward the inviter's "3 friends → 3 Pro days" reward only
-- when they aren't the inviter on another account (no shared IP). Earlier
-- referrals were already rewarded one by one, so they start uncounted.
alter table user_plan add column if not exists ref_counted boolean not null default false;

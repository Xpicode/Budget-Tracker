alter table users
  add column password_reset_hash text,
  add column password_reset_expires_at timestamptz,
  add column password_reset_requested_at timestamptz;

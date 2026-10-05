-- Applied on every startup; must stay idempotent.

CREATE TABLE IF NOT EXISTS polls (
  id             text PRIMARY KEY,
  admin_key_hash text NOT NULL,
  title          text NOT NULL,
  description    text NOT NULL DEFAULT '',
  location       text NOT NULL DEFAULT '',
  timezone       text NOT NULL,
  closed         boolean NOT NULL DEFAULT false,
  final_slot_id  bigint,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS slots (
  id        bigserial PRIMARY KEY,
  poll_id   text NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at   timestamptz NOT NULL,
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS slots_poll_idx ON slots(poll_id);

CREATE TABLE IF NOT EXISTS responses (
  id            bigserial PRIMARY KEY,
  poll_id       text NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  name          text NOT NULL,
  edit_key_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS responses_poll_idx ON responses(poll_id);

CREATE TABLE IF NOT EXISTS votes (
  response_id bigint NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
  slot_id     bigint NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
  value       text NOT NULL CHECK (value IN ('yes', 'maybe', 'no')),
  PRIMARY KEY (response_id, slot_id)
);

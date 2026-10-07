CREATE TABLE IF NOT EXISTS player_sonos_queues (
  id          text PRIMARY KEY,
  key_hash    text NOT NULL,
  group_id    text NOT NULL,
  session_id  text NOT NULL DEFAULT '',
  items       jsonb NOT NULL,
  version     integer NOT NULL DEFAULT 1,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- RecoverKit — PostgreSQL schema
-- Run: psql $DATABASE_URL -f schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Stores ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stores (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain        TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  plan          TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter','pro','enterprise')),
  webhook_secret TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','member')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Carts ────────────────────────────────────────────────────────────────────
CREATE TYPE cart_status AS ENUM (
  'idle', 'abandoned', 'in_sequence', 'recovered', 'closed'
);

CREATE TABLE IF NOT EXISTS carts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  external_id     TEXT NOT NULL,
  customer_email  TEXT NOT NULL,
  customer_name   TEXT NOT NULL DEFAULT '',
  total_price     NUMERIC(12,2) NOT NULL DEFAULT 0,
  line_items      JSONB NOT NULL DEFAULT '[]',
  status          cart_status NOT NULL DEFAULT 'idle',
  abandoned_at    TIMESTAMPTZ,
  recovered_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_carts_store_status ON carts (store_id, status);
CREATE INDEX IF NOT EXISTS idx_carts_abandoned_at  ON carts (abandoned_at) WHERE abandoned_at IS NOT NULL;

-- ─── Sequences ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sequences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sequence_steps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id     UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  position        INTEGER NOT NULL,
  delay_minutes   INTEGER NOT NULL DEFAULT 60,
  channel         TEXT NOT NULL CHECK (channel IN ('email','sms')),
  subject         TEXT,
  body            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sequence_id, position)
);

CREATE TABLE IF NOT EXISTS step_variants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id         UUID NOT NULL REFERENCES sequence_steps(id) ON DELETE CASCADE,
  subject         TEXT,
  body            TEXT NOT NULL,
  weight          INTEGER NOT NULL DEFAULT 50,
  sent_count      INTEGER NOT NULL DEFAULT 0,
  recovered_count INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Messages ─────────────────────────────────────────────────────────────────
CREATE TYPE message_status AS ENUM (
  'pending', 'sent', 'opened', 'clicked', 'failed'
);

CREATE TABLE IF NOT EXISTS messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id       UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  step_id       UUID NOT NULL REFERENCES sequence_steps(id),
  variant_id    UUID REFERENCES step_variants(id),
  store_id      UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  channel       TEXT NOT NULL,
  status        message_status NOT NULL DEFAULT 'pending',
  scheduled_at  TIMESTAMPTZ NOT NULL,
  sent_at       TIMESTAMPTZ,
  opened_at     TIMESTAMPTZ,
  clicked_at    TIMESTAMPTZ,
  provider_id   TEXT,
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_scheduled ON messages (scheduled_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_messages_cart ON messages (cart_id);

-- ─── Updated-at trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DO $$ DECLARE t TEXT;
BEGIN
  FOR t IN VALUES ('stores'),('carts'),('sequences'),('messages') LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at
       BEFORE UPDATE ON %s
       FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t
    );
  END LOOP;
END $$;

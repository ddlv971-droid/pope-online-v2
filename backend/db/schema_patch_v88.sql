-- V88 patch: garantir toutes les colonnes expert_requests et expert_assignments en prod
-- Idempotent — IF NOT EXISTS sur tout

-- Colonnes expert_requests manquantes sur les DBs créées avant v52
ALTER TABLE expert_requests ADD COLUMN IF NOT EXISTS domain               text;
ALTER TABLE expert_requests ADD COLUMN IF NOT EXISTS reply_text           text;
ALTER TABLE expert_requests ADD COLUMN IF NOT EXISTS reply_by             text;
ALTER TABLE expert_requests ADD COLUMN IF NOT EXISTS replied_at           timestamptz;
ALTER TABLE expert_requests ADD COLUMN IF NOT EXISTS updated_at           timestamptz NOT NULL DEFAULT now();
ALTER TABLE expert_requests ADD COLUMN IF NOT EXISTS generation_attachment jsonb;
ALTER TABLE expert_requests ADD COLUMN IF NOT EXISTS vault_file_ids       text[];

-- Table expert_assignments (créée en v36, peut manquer sur très anciennes DBs)
CREATE TABLE IF NOT EXISTS expert_assignments (
  expert_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (expert_id, client_id)
);
CREATE INDEX IF NOT EXISTS idx_ea_expert ON expert_assignments(expert_id);
CREATE INDEX IF NOT EXISTS idx_ea_client ON expert_assignments(client_id);

-- Colonnes users manquantes
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number   text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_full     text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS organization   text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role           text NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at  timestamptz;

-- Colonnes wallets v87
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS renews_at    timestamptz;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS plan_start   timestamptz;
CREATE INDEX IF NOT EXISTS idx_wallets_renews_at  ON wallets(renews_at) WHERE renews_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wallets_plan_start ON wallets(plan_start) WHERE plan_start IS NOT NULL;

-- Table security_events v87
CREATE TABLE IF NOT EXISTS security_events (
  id         bigserial PRIMARY KEY,
  kind       text NOT NULL,
  ip_hash    text,
  user_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  meta       jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sec_events_kind ON security_events(kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sec_events_ip   ON security_events(ip_hash, created_at DESC);

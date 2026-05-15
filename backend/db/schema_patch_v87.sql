-- ============================================================
-- PATCH V87 — Dates plan + sécurité anti-abus améliorée
-- ============================================================

-- 1. Ajouter renews_at et plan_start dans wallets
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS renews_at    timestamptz;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS plan_start   timestamptz;

-- Index pour les requêtes billing
CREATE INDEX IF NOT EXISTS idx_wallets_renews_at  ON wallets(renews_at) WHERE renews_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wallets_plan_start ON wallets(plan_start) WHERE plan_start IS NOT NULL;

-- 2. Amélioration anti-abus: email_hash unique dans deleted_accounts
-- (évite les doublons si l'utilisateur se supprime plusieurs fois)
CREATE UNIQUE INDEX IF NOT EXISTS idx_deleted_accounts_unique
  ON deleted_accounts(email_hash, fp_hash)
  WHERE fp_hash IS NOT NULL;

-- 3. Colonne last_login_at sur users si absente
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

-- 4. Colonne session_version si absente (déjà dans la plupart des schemas)
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 1;

-- 5. Contrainte: session_version ne peut pas être NULL ni négatif
ALTER TABLE users ALTER COLUMN session_version SET DEFAULT 1;

-- 6. Table rate_limit_log pour les tentatives brute-force (optionnelle, pour métriques)
CREATE TABLE IF NOT EXISTS security_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        text NOT NULL,          -- 'login_fail', 'signup_blocked', 'trial_blocked', etc.
  email_hash  text,
  ip_hash     text,
  fp_hash     text,
  meta        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sec_events_kind ON security_events(kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sec_events_ip   ON security_events(ip_hash, created_at DESC);

COMMENT ON TABLE security_events IS 'Journal des événements de sécurité (audit, métriques)';

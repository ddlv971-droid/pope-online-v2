-- ============================================================
-- POPE Online V36 — Schema patch
-- ============================================================

-- 1. Table expert_assignments : portefeuille des experts
CREATE TABLE IF NOT EXISTS expert_assignments (
  expert_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (expert_id, client_id)
);
CREATE INDEX IF NOT EXISTS idx_ea_expert ON expert_assignments(expert_id);
CREATE INDEX IF NOT EXISTS idx_ea_client ON expert_assignments(client_id);

-- 2. Stripe customer ID dans wallets (pour récupérer les invoices)
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS stripe_customer_id text;
CREATE INDEX IF NOT EXISTS idx_wallets_stripe_customer ON wallets(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- ============================================================================
-- PATCH V91 (V88.9) — pack de 3 Conseils Expert valable un mois, champs devis — idempotent
-- ============================================================================
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS credits_expire_at timestamptz;
ALTER TABLE contact_requests ADD COLUMN IF NOT EXISTS population text;
ALTER TABLE contact_requests ADD COLUMN IF NOT EXISTS seats text;
ALTER TABLE contact_requests ADD COLUMN IF NOT EXISTS billing_address text;
-- Crédits échus : remis à zéro (sans effet si aucune échéance n'est dépassée)
UPDATE wallets SET tickets_expert = 0, credits_expire_at = NULL
 WHERE credits_expire_at IS NOT NULL AND credits_expire_at < now() AND tickets_expert > 0;

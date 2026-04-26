-- ============================================================
-- PATCH V29 — Modèle hybride plans + IA illimitée
-- ============================================================

-- Ajouter les colonnes manquantes sur wallets
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS ai_unlimited   boolean NOT NULL DEFAULT false;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS plan_label     text    NOT NULL DEFAULT 'Free';
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS expert_limit   integer NOT NULL DEFAULT 2;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS expert_used    integer NOT NULL DEFAULT 0;

-- Mettre à jour les comptes trial_active existants → IA illimitée + 2 relectures
UPDATE wallets
   SET ai_unlimited  = true,
       expert_limit  = 2,
       expert_used   = 0,
       plan_label    = 'Free'
 WHERE status IN ('trial_active', 'trial_expired')
   AND plan_label = 'Free';

-- Index pour les requêtes sur plan_label
CREATE INDEX IF NOT EXISTS idx_wallets_plan_label ON wallets(plan_label);
CREATE INDEX IF NOT EXISTS idx_wallets_status     ON wallets(status);

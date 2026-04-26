-- ============================================================
-- PATCH V22 — Sécurité suppression compte utilisateur
-- ============================================================

-- Table d'empreintes des comptes supprimés par l'utilisateur lui-même
-- Objectif : bloquer la réinscription avec offre gratuite après auto-suppression
-- La suppression admin FULL réinitialise cette table → permet réinscription normale

CREATE TABLE IF NOT EXISTS deleted_accounts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash   text        NOT NULL,   -- sha256 de l'email normalisé
  fp_hash      text,                   -- empreinte navigateur si disponible
  ip_hash      text,                   -- hash IP au moment de la suppression
  deleted_by   text        NOT NULL DEFAULT 'self',  -- 'self' | 'admin_soft' | 'admin_full'
  deleted_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deleted_accounts_email_hash ON deleted_accounts(email_hash);
CREATE INDEX IF NOT EXISTS idx_deleted_accounts_fp_hash    ON deleted_accounts(fp_hash);

-- ============================================================
-- PATCH V22b — Synchronisation tickets_expert = tickets_ai
-- tickets_expert doit toujours être initialisé = tickets_ai
-- ============================================================

-- Migration des wallets existants où tickets_expert = 0 mais tickets_ai > 0
UPDATE wallets
SET tickets_expert = tickets_ai
WHERE tickets_expert = 0 AND tickets_ai > 0;

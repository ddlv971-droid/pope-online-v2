-- ============================================================
-- PATCH V24 — Promotion du compte admin ddlv971@gmail.com
-- À exécuter UNE FOIS via Render Shell ou pgAdmin
-- Idempotent : ne fait rien si le rôle est déjà 'admin'
-- ============================================================

-- Promouvoir le compte admin par son email
-- Remplacez l'email si différent de ddlv971@gmail.com
UPDATE users
   SET role = 'admin',
       is_email_verified = true,
       must_change_password = false
 WHERE email = 'ddlv971@gmail.com'
   AND role <> 'admin';

-- Vérification
DO $$
DECLARE
  r TEXT;
BEGIN
  SELECT role INTO r FROM users WHERE email = 'ddlv971@gmail.com';
  IF r = 'admin' THEN
    RAISE NOTICE '✅ ddlv971@gmail.com est bien admin';
  ELSIF r IS NULL THEN
    RAISE NOTICE '⚠️  Compte ddlv971@gmail.com introuvable en base';
  ELSE
    RAISE NOTICE '❌ Promotion échouée, rôle actuel : %', r;
  END IF;
END;
$$;

-- ============================================================
-- PATCH V22 (inclus pour idempotence si non encore appliqué)
-- ============================================================
CREATE TABLE IF NOT EXISTS deleted_accounts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash   text        NOT NULL,
  fp_hash      text,
  ip_hash      text,
  deleted_by   text        NOT NULL DEFAULT 'self',
  deleted_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deleted_accounts_email_hash ON deleted_accounts(email_hash);
CREATE INDEX IF NOT EXISTS idx_deleted_accounts_fp_hash    ON deleted_accounts(fp_hash);

UPDATE wallets
   SET tickets_expert = tickets_ai
 WHERE tickets_expert = 0 AND tickets_ai > 0;

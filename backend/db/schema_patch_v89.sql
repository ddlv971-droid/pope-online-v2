-- ============================================================================
-- PATCH V89 (livré avec la V88 « repositionnement élus ») — idempotent
-- ============================================================================

-- 1. Profil de l'élu (facultatif, saisi à l'inscription)
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_function text;   -- maire | adjoint | conseiller | dgs | secretaire_mairie | autre
ALTER TABLE users ADD COLUMN IF NOT EXISTS commune_size  text;   -- moins_1000 | 1000_3500 | 3500_10000 | 10000_50000 | plus_50000

-- 2. Début de la période de quota en cours (remise à zéro mensuelle des offres annuelles)
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS quota_period_start timestamptz;

-- 3. Journal des migrations de données ponctuelles (exécutées une seule fois)
CREATE TABLE IF NOT EXISTS app_migrations (
  id         text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Normalisation des portefeuilles (une seule fois)
--    En V87, tickets_expert valait 9999 pour les essais (Conseils Expert illimités par erreur)
--    ou reproduisait le quota mensuel des abonnés. Depuis la V88, tickets_expert désigne
--    uniquement les Conseils Expert achetés à l'unité ; le quota mensuel est porté par
--    expert_limit / expert_used.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app_migrations WHERE id = 'v89_wallet_normalisation') THEN
    UPDATE wallets SET tickets_expert = 0;
    UPDATE wallets SET plan_label = 'Découverte' WHERE plan_code = 'FREE';
    UPDATE wallets SET quota_period_start = COALESCE(plan_start, now())
     WHERE status = 'active' AND quota_period_start IS NULL;
    INSERT INTO app_migrations(id) VALUES ('v89_wallet_normalisation');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_function ON users(user_function) WHERE user_function IS NOT NULL;

-- 5. Garde-fou permanent (V88.4) : aucune valeur sentinelle « illimité » dans les
--    crédits à l'unité. Sans effet si les données sont propres ; corrige les comptes
--    dont la valeur 9999 de la V87 aurait survécu (ex. démarrage sans db_init).
UPDATE wallets SET tickets_expert = 0 WHERE tickets_expert >= 1000;

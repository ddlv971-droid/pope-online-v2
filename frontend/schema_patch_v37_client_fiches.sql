-- schema_patch_v37_client_fiches.sql
-- Exécuter sur PostgreSQL prod et staging

CREATE TABLE IF NOT EXISTS client_fiches (
  id                  SERIAL PRIMARY KEY,
  user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nom                 TEXT,
  categorie           TEXT,
  territoire          TEXT,
  taille              TEXT,
  contact             TEXT,
  contact_direct      TEXT,
  niveau_decisionnel  TEXT,
  source              TEXT,
  domaines            TEXT[],
  description_besoin  TEXT,
  mode_intervention   TEXT,
  urgence             TEXT,
  stade               TEXT,
  maturite            SMALLINT CHECK (maturite BETWEEN 1 AND 5),
  complexite          SMALLINT CHECK (complexite BETWEEN 1 AND 5),
  potentiel           SMALLINT CHECK (potentiel BETWEEN 1 AND 5),
  fidelite            SMALLINT CHECK (fidelite BETWEEN 1 AND 5),
  decision            TEXT,
  responsable         TEXT,
  notes               TEXT,
  budget              TEXT,
  financement         TEXT,
  duree               TEXT,
  crm_statut          TEXT,
  prochain_contact    DATE,
  canal_pref          TEXT,
  actions             TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS client_fiches_user_uniq ON client_fiches(user_id);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_client_fiches_updated ON client_fiches;
CREATE TRIGGER trg_client_fiches_updated
  BEFORE UPDATE ON client_fiches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

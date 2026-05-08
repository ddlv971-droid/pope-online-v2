-- POPE Online V56 - consolidation fiches client, experts et drafts
CREATE EXTENSION IF NOT EXISTS pgcrypto;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'client';
ALTER TABLE users ADD COLUMN IF NOT EXISTS organization text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_country text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_full text;
CREATE TABLE IF NOT EXISTS client_fiches (user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE);
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS nom text;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS categorie text;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS territoire text;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS taille text;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS contact text;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS contact_phone text;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS contact_direct text;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS niveau_decisionnel text;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS domaines text[] NOT NULL DEFAULT '{}';
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS description_besoin text;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS mode_intervention text;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS urgence text;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS stade text;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS maturite integer;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS complexite integer;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS potentiel integer;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS fidelite integer;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS decision text;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS responsable text;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS responsable_expert_id uuid;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS budget text;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS financement text;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS duree text;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS crm_statut text;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS prochain_contact date;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS canal_pref text;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS actions text;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS echeance text;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS livrable text;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS sensibilite text;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS public_concerne text;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS decision_attendue text;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE TABLE IF NOT EXISTS expert_assignments (
  expert_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (expert_id, client_id)
);
CREATE INDEX IF NOT EXISTS idx_client_fiches_responsable_expert_id ON client_fiches(responsable_expert_id);
CREATE INDEX IF NOT EXISTS idx_expert_assignments_client_id ON expert_assignments(client_id);

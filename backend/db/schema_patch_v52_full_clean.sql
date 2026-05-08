-- POPE Online V5.2 full clean — fiches client + parcours expertise
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS client_fiches (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  nom text, categorie text, territoire text, taille text,
  contact text, contact_email text, contact_phone text, contact_direct text,
  niveau_decisionnel text, source text,
  domaines text[] NOT NULL DEFAULT '{}', description_besoin text,
  mode_intervention text, urgence text, stade text,
  maturite integer, complexite integer, potentiel integer, fidelite integer,
  decision text, responsable text, responsable_expert_id uuid,
  notes text, budget text, financement text, duree text,
  crm_statut text, prochain_contact date, canal_pref text, actions text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS contact_phone text;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS responsable_expert_id uuid;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS expert_assignments (
  expert_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (expert_id, client_id)
);

ALTER TABLE expert_requests ADD COLUMN IF NOT EXISTS domain text;
ALTER TABLE expert_requests ADD COLUMN IF NOT EXISTS reply_text text;
ALTER TABLE expert_requests ADD COLUMN IF NOT EXISTS reply_by text;
ALTER TABLE expert_requests ADD COLUMN IF NOT EXISTS replied_at timestamptz;
ALTER TABLE expert_requests ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE expert_requests ADD COLUMN IF NOT EXISTS generation_attachment jsonb;

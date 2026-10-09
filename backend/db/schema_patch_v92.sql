-- ============================================================================
-- PATCH V92 (V88.11) — pièces jointes des demandes expert conservées avec la demande
-- (le dépôt sécurisé 48 h reste éphémère ; la copie liée à une demande est conservée
--  pour que l'équipe POPE et l'expert puissent la consulter) + demandes « sur mesure » — idempotent
-- ============================================================================
CREATE TABLE IF NOT EXISTS expert_request_files (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id   uuid NOT NULL REFERENCES expert_requests(id) ON DELETE CASCADE,
  user_id      uuid,
  kind         text NOT NULL DEFAULT 'vault',      -- vault | generation
  name         text NOT NULL,
  mime_type    text,
  size_bytes   bigint NOT NULL DEFAULT 0,
  content      bytea NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expert_request_files_req ON expert_request_files(request_id);
ALTER TABLE expert_requests ADD COLUMN IF NOT EXISTS vault_file_ids text[];
ALTER TABLE expert_requests ADD COLUMN IF NOT EXISTS mail_sent boolean;

ALTER TABLE mission_requests ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE mission_requests ADD COLUMN IF NOT EXISTS organization text;
ALTER TABLE mission_requests ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE mission_requests ADD COLUMN IF NOT EXISTS domain text;
ALTER TABLE mission_requests ADD COLUMN IF NOT EXISTS deadline text;
ALTER TABLE mission_requests ADD COLUMN IF NOT EXISTS mail_sent boolean;

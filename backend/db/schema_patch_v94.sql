-- ============================================================================
-- PATCH V94 (application V89.5) — tableau de bord des rendez-vous — idempotent
-- Créneau précis, fuseau et mode pour les demandes « Parler à un conseiller »,
-- et, pour toutes les demandes de rendez-vous : conseiller désigné, notes, suivi.
-- ============================================================================
ALTER TABLE contact_requests ADD COLUMN IF NOT EXISTS slot_at timestamptz;
ALTER TABLE contact_requests ADD COLUMN IF NOT EXISTS timezone text;
ALTER TABLE contact_requests ADD COLUMN IF NOT EXISTS contact_mode text;
ALTER TABLE contact_requests ADD COLUMN IF NOT EXISTS assigned_to uuid;
ALTER TABLE contact_requests ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE contact_requests ADD COLUMN IF NOT EXISTS updated_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_contact_requests_slot ON contact_requests(slot_at);

ALTER TABLE diag_flash_requests ADD COLUMN IF NOT EXISTS assigned_to uuid;
ALTER TABLE diag_flash_requests ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE diag_flash_requests ADD COLUMN IF NOT EXISTS updated_at timestamptz;

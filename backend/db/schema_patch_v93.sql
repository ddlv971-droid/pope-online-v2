-- ============================================================================
-- PATCH V93 (application V89) — diagnostic flash : demandes de rappel — idempotent
-- Seules les personnes qui demandent à être rappelées sont enregistrées, avec leur
-- accord explicite (case cochée). Le diagnostic lui-même est calculé dans le
-- navigateur et n'est jamais transmis sans cette demande.
-- ============================================================================
CREATE TABLE IF NOT EXISTS diag_flash_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  user_id       uuid,                                  -- renseigné si l'élu est connecté
  name          text NOT NULL,
  email         text,
  phone         text,
  role          text,
  organization  text,
  slot          text,
  domain        text,
  situation     text,
  level         text,                                  -- moderee | elevee | critique
  path          text,                                  -- conseil | surmesure
  urgent        boolean NOT NULL DEFAULT false,
  title         text,
  summary       text,
  free_text     text,
  answers       jsonb NOT NULL DEFAULT '{}'::jsonb,
  consent_at    timestamptz NOT NULL DEFAULT now(),
  status        text NOT NULL DEFAULT 'new',           -- new | contacted | converted | closed
  mail_sent     boolean,
  user_agent    text
);
CREATE INDEX IF NOT EXISTS idx_diag_flash_created ON diag_flash_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_diag_flash_status ON diag_flash_requests(status);

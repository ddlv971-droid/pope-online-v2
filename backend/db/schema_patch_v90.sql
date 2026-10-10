-- ============================================================================
-- PATCH V90 (V88.6) — demandes de contact, rendez-vous et devis — idempotent
-- ============================================================================
CREATE TABLE IF NOT EXISTS contact_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  name         text NOT NULL,
  email        text,
  phone        text,
  role         text,
  organization text,
  subject      text NOT NULL DEFAULT 'question',
  slot         text,
  message      text,
  status       text NOT NULL DEFAULT 'new',
  user_agent   text
);
CREATE INDEX IF NOT EXISTS idx_contact_requests_created ON contact_requests(created_at DESC);

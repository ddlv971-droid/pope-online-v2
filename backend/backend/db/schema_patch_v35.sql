-- ============================================================
-- POPE Online V35 — Schema patch
-- ============================================================

-- 1. Relecture experte : réponse expert dans l'app
ALTER TABLE expert_requests
  ADD COLUMN IF NOT EXISTS reply_text      text,
  ADD COLUMN IF NOT EXISTS reply_by        text,
  ADD COLUMN IF NOT EXISTS replied_at      timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at      timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS generation_attachment jsonb;

-- Mise à jour du status possible : new | in_progress | replied | closed
UPDATE expert_requests SET status = 'new' WHERE status IS NULL;

-- 2. Mission : même chose
ALTER TABLE mission_requests
  ADD COLUMN IF NOT EXISTS reply_text      text,
  ADD COLUMN IF NOT EXISTS reply_by        text,
  ADD COLUMN IF NOT EXISTS replied_at      timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at      timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS context         text,
  ADD COLUMN IF NOT EXISTS vault_file_ids  text[];

-- 3. Onboarding : stocker les données wizard dans users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_done      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS activity_domain      text,
  ADD COLUMN IF NOT EXISTS company_name         text,
  ADD COLUMN IF NOT EXISTS contact_method       text,
  ADD COLUMN IF NOT EXISTS main_need            text,
  ADD COLUMN IF NOT EXISTS onboarding_at        timestamptz;

-- 4. Parrainage
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS referral_code   text UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by     uuid REFERENCES users(id) ON DELETE SET NULL;

-- Index pour le parrainage
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);

-- 5. Webhook Stripe : table des events traités (idempotence)
CREATE TABLE IF NOT EXISTS stripe_events (
  id           text PRIMARY KEY,           -- stripe event id
  type         text NOT NULL,
  payload      jsonb,
  processed_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Notification in-app
CREATE TABLE IF NOT EXISTS notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        text NOT NULL,              -- expert_replied | mission_replied | plan_upgraded
  title       text NOT NULL,
  body        text,
  link        text,
  read        boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read, created_at DESC);

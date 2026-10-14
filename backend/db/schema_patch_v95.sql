-- ============================================================================
-- PATCH V95 (application V89.6) — gestion des profils — idempotent
-- Toute nouvelle inscription est un « client » ; les profils internes sont
-- « expert », « conseiller » (rendez-vous) et « admin ».
-- ============================================================================
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'client';
UPDATE users SET role = 'client' WHERE role IS NULL OR role NOT IN ('client', 'expert', 'conseiller', 'admin');
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE TABLE IF NOT EXISTS expert_assignments (
  expert_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (expert_id, client_id)
);
CREATE INDEX IF NOT EXISTS idx_expert_assignments_client ON expert_assignments(client_id);

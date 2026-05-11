-- v55 patch: Nouveaux champs de qualification du besoin dans client_fiches
-- (écheance, livrable, sensibilité, public concerné, décision attendue)

ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS echeance text;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS livrable text;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS sensibilite text;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS public_concerne text;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS decision_attendue text;

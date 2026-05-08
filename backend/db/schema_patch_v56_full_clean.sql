-- v56 patch: Champs description structurée dans client_fiches
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS desc_contexte text;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS desc_objectif text;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS desc_contraintes text;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS desc_acteurs text;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS desc_pieces text;

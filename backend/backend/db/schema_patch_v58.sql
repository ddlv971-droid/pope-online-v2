-- V58 patch: champs description structurée supplémentaires
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS desc_probleme    text;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS desc_decision    text;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS desc_livrable    text;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS desc_risques     text;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS desc_public      text;
ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS desc_niveau      text;

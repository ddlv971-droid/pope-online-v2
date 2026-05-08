-- V60: No new columns needed (all added in v55-v58)
-- Verify existing columns
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='client_fiches' AND column_name='desc_contexte') THEN
    ALTER TABLE client_fiches ADD COLUMN desc_contexte text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='client_fiches' AND column_name='desc_objectif') THEN
    ALTER TABLE client_fiches ADD COLUMN desc_objectif text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='client_fiches' AND column_name='echeance') THEN
    ALTER TABLE client_fiches ADD COLUMN echeance text;
  END IF;
END $$;

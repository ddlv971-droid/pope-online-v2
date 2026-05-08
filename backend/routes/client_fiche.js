import express from 'express';
import { pool } from '../db/index.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

async function ensureClientFicheSchema() {
  await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
  await pool.query(`CREATE TABLE IF NOT EXISTS client_fiches (
    user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    nom text, categorie text, territoire text, taille text,
    contact text, contact_email text, contact_phone text, contact_direct text,
    niveau_decisionnel text, source text,
    domaines text[] NOT NULL DEFAULT '{}', description_besoin text,
    mode_intervention text, urgence text, stade text,
    maturite integer, complexite integer, potentiel integer, fidelite integer,
    decision text, responsable text, responsable_expert_id uuid,
    notes text, budget text, financement text, duree text,
    crm_statut text, prochain_contact date, canal_pref text, actions text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`);
  const alters = [
    `ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS contact_email text`,
    `ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS contact_phone text`,
    `ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS responsable_expert_id uuid`,
    `ALTER TABLE client_fiches ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()`
  ];
  for (const q of alters) await pool.query(q);
}
function toInt(v){ return (v !== '' && v !== null && v !== undefined && !Number.isNaN(Number(v))) ? Number(v) : null; }
function clean(v){ return String(v ?? '').trim() || null; }
function rowToPayload(r){
  if(!r) return null;
  return {
    nom:r.nom, categorie:r.categorie, territoire:r.territoire, size:r.taille,
    contact:r.contact, contact_email:r.contact_email, contact_phone:r.contact_phone, contact_direct:r.contact_direct,
    niveau:r.niveau_decisionnel, source:r.source, domaines:r.domaines || [], besoins:r.description_besoin,
    mode:r.mode_intervention, urgence:r.urgence, stade:r.stade,
    maturite:r.maturite ? String(r.maturite) : '', complexite:r.complexite ? String(r.complexite) : '', potentiel:r.potentiel ? String(r.potentiel) : '', fidelite:r.fidelite ? String(r.fidelite) : '',
    decision:r.decision, responsable:r.responsable, responsable_expert_id:r.responsable_expert_id,
    notes:r.notes, budget:r.budget, financement:r.financement, duree:r.duree, crm_statut:r.crm_statut,
    prochain_contact:r.prochain_contact ? new Date(r.prochain_contact).toISOString().slice(0,10) : '',
    canal_pref:r.canal_pref, actions:r.actions, saved_at:r.updated_at
  };
}

router.get('/client-fiche/:userId', requireAdmin, async (req,res)=>{
  try{
    await ensureClientFicheSchema();
    const { rows } = await pool.query(`SELECT cf.*, u.full_name, u.email, u.organization, u.phone_full, u.account_space
      FROM users u LEFT JOIN client_fiches cf ON cf.user_id=u.id WHERE u.id=$1`, [req.params.userId]);
    if(!rows.length) return res.status(404).json({error:'user_not_found'});
    const r=rows[0];
    const fiche = r.user_id ? rowToPayload(r) : null;
    const prefill = {
      nom: fiche?.nom || r.organization || r.full_name || '',
      categorie: fiche?.categorie || (r.account_space === 'public' ? 'Collectivité / acteur public' : 'Client privé'),
      contact: fiche?.contact || r.full_name || '',
      contact_email: fiche?.contact_email || r.email || '',
      contact_phone: fiche?.contact_phone || r.phone_full || '',
      contact_direct: fiche?.contact_direct || [r.email, r.phone_full].filter(Boolean).join(' / '),
      territoire: fiche?.territoire || '',
      size: fiche?.size || '',
      niveau: fiche?.niveau || '',
      source: fiche?.source || 'Création de compte POPE Online',
      domaines: fiche?.domaines || [],
      besoins: fiche?.besoins || '',
      mode: fiche?.mode || '', urgence: fiche?.urgence || '', stade: fiche?.stade || '',
      maturite: fiche?.maturite || '', complexite: fiche?.complexite || '', potentiel: fiche?.potentiel || '', fidelite: fiche?.fidelite || '',
      decision: fiche?.decision || '', responsable: fiche?.responsable || '', responsable_expert_id: fiche?.responsable_expert_id || '',
      notes: fiche?.notes || '', budget: fiche?.budget || '', financement: fiche?.financement || '', duree: fiche?.duree || '',
      crm_statut: fiche?.crm_statut || '', prochain_contact: fiche?.prochain_contact || '', canal_pref: fiche?.canal_pref || '', actions: fiche?.actions || '', saved_at: fiche?.saved_at || null
    };
    res.json(prefill);
  }catch(e){ console.error('GET client-fiche:', e); res.status(500).json({error:'client_fiche_get_failed', detail:e.message}); }
});

router.post('/client-fiche/:userId', requireAdmin, async (req,res)=>{
  try{
    await ensureClientFicheSchema();
    const d=req.body||{}, uid=req.params.userId;
    const userExists = await pool.query('SELECT id FROM users WHERE id=$1', [uid]);
    if(!userExists.rowCount) return res.status(404).json({error:'user_not_found'});
    await pool.query(`INSERT INTO client_fiches
      (user_id, nom, categorie, territoire, taille, contact, contact_email, contact_phone, contact_direct,
       niveau_decisionnel, source, domaines, description_besoin, mode_intervention, urgence, stade,
       maturite, complexite, potentiel, fidelite, decision, responsable, responsable_expert_id, notes,
       budget, financement, duree, crm_statut, prochain_contact, canal_pref, actions)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31)
      ON CONFLICT(user_id) DO UPDATE SET
       nom=$2,categorie=$3,territoire=$4,taille=$5,contact=$6,contact_email=$7,contact_phone=$8,contact_direct=$9,
       niveau_decisionnel=$10,source=$11,domaines=$12,description_besoin=$13,mode_intervention=$14,urgence=$15,stade=$16,
       maturite=$17,complexite=$18,potentiel=$19,fidelite=$20,decision=$21,responsable=$22,responsable_expert_id=$23,notes=$24,
       budget=$25,financement=$26,duree=$27,crm_statut=$28,prochain_contact=$29,canal_pref=$30,actions=$31,updated_at=now()`,
      [uid, clean(d.nom), clean(d.categorie), clean(d.territoire), clean(d.size), clean(d.contact), clean(d.contact_email), clean(d.contact_phone), clean(d.contact_direct),
       clean(d.niveau), clean(d.source), Array.isArray(d.domaines)?d.domaines:[], clean(d.besoins), clean(d.mode), clean(d.urgence), clean(d.stade),
       toInt(d.maturite), toInt(d.complexite), toInt(d.potentiel), toInt(d.fidelite), clean(d.decision), clean(d.responsable), clean(d.responsable_expert_id), clean(d.notes),
       clean(d.budget), clean(d.financement), clean(d.duree), clean(d.crm_statut), clean(d.prochain_contact), clean(d.canal_pref), clean(d.actions)]);
    res.json({ok:true, saved_at:new Date().toISOString()});
  }catch(e){ console.error('POST client-fiche:', e); res.status(500).json({error:'client_fiche_save_failed', detail:e.message}); }
});
export default router;

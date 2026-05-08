import express from 'express';
import { pool } from '../db/index.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

async function ensureClientFicheSchema() {
  await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'client'`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_country text`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number text`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_full text`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS organization text`);
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
  await pool.query(`CREATE TABLE IF NOT EXISTS expert_assignments (
    expert_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (expert_id, client_id)
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
function cleanUuid(v){ const s=clean(v); return s && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s) ? s : null; }
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
    const { rows } = await pool.query(`SELECT cf.*, u.id AS account_id, u.full_name, u.email, u.organization, u.phone_full, u.phone_country, u.phone_number, u.account_space,
      ax.expert_id AS assigned_expert_id, ex.full_name AS assigned_expert_name, ex.email AS assigned_expert_email
      FROM users u
      LEFT JOIN client_fiches cf ON cf.user_id=u.id
      LEFT JOIN LATERAL (SELECT expert_id FROM expert_assignments WHERE client_id=u.id ORDER BY assigned_at DESC LIMIT 1) ax ON true
      LEFT JOIN users ex ON ex.id=ax.expert_id
      WHERE u.id=$1`, [req.params.userId]);
    if(!rows.length) return res.status(404).json({error:'user_not_found'});
    const r=rows[0];
    const fiche = r.user_id ? rowToPayload(r) : null;
    const phone = r.phone_full || [r.phone_country, r.phone_number].filter(Boolean).join('');
    const assignedName = r.assigned_expert_name || r.assigned_expert_email || '';
    const prefill = {
      nom: fiche?.nom || r.organization || r.full_name || '',
      categorie: fiche?.categorie || (r.account_space === 'public' ? 'Collectivité / acteur public' : 'Client privé'),
      contact: fiche?.contact || r.full_name || '',
      contact_email: fiche?.contact_email || r.email || '',
      contact_phone: fiche?.contact_phone || phone || '',
      contact_direct: fiche?.contact_direct || [r.email, phone].filter(Boolean).join(' / '),
      territoire: fiche?.territoire || '', size: fiche?.size || '', niveau: fiche?.niveau || '', source: fiche?.source || 'Création de compte POPE Online',
      domaines: fiche?.domaines || [], besoins: fiche?.besoins || '', mode: fiche?.mode || '', urgence: fiche?.urgence || '', stade: fiche?.stade || '',
      maturite: fiche?.maturite || '', complexite: fiche?.complexite || '', potentiel: fiche?.potentiel || '', fidelite: fiche?.fidelite || '',
      decision: fiche?.decision || '', responsable: fiche?.responsable || assignedName, responsable_expert_id: fiche?.responsable_expert_id || r.assigned_expert_id || '',
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
    const expertId = cleanUuid(d.responsable_expert_id);
    let expertName = clean(d.responsable);
    if(expertId){
      const exp = await pool.query(`SELECT full_name, email FROM users WHERE id=$1 AND role='expert'`, [expertId]);
      if(!exp.rowCount) return res.status(400).json({error:'expert_not_found', detail:'Expert introuvable ou rôle expert non attribué.'});
      expertName = exp.rows[0].full_name || exp.rows[0].email;
      await pool.query(`INSERT INTO expert_assignments(expert_id, client_id) VALUES($1,$2) ON CONFLICT(expert_id, client_id) DO UPDATE SET assigned_at=now()`, [expertId, uid]);
    }
    await pool.query(`INSERT INTO client_fiches
      (user_id, nom, categorie, territoire, taille, contact, contact_email, contact_phone, contact_direct,
       niveau_decisionnel, source, domaines, description_besoin, mode_intervention, urgence, stade,
       maturite, complexite, potentiel, fidelite, decision, responsable, responsable_expert_id, notes,
       budget, financement, duree, crm_statut, prochain_contact, canal_pref, actions)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31)
      ON CONFLICT(user_id) DO UPDATE SET
       nom=excluded.nom,categorie=excluded.categorie,territoire=excluded.territoire,taille=excluded.taille,contact=excluded.contact,contact_email=excluded.contact_email,contact_phone=excluded.contact_phone,contact_direct=excluded.contact_direct,
       niveau_decisionnel=excluded.niveau_decisionnel,source=excluded.source,domaines=excluded.domaines,description_besoin=excluded.description_besoin,mode_intervention=excluded.mode_intervention,urgence=excluded.urgence,stade=excluded.stade,
       maturite=excluded.maturite,complexite=excluded.complexite,potentiel=excluded.potentiel,fidelite=excluded.fidelite,decision=excluded.decision,responsable=excluded.responsable,responsable_expert_id=excluded.responsable_expert_id,notes=excluded.notes,
       budget=excluded.budget,financement=excluded.financement,duree=excluded.duree,crm_statut=excluded.crm_statut,prochain_contact=excluded.prochain_contact,canal_pref=excluded.canal_pref,actions=excluded.actions,updated_at=now()`,
      [uid, clean(d.nom), clean(d.categorie), clean(d.territoire), clean(d.size), clean(d.contact), clean(d.contact_email), clean(d.contact_phone), clean(d.contact_direct),
       clean(d.niveau), clean(d.source), Array.isArray(d.domaines)?d.domaines:[], clean(d.besoins), clean(d.mode), clean(d.urgence), clean(d.stade),
       toInt(d.maturite), toInt(d.complexite), toInt(d.potentiel), toInt(d.fidelite), clean(d.decision), expertName, expertId, clean(d.notes),
       clean(d.budget), clean(d.financement), clean(d.duree), clean(d.crm_statut), clean(d.prochain_contact), clean(d.canal_pref), clean(d.actions)]);
    res.json({ok:true, saved_at:new Date().toISOString(), responsable:expertName, responsable_expert_id:expertId});
  }catch(e){ console.error('POST client-fiche:', e); res.status(500).json({error:'client_fiche_save_failed', detail:e.message}); }
});
export default router;

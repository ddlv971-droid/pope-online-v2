import express from 'express';
import { pool } from '../db/index.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.get('/client-fiche/:userId', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM client_fiches WHERE user_id = $1', [req.params.userId]
    );
    if (!rows.length) return res.json(null);
    const r = rows[0];
    res.json({
      nom: r.nom, categorie: r.categorie, territoire: r.territoire,
      size: r.taille, contact: r.contact, contact_direct: r.contact_direct,
      niveau: r.niveau_decisionnel, source: r.source,
      domaines: r.domaines || [],
      besoins: r.description_besoin, mode: r.mode_intervention,
      urgence: r.urgence, stade: r.stade,
      maturite:  r.maturite  ? String(r.maturite)  : '',
      complexite:r.complexite? String(r.complexite) : '',
      potentiel: r.potentiel ? String(r.potentiel)  : '',
      fidelite:  r.fidelite  ? String(r.fidelite)   : '',
      decision: r.decision, responsable: r.responsable, notes: r.notes,
      budget: r.budget, financement: r.financement, duree: r.duree,
      crm_statut: r.crm_statut,
      prochain_contact: r.prochain_contact ? r.prochain_contact.toISOString().split('T')[0] : '',
      canal_pref: r.canal_pref, actions: r.actions, saved_at: r.updated_at,
    });
  } catch(e) {
    console.error('GET client-fiche:', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.post('/client-fiche/:userId', requireAdmin, async (req, res) => {
  try {
    const d = req.body;
    const uid = req.params.userId;
    const toInt = v => (v && !isNaN(+v)) ? +v : null;
    await pool.query(
      `INSERT INTO client_fiches
       (user_id,nom,categorie,territoire,taille,contact,contact_direct,
        niveau_decisionnel,source,domaines,description_besoin,mode_intervention,
        urgence,stade,maturite,complexite,potentiel,fidelite,decision,
        responsable,notes,budget,financement,duree,crm_statut,
        prochain_contact,canal_pref,actions)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
              $19,$20,$21,$22,$23,$24,$25,$26,$27,$28)
       ON CONFLICT(user_id) DO UPDATE SET
        nom=$2,categorie=$3,territoire=$4,taille=$5,contact=$6,
        contact_direct=$7,niveau_decisionnel=$8,source=$9,domaines=$10,
        description_besoin=$11,mode_intervention=$12,urgence=$13,stade=$14,
        maturite=$15,complexite=$16,potentiel=$17,fidelite=$18,decision=$19,
        responsable=$20,notes=$21,budget=$22,financement=$23,duree=$24,
        crm_statut=$25,prochain_contact=$26,canal_pref=$27,actions=$28,
        updated_at=NOW()`,
      [uid,d.nom||null,d.categorie||null,d.territoire||null,d.size||null,
       d.contact||null,d.contact_direct||null,d.niveau||null,d.source||null,
       Array.isArray(d.domaines)?d.domaines:[],
       d.besoins||null,d.mode||null,d.urgence||null,d.stade||null,
       toInt(d.maturite),toInt(d.complexite),toInt(d.potentiel),toInt(d.fidelite),
       d.decision||null,d.responsable||null,d.notes||null,d.budget||null,
       d.financement||null,d.duree||null,d.crm_statut||null,
       d.prochain_contact||null,d.canal_pref||null,d.actions||null]
    );
    res.json({ ok: true, saved_at: new Date().toISOString() });
  } catch(e) {
    console.error('POST client-fiche:', e.message);
    res.status(500).json({ error: e.message });
  }
});

export default router;

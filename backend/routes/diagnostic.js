// ============================================================================
// POPE Online V89 — Diagnostic flash
// POST /diagnostic                 : demande de rappel accompagnée du diagnostic
// GET  /admin/diagnostics          : liste des demandes (administrateurs)
// PATCH /admin/diagnostics/:id     : suivi (statut)
// Le diagnostic est calculé côté navigateur ; ici, on ne fait que l'enregistrer
// (avec l'accord explicite de l'élu) et prévenir l'équipe.
// ============================================================================
import express from 'express';
import rateLimit from 'express-rate-limit';
import { withClient } from '../db/index.js';
import { sendMail } from '../services/mailer.js';
import { optionalAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();
const limiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 8, standardHeaders: true, legacyHeaders: false });

const clean = (v, max = 300) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
const cleanText = (v, max = 600) => String(v ?? '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').trim().slice(0, max);
const ID = /^[a-z0-9_]{1,24}$/;
const pickId = (v) => (ID.test(String(v || '')) ? String(v) : null);

const LEVELS = { moderee: 'Modérée', elevee: 'Élevée', critique: 'Critique' };
const PATHS = { conseil: 'Conseil Expert', surmesure: 'Accompagnement sur mesure' };
const STATUSES = new Set(['new', 'contacted', 'converted', 'closed']);

router.post('/diagnostic', limiter, optionalAuth, async (req, res) => {
  const b = req.body || {};
  if (clean(b.website)) return res.json({ ok: true });            // pot de miel anti-robots
  if (!b.consent) return res.status(400).json({ error: 'consent_required' });

  const name = clean(b.name, 120);
  const email = clean(b.email, 160).toLowerCase();
  const phone = clean(b.phone, 40);
  if (!name || (!email && !phone)) return res.status(400).json({ error: 'contact_missing_fields' });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'invalid_email' });

  const d = (b.diag && typeof b.diag === 'object') ? b.diag : {};
  const a = (d.answers && typeof d.answers === 'object') ? d.answers : {};
  const answers = {
    profile: pickId(a.profile), size: pickId(a.size), domain: pickId(a.domain), situation: pickId(a.situation),
    tension: pickId(a.tension), deadline: pickId(a.deadline), scope: pickId(a.scope),
    stakes: Array.isArray(a.stakes) ? a.stakes.map(pickId).filter(Boolean).slice(0, 8) : [],
  };
  const level = LEVELS[d.level] ? d.level : 'moderee';
  const path = PATHS[d.path] ? d.path : 'conseil';
  const urgent = d.urgent === true;
  const title = clean(d.title, 160);
  const summary = clean(d.summary, 400);
  const freeText = cleanText(d.text, 600);
  const role = clean(b.role, 80);
  const organization = clean(b.organization, 160);
  const slot = clean(b.slot, 160);

  let id = null;
  try {
    const r = await withClient((client) => client.query(
      `insert into diag_flash_requests(user_id, name, email, phone, role, organization, slot, domain, situation, level, path, urgent,
                                       title, summary, free_text, answers, user_agent)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) returning id`,
      [req.user?.id || null, name, email || null, phone || null, role || null, organization || null, slot || null,
       answers.domain, answers.situation, level, path, urgent, title || null, summary || null, freeText || null,
       JSON.stringify(answers), clean(req.headers['user-agent'], 300)]
    ));
    id = r.rows[0]?.id || null;
  } catch (e) { console.warn('[diagnostic] enregistrement impossible :', e.message); }

  const to = process.env.MAIL_TO || 'contact@pope-online.com';
  const prefix = urgent ? '[URGENT] ' : '';
  const lines = [
    `Diagnostic flash : ${title || '—'}`,
    `Vigilance : ${LEVELS[level]}${urgent ? ' — échéance sous 48 h' : ''}`,
    `Orientation proposée : ${PATHS[path]}`,
    `Synthèse : ${summary || '—'}`,
    '',
    `Nom : ${name}`, `Fonction : ${role || '—'}`, `Collectivité : ${organization || '—'}`,
    `E-mail : ${email || '—'}`, `Téléphone : ${phone || '—'}`, `Créneau souhaité : ${slot || '—'}`,
    `Compte connecté : ${req.user?.email || 'non'}`,
    '',
    'Description :', freeText || '(aucune)',
  ];
  let mailOk = true;
  try {
    await sendMail({ to, replyTo: email || undefined, subject: `${prefix}[POPE Online] Diagnostic flash — ${title || 'demande de rappel'} — ${name}`, text: lines.join('\n') });
    if (email) {
      await sendMail({
        to: email,
        subject: 'POPE Online — Votre demande de rappel',
        text: `Bonjour ${name},\n\nNous avons bien reçu votre diagnostic flash (${title || 'votre situation'}) et votre demande de rappel. ` +
          (urgent ? 'Votre échéance étant très proche, un conseiller vous rappelle en priorité.' : `Un conseiller vous rappelle sous un jour ouvré${slot ? `, en tenant compte du créneau indiqué (${slot})` : ''}.`) +
          `\n\nSi la situation évolue d'ici là, appelez-nous au 09 70 70 30 55.\n\nL'équipe POPE Online\ncontact@pope-online.com`,
      });
    }
  } catch (e) { mailOk = false; console.error('[diagnostic] e-mail non envoyé :', e.message); }
  if (id) { try { await withClient((c) => c.query('update diag_flash_requests set mail_sent=$1 where id=$2', [mailOk, id])); } catch (_) {} }

  res.json({ ok: true });
});

router.get('/admin/diagnostics', requireAdmin, async (req, res) => {
  const status = STATUSES.has(String(req.query.status || '')) ? String(req.query.status) : null;
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
  try {
    const r = await withClient((c) => c.query(
      `select id, created_at, name, email, phone, role, organization, slot, domain, situation, level, path, urgent,
              title, summary, free_text, status, mail_sent
         from diag_flash_requests
        where ($1::text is null or status = $1)
        order by urgent desc, created_at desc
        limit $2`, [status, limit]));
    res.json({ items: r.rows });
  } catch (e) { console.error('[diagnostic] liste :', e.message); res.status(500).json({ error: 'server_error' }); }
});

router.patch('/admin/diagnostics/:id', requireAdmin, async (req, res) => {
  const status = String(req.body?.status || '');
  if (!STATUSES.has(status)) return res.status(400).json({ error: 'invalid_status' });
  if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(400).json({ error: 'invalid_id' });
  try {
    const r = await withClient((c) => c.query('update diag_flash_requests set status=$1 where id=$2', [status, req.params.id]));
    if (!r.rowCount) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  } catch (e) { console.error('[diagnostic] statut :', e.message); res.status(500).json({ error: 'server_error' }); }
});

export default router;

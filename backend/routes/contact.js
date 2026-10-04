// ============================================================================
// POPE Online V88.6 — Formulaire de contact / prise de rendez-vous / demande de devis
// Remplace le simple lien téléphonique « Parler à un conseiller » (inopérant sur
// ordinateur) : l'élu laisse ses coordonnées, choisit un rappel téléphonique, un
// rendez-vous en visio ou une demande de devis (offres Commune / Collectivité).
// ============================================================================
import express from 'express';
import rateLimit from 'express-rate-limit';
import { withClient } from '../db/index.js';
import { sendMail } from '../services/mailer.js';

const router = express.Router();
const limiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 8, standardHeaders: true, legacyHeaders: false });

const SUBJECTS = {
  rappel: 'Être rappelé par un conseiller',
  visio: 'Rendez-vous en visioconférence',
  devis_commune: 'Devis offre Commune',
  devis_collectivite: 'Devis offre Collectivité',
  question: 'Question sur le service',
};
const clean = (v, max = 300) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);

router.post('/', limiter, async (req, res) => {
  const b = req.body || {};
  if (clean(b.website)) return res.json({ ok: true });            // pot de miel anti-robots
  const name = clean(b.name, 120);
  const email = clean(b.email, 160).toLowerCase();
  const phone = clean(b.phone, 40);
  const role = clean(b.role, 80);
  const organization = clean(b.organization, 160);
  const subject = SUBJECTS[clean(b.subject, 40)] ? clean(b.subject, 40) : 'question';
  const slot = clean(b.slot, 160);
  const message = clean(b.message, 3000);

  if (!name || (!email && !phone)) return res.status(400).json({ error: 'contact_missing_fields' });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'invalid_email' });

  try {
    await withClient((client) => client.query(
      `insert into contact_requests(name, email, phone, role, organization, subject, slot, message, user_agent)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [name, email || null, phone || null, role || null, organization || null, subject, slot || null, message || null,
       clean(req.headers['user-agent'], 300)]
    ));
  } catch (e) { console.warn('[contact] enregistrement impossible :', e.message); }

  const to = process.env.MAIL_TO || 'contact@pope-online.com';
  const lines = [
    `Demande : ${SUBJECTS[subject]}`, `Nom : ${name}`, `Fonction : ${role || '—'}`, `Collectivité : ${organization || '—'}`,
    `E-mail : ${email || '—'}`, `Téléphone : ${phone || '—'}`, `Créneau souhaité : ${slot || '—'}`, '', message || '(pas de message)'
  ];
  try {
    await sendMail({ to, replyTo: email || undefined, subject: `[POPE Online] ${SUBJECTS[subject]} — ${name}`, text: lines.join('\n') });
    if (email) {
      await sendMail({
        to: email,
        subject: 'POPE Online — Nous avons bien reçu votre demande',
        text: `Bonjour ${name},\n\nNous avons bien reçu votre demande (${SUBJECTS[subject].toLowerCase()}). Un conseiller revient vers vous dans un délai d'un jour ouvré${slot ? `, en tenant compte du créneau indiqué (${slot})` : ''}.\n\nL'équipe POPE Online\n09 70 70 30 55 — contact@pope-online.com`
      });
    }
  } catch (e) {
    console.error('[contact] e-mail non envoyé :', e.message);
  }
  res.json({ ok: true });
});

export default router;

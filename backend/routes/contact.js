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
import { humanCheck, takeAckBudget, badPhone, URLISH } from '../services/antiabuse.js';

const router = express.Router();
// V89.3 : anti-abus aligné sur le diagnostic flash (délai de saisie, Turnstile si
// configuré, contrôle des champs, dédoublonnage, plafond d'accusés de réception).
const limiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 8, standardHeaders: true, legacyHeaders: false, message: { error: 'too_many_requests' } });

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
  const hc = await humanCheck(b, req.ip);
  if (hc.drop) return res.json({ ok: true });
  if (hc.reject) return res.status(403).json({ error: 'bot_protection_failed' });
  const name = clean(b.name, 120);
  const email = clean(b.email, 160).toLowerCase();
  const phone = clean(b.phone, 40);
  const role = clean(b.role, 80);
  const organization = clean(b.organization, 160);
  const subject = SUBJECTS[clean(b.subject, 40)] ? clean(b.subject, 40) : 'question';
  const slot = clean(b.slot, 220);
  const contactMode = b.contact_mode === 'visio' ? 'visio' : (b.contact_mode === 'phone' ? 'phone' : '');
  const timezone = /^[A-Za-z_]+\/[A-Za-z_]+$/.test(String(b.timezone || '')) ? String(b.timezone) : null;
  let slotAt = null;
  if (b.slot_at) { const d = new Date(String(b.slot_at)); if (!isNaN(d) && d.getTime() > Date.now() - 3600e3 && d.getTime() < Date.now() + 90 * 864e5) slotAt = d.toISOString(); }
  const message = clean(b.message, 3000);
  const population = clean(b.population, 40);
  const seats = clean(b.seats, 60);
  const billingAddress = clean(b.billing_address, 500);

  if (!name || (!email && !phone)) return res.status(400).json({ error: 'contact_missing_fields' });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'invalid_email' });
  if (badPhone(phone)) return res.status(400).json({ error: 'invalid_phone' });
  if (URLISH.test(name) || URLISH.test(organization)) return res.status(400).json({ error: 'invalid_name' });
  if (subject === 'visio' && !email) return res.status(400).json({ error: 'email_required_for_visio' });

  // Dédoublonnage (15 min) et plafond d'accusés de réception par adresse (24 h)
  let duplicate = false; let recent = 0;
  try {
    const q = await withClient((c) => c.query(
      `select count(*) filter (where created_at > now() - interval '15 minutes' and subject = $3 and (($1::text is not null and email = $1) or ($2::text is not null and phone = $2)))::int as dup,
              count(*) filter (where $1::text is not null and email = $1)::int as recent
         from contact_requests where created_at > now() - interval '24 hours'`, [email || null, phone || null, subject]));
    duplicate = (q.rows[0]?.dup || 0) > 0; recent = q.rows[0]?.recent || 0;
  } catch (_) { /* base indisponible : on continue */ }
  if (duplicate) return res.json({ ok: true, duplicate: true });

  try {
    await withClient((client) => client.query(
      `insert into contact_requests(name, email, phone, role, organization, subject, slot, message, user_agent, population, seats, billing_address, slot_at, timezone, contact_mode)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [name, email || null, phone || null, role || null, organization || null, subject, slot || null, message || null,
       clean(req.headers['user-agent'], 300), population || null, seats || null, billingAddress || null, slotAt, timezone, contactMode || null]
    ));
  } catch (e) { console.warn('[contact] enregistrement impossible :', e.message); }

  const to = process.env.MAIL_TO || 'contact@pope-online.com';
  const lines = [
    `Demande : ${SUBJECTS[subject]}`, `Nom : ${name}`, `Fonction : ${role || '—'}`, `Collectivité : ${organization || '—'}`,
    `E-mail : ${email || '—'}`, `Téléphone : ${phone || '—'}`, `Créneau souhaité : ${slot || '—'}${contactMode ? (contactMode === 'visio' ? ' — visioconférence (envoyer le lien)' : ' — appel téléphonique') : ''}`,
    `Habitants : ${population || '—'}`, `Comptes souhaités : ${seats || '—'}`, `Adresse de facturation : ${billingAddress || '—'}`,
    `Vérification anti-robot : ${hc.verified ? 'oui' : 'non (pas d\'accusé de réception envoyé)'}`,
    '', message || '(pas de message)'
  ];
  try {
    await sendMail({ to, replyTo: email || undefined, subject: `[POPE Online] ${SUBJECTS[subject]} — ${name}`, text: lines.join('\n') });
    if (email && hc.verified && recent < 3 && takeAckBudget()) {
      await sendMail({
        to: email,
        subject: 'POPE Online — Nous avons bien reçu votre demande',
        text: subject.startsWith('devis_')
          ? `Bonjour ${name},\n\nNous avons bien reçu votre demande de devis (${SUBJECTS[subject].replace('Devis ', '')}${organization ? `, ${organization}` : ''}). Un conseiller vous adresse votre devis sous un jour ouvré.\n\nPour mémoire : facture déposée sur Chorus Pro, paiement par mandat administratif.\n\nL'équipe POPE Online\n09 70 70 30 55 — contact@pope-online.com`
          : `Bonjour ${name},\n\nNous avons bien reçu votre demande (${SUBJECTS[subject].toLowerCase()}). Un conseiller revient vers vous dans un délai d'un jour ouvré${slot ? `, en tenant compte du créneau indiqué (${slot})` : ''}.\n\nL'équipe POPE Online\n09 70 70 30 55 — contact@pope-online.com`
      });
    }
  } catch (e) {
    console.error('[contact] e-mail non envoyé :', e.message);
  }
  res.json({ ok: true });
});

export default router;

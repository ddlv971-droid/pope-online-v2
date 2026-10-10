/**
 * POPE Online — Job nocturne : email de fin de période d'essai
 * 
 * À lancer via cron sur Render ou en scheduled job :
 *   node scripts/trial_expiry_mailer.js
 * 
 * Logique :
 *  - Détecte les comptes dont trial_expires_at est dépassé
 *    ET pour lesquels l'email de fin n'a pas encore été envoyé
 *  - Envoie un email personnalisé avec les plans disponibles
 *  - Marque le compte (status = 'trial_expired') pour éviter les doublons
 */

import dotenv from 'dotenv';
import { pool } from '../db/index.js';
import { sendMail } from '../services/mailer.js';
import { resolveFrontendBaseUrl } from '../services/urls.js';

dotenv.config();

const BASE_URL = resolveFrontendBaseUrl();

function buildTrialExpiredMail({ fullName, email }) {
  const pricingUrl = `${BASE_URL}/pricing.html`;
  const loginUrl   = `${BASE_URL}/login.html`;
  const firstName  = (fullName || '').split(' ')[0] || 'Madame, Monsieur';

  // V88 : offre Élu unique, ton sobre, palette sapin
  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Votre essai POPE Online est terminé</title></head>
<body style="margin:0;background:#F6F7F4;font-family:Arial,Helvetica,sans-serif;color:#1F2622">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F7F4;padding:32px 12px">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #D6DDD8;border-radius:6px">
  <tr><td style="padding:28px 32px 8px;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:bold;color:#1F4A3D">POPE Online</td></tr>
  <tr><td style="padding:8px 32px 0;font-size:15px;line-height:1.6">
    <p>Bonjour ${firstName},</p>
    <p>Votre essai gratuit de POPE Online est terminé. Votre compte, vos échanges et vos documents restent consultables.</p>
    <p>Pour continuer à solliciter un expert, l'offre <strong>Élu</strong> est à <strong>49&nbsp;€ HT par mois</strong>, sans engagement&nbsp;:</p>
    <ul style="padding-left:18px;margin:0 0 18px">
      <li>10 Conseils Expert par mois</li>
      <li>Réponse en moins de 24&nbsp;h</li>
      <li>Clausier, dépôt sécurisé et outil de rédaction</li>
    </ul>
    <p style="margin:24px 0"><a href="${pricingUrl}" style="display:inline-block;background:#1F4A3D;color:#ffffff;border-radius:6px;padding:13px 24px;font-weight:bold;text-decoration:none">Souscrire l'offre Élu</a></p>
    <p style="font-size:13px;color:#4B5650">Vous pouvez aussi <a href="${loginUrl}" style="color:#1F4A3D">vous connecter</a> pour consulter votre espace.<br>
    Une question&nbsp;? Un conseiller vous répond au 09&nbsp;70&nbsp;70&nbsp;30&nbsp;55 ou à <a href="mailto:contact@pope-online.com" style="color:#1F4A3D">contact@pope-online.com</a>.</p>
  </td></tr>
  <tr><td style="padding:16px 32px 26px;font-size:12px;color:#4B5650;border-top:1px solid #D6DDD8">Pope Online, une offre Pope Consulting · <a href="${BASE_URL}" style="color:#4B5650">pope-online.com</a></td></tr>
</table>
</td></tr></table>
</body></html>`;

  const text = `Bonjour ${firstName},\n\nVotre essai gratuit de POPE Online est terminé. Votre compte, vos échanges et vos documents restent consultables.\n\nPour continuer à solliciter un expert, l'offre Élu est à 49 € HT par mois, sans engagement :\n• 10 Conseils Expert par mois\n• Réponse en moins de 24 h\n• Clausier, dépôt sécurisé et outil de rédaction\n\nSouscrire : ${pricingUrl}\n\nUne question ? 09 70 70 30 55 — contact@pope-online.com\n\nL'équipe POPE Online`;

  return {
    to: email,
    subject: 'POPE Online — Votre essai gratuit est terminé',
    html,
    text
  };
}

async function run() {
  console.log('[trial_expiry_mailer] Démarrage —', new Date().toISOString());

  let processed = 0, errors = 0;

  try {
    // Récupérer les comptes expirés dont le statut est encore trial_active
    // (trial_expired = pas encore traités par ce job)
    const result = await pool.query(`
      SELECT
        u.id, u.email, u.full_name, u.account_space,
        w.trial_expires_at, w.status
      FROM users u
      JOIN wallets w ON w.user_id = u.id
      WHERE w.status = 'trial_active'
        AND w.trial_expires_at IS NOT NULL
        AND w.trial_expires_at < NOW()
      ORDER BY w.trial_expires_at ASC
      LIMIT 100
    `);

    console.log(`[trial_expiry_mailer] ${result.rowCount} compte(s) expiré(s) à traiter`);

    for (const row of result.rows) {
      try {
        // 1. Marquer comme expiré en base (évite le double-envoi)
        await pool.query(
          `UPDATE wallets SET status = 'trial_expired', updated_at = NOW() WHERE user_id = $1`,
          [row.id]
        );

        // 2. Envoyer l'email
        const mail = buildTrialExpiredMail({
          fullName:     row.full_name,
          email:        row.email,
          accountSpace: row.account_space
        });

        await sendMail(mail);

        console.log(`[trial_expiry_mailer] ✅ Email envoyé : ${row.email}`);
        processed++;

      } catch (err) {
        console.error(`[trial_expiry_mailer] ❌ Erreur pour ${row.email}:`, err.message);
        errors++;
      }

      // Pause entre chaque envoi (évite le rate-limit Resend)
      await new Promise(r => setTimeout(r, 300));
    }

  } catch (err) {
    console.error('[trial_expiry_mailer] Erreur fatale:', err);
  } finally {
    await pool.end();
    console.log(`[trial_expiry_mailer] Terminé — ${processed} envoyés, ${errors} erreurs`);
  }
}

run();

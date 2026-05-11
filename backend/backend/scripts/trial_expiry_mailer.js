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

function buildTrialExpiredMail({ fullName, email, accountSpace }) {
  const spaceLabel = accountSpace === 'private' ? 'privé' : 'public';
  const pricingUrl = `${BASE_URL}/pricing.html`;
  const loginUrl   = `${BASE_URL}/login.html`;

  const firstName = (fullName || '').split(' ')[0] || 'Utilisateur';

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',system-ui,sans-serif;background:#f0f7fc;color:#0b2440">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f7fc;padding:40px 20px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.08)">

  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#0079c1,#03a0d7);padding:32px 40px;text-align:center">
    <div style="font-size:32px;margin-bottom:8px">🎯</div>
    <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;letter-spacing:-.02em">Votre période d'essai est terminée</h1>
    <p style="margin:8px 0 0;color:rgba(255,255,255,.85);font-size:15px">Merci d'avoir utilisé POPE Online espace ${spaceLabel}</p>
  </td></tr>

  <!-- Corps -->
  <tr><td style="padding:36px 40px">
    <p style="font-size:16px;line-height:1.7;margin:0 0 20px">Bonjour ${firstName},</p>
    <p style="font-size:15px;line-height:1.7;color:#50627a;margin:0 0 20px">
      Votre essai gratuit de 15 jours sur POPE Online s'est terminé. Vous avez pu découvrir la puissance
      de notre plateforme : production guidée et <strong style="color:#0b2440">validation experte humaine</strong>
      pour des livrables fiables, sécurisés et exploitables immédiatement.
    </p>
    <p style="font-size:15px;line-height:1.7;color:#50627a;margin:0 0 32px">
      Pour continuer à produire et faire sécuriser vos documents par nos conseillers, choisissez le plan adapté à votre usage.
    </p>

    <!-- Plans -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px">
      <tr>
        <!-- Starter -->
        <td width="31%" style="background:#f0f7fc;border-radius:14px;padding:20px 16px;vertical-align:top;border:1.5px solid #dce9f4">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#50627a;margin-bottom:6px">Starter</div>
          <div style="font-size:24px;font-weight:800;color:#0b2440;margin-bottom:4px">49€<span style="font-size:13px;font-weight:400">/mois</span></div>
          <div style="font-size:11px;color:#065f46;font-weight:600;margin-bottom:12px">ou 499€/an (−15%)</div>
          <ul style="margin:0;padding:0 0 0 14px;font-size:12px;color:#0b2440;line-height:2">
            <li>Production illimitée</li>
            <li>5 relectures expertes/mois</li>
            <li>Closier documentaire</li>
          </ul>
        </td>
        <td width="4%"></td>
        <!-- Pro -->
        <td width="31%" style="background:linear-gradient(135deg,#eef7ff,#e0f0fb);border-radius:14px;padding:20px 16px;vertical-align:top;border:2px solid #0079c1">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#0079c1;margin-bottom:6px">⭐ Pro — Recommandé</div>
          <div style="font-size:24px;font-weight:800;color:#0b2440;margin-bottom:4px">89€<span style="font-size:13px;font-weight:400">/mois</span></div>
          <div style="font-size:11px;color:#065f46;font-weight:600;margin-bottom:12px">ou 890€/an (−15%)</div>
          <ul style="margin:0;padding:0 0 0 14px;font-size:12px;color:#0b2440;line-height:2">
            <li>Production illimitée</li>
            <li>15 relectures expertes/mois</li>
            <li>Accompagnement inclus</li>
          </ul>
        </td>
        <td width="4%"></td>
        <!-- Premium -->
        <td width="31%" style="background:#f0f7fc;border-radius:14px;padding:20px 16px;vertical-align:top;border:1.5px solid #dce9f4">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#50627a;margin-bottom:6px">Premium</div>
          <div style="font-size:20px;font-weight:800;color:#0b2440;margin-bottom:4px">Sur devis</div>
          <div style="font-size:11px;color:#50627a;margin-bottom:12px">Collectivités & Entreprises</div>
          <ul style="margin:0;padding:0 0 0 14px;font-size:12px;color:#0b2440;line-height:2">
            <li>Production illimitée</li>
            <li>Relectures illimitées</li>
            <li>Conseiller dédié</li>
          </ul>
        </td>
      </tr>
    </table>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:28px">
      <a href="${pricingUrl}" style="display:inline-block;background:linear-gradient(135deg,#0079c1,#03a0d7);color:#fff;border-radius:14px;padding:15px 32px;font-size:16px;font-weight:700;text-decoration:none;box-shadow:0 8px 24px rgba(0,121,193,.3)">
        Choisir mon plan →
      </a>
    </div>

    <p style="font-size:13px;color:#50627a;text-align:center;margin:0">
      Vous pouvez aussi <a href="${loginUrl}" style="color:#0079c1">vous connecter</a> pour consulter votre espace en lecture seule.<br/>
      Des questions ? <a href="mailto:contact@pope-online.com" style="color:#0079c1">contact@pope-online.com</a>
    </p>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#f8fbfd;border-top:1px solid #dce9f4;padding:20px 40px;text-align:center">
    <p style="margin:0;font-size:12px;color:#7a8fa8">
      POPE Online — Expertise humaine sécurisée<br/>
      <a href="${BASE_URL}" style="color:#0079c1;text-decoration:none">pope-online.com</a>
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  const text = `Bonjour ${firstName},\n\nVotre essai gratuit POPE Online (espace ${spaceLabel}) s'est terminé.\n\nPour continuer à produire et faire sécuriser vos documents :\n\n• Starter : 49€/mois — 5 relectures expertes\n• Pro : 89€/mois — 15 relectures expertes (recommandé)\n• Premium : Sur devis — Relectures illimitées\n\nChoisir mon plan : ${pricingUrl}\n\nQuestions : contact@pope-online.com\n\n— L'équipe POPE Online`;

  return {
    to: email,
    subject: `POPE Online — Votre période d'essai est terminée, ${firstName}`,
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

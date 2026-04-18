export const API_BASE = window.API_BASE || localStorage.getItem('pope_api_base') || "https://pope-online-v2.onrender.com";

const FR_MESSAGES = {
  invalid_credentials: "Identifiants invalides.",
  invalid_email: "Adresse e-mail invalide.",
  missing_password: "Mot de passe manquant.",
  password_too_short: "Le mot de passe doit contenir au moins 8 caractères.",
  missing_fp: "Informations techniques manquantes. Merci de réessayer.",
  invalid_account_space: "Type de compte invalide.",
  email_exists: "Un compte existe déjà avec cette adresse e-mail.",
  verification_email_sent: "Un e-mail de vérification a été envoyé.",
  reset_email_sent_if_account_exists: "Si un compte existe, un e-mail de réinitialisation a été envoyé.",
  invalid_or_expired_token: "Le lien est invalide ou expiré.",
  invalid_token: "Le lien de vérification est invalide.",
  token_used: "Ce lien a déjà été utilisé.",
  token_expired: "Ce lien a expiré.",
  password_reset_success: "Votre mot de passe a bien été réinitialisé.",
  too_many_attempts: "Trop de tentatives. Merci de réessayer plus tard.",
  unauthorized: "Vous n'êtes pas autorisé à effectuer cette action.",
  forbidden: "Action non autorisée.",
  user_not_found: "Utilisateur introuvable.",
  wallet_missing: "Aucun accès n'est associé à ce compte.",
  trial_expired: "Votre période d'essai est terminée.",
  no_tickets: "Votre quota gratuit est atteint.",
  public_dossier_limit_reached: "Le quota gratuit des dossiers publics est atteint.",
  private_dossier_limit_reached: "Le quota gratuit des dossiers privés est atteint.",
  sensitive_data: "Des données directement sensibles ont été détectées. Merci de les anonymiser avant génération.",
  ai_error: "La génération IA n'a pas pu aboutir.",
  cors_blocked: "Accès refusé depuis cette origine.",
  server_error: "Une erreur technique est survenue.",
  missing_objective: "L'objectif est manquant.",
  missing_expectations: "Les attentes sont manquantes.",
  missing_subject: "L'objet est manquant.",
  missing_description: "La description est manquante.",
  missing_need: "Le besoin est manquant.",
  satisfaction_mail_sent: "L'e-mail de satisfaction a bien été envoyé.",
  satisfaction_mail_already_sent: "L'e-mail de satisfaction a déjà été envoyé.",
  mail_send_failed: "L'envoi de l'e-mail a échoué. Vérifiez la configuration de contact@pope-online.com.",
  missing_satisfaction_token: "Le lien du formulaire de satisfaction est incomplet.",
  missing_satisfaction_answers: "Merci de renseigner tous les critères de satisfaction.",
  satisfaction_response_sent: "Votre retour a bien été transmis. Merci.",
};

export function translateApiMessage(code, fallback = '') {
  if (!code) return fallback || '';
  return FR_MESSAGES[code] || fallback || code;
}

export function getApiMessage(payloadOrError, fallback = 'Une erreur est survenue.') {
  const data = payloadOrError?.data || payloadOrError || {};
  return data?.error_label || data?.message_label || translateApiMessage(data?.error || data?.message, payloadOrError?.message || fallback);
}

export function getToken() {
  return localStorage.getItem('pope_token') || '';
}

export function setToken(token) {
  if (token) localStorage.setItem('pope_token', token);
  else localStorage.removeItem('pope_token');
}

export async function apiFetch(path, { method='GET', body=null, auth=true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const t = getToken();
    if (t) headers['Authorization'] = `Bearer ${t}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : null });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) {
    const err = new Error(getApiMessage(data, 'api_error'));
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

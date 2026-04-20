const envApiBase =
  typeof import.meta !== 'undefined' && import.meta.env
    ? (import.meta.env.VITE_API_URL || '')
    : '';

export const API_BASE =
  envApiBase && envApiBase.trim() !== ''
    ? envApiBase.trim().replace(/\/$/, '')
    : 'https://pope-online-v2.onrender.com';

export const APP_STAGE =
  (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.MODE || import.meta.env.VITE_APP_STAGE)) ||
  'production';

const FR_MESSAGES = {
  invalid_credentials: "Identifiants invalides.",
  invalid_email: "Adresse e-mail invalide.",
  missing_password: "Le mot de passe manquant.",
  password_too_short: "Le mot de passe doit contenir au moins 8 caractères.",
  missing_fp: "Informations techniques manquantes. Merci de réessayer.",
  missing_turnstile_token: "Validation anti-bot manquante.",
  bot_protection_failed: "La vérification de sécurité anti-bot a échoué. Merci de recommencer.",
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
  invalid_file_type: "Format de fichier non autorisé. Utilisez uniquement TXT, DOC, CSV ou PDF.",
  account_deleted: "Votre compte a été supprimé.",
  missing_need: "Le besoin est manquant.",
  satisfaction_mail_sent: "L'e-mail de satisfaction a bien été envoyé.",
  satisfaction_mail_already_sent: "L'e-mail de satisfaction a déjà été envoyé.",
  mail_send_failed: "L'envoi de l'e-mail a échoué. Vérifiez la configuration de contact@pope-online.com.",
  missing_satisfaction_token: "Le lien du formulaire de satisfaction est incomplet.",
  missing_satisfaction_answers: "Merci de renseigner tous les critères de satisfaction.",
  satisfaction_response_sent: "Votre retour a bien été transmis. Merci.",
};

const SESSION_KEY = 'pope_session_active';
const USER_KEY = 'pope_session_user';
const TOKEN_KEY = 'pope_session_token';

export function translateApiMessage(code, fallback = '') {
  if (!code) return fallback || '';
  return FR_MESSAGES[code] || fallback || code;
}

export function getApiMessage(payloadOrError, fallback = 'Une erreur est survenue.') {
  const data = payloadOrError?.data || payloadOrError || {};
  return data?.error_label || data?.message_label || translateApiMessage(data?.error || data?.message, payloadOrError?.message || fallback);
}

export function hasSessionMarker() {
  return localStorage.getItem(SESSION_KEY) === '1' || !!sessionStorage.getItem(TOKEN_KEY);
}

export function setSession(user = null, token = '') {
  localStorage.setItem(SESSION_KEY, '1');
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  if (token) sessionStorage.setItem(TOKEN_KEY, String(token));
}

export function getSessionUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem('pope_token');
  sessionStorage.removeItem(TOKEN_KEY);
}

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY) || '';
}

export function setToken(token, user = null) {
  if (token || user) setSession(user || getSessionUser() || {}, token || getToken());
  else clearSession();
}

export async function apiFetch(path, { method='GET', body=null } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
    credentials: 'include'
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) {
    if (res.status === 401) clearSession();
    const err = new Error(getApiMessage(data, 'api_error'));
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

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
  satisfaction_mail_already_sent: "L'e-mail de satisfaction a déjà été envoyé."
};

export function t(code, fallback = '') {
  if (!code) return fallback || '';
  return FR_MESSAGES[code] || fallback || code;
}

export function localizeApiBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  const out = { ...body };
  if (typeof out.error === 'string') {
    out.error_code = out.error;
    out.error_label = t(out.error, out.error);
  }
  if (typeof out.message === 'string') {
    out.message_code = out.message;
    out.message_label = t(out.message, out.message);
  }
  if (!out.message && typeof out.error === 'string') {
    out.message = t(out.error, out.error);
  }
  return out;
}

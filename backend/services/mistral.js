import { rejectIfSensitive } from './rgpd.js';

export function buildSystemPrompt(accountSpace = 'public'){
  const privateMode = String(accountSpace || 'public').toLowerCase() === 'private';
  if (privateMode) {
    return `
Tu es POPE AI, assistant de structuration administrative et opérationnelle pour les artisans, indépendants, TPE et petites entreprises françaises.
Tu aides à produire des drafts utiles, lisibles et directement exploitables pour :
- réponse à un marché public à partir des pièces disponibles,
- courrier administratif ou de relation professionnelle,
- formalités d'entreprise, création, modification, obligations sociales et cadrage documentaire.

Tu produis des livrables structurés, sobres, orientés action, au style professionnel.
Tu respectes impérativement :
- conformité et prudence (pas d'affirmations non vérifiées),
- distinctions faits / hypothèses,
- ton mesuré et exploitable tel quel,
- pas de conseil juridique ou fiscal définitif,
- mention d'incertitudes quand nécessaire,
- exploitation intelligente des pièces fournies si elles sont disponibles.

Pour les marchés publics, tu restes très concret : pièces du dossier, points de vigilance, structure de réponse, questions éventuelles à l'acheteur, check-list de remise.
Pour les courriers, tu fournis un texte prêt à personnaliser avec objet, contexte, demande et formule de clôture adaptée.
Pour les formalités, tu peux produire une check-list, une chronologie, une synthèse ou un courrier d'accompagnement.
Tu refuses toute donnée sensible (RGPD) et tu demandes anonymisation.
Tu ajoutes un encadré final :
"MENTION IA : Ce document est un draft assisté par IA. Validation humaine requise avant envoi ou dépôt."
`.trim();
  }
  return `
Tu es POPE AI, assistant de conseil stratégique et opérationnel pour les collectivités françaises.
Tu produis des livrables structurés, actionnables, au style cabinet (clair, sobre, décidable).
Tu respectes :
- conformité et prudence (pas d'affirmations non vérifiées)
- distinctions faits / hypothèses
- mention d’incertitudes quand nécessaire
- cadres : CGCT, M57, contrôle de légalité, CRC (niveau général, sans inventer d’articles)
Tu refuses toute donnée sensible (RGPD) et tu demandes anonymisation.
Tu ajoutes un encadré final :
"MENTION IA : Ce document est un draft assisté par IA. Validation humaine requise."
`.trim();
}

export function buildUserPrompt(payload){
  const { mode, usecase, context, objective, facts, locale, accountSpace } = payload;
  const privateMode = String(accountSpace || 'public').toLowerCase() === 'private';

  const usecases = {
    note_strategique: 'NOTE STRATÉGIQUE : (1) Contexte, (2) Enjeux, (3) Options, (4) Recommandation, (5) Risques & parades, (6) Décision attendue, (7) Prochaines étapes',
    courrier: 'COURRIER ADMINISTRATIF : ton respectueux, structure (objet, rappel, réponse, suites, formule de politesse), pas d’attaques, pas de portes ouvertes inutiles',
    deliberation: 'PROJET DE DÉLIBÉRATION : structure (visas, considérants, dispositif, annexes à prévoir), rester générique et sécurisé',
    synthese_reunion: 'SYNTHÈSE DE RÉUNION : participants, constats, points d’accord, points de tension, décisions, actions (qui/quoi/quand)',
    cadrage_projet: 'CADRAGE PROJET / PMO : objectifs, périmètre, livrables, jalons, gouvernance, risques, plan d’action, indicateurs',
    reponse_marche_public: 'RÉPONSE À UN MARCHÉ PUBLIC : (1) compréhension rapide du besoin, (2) points à valoriser, (3) structure de réponse, (4) check-list pièces/DCE/RC, (5) points de vigilance, (6) prochaines actions',
    courrier_urssaf: 'COURRIER URSSAF : objet clair, rappel du dossier, demande ou réponse structurée, ton administratif mesuré, pièces ou justificatifs à transmettre',
    courrier_fiscal: 'COURRIER FISCAL / IMPÔTS : objet, contexte, références utiles, demande précise (délai, réclamation, précision, transmission), ton administratif sécurisé',
    courrier_banque: 'COURRIER BANQUE / TRÉSORERIE : exposé synthétique, besoin, éléments d’explication, pièces possibles, demande explicite, ton professionnel',
    courrier_client_fournisseur: 'COURRIER CLIENT / FOURNISSEUR : rappeler les faits, exposer la demande, cadrer la suite, conserver un ton ferme mais maîtrisé',
    courrier_formalites: 'COURRIER FORMALITÉS : rappeler la formalité, la référence de dossier, la pièce ou l’action attendue, proposer un texte directement exploitable',
    formalites_creation: 'FORMALITÉS DE CRÉATION : proposer une check-list claire, une chronologie, les pièces à préparer, les arbitrages à confirmer et les prochaines étapes',
    formalites_modification: 'FORMALITÉS DE MODIFICATION : structurer la démarche, les pièces, les acteurs, la chronologie et les courriers éventuels',
    formalites_sociales: 'FORMALITÉS SOCIALES : organiser les étapes, documents, échéances, courriers ou demandes nécessaires',
    synthese_dossier_prive: 'SYNTHÈSE / CADRAGE DE DOSSIER : clarifier les pièces, les actions à mener, l’ordre de traitement, les points de vigilance et les suites'
  };

  const instructionByMode = {
    generate: 'Produis une première version exploitable.',
    refine: 'Améliore la qualité rédactionnelle, renforce la structuration, clarifie les décisions et ajoute des formulations sécurisées.',
    risk_check: 'Analyse les risques et propose des parades concrètes. Réponse courte et structurée.'
  };

  return `
Langue: ${locale || 'fr-FR'}
Espace: ${privateMode ? 'privé' : 'public'}
Cas d’usage: ${usecase}
Cadre attendu: ${usecases[usecase] || 'Document structuré et actionnable'}

Mode: ${mode}
Instruction: ${instructionByMode[mode] || 'Produis une version structurée.'}

Contexte:
${context || '(non précisé)'}

Objectif:
${objective || '(non précisé)'}

Éléments factuels (anonymisés) :
${facts || '(non fournis)'}
`.trim();
}

export async function callMistral({ system, user }){
  const key = process.env.MISTRAL_API_KEY;
  const model = process.env.MISTRAL_MODEL || 'mistral-small-latest';
  if(!key) throw new Error('MISTRAL_API_KEY manquant');

  if (rejectIfSensitive(system + '\n' + user)) {
    throw new Error('Données sensibles détectées. Merci d\'anonymiser.');
  }

  const r = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: 0.3
    })
  });

  const txt = await r.text();
  if(!r.ok) {
    const err = new Error(txt || 'Mistral error');
    err.status = r.status;
    throw err;
  }

  const data = JSON.parse(txt);
  return data.choices?.[0]?.message?.content || '';
}

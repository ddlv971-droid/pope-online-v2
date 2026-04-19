import { rejectIfSensitive } from './rgpd.js';

export function buildSystemPrompt(){
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
  const { mode, usecase, context, objective, facts, locale } = payload;

  const usecases = {
    note_strategique: 'NOTE STRATÉGIQUE : (1) Contexte, (2) Enjeux, (3) Options, (4) Recommandation, (5) Risques & parades, (6) Décision attendue, (7) Prochaines étapes',
    courrier: 'COURRIER ADMINISTRATIF : ton respectueux, structure (objet, rappel, réponse, suites, formule de politesse), pas d’attaques, pas de portes ouvertes inutiles',
    deliberation: 'PROJET DE DÉLIBÉRATION : structure (visas, considérants, dispositif, annexes à prévoir), rester générique et sécurisé',
    synthese_reunion: 'SYNTHÈSE DE RÉUNION : participants, constats, points d’accord, points de tension, décisions, actions (qui/quoi/quand)',
    cadrage_projet: 'CADRAGE PROJET / PMO : objectifs, périmètre, livrables, jalons, gouvernance, risques, plan d’action, indicateurs'
  };

  const instructionByMode = {
    generate: 'Produis une première version exploitable.',
    refine: 'Améliore la qualité rédactionnelle, renforce la structuration, clarifie les décisions et ajoute des formulations sécurisées.',
    risk_check: 'Analyse les risques (juridique, budgétaire, organisation, RGPD) et propose des parades concrètes. Réponse courte et structurée.'
  };

  return `
Langue: ${locale || 'fr-FR'}
Cas d’usage: ${usecase}
Cadre attendu: ${usecases[usecase] || 'Document structuré et actionnable'}

Mode: ${mode}
Instruction: ${instructionByMode[mode] || 'Produis une version structurée.'}

Contexte:
${context || '(non précisé)'}

Objectif:
${objective || '(non précisé)'}

Éléments factuels (anonymisés):
${facts || '(non fournis)'}
`.trim();
}

export async function callMistral({ system, user }){
  const key = process.env.MISTRAL_API_KEY;
  const model = process.env.MISTRAL_MODEL || 'mistral-small-latest';
  if(!key) throw new Error('MISTRAL_API_KEY manquant');

  // final safety check
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
    // propagate status info
    const err = new Error(txt || 'Mistral error');
    err.status = r.status;
    throw err;
  }

  const data = JSON.parse(txt);
  return data.choices?.[0]?.message?.content || '';
}

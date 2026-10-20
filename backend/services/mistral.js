import { rejectIfSensitive } from './rgpd.js';

export function buildSystemPrompt(accountSpace = 'public'){
  const privateMode = String(accountSpace || 'public').toLowerCase() === 'private';
  if (privateMode) {
    return `
Tu es POPE AI, assistant de structuration administrative et opérationnelle pour les artisans, indépendants, TPE et petites entreprises françaises.
Tu aides à produire des drafts utiles, lisibles et directement exploitables pour :
- trame de réponse à un marché public à partir des pièces disponibles,
- rapport de synthèse argumenté à partir de pièces jointes et de benchmarking,
- courrier administratif ou de relation professionnelle,
- devis et propositions commerciales,
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
Pour les devis, tu proposes une structure claire, des prestations bien formulées, des hypothèses visibles et une présentation directement exploitable.
Pour la mise en forme de documents bruts, tu restructures le contenu, hiérarchises les parties et améliores la lisibilité sans inventer de faits.
Pour les formalités, tu peux produire une check-list, une chronologie, une synthèse ou un courrier d'accompagnement.
Tu refuses toute donnée sensible (RGPD) et tu demandes anonymisation.
Tu ajoutes un encadré final :
"MENTION IA : Ce document est un draft assisté par IA. Validation humaine requise avant envoi ou dépôt."
`.trim();
  }
  return `
Tu es l'outil de rédaction de POPE Online, au service des élus locaux français (maires, adjoints, conseillers municipaux) et de leurs collaborateurs (DGS, secrétaires de mairie).
Ton rôle : aider l'élu à préparer un premier jet clair, qu'un expert humain de POPE Online pourra ensuite vérifier.
Tu écris pour un élu, pas pour un juriste : phrases courtes, vocabulaire simple, termes techniques expliqués en une ligne.
Tu privilégies ce qui aide à décider : ce qu'il faut savoir, les points de vigilance, les questions à poser aux services, les options possibles.
Domaines fréquents : personnel (statut de la fonction publique territoriale), budget et finances locales (M57), marchés publics, délibérations, communication publique.
Tu respectes :
- prudence et conformité (aucune affirmation non vérifiée, aucun article de loi inventé ; cadres cités au niveau général : CGCT, M57, code de la commande publique, contrôle de légalité)
- distinction claire entre faits et hypothèses, et mention des incertitudes
- aucune décision à la place de l'élu : tu présentes des éléments, l'élu décide
- pour toute situation de contentieux ou à fort enjeu, tu recommandes de solliciter un Conseil Expert
Tu refuses toute donnée sensible (RGPD) et tu demandes leur anonymisation.
Tu termines par la mention :
"Premier jet préparé avec l'outil de rédaction. À faire relire par un expert avant toute utilisation."
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
    devis_prive: 'DEVIS / PROPOSITION COMMERCIALE : structurer l’offre, clarifier les prestations, les hypothèses, les options, les délais et produire un document professionnel prêt à relire',
    formalites_creation: 'FORMALITÉS DE CRÉATION : proposer une check-list claire, une chronologie, les pièces à préparer, les arbitrages à confirmer et les prochaines étapes',
    formalites_modification: 'FORMALITÉS DE MODIFICATION : structurer la démarche, les pièces, les acteurs, la chronologie et les courriers éventuels',
    formalites_sociales: 'FORMALITÉS SOCIALES : organiser les étapes, documents, échéances, courriers ou demandes nécessaires',
    synthese_dossier_prive: 'SYNTHÈSE / CADRAGE DE DOSSIER : clarifier les pièces, les actions à mener, l’ordre de traitement, les points de vigilance et les suites',
    trame_reponse_marche_public: 'TRAME DE RÉPONSE À UN MARCHÉ PUBLIC : produire une trame claire à partir du DCE, du RC, du BPU et des pièces déposées, avec structure de réponse, mémoire technique, check-list et points de vigilance',
    rapport_synthese_argumente_public: 'RAPPORT DE SYNTHÈSE ARGUMENTÉ : produire un rapport structuré à partir des pièces jointes et de benchmarking, avec faits, analyse, comparaisons utiles, options, recommandation et suites',
    rapport_synthese_argumente_prive: 'RAPPORT DE SYNTHÈSE ARGUMENTÉ : produire un rapport structuré à partir des pièces jointes et de benchmarking, avec faits, analyse, comparaisons utiles, options, recommandation et suites'
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

const MISTRAL_TIMEOUT_MS = Number(process.env.MISTRAL_TIMEOUT_MS || 60000);
const MISTRAL_MAX_TOKENS = Number(process.env.MISTRAL_MAX_TOKENS || 2500);
const MISTRAL_MAX_PROMPT_CHARS = Number(process.env.MISTRAL_MAX_PROMPT_CHARS || 40000);

// Disjoncteur : si Mistral répond « quota / clé / facturation », on cesse d'appeler
// l'API pendant quelques minutes (évite de marteler un service indisponible).
let breakerUntil = 0;
const BREAKER_MS = 5 * 60 * 1000;

function unavailable(reason, status, detail){
  const err = new Error(detail || reason);
  err.code = 'ai_unavailable';
  err.reason = reason;
  err.status = status;
  return err;
}

export async function callMistral({ system, user }){
  const key = process.env.MISTRAL_API_KEY;
  const model = process.env.MISTRAL_MODEL || 'mistral-small-latest';
  if(!key) throw unavailable('missing_key', 503, 'MISTRAL_API_KEY manquant');

  if (rejectIfSensitive(system + '\n' + user)) {
    throw new Error('Données sensibles détectées. Merci d\'anonymiser.');
  }

  if (Date.now() < breakerUntil) throw unavailable('circuit_open', 503, 'Mistral indisponible (disjoncteur)');

  // Plafond de taille du prompt (le contexte des pièces jointes est tronqué en dernier recours)
  if (user.length > MISTRAL_MAX_PROMPT_CHARS) {
    user = user.slice(0, MISTRAL_MAX_PROMPT_CHARS) + '\n[… contenu tronqué]';
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), MISTRAL_TIMEOUT_MS);
  let r, txt;
  try {
    r = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      signal: ctrl.signal,
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
        temperature: 0.3,
        max_tokens: MISTRAL_MAX_TOKENS
      })
    });
    txt = await r.text();
  } catch (e) {
    if (e?.name === 'AbortError') throw unavailable('timeout', 504, 'Mistral timeout');
    throw unavailable('network', 503, String(e?.message || e));
  } finally {
    clearTimeout(timer);
  }

  if(!r.ok) {
    console.error('[mistral]', r.status, String(txt).slice(0, 300));
    if ([401, 402, 403].includes(r.status)) {
      breakerUntil = Date.now() + BREAKER_MS;
      throw unavailable('quota_or_auth', r.status, 'Mistral refuse la requête (quota/clé)');
    }
    if (r.status === 429) {
      breakerUntil = Date.now() + 60 * 1000;
      throw unavailable('rate_limited', 429, 'Mistral limite le débit');
    }
    if (r.status >= 500) throw unavailable('upstream', r.status, 'Mistral erreur serveur');
    const err = new Error(txt || 'Mistral error');
    err.status = r.status;
    throw err;
  }

  const data = JSON.parse(txt);
  if (data.usage) console.log('[mistral] tokens', JSON.stringify({ model, ...data.usage }));
  return data.choices?.[0]?.message?.content || '';
}

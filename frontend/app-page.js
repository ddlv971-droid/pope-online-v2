import { apiFetch, getApiMessage } from './api.js';
import { requireLogin, wireLogout, setTicketsBadge, showToast } from './app.js';
import {
  createArchiveStore,
  buildArchiveFilename,
  isArchiveStorageAvailable,
  getAutoArchivePreference,
  setAutoArchivePreference,
  archivePreviewHtml
} from './archive.js';

if (!requireLogin('app.html')) {}
wireLogout();

const el = (id) => document.getElementById(id);
const LAST_GENERATION_KEY = 'pope_last_generation_public';
const FORM_STATE_KEYS = { public: 'pope_generation_form_public', private: 'pope_generation_form_private' };
let currentUser = null;
let archiveStore = null;
let generationInFlight = false;
let vaultFiles = [];
let lastDossierAnalysis = null;

const PUBLIC_USECASES = [
  ['note_strategique', 'Note stratégique / arbitrage'],
  ['courrier', 'Courrier administratif'],
  ['deliberation', 'Projet de délibération'],
  ['synthese_reunion', 'Synthèse de réunion'],
  ['cadrage_projet', 'Cadrage projet / pilotage'],
  ['rapport_synthese_argumente_public', 'Rapport de synthèse argumenté (pièces jointes + benchmarking)']
];

const PRIVATE_USECASE_GROUPS = [
  {
    label: 'Marchés publics',
    options: [
      ['reponse_marche_public', 'Réponse à un marché public (DCE / RC / offre)']
    ]
  },
  {
    label: 'Courriers administratifs',
    options: [
      ['courrier_urssaf', 'Courrier URSSAF / cotisations / délai / contestation'],
      ['courrier_fiscal', 'Courrier impôts / TVA / SIE / réclamation'],
      ['courrier_banque', 'Courrier banque / trésorerie / justificatifs'],
      ['courrier_client_fournisseur', 'Courrier client / fournisseur / relance / mise au point'],
      ['courrier_formalites', 'Courrier formalités / greffe / CCI / INPI'],
      ['devis_prive', 'Devis / proposition commerciale']
    ]
  },
  {
    label: "Formalités d'entreprise",
    options: [
      ['formalites_creation', "Création d'entreprise / lancement d'activité"],
      ['formalites_modification', "Modification d'entreprise / siège / activité / dirigeants"],
      ['formalites_sociales', 'Formalités sociales / embauche / documents / affiliation'],
      ['synthese_dossier_prive', 'Synthèse / cadrage / check-list de dossier'],
      ['trame_reponse_marche_public', 'Trame de réponse à un marché public (DCE / RC / BPU / pièces jointes)'],
      ['rapport_synthese_argumente_prive', 'Rapport de synthèse argumenté (pièces jointes + benchmarking)']
    ]
  }
];

const PRIVATE_USECASE_HELP = {
  reponse_marche_public: {
    title: 'Aide à la réponse à un marché public',
    intro: 'Préparez une réponse à partir du DCE, du règlement de consultation et de vos pièces internes déposées 48h. La génération peut produire une trame de réponse, une note de cadrage ou une check-list de remise.',
    bullets: [
      "Pièces recommandées : DCE, RC, BPU, DPGF, acte d'engagement, trame de mémoire technique.",
      "Résultats utiles : synthèse du besoin, points différenciants, questions à l'acheteur, structure de réponse et points de vigilance.",
      'Repère benchmark : les ressources commande publique mettent l'accent sur la candidature, les pièces du dossier et la lisibilité de l'offre.'
    ],
    source: 'Repères : commande publique / économie.gouv.fr',
    contextPlaceholder: "Votre activité, la consultation visée, le besoin exprimé par l'acheteur, vos atouts et vos contraintes de réponse…",
    objectivePlaceholder: "Ex : obtenir une trame de réponse, une synthèse du RC, une liste des pièces manquantes ou une note pour préparer l'offre.",
    factsPlaceholder: 'Références du marché, échéance, allotissement, exigences du RC, points techniques, références client, pièces déjà prêtes…',
    vaultTitle: 'Pièces temporaires 48h — marché public',
    vaultCopy: "Sélectionnez par exemple le DCE, le règlement de consultation, une trame d'offre ou vos justificatifs utiles à la préparation de la réponse."
  },
  trame_reponse_marche_public: {
    title: 'Trame de réponse à un marché public',
    intro: 'Produisez une trame de réponse structurée à partir du DCE, du RC, du BPU et de vos pièces jointes pour sécuriser votre compréhension du marché et organiser votre offre.',
    bullets: [
      "Pièces recommandées : DCE, règlement de consultation, BPU, DPGF, acte d'engagement, mémoire technique, pièces administratives.",
      'Résultats utiles : architecture de réponse, trame du mémoire, check-list des pièces, angles de différenciation, points de vigilance et questions éventuelles.',
      "Repère benchmark : les meilleures réponses mettent en avant la compréhension du besoin, la méthode, les moyens, les engagements et la lisibilité de l'offre."
    ],
    source: 'Repères : commande publique / benchmark mémoire technique',
    contextPlaceholder: "Votre activité, le marché visé, les attentes perçues de l'acheteur, vos atouts, vos références et vos contraintes de remise…",
    objectivePlaceholder: 'Ex : obtenir une trame de mémoire technique, une structure de réponse, une check-list des pièces et des points de vigilance.',
    factsPlaceholder: 'Références du marché, échéance, allotissement, critères, exigences du RC, pièces disponibles, références internes, organisation de réponse…',
    vaultTitle: 'Pièces temporaires 48h — trame réponse marché public',
    vaultCopy: 'Ajoutez le DCE, le RC, le BPU, vos notes internes et vos pièces utiles pour construire une trame de réponse exploitable.'
  },
  rapport_synthese_argumente_public: {
    title: 'Rapport de synthèse argumenté',
    intro: "Produisez un rapport de synthèse argumenté à partir des pièces jointes et d'un benchmarking utile pour éclairer une décision, une orientation ou un arbitrage.",
    bullets: [
      'Le rapport vise une lecture cabinet : contexte, constats, analyse, benchmark, options, recommandation et suites.',
      'Les pièces jointes servent à asseoir les faits et à faire ressortir les enjeux opérationnels, financiers et organisationnels.',
      "Le benchmarking aide à situer le dossier, comparer des approches et renforcer l'argumentation."
    ],
    source: 'Repères : rapport décisionnel / benchmark sectoriel',
    contextPlaceholder: 'Objet du dossier, environnement institutionnel, destinataire du rapport, niveau de décision attendu, points de comparaison utiles…',
    objectivePlaceholder: 'Ex : produire un rapport de synthèse argumenté à partir des pièces jointes avec éléments de benchmark et recommandations.',
    factsPlaceholder: 'Pièces disponibles, dates, montants, acteurs, difficultés, comparaisons, hypothèses, contraintes et décisions attendues…',
    vaultTitle: 'Pièces temporaires 48h — rapport de synthèse argumenté',
    vaultCopy: 'Ajoutez les pièces du dossier à analyser pour produire un rapport structuré, argumenté et enrichi de repères comparatifs.'
  },
  rapport_synthese_argumente_prive: {
    title: 'Rapport de synthèse argumenté',
    intro: "Préparez un rapport de synthèse argumenté à partir de vos pièces jointes et d'un benchmarking utile pour cadrer un dossier, défendre une position ou préparer une décision.",
    bullets: [
      'Le rapport met en évidence les faits, les enjeux, les constats, les comparaisons utiles, les options et la recommandation.',
      'Il est particulièrement adapté à un dossier complexe, à une préparation de rendez-vous, à une décision de dirigeant ou à une restitution client.',
      'Le benchmarking sert à comparer des pratiques, des structures de réponse ou des positionnements observés.'
    ],
    source: 'Repères : dossier privé / benchmark opérationnel',
    contextPlaceholder: 'Nature du dossier, entreprise concernée, destinataire du rapport, objectif de décision, repères ou comparaisons utiles…',
    objectivePlaceholder: 'Ex : produire un rapport de synthèse argumenté à partir des pièces du dossier avec benchmark et recommandation.',
    factsPlaceholder: 'Pièces disponibles, dates, montants, interlocuteurs, risques, options, éléments de comparaison et suites attendues…',
    vaultTitle: 'Pièces temporaires 48h — rapport de synthèse argumenté',
    vaultCopy: 'Ajoutez les pièces du dossier pour produire une synthèse argumentée enrichie de repères comparatifs et de recommandations.'
  },
  courrier_urssaf: {
    title: 'Courrier URSSAF / cotisations / délai / contestation',
    intro: 'Préparez un courrier administratif clair et contextualisé à destination de l'URSSAF : demande de délai, réponse à une relance, demande d'explication, transmission de justificatifs ou contestation argumentée.',
    bullets: [
      "Cas représentatifs : demande d'échéancier, réponse à mise en demeure, demande de régularisation, transmission de pièces.",
      'Le courrier est structuré pour reprendre les références dossier, le contexte, la demande et les suites attendues.',
      "Repère benchmark : l'Urssaf publie des démarches et modèles de documents utiles pour les créateurs, indépendants et employeurs."
    ],
    source: 'Repères : Urssaf / formulaires et démarches',
    contextPlaceholder: "Votre situation, le courrier reçu, le compte concerné, le délai, la relation avec l'URSSAF et les éléments déjà transmis…",
    objectivePlaceholder: 'Ex : demander un délai, contester une régularisation, répondre à une relance ou transmettre des justificatifs.',
    factsPlaceholder: 'Numéro de dossier anonymisé, périodes concernées, montants, échéances, échanges précédents, pièces disponibles…',
    vaultTitle: 'Pièces temporaires 48h — courrier URSSAF',
    vaultCopy: 'Ajoutez si besoin un courrier reçu, une relance, une mise en demeure ou vos justificatifs pour nourrir la rédaction.'
  },
  courrier_fiscal: {
    title: 'Courrier impôts / TVA / SIE / réclamation',
    intro: 'Préparez un courrier à destination des impôts ou du SIE pour une demande de délai, une réclamation, une précision sur la TVA ou une réponse à une sollicitation administrative.',
    bullets: [
      "Cas représentatifs : demande d'échéancier, réponse à proposition, clarification TVA, réclamation ou transmission de justificatifs.",
      'Le draft reprend le contexte, la demande précise, les références utiles et un ton administratif maîtrisé.',
      'Repère benchmark : les besoins TPE sur la relation administrative portent souvent sur les délais, les justificatifs et la sécurisation des échanges.'
    ],
    source: 'Repères : impôts / gestion administrative TPE',
    contextPlaceholder: "Votre situation, le service concerné, la nature de la demande fiscale, l'échéance et les contraintes de trésorerie…",
    objectivePlaceholder: 'Ex : demander un délai de paiement, rédiger une réclamation, répondre à un courrier du SIE ou préparer un mail structuré.',
    factsPlaceholder: 'Périodes, montants, références anonymisées, échanges déjà reçus, justificatifs, situation de TVA ou de trésorerie…',
    vaultTitle: 'Pièces temporaires 48h — fiscal / impôts',
    vaultCopy: 'Ajoutez un avis, un courrier reçu, un récapitulatif de TVA ou des justificatifs pour nourrir la réponse.'
  },
  courrier_banque: {
    title: 'Courrier banque / trésorerie / justificatifs',
    intro: 'Préparez un courrier ou un mail pour votre banque : demande de rendez-vous, transmission de justificatifs, explication de situation, point de trésorerie ou sollicitation sur un financement.',
    bullets: [
      "Cas représentatifs : demande de rendez-vous, justificatifs pour dossier, point sur la trésorerie, demande d'appui bancaire.",
      'Le résultat met en avant la clarté, le ton professionnel et la hiérarchie des informations utiles.',
      'Repère benchmark : les petites entreprises ont souvent besoin de formaliser rapidement des échanges structurés avec leur banque.'
    ],
    source: 'Repères : besoins courants TPE / relation bancaire',
    contextPlaceholder: 'Votre relation bancaire, le motif du courrier, la situation de trésorerie, le rendez-vous souhaité ou le dossier à justifier…',
    objectivePlaceholder: 'Ex : demander un rendez-vous, présenter un besoin de trésorerie ou transmettre un dossier synthétique.',
    factsPlaceholder: 'Montants, échéances, documents disponibles, interlocuteurs, contexte commercial ou financier…',
    vaultTitle: 'Pièces temporaires 48h — banque',
    vaultCopy: 'Ajoutez si besoin un mail reçu, des justificatifs de situation, un prévisionnel ou une synthèse de trésorerie.'
  },
  courrier_client_fournisseur: {
    title: 'Courrier client / fournisseur / relance / mise au point',
    intro: "Rédigez un courrier ou un mail professionnel pour clarifier une situation avec un client ou un fournisseur : relance, demande de régularisation, réponse à un litige ou cadrage d'un échange sensible.",
    bullets: [
      'Cas représentatifs : relance de paiement, mise au point contractuelle, réponse à une réclamation, demande de justificatifs.',
      'Le brouillon vise un ton ferme mais mesuré, avec des demandes explicites et une traçabilité des échanges.',
      'Repère benchmark : ce besoin revient fréquemment dans les TPE quand la gestion administrative doit rester rapide et cadrée.'
    ],
    source: 'Repères : gestion quotidienne artisans / TPE',
    contextPlaceholder: "La relation concernée, le problème rencontré, les échanges déjà passés, le ton à adopter et l'enjeu commercial…",
    objectivePlaceholder: 'Ex : relancer un règlement, demander une régularisation, répondre à un client ou formaliser une position.',
    factsPlaceholder: 'Dates, montants, prestations, commande, incidents, références et pièces utiles…',
    vaultTitle: 'Pièces temporaires 48h — client / fournisseur',
    vaultCopy: 'Ajoutez un échange, une facture, un devis ou un document de référence pour produire un courrier mieux ancré dans votre situation.'
  },
  courrier_formalites: {
    title: 'Courrier formalités / greffe / CCI / INPI',
    intro: "Préparez un courrier ou un message lié à une formalité d'entreprise : précision à demander, pièce à transmettre, relance sur un dossier ou réponse à un organisme de formalité.",
    bullets: [
      'Cas représentatifs : demande de précision, envoi de pièces, relance de formalité, réponse à une demande de complément.',
      "Le brouillon met en avant les références du dossier, les documents joints et l'action attendue.",
      'Repère benchmark : les CCI et les formalités en ligne structurent de nombreuses démarches de création et de modification.'
    ],
    source: 'Repères : CCI / formalités entreprises',
    contextPlaceholder: "Le dossier concerné, l'organisme, la formalité en cours, la pièce attendue ou le blocage rencontré…",
    objectivePlaceholder: 'Ex : demander une précision, répondre à une demande de complément ou relancer un dossier.',
    factsPlaceholder: 'Références de dossier, date de dépôt, pièces manquantes, interlocuteurs, échéances…',
    vaultTitle: 'Pièces temporaires 48h — formalités',
    vaultCopy: 'Ajoutez la demande reçue, votre dossier ou la pièce concernée pour mieux cadrer la réponse.'
  },
  formalites_creation: {
    title: 'Création d'entreprise / lancement d'activité',
    intro: 'Préparez un cadrage opérationnel de création : étapes, pièces, choix structurants, questions à traiter et documents à préparer avant immatriculation.',
    bullets: [
      "Cas représentatifs : choisir un statut, préparer l'immatriculation, rassembler les pièces, planifier les démarches de lancement.",
      'Résultats utiles : check-list, plan d'action, synthèse des pièces, note d'arbitrage ou message à adresser à un organisme.',
      "Repère benchmark : Bpifrance Création, l'Urssaf et les CCI structurent fortement les parcours de création et de formalités."
    ],
    source: 'Repères : Bpifrance Création / Urssaf / CCI',
    contextPlaceholder: "Votre projet, l'activité visée, le calendrier de lancement, vos contraintes et les démarches déjà réalisées…",
    objectivePlaceholder: "Ex : obtenir une check-list de création, un plan d'action, un courrier à un organisme ou une synthèse des étapes.",
    factsPlaceholder: 'Forme juridique envisagée, associés, siège, activité, calendrier, besoins documentaires, interlocuteurs…',
    vaultTitle: "Pièces temporaires 48h — création d'entreprise",
    vaultCopy: "Déposez un projet de statuts, une trame de business, des pièces d'identité ou tout document préparatoire utile."
  },
  formalites_modification: {
    title: "Modification d'entreprise / siège / activité / dirigeants",
    intro: 'Préparez une formalité de modification : changement d'adresse, d'activité, de dirigeant, mise à jour de statuts ou cadrage des pièces à déposer.',
    bullets: [
      "Cas représentatifs : transfert de siège, modification d'activité, changement de dirigeant, actualisation de pièces.",
      "Résultats utiles : check-list de formalité, chronologie des actions, courrier d'accompagnement ou synthèse du dossier.",
      'Repère benchmark : les formalités de société et les démarches en ligne nécessitent une préparation documentaire rigoureuse.'
    ],
    source: 'Repères : CCI / formalités entreprises / guichet unique',
    contextPlaceholder: "La modification envisagée, le calendrier, l'état des pièces et les organismes concernés…",
    objectivePlaceholder: "Ex : obtenir la liste des étapes, un courrier d'accompagnement ou une check-list des pièces à produire.",
    factsPlaceholder: 'Forme sociale, siège, activité, personnes concernées, date souhaitée, documents déjà disponibles…',
    vaultTitle: "Pièces temporaires 48h — modification d'entreprise",
    vaultCopy: 'Ajoutez vos statuts, un PV, une pièce de justificatif ou tout document utile à la préparation du dossier.'
  },
  formalites_sociales: {
    title: 'Formalités sociales / embauche / documents / affiliation',
    intro: 'Préparez un dossier ou un courrier lié à une formalité sociale : embauche, affiliation, régularisation, réponse documentaire ou organisation des pièces à fournir.',
    bullets: [
      "Cas représentatifs : préparation d'embauche, régularisation sociale, justificatifs, organisation documentaire.",
      "Le résultat peut prendre la forme d'une check-list, d"un courrier ou d'un cadrage de démarche.',
      'Repère benchmark : les parcours Urssaf distinguent fortement les besoins des indépendants et des employeurs.'
    ],
    source: 'Repères : Urssaf / indépendants / employeurs',
    contextPlaceholder: 'Le dossier social concerné, le salarié ou l'activité visée, l'échéance et les documents à réunir…',
    objectivePlaceholder: 'Ex : obtenir une check-list, préparer un courrier ou structurer les étapes de la formalité.',
    factsPlaceholder: 'Dates, statuts, pièces disponibles, références anonymisées, obligations connues…',
    vaultTitle: 'Pièces temporaires 48h — formalités sociales',
    vaultCopy: 'Ajoutez vos documents préparatoires ou la demande reçue pour structurer la réponse et la check-list.'
  },
  synthese_dossier_prive: {
    title: 'Synthèse / cadrage / check-list de dossier',
    intro: "Structurez rapidement un dossier privé ou administratif pour clarifier les pièces, les actions à mener et l'ordre de traitement avant relecture experte ou accompagnement.",
    bullets: [
      "Cas représentatifs : synthèse de dossier, check-list de pièces, chronologie d'actions, répartition des tâches.",
      "Pratique quand plusieurs documents ont été déposés 48h et qu'il faut les exploiter dans un ordre cohérent.",
      'Repère benchmark : utile pour passer d'un besoin flou à un plan d'action opérationnel.'
    ],
    source: 'Repères : besoins transverses artisans / TPE',
    contextPlaceholder: "Le dossier à structurer, les parties prenantes, l'urgence, les pièces disponibles et les points à arbitrer…",
    objectivePlaceholder: 'Ex : obtenir une synthèse, une check-list, une chronologie ou un cadrage de dossier.',
    factsPlaceholder: 'Documents disponibles, contraintes, échéances, interlocuteurs et points de vigilance…',
    vaultTitle: 'Pièces temporaires 48h — cadrage de dossier',
    vaultCopy: 'Sélectionnez les pièces utiles pour produire une synthèse ou une check-list opérationnelle.'
  },
  devis_prive: {
    title: 'Réalisation d'un devis ou d'une proposition commerciale',
    intro: 'Préparez un devis clair, rassurant et directement exploitable à partir de vos éléments métier. L'assistant peut structurer l'offre, reformuler les prestations et clarifier les conditions commerciales.',
    bullets: [
      "Utile pour partir de notes brutes, d'un message client, d"un relevé de besoin ou d'un ancien devis.',
      'Résultats possibles : devis structuré, proposition d'accompagnement, mail d'envoi du devis, check-list des pièces ou informations manquantes.',
      'Repère métier : aide particulièrement utile quand il faut répondre vite tout en gardant une présentation professionnelle et cohérente.'
    ],
    source: 'Repères : usages fréquents artisans / TPE',
    contextPlaceholder: "Activité concernée, client, besoin exprimé, contexte de la demande et niveau d'urgence…",
    objectivePlaceholder: "Ex : obtenir un devis prêt à relire, une proposition commerciale ou un mail d'accompagnement du devis.",
    factsPlaceholder: "Prestations, quantités, prix, délais, options, conditions d'intervention, hypothèses et éléments à confirmer…",
    vaultTitle: 'Pièces temporaires 48h — devis / proposition',
    vaultCopy: 'Ajoutez vos notes, ancien devis, cahier des charges ou échange client pour produire un document plus propre et plus complet.'
  },
  design_document_public: {
    title: "Mise en forme d'un document brut",
    intro: 'Transformez des notes, un relevé ou un texte non finalisé en document plus lisible, plus hiérarchisé et plus présentable pour un usage public ou interne.',
    bullets: [
      'Utile pour remettre en forme une note, une synthèse, un compte rendu ou un document interne avant validation.',
      'Résultats possibles : structuration des titres, remise en ordre des idées, amélioration des transitions et version plus propre à relire.',
      'Repère : adapté quand le fond existe déjà mais que la forme doit être professionalisée.'
    ],
    source: 'Repères : usages fréquents collectivités',
    contextPlaceholder: 'Nature du document, destinataire, niveau de formalité, contexte administratif et tonalité attendue…',
    objectivePlaceholder: "Ex : obtenir une version plus claire, plus lisible et plus présentable d'un document déjà rédigé.",
    factsPlaceholder: 'Texte brut, notes, décisions, titres souhaités, ordre logique des parties et points à conserver…',
    vaultTitle: 'Pièces temporaires 48h — document brut',
    vaultCopy: 'Ajoutez un document brut, un relevé ou des notes à remettre en forme avant validation ou diffusion.'
  }
};

let currentSpace = 'public';
const forcedSpace = (document.body?.dataset?.forcedSpace || '').trim();

function status(text) {
  const node = el('status');
  if (node) node.textContent = text;
}


function getEffectiveSpace() {
  return forcedSpace || currentSpace || 'public';
}

function getFormStateKey(space = getEffectiveSpace()) {
  return FORM_STATE_KEYS[space === 'private' ? 'private' : 'public'];
}

function persistFormState(space = getEffectiveSpace()) {
  try {
    const usecaseNode = el('usecase');
    if (!usecaseNode) return;
    const payload = {
      space,
      usecase: usecaseNode.value || '',
      context: el('context')?.value || '',
      objective: el('objective')?.value || '',
      facts: el('facts')?.value || '',
      savedAt: new Date().toISOString()
    };
    sessionStorage.setItem(getFormStateKey(space), JSON.stringify(payload));
  } catch (error) {
    console.warn('Impossible de mémoriser le brouillon de génération', error);
  }
}

function restoreFormState(space = getEffectiveSpace()) {
  const usecaseNode = el('usecase');
  try {
    const raw = sessionStorage.getItem(getFormStateKey(space));
    if (!raw) {
      if (usecaseNode && !usecaseNode.value && usecaseNode.options.length) {
        usecaseNode.value = usecaseNode.options[0].value;
      }
      return;
    }
    const saved = JSON.parse(raw);
    if (usecaseNode) {
      const values = Array.from(usecaseNode.options).map((option) => option.value);
      if (saved.usecase && values.includes(saved.usecase)) {
        usecaseNode.value = saved.usecase;
      } else if (!usecaseNode.value && usecaseNode.options.length) {
        usecaseNode.value = usecaseNode.options[0].value;
      }
    }
    if (typeof saved.context === 'string') el('context').value = saved.context;
    if (typeof saved.objective === 'string') el('objective').value = saved.objective;
    if (typeof saved.facts === 'string') el('facts').value = saved.facts;
  } catch (error) {
    console.warn('Impossible de restaurer le brouillon de génération', error);
    if (usecaseNode && !usecaseNode.value && usecaseNode.options.length) {
      usecaseNode.value = usecaseNode.options[0].value;
    }
  }
}

function getUserKey() {
  return currentUser?.id || currentUser?.email || 'anonymous';
}


function isPrivateSpace() {
  return currentSpace === 'private';
}

function updateCrossLinks(space = currentSpace) {
  const isPrivate = space === 'private';
  const appExpert = el('appExpertLink');
  const resultExpert = el('resultExpertLink');
  const resultMission = el('resultMissionLink');
  if (appExpert) appExpert.href = isPrivate ? 'expert-private.html' : 'expert.html';
  if (resultExpert) resultExpert.href = isPrivate ? 'expert-private.html' : 'expert.html';
  if (resultMission) resultMission.href = isPrivate ? 'mission-private.html' : 'mission.html';
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
}

function renderInlineMarkup(value = '') {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function isTableSeparator(line) {
  return /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$/.test(line);
}

function splitTableRow(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
}

function renderMarkdownish(source = '') {
  const lines = String(source || '').replace(/\r/g, '').split('\n');
  const parts = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) { i += 1; continue; }
    if (/^-{3,}$/.test(trimmed)) { parts.push('<hr>'); i += 1; continue; }
    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      parts.push(`<h${level}>${renderInlineMarkup(heading[2])}</h${level}>`);
      i += 1;
      continue;
    }
    if (line.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headers = splitTableRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(splitTableRow(lines[i]));
        i += 1;
      }
      const thead = `<thead><tr>${headers.map((cell) => `<th>${renderInlineMarkup(cell)}</th>`).join('')}</tr></thead>`;
      const tbody = `<tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${renderInlineMarkup(cell)}</td>`).join('')}</tr>`).join('')}</tbody>`;
      parts.push(`<div class="rich-table-wrap"><table>${thead}${tbody}</table></div>`);
      continue;
    }
    if (/^[-*]\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(`<li>${renderInlineMarkup(lines[i].trim().replace(/^[-*]\s+/, ''))}</li>`);
        i += 1;
      }
      parts.push(`<ul>${items.join('')}</ul>`);
      continue;
    }
    const paragraph = [];
    while (i < lines.length) {
      const look = lines[i].trim();
      if (!look || /^#{1,6}\s+/.test(look) || /^[-*]\s+/.test(look) || /^-{3,}$/.test(look) || (lines[i].includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1]))) break;
      paragraph.push(renderInlineMarkup(lines[i]));
      i += 1;
    }
    parts.push(`<p>${paragraph.join('<br>')}</p>`);
  }
  return parts.join('') || '<div class="muted">Cliquez sur « Produire un livrable sécurisé » pour générer un premier draft structuré.</div>';
}

function getCurrentResultText() {
  const node = el('output');
  return node?.dataset?.raw || node?.textContent || '';
}

function setOutput(text) {
  const node = el('output');
  if (!node) return;
  const raw = String(text || '');
  node.dataset.raw = raw;
  node.innerHTML = renderMarkdownish(raw);
}

function renderList(values = []) {
  if (!Array.isArray(values) || !values.length) return '<p class="muted">Aucun élément détecté automatiquement.</p>';
  return `<ul>${values.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function setDossierIntel(analysis) {
  lastDossierAnalysis = analysis || null;
  const node = el('dossierIntel');
  if (!node) return;
  if (!analysis || !analysis.documentCount) {
    node.hidden = true;
    node.innerHTML = '';
    return;
  }
  const quality = analysis.quality || {};
  node.hidden = false;
  node.innerHTML = `
    <h3>Analyse automatique du dossier</h3>
    <div class="dossier-intel-grid">
      <div class="dossier-intel-card"><span class="muted">Score qualité</span><strong>${escapeHtml(String(quality.score ?? '—'))}/100</strong><span>${escapeHtml(quality.label || '')}</span></div>
      <div class="dossier-intel-card"><span class="muted">Documents analysés</span><strong>${escapeHtml(String(analysis.readableCount || 0))}/${escapeHtml(String(analysis.documentCount || 0))}</strong><span>pièces exploitables</span></div>
      <div class="dossier-intel-card"><span class="muted">OCR PDF scan</span><strong>${escapeHtml(String(analysis.ocrUsedCount || 0))}</strong><span>document(s) OCR</span></div>
      <div class="dossier-intel-card"><span class="muted">Volume lu</span><strong>${escapeHtml(String(Math.round((analysis.totalTextLength || 0) / 100) / 10))}k</strong><span>caractères utiles</span></div>
    </div>
    <div class="dossier-intel-block"><strong>Résumé automatique multi-documents</strong><p>${escapeHtml(analysis.multiDocumentSummary || 'Aucun résumé disponible.')}</p></div>
    <div class="dossier-intel-grid">
      <div class="dossier-intel-block dossier-intel-card"><strong>Dates détectées</strong>${renderList(analysis.dates)}</div>
      <div class="dossier-intel-block dossier-intel-card"><strong>Montants détectés</strong>${renderList(analysis.amounts)}</div>
      <div class="dossier-intel-block dossier-intel-card"><strong>Acteurs détectés</strong>${renderList(analysis.actors)}</div>
    </div>
    <div class="dossier-intel-grid">
      <div class="dossier-intel-block dossier-intel-card"><strong>Points forts</strong>${renderList(quality.strengths)}</div>
      <div class="dossier-intel-block dossier-intel-card"><strong>Points à compléter</strong>${renderList(quality.gaps)}</div>
    </div>`;
}

function setGenerationLoading(loading) {
  generationInFlight = Boolean(loading);
  const indicator = el('generationIndicator');
  const button = el('btnGenerate');
  if (indicator) {
    indicator.hidden = !loading;
    indicator.style.display = loading ? 'flex' : 'none';
  }
  if (button) {
    button.disabled = loading;
    button.classList.toggle('is-loading', loading);
    button.textContent = loading ? 'Génération en cours…' : (isPrivateSpace() ? 'Générer un draft privé sécurisé' : 'Produire un livrable sécurisé');
  }
}

function getSelectedVaultIds() {
  return Array.from(document.querySelectorAll('[data-vault-select]:checked')).map((n) => n.value);
}

function buildPayload() {
  return {
    mode: 'generate',
    usecase: el('usecase').value,
    context: el('context').value.trim(),
    objective: el('objective').value.trim(),
    facts: el('facts').value.trim(),
    locale: 'fr-FR',
    accountSpace: currentSpace,
    uploaded_file_ids: getSelectedVaultIds()
  };
}

function currentUsecaseLabel() {
  return el('usecase').selectedOptions?.[0]?.textContent?.trim() || 'Génération IA';
}

function inferArchiveTitle() {
  persistFormState();
  const payload = buildPayload();
  const line = payload.objective || payload.context || currentUsecaseLabel();
  const clean = String(line).replace(/\s+/g, ' ').trim();
  const part = clean.length > 64 ? `${clean.slice(0, 64).trimEnd()}…` : clean;
  return `${currentUsecaseLabel()} — ${part || 'sans titre'}`;
}

function buildArchiveRecord() {
  const result = getCurrentResultText().trim();
  if (!result || result.startsWith('Cliquez sur') || result.startsWith('Erreur')) return null;
  const payload = buildPayload();
  return {
    title: inferArchiveTitle(),
    usecaseLabel: currentUsecaseLabel(),
    prompt: { context: payload.context, objective: payload.objective, facts: payload.facts },
    result,
    dossierAnalysis: lastDossierAnalysis || null
  };
}

function rememberLastGeneration(record) {
  try {
    localStorage.setItem(LAST_GENERATION_KEY, JSON.stringify({
      createdAt: new Date().toISOString(),
      usecaseLabel: record.usecaseLabel,
      prompt: record.prompt,
      result: record.result,
      dossierAnalysis: record.dossierAnalysis || null
    }));
  } catch {}
}

function fillFormFromArchive(item) {
  el('context').value = item?.prompt?.context || '';
  el('objective').value = item?.prompt?.objective || '';
  el('facts').value = item?.prompt?.facts || '';
  setOutput(item?.result || '');
  setDossierIntel(item?.dossierAnalysis || null);
  status('Archive chargée');
  persistFormState();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 800);
}

function openPrintableDocument(html) {
  const printableHtml = String(html || '').replace('</body>', `<script>window.addEventListener('load',()=>{setTimeout(()=>{try{window.focus();window.print();}catch(e){}},250);});</script></body>`);
  const blob = new Blob([printableHtml], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  let opened = false;
  try {
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    opened = !!win;
  } catch {}
  if (!opened) {
    try {
      const frame = document.createElement('iframe');
      frame.style.position = 'fixed';
      frame.style.right = '0';
      frame.style.bottom = '0';
      frame.style.width = '1px';
      frame.style.height = '1px';
      frame.style.opacity = '0';
      frame.style.pointerEvents = 'none';
      frame.setAttribute('aria-hidden', 'true');
      frame.src = url;
      frame.onload = () => {
        try {
          frame.contentWindow?.focus();
          frame.contentWindow?.print();
        } catch {}
        setTimeout(() => {
          try { frame.remove(); } catch {}
          try { URL.revokeObjectURL(url); } catch {}
        }, 30000);
      };
      document.body.appendChild(frame);
      return true;
    } catch {
      try { URL.revokeObjectURL(url); } catch {}
      return false;
    }
  }
  setTimeout(() => {
    try { URL.revokeObjectURL(url); } catch {}
  }, 30000);
  return true;
}

function csvEscape(value = '') {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function buildArchiveCsv(items = []) {
  const rows = [['id','title','usecaseLabel','favorite','createdAt','updatedAt','context','objective','facts','result']];
  for (const item of items) {
    rows.push([
      item.id,
      item.title,
      item.usecaseLabel,
      item.favorite ? '1' : '0',
      item.createdAt,
      item.updatedAt,
      item.prompt?.context || '',
      item.prompt?.objective || '',
      item.prompt?.facts || '',
      item.result || ''
    ]);
  }
  return rows.map((row) => row.map(csvEscape).join(',')).join('\n');
}

function parseCsvLine(line = '') {
  const out = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out;
}

function parseArchiveImport(fileName = '', raw = '') {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  const content = String(raw || '').trim();
  if (!content) return [];
  if (ext === 'csv') {
    const lines = content.split(/\r?\n/).filter(Boolean);
    if (lines.length <= 1) return [];
    const header = parseCsvLine(lines[0]);
    const byName = Object.fromEntries(header.map((name, index) => [String(name || '').trim(), index]));
    return lines.slice(1).map((line) => {
      const cols = parseCsvLine(line);
      const value = (key) => cols[byName[key]] || '';
      return {
        id: value('id') || undefined,
        title: value('title') || 'Archive importée',
        usecaseLabel: value('usecaseLabel') || 'Archive importée',
        favorite: value('favorite') === '1',
        createdAt: value('createdAt') || new Date().toISOString(),
        updatedAt: value('updatedAt') || new Date().toISOString(),
        prompt: {
          context: value('context') || '',
          objective: value('objective') || '',
          facts: value('facts') || ''
        },
        result: value('result') || ''
      };
    }).filter((item) => item.result || item.prompt?.context || item.prompt?.objective || item.prompt?.facts);
  }
  return [{
    title: fileName.replace(/\.[^.]+$/, '') || 'Archive importée',
    usecaseLabel: ['doc', 'pdf'].includes(ext) ? 'Document importé' : 'Texte importé',
    prompt: { context: '', objective: '', facts: '' },
    result: content
  }];
}

function buildExportContent(format) {
  const payload = buildPayload();
  const result = getCurrentResultText();
  const stamp = new Date().toLocaleString('fr-FR');
  if (format === 'doc') {
    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Livrable POPE Online</title><style>body{font-family:Arial,sans-serif;margin:40px;color:#07162A}h1,h2{color:#0c5ea8}pre{white-space:pre-wrap;font-family:inherit;line-height:1.5}section{margin:0 0 24px}</style></head><body><h1>Livrable POPE Online</h1><p><strong>Date :</strong> ${stamp}<br><strong>Type :</strong> ${currentUsecaseLabel()}</p><section><h2>Contexte</h2><pre>${escapeHtml(payload.context || '-')}</pre></section><section><h2>Objectif</h2><pre>${escapeHtml(payload.objective || '-')}</pre></section><section><h2>Éléments factuels utiles</h2><pre>${escapeHtml(payload.facts || '-')}</pre></section><section><h2>Génération IA</h2><pre>${escapeHtml(result)}</pre></section></body></html>`;
    return { filename: 'pope-online-livrable.doc', mime: 'application/msword', content: html };
  }
  if (format === 'pdf') {
    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Livrable POPE Online</title><style>body{font-family:Arial,sans-serif;margin:40px;color:#07162A;line-height:1.5}h1,h2{color:#0c5ea8}pre{white-space:pre-wrap;font-family:inherit;line-height:1.5}section{margin:0 0 24px}small{color:#51606f}</style></head><body><h1>Livrable POPE Online</h1><p><strong>Date :</strong> ${stamp}<br><strong>Type :</strong> ${currentUsecaseLabel()}</p><section><h2>Contexte</h2><pre>${escapeHtml(payload.context || '-')}</pre></section><section><h2>Objectif</h2><pre>${escapeHtml(payload.objective || '-')}</pre></section><section><h2>Éléments factuels utiles</h2><pre>${escapeHtml(payload.facts || '-')}</pre></section><section><h2>Génération IA</h2><pre>${escapeHtml(result)}</pre></section><small>Utilisez la fonction d'impression du navigateur puis « Enregistrer au format PDF » pour finaliser le document.</small></body></html>`;
    return { filename: 'pope-online-livrable.pdf', mime: 'text/html;charset=utf-8', content: html, printable: true };
  }
  if (format === 'csv') {
    const csv = [
      ['Section', 'Contenu'],
      ['Date', stamp],
      ['Type', currentUsecaseLabel()],
      ['Contexte', payload.context || '-'],
      ['Objectif', payload.objective || '-'],
      ['Éléments factuels utiles', payload.facts || '-'],
      ['Génération IA', result || '-']
    ].map((row) => row.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    return { filename: 'pope-online-livrable.csv', mime: 'text/csv;charset=utf-8', content: csv };
  }
  return { filename: 'pope-online-livrable.txt', mime: 'text/plain;charset=utf-8', content: `Livrable POPE Online
Date : ${stamp}
Type : ${currentUsecaseLabel()}

Contexte
${payload.context || '-'}

Objectif
${payload.objective || '-'}

Éléments factuels utiles
${payload.facts || '-'}

Génération IA
${result}
` };
}

function setArchiveAvailability(enabled) {
  const label = el('archiveModeLabel');
  if (label) label.textContent = enabled ? 'Disponible' : 'Indisponible';
  ['archiveAutoSave','btnArchiveCurrent','btnExportArchive','btnClearArchive','archiveImportInput','archiveSearch'].forEach((id) => {
    const node = el(id);
    if (node) node.disabled = !enabled;
  });
  if (!enabled) {
    el('archiveSummary').innerHTML = '';
    el('archiveList').innerHTML = '<div class="muted">L\'archivage local est indisponible sur cet appareil.</div>';
  }
}

function initArchive() {
  if (!isArchiveStorageAvailable()) {
    archiveStore = null;
    setArchiveAvailability(false);
    return;
  }
  try {
    archiveStore = createArchiveStore({ userId: getUserKey() });
    setArchiveAvailability(true);
    el('archiveAutoSave').checked = getAutoArchivePreference(getUserKey());
    renderArchive();
  } catch (error) {
    console.error(error);
    archiveStore = null;
    setArchiveAvailability(false);
  }
}

function renderArchiveSummary() {
  const host = el('archiveSummary');
  if (!host || !archiveStore) return;
  const stats = archiveStore.stats();
  const latest = stats.latest ? new Date(stats.latest).toLocaleDateString('fr-FR') : '—';
  host.innerHTML = `
    <div class="archive-summary-pill-v10"><strong>${stats.total}</strong><span>archive${stats.total > 1 ? 's' : ''}</span></div>
    <div class="archive-summary-pill-v10"><strong>${stats.favorites}</strong><span>favori${stats.favorites > 1 ? 's' : ''}</span></div>
    <div class="archive-summary-pill-v10"><strong>${latest}</strong><span>dernière archive</span></div>`;
}

function renderArchive() {
  const host = el('archiveList');
  if (!host) return;
  if (!archiveStore) {
    host.innerHTML = '<div class="muted">L\'archivage local est indisponible.</div>';
    return;
  }
  const term = (el('archiveSearch').value || '').trim().toLowerCase();
  const items = archiveStore.list().filter((item) => !term || [item.title, item.usecaseLabel, item.result, item.prompt?.context, item.prompt?.objective, item.prompt?.facts].join(' ').toLowerCase().includes(term));
  renderArchiveSummary();
  if (!items.length) {
    host.innerHTML = '<div class="archive-empty-v10"><strong>Aucune archive enregistrée.</strong><span>Archivez un résultat utile pour le retrouver rapidement.</span></div>';
    return;
  }
  host.innerHTML = items.map(archivePreviewHtml).join('');
}

function archiveCurrentGeneration(notifyEmpty = true) {
  if (!archiveStore) {
    showToast('Archivage local indisponible', 'err');
    return null;
  }
  const record = buildArchiveRecord();
  if (!record) {
    if (notifyEmpty) showToast('Aucune génération à archiver', 'warn');
    return null;
  }
  const saved = archiveStore.save(record);
  rememberLastGeneration(saved);
  renderArchive();
  showToast('Résultat archivé sur cet appareil', 'ok');
  return saved;
}

function firstPrivateUsecase() {
  return PRIVATE_USECASE_GROUPS[0]?.options?.[0]?.[0] || 'reponse_marche_public';
}

function setFieldPlaceholders(config = {}) {
  el('context').placeholder = config.contextPlaceholder || "Votre activité, votre situation, l'organisme ou l"interlocuteur concerné, les contraintes et l'échéance…';
  el('objective').placeholder = config.objectivePlaceholder || 'Ce que vous voulez obtenir : courrier, trame de réponse, message à adresser, formalité à préparer…';
  el('facts').placeholder = config.factsPlaceholder || 'Dates, chiffres, clauses du marché, références client, éléments URSSAF ou fiscaux, banque, RC, DCE, etc.';
}

function renderUsecaseInsight(space = currentSpace) {
  const host = el('usecaseInsight');
  if (!host) return;
  if (space !== 'private') {
    host.innerHTML = `<div class="usecase-insight-card-v15"><strong>Cadre public</strong><p>Choisissez un format de livrable pour cadrer un besoin de collectivité, préparer un arbitrage ou produire un draft sécurisé avant relecture humaine si nécessaire.</p></div>`;
    el('vaultInlineTitle').textContent = 'Pièces temporaires 48h';
    el('vaultInlineCopy').textContent = 'Ajoutez des pièces utiles à la génération. Les formats TXT, DOC, CSV et PDF sélectionnés depuis le dépôt sécurisé 48h peuvent être analysés pour nourrir la génération.';
    el('safeNote').textContent = "🔒 N'insérez pas de données personnelles ou sensibles. Travaillez sur des éléments anonymisés ou génériques.";
    el('context').placeholder = 'Collectivité, enjeu, contraintes, échéance, destinataires…';
    el('objective').placeholder = 'Décision attendue, arbitrage, message clé, finalité…';
    el('facts').placeholder = 'Dates, chiffres, options, risques, contraintes, éléments de contexte…';
    return;
  }
  const choice = PRIVATE_USECASE_HELP[el('usecase').value] || PRIVATE_USECASE_HELP[firstPrivateUsecase()];
  setFieldPlaceholders(choice);
  el('vaultInlineTitle').textContent = choice.vaultTitle || 'Pièces temporaires 48h';
  el('vaultInlineCopy').textContent = choice.vaultCopy || 'Ajoutez des pièces utiles à la génération privée.';
  el('safeNote').textContent = '🔒 Déposez uniquement des pièces utiles et anonymisées quand nécessaire. Les documents du dépôt sécurisé 48h sont automatiquement purgés après expiration.';
  host.innerHTML = `
    <div class="usecase-insight-card-v15">
      <div class="usecase-insight-topline-v15">Assistant privé calibré</div>
      <h3>${escapeHtml(choice.title)}</h3>
      <p>${escapeHtml(choice.intro)}</p>
      <ul>${choice.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      <div class="usecase-insight-source-v15">${escapeHtml(choice.source)}</div>
    </div>`;
}

function applySpaceConfig(space) {
  const isPrivate = space === 'private';
  currentSpace = isPrivate ? 'private' : 'public';
  document.getElementById('appHomeLink').href = isPrivate ? 'dashboard-private.html' : 'dashboard.html';
  updateCrossLinks(space);
  el('appSubTitle').textContent = isPrivate ? 'Génération IA privée' : 'Mon espace public';
  el('spaceBadge').textContent = isPrivate ? 'Génération IA privée' : 'Génération guidée';
  el('heroTitle').textContent = isPrivate ? 'Produire un livrable privé sécurisé' : 'Produire un livrable sécurisé';
  el('heroCopy').textContent = isPrivate
    ? "Choisissez un assistant privé pensé pour les artisans, indépendants et TPE : trame de réponse à un marché public, rapport de synthèse argumenté, courrier administratif contextualisé ou formalité d'entreprise à préparer à partir de vos pièces 48h."
    : 'Préparez votre demande, lancez la génération et conservez les résultats utiles dans un archivage local simple, lisible et fiable.';
  el('formCopy').textContent = isPrivate
    ? 'Sélectionnez un assistant métier privé, décrivez votre situation et ajoutez vos pièces temporaires si besoin pour produire un draft immédiatement exploitable.'
    : "Cadrez votre besoin, précisez l'objectif attendu et rassemblez les éléments utiles avant la génération.";
  if (el('usecaseLabel')) el('usecaseLabel').textContent = isPrivate ? 'Assistant privé' : 'Type de livrable';
  if (el('contextLabel')) el('contextLabel').textContent = isPrivate ? 'Votre situation' : 'Contexte';
  if (el('objectiveLabel')) el('objectiveLabel').textContent = isPrivate ? 'Ce que vous voulez obtenir' : 'Objectif du livrable';
  if (el('factsLabel')) el('factsLabel').textContent = isPrivate ? 'Pièces, références et éléments utiles' : 'Éléments factuels utiles';
  const generateBtn = el('btnGenerate');
  if (generateBtn && !generationInFlight) generateBtn.textContent = isPrivate ? 'Générer un draft privé sécurisé' : 'Produire un livrable sécurisé';
  const exportBtn = el('btnExport');
  if (exportBtn) exportBtn.textContent = isPrivate ? 'Exporter le draft' : 'Exporter';
  if (isPrivate) {
    el('usecase').innerHTML = PRIVATE_USECASE_GROUPS.map((group) => `
      <optgroup label="${group.label}">
        ${group.options.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
      </optgroup>`).join('');
    el('usecase').value = firstPrivateUsecase();
  } else {
    el('usecase').innerHTML = PUBLIC_USECASES.map(([v, l]) => `<option value="${escapeHtml(v)}">${escapeHtml(l)}</option>`).join('');
    if (el('usecase').options.length) el('usecase').value = el('usecase').options[0].value;
  }
  restoreFormState(currentSpace);
  renderUsecaseInsight(currentSpace);
}

function formatFileSize(size = 0) {
  if (size < 1024) return size + ' o';
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' Ko';
  return (size / 1024 / 1024).toFixed(1) + ' Mo';
}

function renderVaultInline() {
  const host = el('vaultInlineList');
  if (!host) return;
  if (!vaultFiles.length) {
    host.innerHTML = '<div class="muted">Aucune pièce temporaire disponible pour le moment.</div>';
    return;
  }
  host.innerHTML = vaultFiles.map((item) => `
    <label class="vault-inline-item">
      <input type="checkbox" data-vault-select value="${item.id}">
      <div>
        <strong>${escapeHtml(item.name)}</strong>
        <span>${formatFileSize(item.size)} · expire le ${new Date(item.expiresAt).toLocaleString('fr-FR')} · ${item.canFeedAI ? 'analysable dans la génération' : 'transmis comme pièce jointe'}</span>
      </div>
    </label>`).join('');
}

async function refreshVaultInline() {
  try {
    const data = await apiFetch('/vault');
    vaultFiles = data.items || [];
  } catch (e) {
    console.warn(e);
    vaultFiles = [];
  }
  renderVaultInline();
}

async function refreshWallet() {
  initArchive();
  try {
    const me = await apiFetch('/auth/me');
    currentUser = me.user || null;
    setTicketsBadge(me.wallet);
    applySpaceConfig(forcedSpace || currentUser?.accountSpace || 'public');
  } catch (error) {
    console.warn(error);
    applySpaceConfig(forcedSpace || 'public');
  } finally {
    initArchive();
    refreshVaultInline();
  }
}

async function callAI() {
  const payload = buildPayload();
  const raw = `${payload.context}\n${payload.objective}\n${payload.facts}`;
  const sensitiveHints = [/\b(?:num[eé]ro\s+de\s+s[ée]curit[ée]\s+sociale|nss|iban|rib|carte\s+bancaire|carte\s+vitale)\b/i, /\b\d{13}\b/, /\bfr\d{2}[a-z0-9]{11,30}\b/i];
  if (sensitiveHints.some((re) => re.test(raw))) {
    setOutput('⚠️ Des données directement sensibles semblent présentes. Merci de les anonymiser avant génération.');
    showToast('Données sensibles détectées', 'warn');
    return;
  }
  if (generationInFlight) return;
  status('En cours…');
  setDossierIntel(null);
  setGenerationLoading(true);
  try {
    const data = await apiFetch('/ai/generate', { method: 'POST', body: payload });
    const resultText = data.text || '(vide)';
    setOutput(resultText);
    // V37: révéler la zone résultat
    var rEmpty = document.getElementById('resultEmpty');
    var rCard  = document.getElementById('resultCard');
    var rNext  = document.getElementById('nextActions');
    if (rEmpty) rEmpty.style.display = 'none';
    if (rCard)  rCard.removeAttribute('hidden');
    if (rNext)  rNext.removeAttribute('hidden');
    if (typeof window.setWorkflowStep === 'function') window.setWorkflowStep(3);
    setDossierIntel(data.dossierAnalysis || null);
    status('Terminé');
    setTicketsBadge(data.wallet);
    rememberLastGeneration({ usecaseLabel: currentUsecaseLabel(), prompt: { context: payload.context, objective: payload.objective, facts: payload.facts }, result: resultText, dossierAnalysis: data.dossierAnalysis || null });
    persistFormState();
    if (el('archiveAutoSave').checked) archiveCurrentGeneration(false);
  } catch (e) {
    console.error(e);
    status('Erreur');
    if (e.status === 403 && e.data?.error === 'wallet_missing') {
      setOutput("⚠️ Votre compte n'a pas encore d'acc\u00e8s configur\u00e9. Contactez le support \u00e0 contact@pope-online.com.");
      setDossierIntel(null);
      showToast('Accès non configuré', 'warn');
      return;
    }
    if (e.status === 402 && ['no_tickets','trial_expired','public_dossier_limit_reached','private_dossier_limit_reached'].includes(e.data?.error)) {
      setOutput("🚫 Votre période gratuite est terminée ou votre quota gratuit est atteint. Contactez-nous pour définir l'offre adaptée à votre besoin.");
      setDossierIntel(null);
      showToast('Accès temporairement limité', 'warn');
      return;
    }
    if (e.status === 400 && e.data?.error === 'sensitive_data') {
      setOutput('⚠️ Le contenu semble contenir des données sensibles. Merci de les retirer puis réessayez.');
      setDossierIntel(null);
      showToast('Données sensibles détectées', 'warn');
      return;
    }
    setOutput('Erreur : ' + getApiMessage(e));
    setDossierIntel(null);
    showToast('Erreur de génération', 'err');
  } finally {
    setGenerationLoading(false);
  }
}

el('btnGenerate').addEventListener('click', callAI);
el('btnCopy').addEventListener('click', async () => {
  const content = getCurrentResultText();
  if (!content.trim() || content.startsWith('Cliquez sur')) {
    showToast('Aucun résultat à copier', 'warn');
    return;
  }
  try {
    await navigator.clipboard.writeText(content);
    showToast('Résultat copié', 'ok');
  } catch {
    showToast('Copie impossible', 'err');
  }
});

el('btnExport').addEventListener('click', () => {
  const format = el('exportFormat').value || 'txt';
  const resultText = getCurrentResultText().trim();
  if (!resultText || resultText.startsWith('Cliquez sur') || resultText.startsWith('Erreur')) {
    showToast('Aucun résultat à exporter', 'warn');
    return;
  }
  const file = buildExportContent(format);
  if (file.printable) {
    const opened = openPrintableDocument(file.content);
    showToast(opened ? 'Préparation du PDF lancée' : 'Veuillez autoriser l'ouverture ou l'impression du PDF', opened ? 'ok' : 'warn');
    return;
  }
  downloadFile(file.filename, file.content, file.mime);
  showToast(`Export ${format.toUpperCase()} prêt`, 'ok');
});

el('btnArchiveCurrent').addEventListener('click', () => archiveCurrentGeneration(true));
el('archiveAutoSave').addEventListener('change', (event) => {
  if (!archiveStore) {
    event.target.checked = false;
    showToast('Archivage local indisponible', 'err');
    return;
  }
  setAutoArchivePreference(getUserKey(), event.target.checked);
  showToast(event.target.checked ? 'Archivage automatique activé' : 'Archivage automatique désactivé', 'ok');
});

el('archiveSearch').addEventListener('input', renderArchive);
el('btnExportArchive').addEventListener('click', () => {
  if (!archiveStore) return;
  const items = archiveStore.exportAll();
  if (!items.length) { showToast('Aucune archive à exporter', 'warn'); return; }
  downloadFile('pope-online-archives.csv', buildArchiveCsv(items), 'text/csv;charset=utf-8');
  showToast('Archives exportées en CSV', 'ok');
});

el('archiveImportInput').addEventListener('change', async (event) => {
  if (!archiveStore) return;
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const raw = await file.text();
    const parsed = parseArchiveImport(file.name, raw);
    if (!parsed.length) throw new Error('empty_import');
    const count = archiveStore.importMany(parsed);
    renderArchive();
    showToast(`${count} archive(s) importée(s)`, 'ok');
  } catch {
    showToast('Import impossible', 'err');
  } finally {
    event.target.value = '';
  }
});

el('btnClearArchive').addEventListener('click', () => {
  if (!archiveStore) return;
  if (!archiveStore.list().length) { showToast('Archive déjà vide', 'warn'); return; }
  if (!window.confirm('Vider toutes les archives locales enregistrées sur cet appareil ?')) return;
  archiveStore.clear();
  renderArchive();
  showToast('Archives locales vidées', 'ok');
});

el('archiveList').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button || !archiveStore) return;
  const item = archiveStore.get(button.closest('[data-archive-id]')?.dataset?.archiveId);
  if (!item) return;
  const action = button.dataset.action;
  if (action === 'load') {
    fillFormFromArchive(item);
    showToast('Archive rechargée', 'ok');
    return;
  }
  if (action === 'favorite') {
    archiveStore.toggleFavorite(item.id);
    renderArchive();
    return;
  }
  if (action === 'copy') {
    try { await navigator.clipboard.writeText(item.result || ''); showToast('Archive copiée', 'ok'); } catch { showToast('Copie impossible', 'err'); }
    return;
  }
  if (action === 'download') {
    const content = `Archive POPE Online\nTitre : ${item.title}\nType : ${item.usecaseLabel}\nDate : ${new Date(item.updatedAt || item.createdAt).toLocaleString('fr-FR')}\n\nContexte\n${item.prompt?.context || '-'}\n\nObjectif\n${item.prompt?.objective || '-'}\n\nÉléments factuels utiles\n${item.prompt?.facts || '-'}\n\nRésultat\n${item.result || '-'}\n`;
    downloadFile(buildArchiveFilename(item, 'txt'), content, 'text/plain;charset=utf-8');
    showToast('Archive téléchargée', 'ok');
    return;
  }
  if (action === 'delete') {
    archiveStore.remove(item.id);
    renderArchive();
    showToast('Archive supprimée', 'ok');
  }
});

setGenerationLoading(false);
['context','objective','facts','usecase'].forEach((id) => {
  const node = el(id);
  if (!node) return;
  const handler = () => {
    persistFormState();
    if (id === 'usecase') renderUsecaseInsight(currentSpace);
  };
  node.addEventListener(id === 'usecase' ? 'change' : 'input', handler);
  if (id !== 'usecase') node.addEventListener('change', handler);
});

document.querySelectorAll('a[href*="vault.html"]').forEach((link) => {
  link.addEventListener('click', () => persistFormState());
});

window.addEventListener('beforeunload', () => persistFormState());

refreshWallet();

// ============================================================================
// POPE Online V89 — Diagnostic flash : arbre de questions et règles de lecture
// Données pures, sans dépendance : le moteur (diagnostic.js) les parcourt.
// Pour ajouter une situation : compléter SITUATIONS[domaine] ; rien d'autre à toucher.
// ============================================================================

export const PROFILES = [
  { id: 'maire', label: 'Maire' },
  { id: 'adjoint', label: 'Adjoint(e) ou conseiller(ère) délégué(e)' },
  { id: 'conseiller', label: 'Conseiller(ère) municipal(e)' },
  { id: 'elu_autre', label: 'Élu(e) intercommunal(e), départemental(e) ou régional(e)' },
  { id: 'dgs', label: 'DGS ou secrétaire de mairie' },
  { id: 'agent', label: 'Collaborateur ou chef de service' },
];

export const SIZES = [
  { id: 'lt1000', label: 'Moins de 1 000 habitants' },
  { id: '1000_3500', label: '1 000 à 3 500 habitants' },
  { id: '3500_10000', label: '3 500 à 10 000 habitants' },
  { id: '10000_50000', label: '10 000 à 50 000 habitants' },
  { id: 'gt50000', label: 'Plus de 50 000 habitants, intercommunalité ou département' },
];

// `domain` = valeur attendue par l'espace élu (data-domain du tableau de bord)
export const DOMAINS = [
  { id: 'rh', label: 'Personnel et ressources humaines', domain: 'Ressources humaines' },
  { id: 'fin', label: 'Budget et finances', domain: 'Finances et Gestion' },
  { id: 'urba', label: 'Urbanisme, permis, PLU', domain: 'Urbanisme' },
  { id: 'mp', label: 'Marchés publics', domain: 'Marches publics' },
  { id: 'jur', label: 'Délibérations et sécurité juridique', domain: 'Droit et Juridique' },
  { id: 'med', label: 'Tensions et conflits', domain: 'Mediation et Conflits' },
  { id: 'com', label: 'Communication sensible ou de crise', domain: 'Communication' },
  { id: 'orga', label: 'Organisation et pilotage des services', domain: 'Management et Strategie' },
  { id: 'trav', label: 'Travaux et projets d\'équipement', domain: 'Travaux et MOA' },
  { id: 'autre', label: 'Autre sujet', domain: 'Autre domaine' },
];

// w = gravité propre à la situation (0 à 2). q = ce que l'expert examinera. p = pièces utiles.
export const SITUATIONS = {
  rh: [
    { id: 'recrut', label: 'Recruter, renouveler ou mettre fin à un contrat', w: 1, title: 'Situation contractuelle d\'un agent',
      q: ['Le fondement juridique du contrat et sa durée possible', 'Les obligations de publicité et les délais à respecter', 'Les risques de requalification ou de contentieux'],
      p: ['Contrats et avenants en cours', 'Fiche de poste', 'Délibération créant l\'emploi'] },
    { id: 'disc', label: 'Comportement d\'un agent, faute, procédure disciplinaire', w: 2, title: 'Procédure disciplinaire',
      q: ['La qualification des faits et les preuves disponibles', 'La procédure à suivre et les garanties de l\'agent', 'La sanction proportionnée et ses risques d\'annulation'],
      p: ['Rapports, signalements et témoignages', 'Dossier individuel de l\'agent', 'Échanges écrits'] },
    { id: 'sante', label: 'Absences, maladie, inaptitude, reclassement', w: 1, title: 'Absences et santé d\'un agent',
      q: ['La position statutaire de l\'agent', 'Les instances à saisir (conseil médical, médecine du travail)', 'Les obligations de reclassement et leur calendrier'],
      p: ['Arrêts et avis médicaux reçus', 'Historique des absences', 'Correspondances avec l\'agent'] },
    { id: 'orga', label: 'Temps de travail, organisation, rémunération', w: 0, title: 'Organisation du travail et rémunération',
      q: ['Le cadre réglementaire applicable', 'Les délibérations à prendre ou à modifier', 'Les consultations obligatoires des instances'],
      p: ['Délibérations en vigueur', 'Règlement intérieur, tableau des effectifs'] },
    { id: 'harc', label: 'Signalement de harcèlement ou de souffrance au travail', w: 2, title: 'Signalement de harcèlement',
      q: ['Les mesures de protection immédiates', 'L\'enquête administrative et sa conduite', 'La protection fonctionnelle et les responsabilités en jeu'],
      p: ['Signalement reçu', 'Échanges et témoignages', 'Mesures déjà prises'] },
  ],
  fin: [
    { id: 'budget', label: 'Préparer ou présenter le budget, le débat d\'orientation', w: 0, title: 'Préparation et présentation budgétaire',
      q: ['Les équilibres et les points de fragilité du budget', 'Les questions probables en séance', 'Le calendrier et les obligations de présentation'],
      p: ['Projet de budget ou rapport d\'orientation', 'Compte administratif ou compte financier unique', 'Plan pluriannuel d\'investissement'] },
    { id: 'equilibre', label: 'Difficultés de trésorerie ou d\'équilibre', w: 2, title: 'Équilibre budgétaire et trésorerie',
      q: ['Le diagnostic de la situation financière', 'Les leviers à court terme', 'Le risque de saisine de la chambre régionale des comptes'],
      p: ['Situation de trésorerie', 'Derniers comptes et budget', 'Échanges avec le comptable public ou la préfecture'] },
    { id: 'dette', label: 'Emprunt, dette, garantie d\'emprunt', w: 1, title: 'Emprunt et endettement',
      q: ['La soutenabilité de l\'endettement', 'Les conditions des offres reçues', 'Les risques des garanties accordées'],
      p: ['Tableau de la dette', 'Offres de financement', 'Délibérations antérieures'] },
    { id: 'subv', label: 'Subventions, fonds européens, financements', w: 0, title: 'Mobilisation de financements',
      q: ['Les financements mobilisables', 'Le montage et le calendrier des dossiers', 'Les justificatifs exigés'],
      p: ['Description du projet', 'Plan de financement', 'Notifications ou refus reçus'] },
    { id: 'ctrl', label: 'Observations de la chambre des comptes ou de la préfecture', w: 2, title: 'Réponse à un contrôle financier',
      q: ['La portée des observations', 'La réponse à apporter et ses délais', 'Les mesures correctrices à engager'],
      p: ['Rapport ou lettre d\'observations', 'Pièces budgétaires concernées'] },
  ],
  urba: [
    { id: 'permis', label: 'Un permis de construire à instruire ou contesté', w: 1, title: 'Instruction d\'un permis de construire',
      q: ['La conformité du projet aux règles applicables', 'Les délais d\'instruction et le risque de permis tacite', 'Les options : accord, prescriptions, refus, sursis à statuer'],
      p: ['Dossier de demande et récépissé', 'Règlement de la zone', 'Avis des services consultés'] },
    { id: 'recours', label: 'Un recours contre une autorisation d\'urbanisme', w: 2, title: 'Recours contre une autorisation d\'urbanisme',
      q: ['La recevabilité et les délais du recours', 'Les moyens soulevés et leur solidité', 'La défense de la commune ou la régularisation possible'],
      p: ['Requête ou recours gracieux', 'Autorisation contestée', 'Dossier d\'instruction'] },
    { id: 'plu', label: 'Élaborer, réviser ou modifier le PLU', w: 1, title: 'Procédure d\'évolution du PLU',
      q: ['La procédure adaptée et son calendrier', 'Les étapes de concertation', 'Les points de fragilité juridique'],
      p: ['Délibérations de prescription', 'PADD et documents en cours', 'Avis des personnes publiques associées'] },
    { id: 'infra', label: 'Une construction sans autorisation ou non conforme', w: 1, title: 'Infraction aux règles d\'urbanisme',
      q: ['Le constat et sa procédure', 'Les pouvoirs du maire et leurs limites', 'Les suites possibles : régularisation, mise en demeure, procès-verbal'],
      p: ['Photos et constats', 'Autorisations éventuelles', 'Échanges avec le propriétaire'] },
    { id: 'projet', label: 'Un projet d\'aménagement ou de logements', w: 0, title: 'Montage d\'un projet d\'aménagement',
      q: ['La maîtrise foncière et les outils mobilisables', 'Les autorisations et le calendrier', 'Les partenaires et les financements'],
      p: ['Esquisse ou programme', 'Situation foncière', 'Échanges avec les opérateurs'] },
  ],
  mp: [
    { id: 'preparer', label: 'Préparer un marché ou choisir la procédure', w: 0, title: 'Préparation d\'un marché public',
      q: ['La procédure adaptée au montant et au besoin', 'La rédaction des pièces et des critères', 'Les erreurs fréquentes à éviter'],
      p: ['Expression du besoin', 'Estimation financière', 'Projet de pièces de consultation'] },
    { id: 'analyse', label: 'Analyser les offres, attribuer, écarter un candidat', w: 1, title: 'Analyse des offres et attribution',
      q: ['L\'application régulière des critères', 'Le traitement des offres anormalement basses ou irrégulières', 'Le risque de référé précontractuel'],
      p: ['Règlement de la consultation', 'Offres reçues', 'Rapport d\'analyse'] },
    { id: 'execution', label: 'Un litige avec le titulaire : retard, malfaçon, pénalités', w: 2, title: 'Litige en cours d\'exécution d\'un marché',
      q: ['Les droits de la commune selon le contrat', 'Les pénalités, mises en demeure et résiliation possibles', 'La voie amiable avant tout contentieux'],
      p: ['Marché et cahier des clauses', 'Ordres de service et comptes rendus de chantier', 'Courriers échangés'] },
    { id: 'avenant', label: 'Un avenant ou une modification du marché', w: 1, title: 'Modification d\'un marché en cours',
      q: ['La possibilité juridique de modifier le marché', 'Les seuils et conditions à respecter', 'La rédaction de l\'avenant'],
      p: ['Marché initial', 'Projet d\'avenant', 'Justification de la modification'] },
    { id: 'achat', label: 'Un achat sans procédure : faut-il mettre en concurrence ?', w: 0, title: 'Achat public et mise en concurrence',
      q: ['Les seuils applicables', 'Les bonnes pratiques pour un petit achat', 'La traçabilité du choix'],
      p: ['Besoin et montant estimé', 'Devis reçus'] },
  ],
  jur: [
    { id: 'delib', label: 'Sécuriser une délibération avant le conseil', w: 1, title: 'Sécurisation d\'une délibération',
      q: ['La compétence de l\'assemblée et la procédure', 'La rédaction des visas et de la motivation', 'Les risques d\'annulation'],
      p: ['Projet de délibération', 'Note de synthèse', 'Délibérations antérieures liées'] },
    { id: 'legalite', label: 'Une observation du contrôle de légalité', w: 2, title: 'Réponse au contrôle de légalité',
      q: ['La portée de l\'observation', 'Retirer, modifier ou maintenir l\'acte', 'Les délais et le risque de déféré'],
      p: ['Courrier de la préfecture', 'Acte concerné'] },
    { id: 'probite', label: 'Conflit d\'intérêts, déport, probité', w: 2, title: 'Prévention d\'un conflit d\'intérêts',
      q: ['L\'existence d\'un intérêt pouvant influencer la décision', 'Les règles de déport à appliquer', 'La sécurisation de la décision et des élus'],
      p: ['Description des liens en cause', 'Projet de décision concerné'] },
    { id: 'conseil', label: 'Fonctionnement du conseil municipal', w: 0, title: 'Fonctionnement des instances',
      q: ['Les règles de convocation, de quorum et de vote', 'Les droits des élus de l\'opposition', 'Le règlement intérieur'],
      p: ['Règlement intérieur', 'Convocation et ordre du jour'] },
    { id: 'competence', label: 'Savoir si la commune peut agir sur un sujet', w: 1, title: 'Compétence de la commune',
      q: ['La répartition des compétences en jeu', 'Le cadre juridique de l\'intervention', 'Les solutions alternatives'],
      p: ['Description du projet ou de la demande', 'Statuts de l\'intercommunalité'] },
  ],
  med: [
    { id: 'elus', label: 'Tensions au sein de l\'équipe municipale', w: 1, title: 'Tensions au sein de l\'équipe municipale',
      q: ['Les causes et les acteurs de la tension', 'Les marges de dialogue', 'Les conséquences possibles sur les délégations'],
      p: ['Chronologie des faits', 'Arrêtés de délégation'] },
    { id: 'elus_agents', label: 'Conflit entre élus et agents', w: 2, title: 'Conflit entre élus et services',
      q: ['La clarification des rôles', 'Les risques pour l\'employeur', 'Une démarche de médiation adaptée'],
      p: ['Chronologie', 'Échanges écrits'] },
    { id: 'administres', label: 'Conflit avec des administrés ou des riverains', w: 1, title: 'Conflit avec des administrés',
      q: ['Le fond du désaccord et le droit applicable', 'La posture et les messages de la commune', 'Les voies de règlement amiable'],
      p: ['Courriers et pétitions', 'Décisions en cause'] },
    { id: 'partenaire', label: 'Désaccord avec un partenaire (intercommunalité, association, entreprise)', w: 1, title: 'Désaccord avec un partenaire',
      q: ['Les engagements de chacun', 'Les leviers de négociation', 'Les issues possibles'],
      p: ['Conventions et contrats', 'Échanges récents'] },
  ],
  com: [
    { id: 'crise', label: 'Une crise est en cours', w: 2, title: 'Gestion d\'une crise en cours',
      q: ['Les premiers messages et leur canal', 'Ce qu\'il faut dire, et ne pas dire', 'L\'organisation de la parole publique'],
      p: ['Faits établis à ce stade', 'Publications ou articles parus'] },
    { id: 'risque', label: 'Une décision sensible à annoncer', w: 1, title: 'Annonce d\'une décision sensible',
      q: ['Le calendrier et les publics à informer', 'Les éléments de langage', 'Les réactions à anticiper'],
      p: ['Décision ou projet concerné', 'Contexte local'] },
    { id: 'reseaux', label: 'Attaques ou rumeurs sur les réseaux sociaux', w: 1, title: 'Attaques sur les réseaux sociaux',
      q: ['L\'opportunité de répondre', 'Les recours en cas de propos illicites', 'La modération des comptes de la commune'],
      p: ['Captures des publications', 'Historique'] },
  ],
  orga: [
    { id: 'reorg', label: 'Réorganiser les services', w: 1, title: 'Réorganisation des services',
      q: ['Le diagnostic de l\'organisation actuelle', 'Le scénario cible et sa conduite', 'Les consultations obligatoires'],
      p: ['Organigramme', 'Tableau des effectifs', 'Fiches de poste'] },
    { id: 'pilotage', label: 'Piloter les projets et suivre l\'action municipale', w: 0, title: 'Pilotage de l\'action municipale',
      q: ['Les priorités du mandat', 'Les outils de suivi adaptés', 'L\'organisation des arbitrages'],
      p: ['Programme ou projet de mandat', 'Liste des projets en cours'] },
    { id: 'dysf', label: 'Un service qui ne fonctionne plus correctement', w: 2, title: 'Dysfonctionnement d\'un service',
      q: ['Les causes du dysfonctionnement', 'Les mesures immédiates', 'Le plan de redressement'],
      p: ['Indicateurs disponibles', 'Signalements reçus'] },
  ],
  trav: [
    { id: 'programmer', label: 'Programmer une opération', w: 0, title: 'Programmation d\'une opération',
      q: ['Le besoin et le programme', 'Le mode de réalisation et de dévolution', 'Le plan de financement'],
      p: ['Note de besoin', 'Études existantes', 'Estimation'] },
    { id: 'derive', label: 'Retard ou dérive des coûts d\'un chantier', w: 2, title: 'Dérive d\'un chantier',
      q: ['Les causes et les responsabilités', 'Les leviers contractuels', 'La reprise du calendrier et du budget'],
      p: ['Marchés de travaux', 'Comptes rendus de chantier', 'Avenants'] },
    { id: 'reception', label: 'Réception des travaux, réserves, garanties', w: 1, title: 'Réception et garanties',
      q: ['Les conditions de la réception', 'Le suivi des réserves', 'La mise en jeu des garanties'],
      p: ['Procès-verbaux', 'Liste des réserves'] },
  ],
  autre: [
    { id: 'libre', label: 'Mon sujet ne figure pas dans la liste', w: 1, title: 'Demande d\'expertise',
      q: ['La qualification juridique et pratique de la situation', 'Les options possibles', 'Les risques à maîtriser'],
      p: ['Tout document utile à la compréhension'] },
  ],
};

export const TENSION = [
  { id: 'ouvert', label: 'Non, tout est encore ouvert', w: 0 },
  { id: 'tensions', label: 'Des tensions ou des réclamations apparaissent', w: 1 },
  { id: 'recours', label: 'Un recours, une plainte ou une mise en demeure est engagé', w: 3 },
  { id: 'public', label: 'La situation est exposée publiquement (presse, réseaux)', w: 3 },
];

export const DEADLINES = [
  { id: '48h', label: 'Dans moins de 48 heures', w: 3 },
  { id: 'semaine', label: 'Cette semaine', w: 2 },
  { id: 'mois', label: 'Dans le mois', w: 1 },
  { id: 'aucune', label: 'Pas d\'échéance précise', w: 0 },
];

export const STAKES = [
  { id: 'juridique', label: 'Juridique : risque d\'annulation ou de recours' },
  { id: 'financier', label: 'Financier' },
  { id: 'humain', label: 'Humain et social' },
  { id: 'politique', label: 'Politique ou médiatique' },
  { id: 'organisation', label: 'Fonctionnement des services' },
];

export const SCOPES = [
  { id: 'question', label: 'Une réponse claire à une question précise', objective: 'Obtenir une réponse argumentée et les points de vigilance.' },
  { id: 'document', label: 'Un avis sur un document ou une décision déjà préparée', objective: 'Faire relire et sécuriser un document ou une décision avant de la prendre.' },
  { id: 'accompagnement', label: 'Un accompagnement sur plusieurs semaines', objective: 'Être accompagné dans la durée : projet, réorganisation ou situation complexe.' },
];

// V89.1 — « Ma situation est différente » : aucune liste ne peut être exhaustive.
// L'élu décrit sa situation en une phrase ; l'analyse s'appuie alors sur les points
// et pièces communs au domaine, et l'expert lit sa description.
export const OTHER_SITUATION = { id: 'autre', label: 'Ma situation est différente', w: 1 };
export const GENERIC = {
  rh: { title: 'Question de ressources humaines', q: ['Le statut et la situation exacte de l\'agent concerné', 'Les règles et la procédure applicables', 'Les risques pour l\'employeur et les précautions à prendre'], p: ['Dossier ou situation administrative de l\'agent', 'Délibérations et actes en vigueur', 'Échanges écrits sur le sujet'] },
  fin: { title: 'Question budgétaire et financière', q: ['Les règles budgétaires et comptables applicables', 'L\'impact sur les équilibres de la collectivité', 'Les options et leurs conséquences'], p: ['Budget et derniers comptes', 'Délibérations concernées', 'Échanges avec le comptable public'] },
  urba: { title: 'Question d\'urbanisme', q: ['Les règles d\'urbanisme applicables au terrain ou au projet', 'Les pouvoirs du maire et la procédure', 'Les risques de recours'], p: ['Document d\'urbanisme applicable', 'Dossier ou demande concerné', 'Courriers échangés'] },
  mp: { title: 'Question de commande publique', q: ['Les règles de la commande publique applicables', 'Les marges de manœuvre de l\'acheteur', 'Les risques de contentieux'], p: ['Pièces du marché ou de la consultation', 'Échanges avec les entreprises'] },
  jur: { title: 'Question de droit public', q: ['Le cadre juridique applicable', 'La compétence et la procédure', 'Les risques d\'annulation et les précautions'], p: ['Acte ou projet d\'acte concerné', 'Délibérations antérieures', 'Courriers reçus'] },
  med: { title: 'Situation de tension', q: ['Les acteurs et les causes de la tension', 'Le cadre à rappeler à chacun', 'Les voies de sortie amiables'], p: ['Chronologie des faits', 'Échanges écrits'] },
  com: { title: 'Question de communication sensible', q: ['Les publics concernés et le bon calendrier', 'Les messages à porter et ceux à éviter', 'Les risques de réaction'], p: ['Faits établis', 'Publications ou articles parus'] },
  orga: { title: 'Question d\'organisation des services', q: ['Le diagnostic de la situation', 'Les solutions possibles et leur conduite', 'Les consultations nécessaires'], p: ['Organigramme', 'Éléments de contexte disponibles'] },
  trav: { title: 'Question de travaux et d\'équipement', q: ['Le cadre contractuel et réglementaire', 'Les responsabilités de chacun', 'Les options pour avancer'], p: ['Marchés et pièces techniques', 'Comptes rendus et courriers'] },
  autre: { title: 'Demande d\'expertise', q: ['La qualification juridique et pratique de la situation', 'Les options possibles', 'Les risques à maîtriser'], p: ['Tout document utile à la compréhension'] },
};

// shortcut: données de démonstration pour construire les écrans ; remplacées par Supabase quand le serveur sera branché.

export interface Bien {
  ref: string;
  titre: string;
  ville: string;
  surface_m2: number;
  prix: number;
  piege?: string; // raison pour laquelle l'agent doit refuser de publier
}

export interface Workflow {
  id: string;
  nom: string;
  occurrences: number;
  source: string;
  destinations: string[];
  etapes: { site: string; texte: string }[];
  donnees: string[];
  regles: string[];
  gain: { manuel_s: number; agent_s: number };
  lignes: Bien[];
}

export const WORKFLOW_DEMO: Workflow = {
  id: 'demo',
  nom: 'Publier un bien sur plusieurs portails',
  occurrences: 2,
  source: 'Google Sheet',
  destinations: ['Portail A', 'Portail B', 'Portail C'],
  etapes: [
    { site: 'Google Sheet', texte: 'Lire la ligne du bien à publier' },
    { site: 'Portail A', texte: 'Ouvrir « Déposer une annonce », remplir les champs, publier' },
    { site: 'Portail B', texte: 'Ouvrir « Nouvelle annonce », choisir la commune, publier' },
    { site: 'Portail C', texte: 'Remplir les deux étapes, joindre la photo, cocher la certification, publier' },
  ],
  donnees: ['Titre', 'Prix', 'Surface', 'Ville', 'Description', 'Photo'],
  regles: [
    'Ne rien publier si la classe énergie manque ou si le prix au m² est incohérent.',
    'Recopier le titre exactement, lettre par lettre.',
    'Joindre la photo du bien, jamais une autre.',
  ],
  gain: { manuel_s: 244, agent_s: 113 },
  lignes: [
    { ref: 'M-0143', titre: 'Maison familiale avec jardin', ville: 'Palaiseau', surface_m2: 120, prix: 615000 },
    { ref: 'M-0144', titre: 'Studio étudiant proche université', ville: 'Orsay', surface_m2: 24, prix: 139000 },
    { ref: 'M-0145', titre: 'T2 avec terrasse en résidence récente', ville: 'Massy', surface_m2: 45, prix: 238000 },
    { ref: 'M-T01', titre: 'T2 rénové proche gare', ville: 'Massy', surface_m2: 48, prix: 235000, piege: 'Classe énergie manquante' },
  ],
};

export function minutes(s: number): string {
  return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')}`;
}

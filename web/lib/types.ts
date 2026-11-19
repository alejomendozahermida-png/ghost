// Formes renvoyées par l'API, partagées avec les écrans (aucun secret ici).

export interface Destination {
  site: string;
  url: string | null;
}

export interface LigneSheet {
  cle: string;
  valeurs: Record<string, string>;
}

export interface WorkflowVue {
  id: string;
  nom: string;
  statut: 'repere' | 'preparation' | 'pret' | 'erreur';
  occurrences: number;
  procedure: { objectif: string; etapes: { site: string; texte: string }[]; champs: { champ: string; colonne: string }[] } | null;
  agent: string | null;
  sheet_url: string | null;
  source: 'lecture' | 'sheet' | 'formulaire' | 'aucune' | null;
  source_nom: string | null;
  destinations: Destination[] | null;
  regles: string[] | null;
  surveillance: boolean;
  planification: { frequence: 'jour' | 'ouvres' | 'semaine' | 'heure'; heure: string; jour?: number } | null;
  prochaine_execution: string | null;
  webhook_jeton: string | null;
  en_cours: string | null; // exécution en cours de ce workflow, pour la rejoindre
  colonnes: string[];
  lignes: LigneSheet[];
  gain: { manuel_s: number | null; agent_s: number | null; executions: number };
}

export function minutes(s: number): string {
  const r = Math.round(s);
  return `${Math.floor(r / 60)} min ${String(r % 60).padStart(2, '0')}`;
}

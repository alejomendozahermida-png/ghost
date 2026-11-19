import 'server-only';
import { db } from '@/lib/supabase';
import { quota } from '@/lib/h';
import { lireSheet, type Ligne } from '@/lib/sheet';
import { nouvellesLignes } from '@/lib/execution';
import type { Workflow } from '@/lib/workflow';

export type Origine = 'manuel' | 'veille' | 'planifie' | 'webhook';
const TOKENS_MINIMUM = 500_000; // en dessous, une ligne complète (action + relecture, relances comprises) risque de s'arrêter faute de crédits
const MAX_LIGNES = 20;

export type Lancement = { id: string } | { erreur: string; statut: number };

// Seul point de départ d'une exécution : à la main, par la veille, par la planification ou par un lien de déclenchement.
// Sans lignes fournies, la source décide : un Sheet donne ses nouvelles lignes, l'agent lit lui-même, ou une exécution sans données.
export async function lancer(w: Workflow, o: { origine: Origine; lignes?: Ligne[]; consigne?: string; cleDemande?: string }): Promise<Lancement> {
  if (!w.agent || w.statut !== 'pret' || !w.user_id) return { erreur: 'Ce workflow n’est pas encore prêt.', statut: 409 };

  let lignes = o.lignes;
  if (!lignes) {
    if (w.source === 'aucune') lignes = [{ cle: 'Exécution', valeurs: {} }];
    else if (w.source === 'lecture') lignes = []; // l'agent, ou Ghost si le Sheet s'ouvre par lien, lira la source au début
    else if (w.source === 'sheet' && w.sheet_url) lignes = (await nouvellesLignes(w.id, (await lireSheet(w.sheet_url)).lignes)).slice(0, MAX_LIGNES);
    else return { erreur: 'Ce workflow attend des valeurs : envoyez-les avec la demande.', statut: 400 };
    if (w.source === 'sheet' && !lignes.length) return { erreur: 'Aucune nouvelle ligne dans le Sheet.', statut: 200 };
  }

  const q = await quota().catch(() => null);
  if (!q || q.remaining < TOKENS_MINIMUM) return { erreur: 'Crédits H insuffisants ou non confirmés.', statut: 402 };

  const { data, error } = await db
    .from('executions')
    .insert({
      workflow_id: w.id,
      user_id: w.user_id,
      origine: o.origine,
      cle_demande: o.cleDemande ?? `${o.origine}-${w.id}-${Date.now()}`,
      lignes,
      verification: { courant: 0, cout: 0, resultats: [], consigne: o.consigne?.trim().slice(0, 300) ?? '' },
    })
    .select('id')
    .single();
  if (error?.code === '23505') return { erreur: 'Ce workflow est déjà en cours d’exécution.', statut: 409 };
  if (error) return { erreur: error.message, statut: 500 };
  return { id: data.id };
}

const MAX_SAISIES = 20;
const MAX_VALEUR = 2000;

// Valeurs envoyées de l'extérieur (formulaire, lien de déclenchement) : seuls les champs de la tâche entrent dans le message de l'agent.
export function lignesSaisies(w: Workflow, saisies: unknown): Ligne[] | string {
  const champs = new Set((w.procedure?.champs ?? []).map((c) => c.colonne));
  if (!Array.isArray(saisies) || !saisies.length || saisies.length > MAX_SAISIES) return 'Saisie invalide.';
  const lignes: Ligne[] = [];
  for (const [i, v] of saisies.entries()) {
    if (!v || typeof v !== 'object') return 'Saisie invalide.';
    const valeurs = Object.fromEntries(Object.entries(v).filter(([c]) => champs.has(c)).map(([c, x]) => [c, String(x ?? '').trim().slice(0, MAX_VALEUR)]));
    if (!Object.values(valeurs).some(Boolean)) return 'Remplissez au moins un champ.';
    lignes.push({ cle: `Saisie ${i + 1}`, valeurs });
  }
  return lignes;
}

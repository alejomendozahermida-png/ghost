import 'server-only';
import { db } from '@/lib/supabase';
import { lireSheet } from '@/lib/sheet';
import { avancer, nouvellesLignes } from '@/lib/execution';
import { lancer } from '@/lib/lancement';
import { prochaine, valide } from '@/lib/planification';
import type { Workflow } from '@/lib/workflow';

const MAX_LIGNES = 20;

// Appelée toutes les 30 s (pg_cron en ligne, scripts/veille.mjs en local) :
// 1. fait avancer chaque exécution en cours, même si personne n'a la page ouverte ;
// 2. lance les tâches planifiées dont l'heure est venue ;
// 3. pour chaque workflow en veille, lance les nouvelles lignes de son Sheet.
export async function veiller(): Promise<{ avancees: number; lancees: string[] }> {
  const { data: enCours } = await db.from('executions').select('id').eq('statut', 'en_cours');
  await Promise.all((enCours ?? []).map((e) => avancer(e.id).catch(() => null)));
  const lancees: string[] = [];

  const { data: dues } = await db.from('workflows').select('*').eq('statut', 'pret').lte('prochaine_execution', new Date().toISOString()).returns<(Workflow & { planification: unknown })[]>();
  for (const w of dues ?? []) {
    // L'heure suivante est fixée avant de lancer : une panne ou un workflow occupé ne relance pas en boucle, on attend le prochain créneau.
    await db.from('workflows').update({ prochaine_execution: valide(w.planification) ? prochaine(w.planification).toISOString() : null }).eq('id', w.id);
    const r = await lancer(w, { origine: 'planifie' }).catch(() => null);
    if (r && 'id' in r) lancees.push(`${w.nom} (planifié)`);
  }

  const { data: veilles } = await db.from('workflows').select('*').eq('surveillance', true).eq('statut', 'pret').returns<Workflow[]>();
  for (const w of veilles ?? []) {
    // shortcut: la veille lit seulement un Sheet ouvert par lien ; une source privée demanderait un agent à chaque passage (coûteux).
    if ((w.source !== 'sheet' && w.source !== 'lecture') || !w.sheet_url) continue;
    const sheet = await lireSheet(w.sheet_url).catch(() => null);
    if (!sheet) continue;
    const nouvelles = (await nouvellesLignes(w.id, sheet.lignes)).slice(0, MAX_LIGNES);
    if (!nouvelles.length) continue;
    const r = await lancer(w, { origine: 'veille', lignes: nouvelles });
    if ('id' in r) lancees.push(w.nom);
    if (!('id' in r) && r.statut === 402) break; // plus de crédits : inutile d'essayer les suivants
  }
  return { avancees: enCours?.length ?? 0, lancees };
}

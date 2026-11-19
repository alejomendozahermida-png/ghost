import 'server-only';
import { db } from '@/lib/supabase';
import { quota } from '@/lib/h';
import { lireSheet } from '@/lib/sheet';
import { avancer, nouvellesLignes } from '@/lib/execution';
import type { Workflow } from '@/lib/workflow';

const TOKENS_MINIMUM = 500_000; // même seuil qu'un lancement à la main
const MAX_LIGNES = 20;

// Appelée régulièrement (toutes les 30 s en local, par pg_cron une fois en ligne) :
// 1. fait avancer chaque exécution en cours, même si personne n'a la page ouverte ;
// 2. pour chaque workflow en veille, lance les nouvelles lignes de son Sheet.
export async function veiller(): Promise<{ avancees: number; lancees: string[] }> {
  const { data: enCours } = await db.from('executions').select('id').eq('statut', 'en_cours');
  await Promise.all((enCours ?? []).map((e) => avancer(e.id).catch(() => null)));

  const { data: ws } = await db.from('workflows').select('*').eq('surveillance', true).eq('statut', 'pret').returns<Workflow[]>();
  const lancees: string[] = [];
  let credits: boolean | null = null;
  for (const w of ws ?? []) {
    // shortcut: la veille lit seulement un Sheet ouvert par lien ; une source privée demanderait un agent à chaque passage (coûteux).
    if ((w.source !== 'sheet' && w.source !== 'lecture') || !w.sheet_url || !w.user_id || !w.agent) continue;
    const sheet = await lireSheet(w.sheet_url).catch(() => null);
    if (!sheet) continue;
    const nouvelles = (await nouvellesLignes(w.id, sheet.lignes)).slice(0, MAX_LIGNES);
    if (!nouvelles.length) continue;
    credits ??= ((await quota().catch(() => null))?.remaining ?? 0) >= TOKENS_MINIMUM;
    if (!credits) break;
    const { error } = await db.from('executions').insert({
      workflow_id: w.id,
      user_id: w.user_id,
      cle_demande: `veille-${w.id}-${Date.now()}`,
      lignes: nouvelles,
      verification: { courant: 0, cout: 0, resultats: [], consigne: '' },
    });
    // 23505 : une exécution est déjà en cours pour cet utilisateur ; on réessaiera au prochain passage.
    if (!error) lancees.push(w.nom);
  }
  return { avancees: enCours?.length ?? 0, lancees };
}

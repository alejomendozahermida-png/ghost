import { db } from '@/lib/supabase';
import { NON_CONNECTE, utilisateur } from '@/lib/session';

export const dynamic = 'force-dynamic';

// Mes workflows : chacun avec son agent, son mode, sa dernière exécution et son taux de réussite.
export async function GET() {
  const moi = await utilisateur();
  if (!moi) return NON_CONNECTE();
  const { data: workflows } = await db
    .from('workflows')
    .select('id, nom, statut, occurrences, surveillance, destinations, planification, webhook_jeton, cree_le')
    .eq('user_id', moi.id)
    .order('cree_le', { ascending: false });
  const { data: toutes } = await db
    .from('executions')
    .select('id, workflow_id, statut, cree_le')
    .eq('user_id', moi.id)
    .order('cree_le', { ascending: false });
  const execs = (toutes ?? []).filter((e) => e.statut !== 'en_cours');
  return Response.json(
    (workflows ?? []).map((w) => {
      const siennes = (execs ?? []).filter((e) => e.workflow_id === w.id);
      const { webhook_jeton, ...reste } = w; // le jeton du lien ne sort pas de la fiche
      return {
        ...reste,
        lien: !!webhook_jeton,
        en_cours: (toutes ?? []).find((e) => e.workflow_id === w.id && e.statut === 'en_cours')?.id ?? null,
        derniere_execution: siennes[0]?.cree_le ?? null,
        executions: siennes.length,
        reussite: siennes.length ? Math.round((siennes.filter((e) => e.statut === 'completed').length / siennes.length) * 100) : null,
      };
    }),
  );
}

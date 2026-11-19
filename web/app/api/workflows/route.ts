import { db } from '@/lib/supabase';
import { NON_CONNECTE, utilisateur } from '@/lib/session';

export const dynamic = 'force-dynamic';

// Mes workflows : chacun avec son agent, son mode, sa dernière exécution et son taux de réussite.
export async function GET() {
  const moi = await utilisateur();
  if (!moi) return NON_CONNECTE();
  const { data: workflows } = await db
    .from('workflows')
    .select('id, nom, statut, occurrences, surveillance, destinations, cree_le')
    .eq('user_id', moi.id)
    .order('cree_le', { ascending: false });
  const { data: execs } = await db
    .from('executions')
    .select('workflow_id, statut, cree_le')
    .eq('user_id', moi.id)
    .neq('statut', 'en_cours')
    .order('cree_le', { ascending: false });
  return Response.json(
    (workflows ?? []).map((w) => {
      const siennes = (execs ?? []).filter((e) => e.workflow_id === w.id);
      return {
        ...w,
        derniere_execution: siennes[0]?.cree_le ?? null,
        executions: siennes.length,
        reussite: siennes.length ? Math.round((siennes.filter((e) => e.statut === 'completed').length / siennes.length) * 100) : null,
      };
    }),
  );
}

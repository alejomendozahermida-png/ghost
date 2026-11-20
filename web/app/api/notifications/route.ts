import { db } from '@/lib/supabase';
import { NON_CONNECTE, utilisateur } from '@/lib/session';

export const dynamic = 'force-dynamic';

const FENETRE_MS = 24 * 3600_000;

interface Resultat { statut: 'publie' | 'signale' | 'echec'; cle: string; raison?: string }

// Exécutions terminées ces dernières 24 h, résumées pour une notification. Le navigateur garde celles qu'il a déjà montrées.
export async function GET() {
  const moi = await utilisateur();
  if (!moi) return NON_CONNECTE();
  const { data } = await db
    .from('executions')
    .select('id, workflow_id, statut, origine, resume, verification, cree_le, duree_s, workflows(nom)')
    .eq('user_id', moi.id)
    .neq('statut', 'en_cours')
    .gte('cree_le', new Date(Date.now() - FENETRE_MS).toISOString())
    .order('cree_le', { ascending: false })
    .limit(20);
  return Response.json(
    (data ?? []).map((e) => {
      const r = ((e.verification as { resultats?: Resultat[] } | null)?.resultats ?? []);
      const n = (s: Resultat['statut']) => r.filter((x) => x.statut === s).length;
      const nom = (e.workflows as unknown as { nom: string } | null)?.nom ?? 'Workflow';
      const parties = [n('publie') && `${n('publie')} faite(s) et relue(s)`, n('signale') && `${n('signale')} refusée(s)`, n('echec') && `${n('echec')} en échec`].filter(Boolean);
      const refus = r.find((x) => x.statut !== 'publie')?.raison;
      return {
        id: e.id,
        nom,
        statut: e.statut,
        origine: e.origine,
        quand: e.cree_le,
        duree_s: e.duree_s,
        lien: `/workflows/${e.workflow_id}/lancer?execution=${e.id}`,
        titre: `${e.statut === 'completed' ? 'Terminé' : 'Terminé avec des erreurs'} : ${nom}`,
        texte: parties.length ? [`${parties.join(', ')}.`, refus].filter(Boolean).join(' ') : e.resume ?? 'Aucune ligne à faire.',
      };
    }),
  );
}

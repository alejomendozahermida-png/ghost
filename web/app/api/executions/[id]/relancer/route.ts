import { db } from '@/lib/supabase';
import { lireWorkflow } from '@/lib/workflow';
import { lancer } from '@/lib/lancement';
import { appartient } from '@/lib/proprietaire';
import { NON_CONNECTE, utilisateur } from '@/lib/session';
import type { Ligne } from '@/lib/sheet';
import type { Progres } from '@/lib/execution';

// Relance seulement ce qui a échoué : les lignes en échec, sur les sites en échec, avec les erreurs d'avant dites à l'agent.
// Les lignes refusées par une règle (« signale ») ne sont pas relancées : le refus est voulu.
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const moi = await utilisateur();
  if (!moi || !(await appartient('executions', id, moi.id))) return NON_CONNECTE();

  const { data: e } = await db.from('executions').select('workflow_id, statut, lignes, verification').eq('id', id).single();
  if (!e || e.statut === 'en_cours') return Response.json({ erreur: 'Cette exécution n’est pas terminée.' }, { status: 409 });
  const w = await lireWorkflow(e.workflow_id);
  if (!w) return Response.json({ erreur: 'Workflow introuvable.' }, { status: 404 });

  const p = (e.verification ?? {}) as Progres;
  const lignes: Ligne[] = (e.lignes as Ligne[]).flatMap((l) => {
    const r = p.resultats?.find((x) => x.cle === l.cle);
    if (r?.statut !== 'echec') return [];
    const sites = Object.entries(r.portails).filter(([, v]) => v !== 'ok').map(([s]) => s);
    return [{ cle: l.cle, valeurs: l.valeurs, sites: sites.length ? sites : undefined, ecarts: r.raison ? r.raison.split(' ; ') : [] }];
  });
  if (!lignes.length) return Response.json({ erreur: 'Aucune ligne en échec à relancer.' }, { status: 400 });

  // Double clic : la même relance est rendue, pas recréée.
  const deja = await db.from('executions').select('id').eq('cle_demande', `relance-${id}`).maybeSingle();
  if (deja.data) return Response.json({ id: deja.data.id });
  const r = await lancer(w, { origine: 'manuel', lignes, cleDemande: `relance-${id}` });
  return 'id' in r ? Response.json(r) : Response.json({ erreur: r.erreur }, { status: r.statut });
}

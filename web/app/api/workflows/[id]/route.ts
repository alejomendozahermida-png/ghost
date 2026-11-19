import { db } from '@/lib/supabase';
import { lireSheet } from '@/lib/sheet';
import { lireWorkflow, preparer, type Destination } from '@/lib/workflow';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const mediane = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : null);

// Temps mesurés, jamais estimés : à la main d'après l'observation, avec Ghost d'après les exécutions réussies.
async function gain(w: { id: string; observation_id: string | null }) {
  const { data: etapes } = await db.from('etapes').select('tache, cree_le').eq('observation_id', w.observation_id ?? '');
  const parTache = new Map<number, number[]>();
  for (const e of etapes ?? []) parTache.set(e.tache, [...(parTache.get(e.tache) ?? []), Date.parse(e.cree_le)]);
  const manuel = [...parTache.values()].filter((t) => t.length > 1).map((t) => (Math.max(...t) - Math.min(...t)) / 1000);
  const { data: execs } = await db.from('executions').select('duree_s, lignes').eq('workflow_id', w.id).eq('statut', 'completed');
  const agent = (execs ?? []).filter((e) => e.duree_s).map((e) => e.duree_s / (e.lignes as unknown[]).length);
  return { manuel_s: mediane(manuel), agent_s: mediane(agent), executions: execs?.length ?? 0 };
}

// La fiche : le workflow, préparé à la première lecture (procédure, Skill, agent H), les lignes du Sheet, le gain mesuré.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let w = await lireWorkflow(id);
  if (!w) return Response.json({ erreur: 'Workflow introuvable.' }, { status: 404 });
  if (w.statut !== 'pret') w = await preparer(id).catch(() => w!);
  const sheet = w.sheet_url ? await lireSheet(w.sheet_url).catch(() => null) : null;
  return Response.json({ ...w, colonnes: sheet?.colonnes ?? [], lignes: sheet?.lignes ?? [], gain: await gain(w) });
}

// Ce que l'utilisateur corrige ou ajoute : la source, les adresses des sites, ses règles métier. L'agent est regénéré.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const corps = (await req.json()) as { sheet_url?: string; destinations?: Destination[]; regles?: string[]; surveillance?: boolean };
  const champs = Object.fromEntries(Object.entries(corps).filter(([k]) => ['sheet_url', 'destinations', 'regles', 'surveillance'].includes(k)));
  const { error } = await db.from('workflows').update(champs).eq('id', id);
  if (error) return Response.json({ erreur: error.message }, { status: 400 });
  const seuleVeille = 'surveillance' in champs && Object.keys(champs).length === 1;
  const w = seuleVeille ? await lireWorkflow(id) : await preparer(id).catch((e: Error) => ({ erreur: e.message }));
  return Response.json(w);
}

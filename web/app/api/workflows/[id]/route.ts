import { randomBytes } from 'node:crypto';
import { db } from '@/lib/supabase';
import { prochaine, valide, type Planification } from '@/lib/planification';
import { lireSheet } from '@/lib/sheet';
import { lireWorkflow, preparer, type Destination } from '@/lib/workflow';
import { appartient } from '@/lib/proprietaire';
import { NON_CONNECTE, utilisateur } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const mediane = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : null);

// Temps mesurés, jamais estimés : à la main d'après l'observation, avec Ghost d'après les exécutions réussies.
async function gain(w: { id: string; observation_id: string | null }) {
  const [{ data: etapes }, { data: execs }] = await Promise.all([
    db.from('etapes').select('tache, cree_le').eq('observation_id', w.observation_id ?? ''),
    db.from('executions').select('duree_s, lignes').eq('workflow_id', w.id).eq('statut', 'completed'),
  ]);
  const parTache = new Map<number, number[]>();
  for (const e of etapes ?? []) parTache.set(e.tache, [...(parTache.get(e.tache) ?? []), Date.parse(e.cree_le)]);
  const manuel = [...parTache.values()].filter((t) => t.length > 1).map((t) => (Math.max(...t) - Math.min(...t)) / 1000);
  const agent = (execs ?? []).filter((e) => e.duree_s).map((e) => e.duree_s / (e.lignes as unknown[]).length);
  return { manuel_s: mediane(manuel), agent_s: mediane(agent), executions: execs?.length ?? 0 };
}

// La fiche : le workflow, préparé à la première lecture (procédure, Skill, agent H), les lignes du Sheet, le gain mesuré.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const moi = await utilisateur();
  if (!moi) return NON_CONNECTE();
  let w = await lireWorkflow(id);
  if (!w || w.user_id !== moi.id) return Response.json({ erreur: 'Workflow introuvable.' }, { status: 404 });
  if (w.statut !== 'pret') w = await preparer(id).catch(() => w!);
  const [sheet, g] = await Promise.all([w.source === 'sheet' && w.sheet_url ? lireSheet(w.sheet_url).catch(() => null) : null, gain(w)]);
  const { data: enCours } = await db.from('executions').select('id').eq('workflow_id', id).eq('statut', 'en_cours').maybeSingle();
  return Response.json({ ...w, colonnes: sheet?.colonnes ?? [], lignes: sheet?.lignes ?? [], gain: g, en_cours: enCours?.id ?? null });
}

// Ce que l'utilisateur corrige ou ajoute : la source, les adresses des sites, ses règles métier. L'agent est regénéré.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const moi = await utilisateur();
  if (!moi || !(await appartient('workflows', id, moi.id))) return NON_CONNECTE();
  const corps = (await req.json()) as { sheet_url?: string; source?: string; destinations?: Destination[]; regles?: string[]; surveillance?: boolean; planification?: unknown; webhook?: string };

  // Déclencheurs (heure planifiée, lien) : ils ne changent pas l'agent, rien à regénérer.
  if ('planification' in corps || 'webhook' in corps) {
    const actuel = (await lireWorkflow(id))!;
    const maj: Record<string, unknown> = {};
    if ('planification' in corps) {
      if (corps.planification !== null && !valide(corps.planification)) return Response.json({ erreur: 'Planification invalide.' }, { status: 400 });
      if (corps.planification && actuel.source === 'formulaire') return Response.json({ erreur: 'Cette tâche attend des valeurs à chaque fois : déclenchez-la plutôt par un lien.' }, { status: 400 });
      maj.planification = corps.planification;
      maj.prochaine_execution = corps.planification ? prochaine(corps.planification as Planification).toISOString() : null;
    }
    if (corps.webhook === 'creer') maj.webhook_jeton = randomBytes(24).toString('base64url'); // 32 caractères, impossible à deviner
    if (corps.webhook === 'retirer') maj.webhook_jeton = null;
    const { error: e } = await db.from('workflows').update(maj).eq('id', id);
    return e ? Response.json({ erreur: e.message }, { status: 400 }) : Response.json(await lireWorkflow(id));
  }
  if (corps.source !== undefined && !['lecture', 'sheet', 'formulaire', 'aucune'].includes(corps.source)) return Response.json({ erreur: 'Source inconnue.' }, { status: 400 });
  const champs = Object.fromEntries(Object.entries(corps).filter(([k]) => ['sheet_url', 'source', 'destinations', 'regles', 'surveillance'].includes(k)));
  const { error } = await db.from('workflows').update(champs).eq('id', id);
  if (error) return Response.json({ erreur: error.message }, { status: 400 });
  const seuleVeille = 'surveillance' in champs && Object.keys(champs).length === 1;
  const w = seuleVeille ? await lireWorkflow(id) : await preparer(id).catch((e: Error) => ({ erreur: e.message }));
  return Response.json(w);
}

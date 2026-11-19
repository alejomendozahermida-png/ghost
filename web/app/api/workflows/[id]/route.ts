import { db } from '@/lib/supabase';
import { lireSheet } from '@/lib/sheet';
import { lireWorkflow, preparer, type Destination } from '@/lib/workflow';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// La fiche : le workflow, préparé à la première lecture (procédure, Skill, agent H), et les lignes du Sheet.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let w = await lireWorkflow(id);
  if (!w) return Response.json({ erreur: 'Workflow introuvable.' }, { status: 404 });
  if (w.statut !== 'pret') w = await preparer(id).catch(() => w!);
  const sheet = w.sheet_url ? await lireSheet(w.sheet_url).catch(() => null) : null;
  return Response.json({ ...w, lignes: sheet?.lignes ?? [] });
}

// Ce que l'utilisateur corrige ou ajoute : la source, les adresses des sites, ses règles métier. L'agent est regénéré.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const corps = (await req.json()) as { sheet_url?: string; destinations?: Destination[]; regles?: string[]; surveillance?: boolean };
  const champs = Object.fromEntries(Object.entries(corps).filter(([k]) => ['sheet_url', 'destinations', 'regles', 'surveillance'].includes(k)));
  const { error } = await db.from('workflows').update(champs).eq('id', id);
  if (error) return Response.json({ erreur: error.message }, { status: 400 });
  const w = 'surveillance' in champs && Object.keys(champs).length === 1 ? await lireWorkflow(id) : await preparer(id);
  return Response.json(w);
}

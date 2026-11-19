import { db } from '@/lib/supabase';
import { lireSheet, type Ligne } from '@/lib/sheet';
import { lireWorkflow, type Workflow } from '@/lib/workflow';
import { lancer, lignesSaisies } from '@/lib/lancement';
import { NON_CONNECTE, utilisateur } from '@/lib/session';

// Les valeurs attendues sont figées au lancement : la relecture comparera à elles.
async function lignesDe(w: Workflow, cles: unknown, saisies: unknown): Promise<Ligne[] | string | undefined> {
  if (w.source === 'formulaire') return lignesSaisies(w, saisies);
  if (w.source !== 'sheet') return undefined; // la source décide (lecture par l'agent, ou aucune donnée)
  if (!w.sheet_url || !Array.isArray(cles) || !cles.length) return 'Choisissez au moins une ligne.';
  const { lignes } = await lireSheet(w.sheet_url);
  const choisies = lignes.filter((l) => cles.includes(l.cle));
  return choisies.length === cles.length ? choisies : 'Ligne introuvable dans le Sheet.';
}

export async function POST(req: Request) {
  const moi = await utilisateur();
  if (!moi) return NON_CONNECTE();
  const { workflow_id, cles, saisies, consigne, cle_demande } = (await req.json()) as { workflow_id: string; cles?: unknown; saisies?: unknown; consigne?: unknown; cle_demande: string };
  if (!workflow_id || !cle_demande) return Response.json({ erreur: 'Demande invalide.' }, { status: 400 });

  // Même clé = même exécution : un navigateur qui relance après un délai ne crée pas de doublon.
  const deja = await db.from('executions').select('id').eq('cle_demande', cle_demande).eq('user_id', moi.id).maybeSingle();
  if (deja.data) return Response.json({ id: deja.data.id });

  const w = await lireWorkflow(workflow_id);
  if (!w || w.user_id !== moi.id) return Response.json({ erreur: 'Workflow introuvable.' }, { status: 404 });

  const lignes = await lignesDe(w, cles, saisies).catch((e: Error) => e.message);
  if (typeof lignes === 'string') return Response.json({ erreur: lignes }, { status: 400 });
  const r = await lancer(w, { origine: 'manuel', lignes, consigne: typeof consigne === 'string' ? consigne : '', cleDemande: cle_demande });
  return 'id' in r ? Response.json(r) : Response.json({ erreur: r.erreur }, { status: r.statut });
}

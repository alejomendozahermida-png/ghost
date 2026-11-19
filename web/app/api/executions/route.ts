import { db } from '@/lib/supabase';
import { quota } from '@/lib/h';
import { lireSheet } from '@/lib/sheet';
import { lireWorkflow, type Workflow } from '@/lib/workflow';
import type { Ligne } from '@/lib/sheet';
import { NON_CONNECTE, utilisateur } from '@/lib/session';

// En dessous, une ligne complète (action + relecture, relances comprises) risque de s'arrêter faute de crédits.
const TOKENS_MINIMUM = 500_000;
const MAX_SAISIES = 20;
const MAX_VALEUR = 2000;
const MAX_CONSIGNE = 300;

// Les valeurs attendues sont figées au lancement : la relecture comparera à elles.
async function lignesDe(w: Workflow, cles: unknown, saisies: unknown): Promise<Ligne[] | string> {
  if (w.source === 'lecture') return []; // l'agent lira lui-même la source au début de l'exécution
  if (w.source === 'aucune') return [{ cle: 'Exécution', valeurs: {} }];
  if (w.source === 'formulaire') {
    // Seuls les champs de la tâche sont acceptés : rien d'autre n'entre dans le message envoyé à l'agent.
    const champs = new Set((w.procedure?.champs ?? []).map((c) => c.colonne));
    if (!Array.isArray(saisies) || !saisies.length || saisies.length > MAX_SAISIES) return 'Saisie invalide.';
    const lignes: Ligne[] = [];
    for (const [i, v] of saisies.entries()) {
      if (!v || typeof v !== 'object') return 'Saisie invalide.';
      const valeurs = Object.fromEntries(Object.entries(v).filter(([c]) => champs.has(c)).map(([c, x]) => [c, String(x ?? '').trim().slice(0, MAX_VALEUR)]));
      if (!Object.values(valeurs).some(Boolean)) return 'Remplissez au moins un champ.';
      lignes.push({ cle: `Saisie ${i + 1}`, valeurs });
    }
    return lignes;
  }
  if (!w.sheet_url || !Array.isArray(cles) || !cles.length) return 'Choisissez au moins une ligne.';
  const { lignes } = await lireSheet(w.sheet_url);
  const choisies = lignes.filter((l) => cles.includes(l.cle));
  return choisies.length === cles.length ? choisies : 'Ligne introuvable dans le Sheet.';
}

export async function POST(req: Request) {
  const moi = await utilisateur();
  if (!moi) return NON_CONNECTE();
  const { workflow_id, cles, saisies, consigne, cle_demande } = (await req.json()) as { workflow_id: string; cles?: unknown; saisies?: unknown; consigne?: unknown; cle_demande: string };
  if (!workflow_id || !cle_demande) {
    return Response.json({ erreur: 'Demande invalide.' }, { status: 400 });
  }

  // Même clé = même exécution : un navigateur qui relance après un délai ne crée pas de doublon.
  const deja = await db.from('executions').select('id').eq('cle_demande', cle_demande).eq('user_id', moi.id).maybeSingle();
  if (deja.data) return Response.json({ id: deja.data.id });

  const w = await lireWorkflow(workflow_id);
  if (!w || w.user_id !== moi.id) return Response.json({ erreur: 'Workflow introuvable.' }, { status: 404 });
  if (!w.agent || w.statut !== 'pret') return Response.json({ erreur: 'Ce workflow n’est pas encore prêt.' }, { status: 409 });

  const choisies = await lignesDe(w, cles, saisies).catch((e: Error) => e.message);
  if (typeof choisies === 'string') return Response.json({ erreur: choisies }, { status: 400 });

  const q = await quota().catch(() => null);
  if (!q || q.remaining < TOKENS_MINIMUM) {
    return Response.json({ erreur: 'Crédits H insuffisants ou non confirmés.' }, { status: 402 });
  }

  const { data, error } = await db
    .from('executions')
    .insert({
      workflow_id, cle_demande, lignes: choisies, user_id: moi.id,
      verification: { courant: 0, cout: 0, resultats: [], consigne: typeof consigne === 'string' ? consigne.trim().slice(0, MAX_CONSIGNE) : '' },
    })
    .select('id')
    .single();
  if (error?.code === '23505') return Response.json({ erreur: 'Une exécution est déjà en cours.' }, { status: 409 });
  if (error) return Response.json({ erreur: error.message }, { status: 500 });
  return Response.json({ id: data.id });
}

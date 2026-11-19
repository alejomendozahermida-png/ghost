import { db } from '@/lib/supabase';
import { quota } from '@/lib/h';
import { lireSheet } from '@/lib/sheet';
import { lireWorkflow } from '@/lib/workflow';

// En dessous, une ligne complète (action + relecture, relances comprises) risque de s'arrêter faute de crédits.
const TOKENS_MINIMUM = 500_000;

export async function POST(req: Request) {
  const { workflow_id, cles, cle_demande } = (await req.json()) as { workflow_id: string; cles: string[]; cle_demande: string };
  if (!workflow_id || !cle_demande || !Array.isArray(cles) || !cles.length) {
    return Response.json({ erreur: 'Demande invalide.' }, { status: 400 });
  }

  // Même clé = même exécution : un navigateur qui relance après un délai ne crée pas de doublon.
  const deja = await db.from('executions').select('id').eq('cle_demande', cle_demande).maybeSingle();
  if (deja.data) return Response.json({ id: deja.data.id });

  const w = await lireWorkflow(workflow_id);
  if (!w?.agent || !w.sheet_url) return Response.json({ erreur: 'Ce workflow n’est pas encore prêt.' }, { status: 409 });

  // Les valeurs attendues sont figées au lancement : la relecture comparera à elles.
  const { lignes } = await lireSheet(w.sheet_url);
  const choisies = lignes.filter((l) => cles.includes(l.cle));
  if (choisies.length !== cles.length) return Response.json({ erreur: 'Ligne introuvable dans le Sheet.' }, { status: 400 });

  const q = await quota().catch(() => null);
  if (!q || q.remaining < TOKENS_MINIMUM) {
    return Response.json({ erreur: 'Crédits H insuffisants ou non confirmés.' }, { status: 402 });
  }

  const { data, error } = await db
    .from('executions')
    .insert({ workflow_id, cle_demande, lignes: choisies })
    .select('id')
    .single();
  if (error?.code === '23505') return Response.json({ erreur: 'Une exécution est déjà en cours.' }, { status: 409 });
  if (error) return Response.json({ erreur: error.message }, { status: 500 });
  return Response.json({ id: data.id });
}

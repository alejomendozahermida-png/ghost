import { db } from '@/lib/supabase';
import { mandat } from '@/lib/annonce';
import { quota } from '@/lib/h';

// En dessous, une session complète (3 portails, corrections comprises) risque de s'arrêter faute de crédits.
const TOKENS_MINIMUM = 500_000;

export async function POST(req: Request) {
  const { workflow_id, refs, cle_demande } = (await req.json()) as { workflow_id: string; refs: string[]; cle_demande: string };
  if (!workflow_id || !cle_demande || !Array.isArray(refs) || !refs.length || !refs.every((r) => mandat(r))) {
    return Response.json({ erreur: 'Demande invalide.' }, { status: 400 });
  }

  // Même clé = même exécution : un navigateur qui relance après un délai ne crée pas de doublon.
  const deja = await db.from('executions').select('id').eq('cle_demande', cle_demande).maybeSingle();
  if (deja.data) return Response.json({ id: deja.data.id });

  const q = await quota().catch(() => null);
  if (!q || q.remaining < TOKENS_MINIMUM) {
    return Response.json({ erreur: 'Crédits H insuffisants ou non confirmés.' }, { status: 402 });
  }

  const { data, error } = await db
    .from('executions')
    .insert({ workflow_id, cle_demande, lignes: refs })
    .select('id')
    .single();
  if (error?.code === '23505') {
    return Response.json({ erreur: 'Une exécution est déjà en cours.' }, { status: 409 });
  }
  if (error) return Response.json({ erreur: error.message }, { status: 500 });
  return Response.json({ id: data.id });
}

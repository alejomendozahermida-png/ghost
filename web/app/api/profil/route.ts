import { db } from '@/lib/supabase';
import { NON_CONNECTE, utilisateur } from '@/lib/session';

export const dynamic = 'force-dynamic';

// État du premier passage de l'utilisateur.
export async function GET() {
  const moi = await utilisateur();
  if (!moi) return NON_CONNECTE();
  const { data } = await db.from('profils').select('onboarding_fini').eq('user_id', moi.id).maybeSingle();
  return Response.json({ onboarding_fini: data?.onboarding_fini ?? null });
}

// Accueil terminé ou passé : il ne revient plus.
export async function POST() {
  const moi = await utilisateur();
  if (!moi) return NON_CONNECTE();
  const { error } = await db.from('profils').upsert({ user_id: moi.id, onboarding_fini: new Date().toISOString() }, { onConflict: 'user_id' });
  return error ? Response.json({ erreur: error.message }, { status: 500 }) : Response.json({ ok: true });
}

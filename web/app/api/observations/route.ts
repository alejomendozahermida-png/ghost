import { db } from '@/lib/supabase';
import { NON_CONNECTE, utilisateur } from '@/lib/session';

export async function POST() {
  const moi = await utilisateur();
  if (!moi) return NON_CONNECTE();
  const { data, error } = await db.from('observations').insert({ user_id: moi.id }).select('id').single();
  if (error) return Response.json({ erreur: error.message }, { status: 500 });
  return Response.json({ id: data.id });
}

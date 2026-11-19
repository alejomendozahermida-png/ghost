import { db } from '@/lib/supabase';

export async function POST() {
  const { data, error } = await db.from('observations').insert({}).select('id').single();
  if (error) return Response.json({ erreur: error.message }, { status: 500 });
  return Response.json({ id: data.id });
}

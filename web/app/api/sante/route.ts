import { db } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Vérifie que la base et les clés répondent, sans renvoyer aucun secret.
export async function GET() {
  const base = await db.from('workflows').select('id', { count: 'exact', head: true });
  const h = await fetch('https://agp.eu.hcompany.ai/api/v2/quota/tokens', {
    headers: { Authorization: `Bearer ${process.env.HAI_API_KEY}` },
    cache: 'no-store',
  });
  const quota = h.ok ? await h.json() : null;
  return Response.json({
    base: base.error ? `erreur : ${base.error.message}` : 'ok',
    h: quota ? `ok, ${quota.remaining} tokens restants` : `erreur ${h.status}`,
    hugging_face: process.env.HF_TOKEN ? 'clé présente' : 'clé manquante',
  });
}

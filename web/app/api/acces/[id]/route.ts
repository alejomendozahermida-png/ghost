import { retirerAcces } from '@/lib/acces';
import { NON_CONNECTE, utilisateur } from '@/lib/session';

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const moi = await utilisateur();
  if (!moi) return NON_CONNECTE();
  const ok = await retirerAcces(moi.id, (await params).id).catch(() => false);
  return ok ? new Response(null, { status: 204 }) : Response.json({ erreur: 'Accès introuvable.' }, { status: 404 });
}

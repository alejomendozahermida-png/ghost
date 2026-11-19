import { appartient } from '@/lib/proprietaire';
import { NON_CONNECTE, utilisateur } from '@/lib/session';
import { derniereCapture, sessionDe } from '@/lib/direct';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const moi = await utilisateur();
  if (!moi || !(await appartient('executions', id, moi.id))) return NON_CONNECTE();
  const sid = await sessionDe(id);
  return (sid && (await derniereCapture(sid))) || new Response(null, { status: 204 });
}

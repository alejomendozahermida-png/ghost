import { appartient } from '@/lib/proprietaire';
import { NON_CONNECTE, utilisateur } from '@/lib/session';
import { capture, sessionsDe } from '@/lib/direct';

export const dynamic = 'force-dynamic';

// ?s=<session H>&n=<numéro de capture> : une capture précise d'un des agents de cette exécution.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const moi = await utilisateur();
  if (!moi || !(await appartient('executions', id, moi.id))) return NON_CONNECTE();
  const url = new URL(req.url);
  const s = url.searchParams.get('s') ?? '';
  const n = Number(url.searchParams.get('n'));
  if (!Number.isInteger(n) || n < 1 || !(await sessionsDe(id)).has(s)) return new Response(null, { status: 404 });
  return (await capture(s, n)) ?? new Response(null, { status: 204 });
}

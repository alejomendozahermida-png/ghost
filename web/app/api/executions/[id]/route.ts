import { avancer } from '@/lib/execution';
import { appartient } from '@/lib/proprietaire';
import { NON_CONNECTE, utilisateur } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const moi = await utilisateur();
  if (!moi || !(await appartient('executions', id, moi.id))) return NON_CONNECTE();
  const e = await avancer(id);
  if (!e) return Response.json({ erreur: 'Exécution introuvable.' }, { status: 404 });
  const p = e.verification;
  return Response.json({
    statut: e.statut,
    etape: e.etape,
    courant: p?.courant ?? 0,
    resultats: p?.resultats ?? [],
    lien_session_h: p?.lien ?? null,
    relances: p?.relances ?? 0,
    resume: e.resume,
    duree_s: e.duree_s,
    cout_usd: e.cout_usd,
    cree_le: e.cree_le,
  });
}

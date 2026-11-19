import { avancer } from '@/lib/execution';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const e = await avancer((await params).id);
  if (!e) return Response.json({ erreur: 'Exécution introuvable.' }, { status: 404 });
  const p = e.verification;
  return Response.json({
    statut: e.statut,
    etape: e.etape,
    courant: p?.courant ?? 0,
    resultats: p?.resultats ?? [],
    lien_session_h: p?.lien ?? null,
    corrections: e.corrections,
    resume: e.resume,
    duree_s: e.duree_s,
    cout_usd: e.cout_usd,
    cree_le: e.cree_le,
  });
}

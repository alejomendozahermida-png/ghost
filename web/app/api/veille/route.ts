import { timingSafeEqual } from 'node:crypto';
import { veiller } from '@/lib/veille';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Réservée au planificateur : « Authorization: Bearer <GHOST_CRON_SECRET> ».
function autorise(req: Request): boolean {
  const attendu = Buffer.from(`Bearer ${process.env.GHOST_CRON_SECRET ?? ''}`);
  const recu = Buffer.from(req.headers.get('authorization') ?? '');
  return !!process.env.GHOST_CRON_SECRET && recu.length === attendu.length && timingSafeEqual(recu, attendu);
}

export async function POST(req: Request) {
  if (!autorise(req)) return Response.json({ erreur: 'Non autorisé.' }, { status: 401 });
  return Response.json(await veiller());
}

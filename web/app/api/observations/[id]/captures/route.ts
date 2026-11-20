import { detecter, lireCapture } from '@/lib/observation';
import { appartient } from '@/lib/proprietaire';
import { NON_CONNECTE, utilisateur } from '@/lib/session';

export const maxDuration = 60;

const TAILLE_MAX = 3_000_000; // une capture JPEG en 1280 px fait environ 200 Ko

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const moi = await utilisateur();
  if (!moi || !(await appartient('observations', id, moi.id))) return NON_CONNECTE();
  const { image, barre, url } = (await req.json()) as { image?: string; barre?: string | null; url?: string | null };
  const valide = (x: unknown) => typeof x === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(x) && x.length <= TAILLE_MAX;
  // Adresse exacte donnée par l'extension : seulement http(s), longueur raisonnable.
  const adresseOk = url == null || (typeof url === 'string' && url.length <= 2048 && /^https?:\/\//.test(url));
  if (!valide(image) || (barre != null && !valide(barre)) || !adresseOk) {
    return Response.json({ erreur: 'Capture invalide.' }, { status: 400 });
  }
  try {
    const etape = await lireCapture(id, image!, barre, url ?? null);
    const workflow = await detecter(id, !!etape && (etape.fin_de_tache || etape.nouvelle_tache));
    return Response.json({ etape, workflow });
  } catch (e) {
    // Une capture illisible n'arrête pas l'observation.
    return Response.json({ etape: null, workflow: null, erreur: e instanceof Error ? e.message : String(e) });
  }
}

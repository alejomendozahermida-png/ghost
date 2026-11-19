import { detecter, lireCapture } from '@/lib/observation';

export const maxDuration = 60;

const TAILLE_MAX = 3_000_000; // une capture JPEG en 1280 px fait environ 200 Ko

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { image } = (await req.json()) as { image?: string };
  if (typeof image !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(image) || image.length > TAILLE_MAX) {
    return Response.json({ erreur: 'Capture invalide.' }, { status: 400 });
  }
  try {
    const etape = await lireCapture(id, image);
    const workflow = await detecter(id, !!etape?.fin_de_tache);
    return Response.json({ etape, workflow });
  } catch (e) {
    // Une capture illisible n'arrête pas l'observation.
    return Response.json({ etape: null, workflow: null, erreur: e instanceof Error ? e.message : String(e) });
  }
}

import { analyser } from '@/lib/observation';
import { appartient } from '@/lib/proprietaire';
import { NON_CONNECTE, utilisateur } from '@/lib/session';

export const maxDuration = 60;

// « J'ai fini, analyser maintenant » : Qwen décrit la tâche observée et Ghost crée le workflow, sans attendre la détection automatique.
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const moi = await utilisateur();
  if (!moi || !(await appartient('observations', id, moi.id))) return NON_CONNECTE();
  const r = await analyser(id);
  return 'erreur' in r ? Response.json(r, { status: 422 }) : Response.json(r);
}

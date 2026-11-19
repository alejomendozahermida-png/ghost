import { raisonner } from '@/lib/modeles';
import { lireWorkflow } from '@/lib/workflow';
import { NON_CONNECTE, utilisateur } from '@/lib/session';

export const maxDuration = 60;
const MAX_TEXTE = 4000;

// Un texte libre (« appart rue X, 3 pièces, 300 k ») -> les champs du formulaire. L'utilisateur relit avant de lancer.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const moi = await utilisateur();
  if (!moi) return NON_CONNECTE();
  const w = await lireWorkflow(id);
  if (!w || w.user_id !== moi.id) return Response.json({ erreur: 'Workflow introuvable.' }, { status: 404 });
  const { texte } = (await req.json()) as { texte?: unknown };
  if (typeof texte !== 'string' || !texte.trim() || texte.length > MAX_TEXTE) return Response.json({ erreur: 'Texte vide ou trop long.' }, { status: 400 });

  const champs = [...new Set((w.procedure?.champs ?? []).map((c) => c.colonne))];
  const prompt = `Extrais de ce texte la valeur de chaque champ. Recopie les valeurs telles qu'écrites ; un nombre en chiffres seuls (300 k = 300000).
Si une valeur n'est pas dans le texte, mets "". N'invente rien.
Champs : ${champs.join(', ')}
Texte :
"""${texte}"""
Rends UNIQUEMENT ce JSON : {"valeurs": {"<champ>": "<valeur>"}}`;
  const r = await raisonner<{ valeurs: Record<string, unknown> }>(prompt).catch(() => null);
  if (!r) return Response.json({ erreur: 'Ghost n’a pas pu lire ce texte. Remplissez les champs à la main.' }, { status: 502 });
  return Response.json({ valeurs: Object.fromEntries(champs.map((c) => [c, String(r.valeurs?.[c] ?? '')])) });
}

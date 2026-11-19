import { db } from '@/lib/supabase';
import { lancer, lignesSaisies } from '@/lib/lancement';
import type { Workflow } from '@/lib/workflow';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const TAILLE_MAX = 20_000;
const JETON = /^[A-Za-z0-9_-]{32,64}$/;

// Lien de déclenchement : n'importe quel service (Google Sheets via Apps Script, Airtable, Zapier, un formulaire)
// l'appelle en POST quand quelque chose change. Le jeton secret du lien désigne le workflow ; il se révoque depuis la fiche.
// Corps facultatif (JSON) : {"valeurs": {...}} ou {"lignes": [{...}]} pour une tâche à formulaire, {"consigne": "..."} pour choisir les lignes.
export async function POST(req: Request, { params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  if (!JETON.test(jeton)) return Response.json({ erreur: 'Lien inconnu.' }, { status: 404 });
  const { data: w } = await db.from('workflows').select('*').eq('webhook_jeton', jeton).maybeSingle<Workflow>();
  if (!w) return Response.json({ erreur: 'Lien inconnu.' }, { status: 404 });

  const texte = await req.text();
  if (texte.length > TAILLE_MAX) return Response.json({ erreur: 'Demande trop volumineuse.' }, { status: 413 });
  let corps: { valeurs?: unknown; lignes?: unknown; consigne?: unknown } = {};
  try {
    corps = texte.trim() ? JSON.parse(texte) : {};
  } catch {
    return Response.json({ erreur: 'Le corps doit être du JSON.' }, { status: 400 });
  }

  let lignes;
  if (w.source === 'formulaire') {
    lignes = lignesSaisies(w, corps.lignes ?? (corps.valeurs ? [corps.valeurs] : undefined));
    if (typeof lignes === 'string') return Response.json({ erreur: lignes }, { status: 400 });
  }
  const r = await lancer(w, { origine: 'webhook', lignes, consigne: typeof corps.consigne === 'string' ? corps.consigne : '' });
  return 'id' in r ? Response.json({ execution: r.id }, { status: 202 }) : Response.json({ erreur: r.erreur }, { status: r.statut });
}

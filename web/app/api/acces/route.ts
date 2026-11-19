import { db } from '@/lib/supabase';
import { ajouterAcces } from '@/lib/acces';
import { NON_CONNECTE, utilisateur } from '@/lib/session';

export async function GET() {
  const moi = await utilisateur();
  if (!moi) return NON_CONNECTE();
  const { data } = await db.from('acces').select('id, plateforme, url, cree_le').eq('user_id', moi.id).order('cree_le');
  return Response.json(data ?? []);
}

// Le mot de passe traverse ce serveur une seule fois, vers le coffre-fort H : il n'est ni enregistré ni écrit dans les journaux.
export async function POST(req: Request) {
  const moi = await utilisateur();
  if (!moi) return NON_CONNECTE();
  const a = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const texte = (k: string) => (typeof a[k] === 'string' ? (a[k] as string).trim() : '');
  const url = texte('url');
  if (!texte('plateforme') || !texte('identifiant') || !texte('motDePasse') || !/^https?:\/\/[^\s]+$/.test(url)) {
    return Response.json({ erreur: 'Renseignez la plateforme, son adresse (https://…), l’identifiant et le mot de passe.' }, { status: 400 });
  }
  try {
    return Response.json(
      await ajouterAcces(moi.id, { plateforme: texte('plateforme'), url, identifiant: texte('identifiant'), motDePasse: a.motDePasse as string, totp: texte('totp') }),
    );
  } catch {
    return Response.json({ erreur: 'Le coffre-fort n’a pas accepté cet accès. Réessayez.' }, { status: 502 });
  }
}

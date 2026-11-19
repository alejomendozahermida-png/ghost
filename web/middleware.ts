import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Rafraîchit la session à chaque requête et renvoie vers la connexion les pages réservées aux comptes.
const PUBLIQUES = ['/', '/connexion'];

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (liste) => {
        liste.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        liste.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await sb.auth.getUser();
  const chemin = req.nextUrl.pathname;
  if (!data.user && !PUBLIQUES.includes(chemin) && !chemin.startsWith('/api/')) {
    const url = req.nextUrl.clone();
    url.pathname = '/connexion';
    url.searchParams.set('suite', chemin);
    return NextResponse.redirect(url);
  }
  return res;
}

// Fichiers publics (icônes, manifeste, photos) : jamais derrière la connexion.
export const config = { matcher: ['/((?!_next/static|_next/image|icon.svg|apple-icon|manifest.webmanifest|icones/|photos/).*)'] };

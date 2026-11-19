import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

// L'utilisateur connecté, lu dans le cookie de session Supabase (vérifié auprès de Supabase, pas seulement décodé).
export async function utilisateur(): Promise<{ id: string; email: string } | null> {
  const jar = await cookies();
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (liste) => {
        try {
          liste.forEach(({ name, value, options }) => jar.set(name, value, options));
        } catch {
          // Appelé depuis une page : le middleware rafraîchit déjà le cookie.
        }
      },
    },
  });
  const { data } = await sb.auth.getUser();
  return data.user ? { id: data.user.id, email: data.user.email ?? '' } : null;
}

export const NON_CONNECTE = () => Response.json({ erreur: 'Connectez-vous.' }, { status: 401 });

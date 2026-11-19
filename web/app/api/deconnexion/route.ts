import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function POST(req: Request) {
  const jar = await cookies();
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => jar.getAll(), setAll: (l) => l.forEach(({ name, value, options }) => jar.set(name, value, options)) },
  });
  await sb.auth.signOut();
  return Response.redirect(new URL('/', req.url), 303);
}

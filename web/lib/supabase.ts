import 'server-only';
import { createClient } from '@supabase/supabase-js';

// Clé secrète : routes serveur uniquement, jamais envoyée au navigateur.
export const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

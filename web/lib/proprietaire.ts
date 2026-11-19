import 'server-only';
import { db } from '@/lib/supabase';

// Toutes les tables sont lues avec la clé serveur : c'est ici qu'on vérifie que la ligne est bien à l'utilisateur.
export async function appartient(table: 'observations' | 'workflows' | 'executions', id: string, userId: string): Promise<boolean> {
  const { data } = await db.from(table).select('user_id').eq('id', id).maybeSingle();
  return data?.user_id === userId;
}

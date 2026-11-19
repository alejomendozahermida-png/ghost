import 'server-only';
import { db } from '@/lib/supabase';
import { ajouterSecret, creerCoffre, retirerSecret } from '@/lib/h';

// Mes accès : chaque utilisateur a son coffre-fort H. Ghost ne garde que la référence de chaque élément, jamais un secret.

export async function coffreDe(userId: string): Promise<string> {
  const { data } = await db.from('profils').select('vault_id').eq('user_id', userId).maybeSingle();
  if (data?.vault_id) return data.vault_id;
  const { id } = await creerCoffre(`ghost-${userId.slice(0, 8)}`);
  await db.from('profils').upsert({ user_id: userId, vault_id: id });
  return id;
}

export interface NouvelAcces {
  plateforme: string;
  url: string;
  identifiant: string;
  motDePasse: string;
  totp?: string;
}

export async function ajouterAcces(userId: string, a: NouvelAcces) {
  const coffre = await coffreDe(userId);
  const origine = new URL(a.url).origin; // H retrouve le secret par le nom du site
  const valeurs: Record<string, string> = { username: a.identifiant, password: a.motDePasse };
  if (a.identifiant.includes('@')) valeurs.email = a.identifiant;
  if (a.totp?.trim()) valeurs.totp = a.totp.trim();
  const item = await ajouterSecret(coffre, a.plateforme, origine, valeurs);
  const { data, error } = await db
    .from('acces')
    .insert({ user_id: userId, plateforme: a.plateforme, url: origine, vault_item_id: item.id })
    .select('id, plateforme, url, cree_le')
    .single();
  if (error) {
    await retirerSecret(coffre, item.id).catch(() => null); // pas de secret orphelin chez H
    throw new Error(error.message);
  }
  return { ...data, champs: item.fields };
}

export async function retirerAcces(userId: string, id: string): Promise<boolean> {
  const { data } = await db.from('acces').select('vault_item_id').eq('id', id).eq('user_id', userId).maybeSingle();
  if (!data) return false;
  await retirerSecret(await coffreDe(userId), data.vault_item_id);
  await db.from('acces').delete().eq('id', id);
  return true;
}

import 'server-only';
import { db } from '@/lib/supabase';
import type { Progres } from '@/lib/execution';

export interface ErreurFrequente {
  site: string;
  champ: string | null; // null : l'annonce n'a pas été trouvée sur le site
  fois: number;
  regle: string; // règle proposée, à ajouter en un clic
}

const DERNIERES = 20; // exécutions regardées
const SEUIL = 2; // à partir de combien de fois une erreur « revient »

// Les raisons d'échec ont deux formes, écrites par conclure() :
// « Portail A, Titre : la page n'affiche pas « … » » et « Portail A : aucune annonce trouvée ».
const CHAMP = /^(.+?), (.+?) : la page n'affiche pas/;
const ABSENT = /^(.+?) : aucune annonce trouvée/;

export function regroupe(raisons: string[]): ErreurFrequente[] {
  const compte = new Map<string, { site: string; champ: string | null; fois: number }>();
  for (const ecart of raisons.flatMap((r) => r.split(' ; '))) {
    const m = CHAMP.exec(ecart);
    const a = m ? null : ABSENT.exec(ecart);
    if (!m && !a) continue;
    const site = (m ?? a)![1].trim();
    const champ = m ? m[2].trim() : null;
    const cle = `${site}|${champ ?? ''}`;
    const x = compte.get(cle) ?? { site, champ, fois: 0 };
    x.fois += 1;
    compte.set(cle, x);
  }
  return [...compte.values()]
    .filter((x) => x.fois >= SEUIL)
    .sort((a, b) => b.fois - a.fois)
    .map((x) => ({
      ...x,
      regle: x.champ
        ? `Sur ${x.site}, recopie le champ « ${x.champ} » exactement comme dans la source : mêmes mots, majuscules et accents, sans traduire ni corriger.`
        : `Sur ${x.site}, ne termine qu'après avoir vu la page de l'annonce publiée.`,
    }));
}

// Couples « site|champ » mal recopiés au moins SEUIL fois sur les dernières exécutions du workflow :
// sur ce site, ce champ est collé au lieu d'être tapé (« Apartment » revient toujours sur le Portail A, jamais sur le B).
export async function champsARisque(workflowId: string): Promise<Set<string>> {
  const { data } = await db.from('executions').select('verification').eq('workflow_id', workflowId).order('cree_le', { ascending: false }).limit(DERNIERES);
  const raisons = (data ?? []).flatMap((e) => ((e.verification ?? {}) as Progres).resultats ?? []).flatMap((r) => (r.raison ?? '').split(' ; '));
  const compte = new Map<string, number>();
  for (const x of raisons) {
    const m = CHAMP.exec(x);
    if (m) compte.set(`${m[1].trim()}|${m[2].trim()}`, (compte.get(`${m[1].trim()}|${m[2].trim()}`) ?? 0) + 1);
  }
  return new Set([...compte].filter(([, n]) => n >= SEUIL).map(([k]) => k));
}

// Les erreurs qui reviennent sur les dernières exécutions d'un workflow.
export async function erreursFrequentes(workflowId: string): Promise<ErreurFrequente[]> {
  const { data } = await db.from('executions').select('verification').eq('workflow_id', workflowId).order('cree_le', { ascending: false }).limit(DERNIERES);
  const raisons = (data ?? []).flatMap((e) => ((e.verification ?? {}) as Progres).resultats ?? []).filter((r) => r.statut === 'echec' && r.raison).map((r) => r.raison!);
  return regroupe(raisons);
}

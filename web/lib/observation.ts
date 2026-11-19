import 'server-only';
import { db } from '@/lib/supabase';
import { holo, raisonner } from '@/lib/modeles';
import { PORTAILS } from '@/lib/annonce';

export interface Etape {
  id: number;
  tache: number;
  site: string | null;
  ecran: string | null;
  action: string | null;
  champ: string | null;
  valeur: string | null;
  fin_de_tache: boolean;
  url: string | null;
}

interface Lecture extends Omit<Etape, 'id' | 'tache'> {
  ecran_connexion: boolean;
}

const LIRE = `Capture d'écran du poste de travail d'une personne qui travaille. Décris ce qu'elle est en train de faire.
Rends UNIQUEMENT ce JSON :
{"site": "nom du site ou du logiciel visible (ex. Portail A, Google Sheet), lu dans la page ou la barre d'adresse",
 "url": "adresse complète lue dans la barre d'adresse du navigateur, ou null si elle n'est pas visible",
 "ecran": "titre de l'écran ou de la page",
 "action": "navigate|click|type|select|check|read|submit|none",
 "champ": "libellé exact du champ ou du bouton concerné, ou null",
 "valeur": "valeur saisie ou lue, ou null",
 "fin_de_tache": true si un message de confirmation est visible n'importe où sur l'écran (bandeau « publiée », « enregistrée », « envoyé », « référence »), même si le reste de la page montre autre chose ; sinon false,
 "ecran_connexion": true si c'est une page de connexion ou de saisie de mot de passe, sinon false}
N'invente rien : si rien ne change, mets "action": "none".`;

// Lit une capture et garde seulement sa description (jamais l'image). Renvoie null si rien d'utile.
export async function lireCapture(observationId: string, image: string): Promise<Etape | null> {
  const l = await holo<Lecture>(LIRE, image);
  if (l.ecran_connexion) return null;

  const { data: derniere } = await db
    .from('etapes')
    .select('*')
    .eq('observation_id', observationId)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle<Etape>();
  // Un écran qui ne bouge pas : seule son arrivée compte (une navigation). Même écran, même action : rien de nouveau.
  if (l.action === 'none') {
    if (derniere?.site === l.site && derniere?.ecran === l.ecran) return null;
    l.action = 'navigate';
  }
  if (derniere && (['site', 'ecran', 'action', 'champ', 'valeur'] as const).every((c) => derniere[c] === l[c])) return null;

  const tache = derniere ? derniere.tache + (derniere.fin_de_tache ? 1 : 0) : 0;
  const { data } = await db
    .from('etapes')
    .insert({ observation_id: observationId, tache, site: l.site, ecran: l.ecran, action: l.action, champ: l.champ, valeur: l.valeur, url: l.url, fin_de_tache: !!l.fin_de_tache })
    .select('*')
    .single<Etape>();
  return data;
}

const MEME = `Voici des tâches observées sur le poste d'une personne, chacune sous forme d'étapes (site · écran · action · champ).
La DERNIÈRE tâche est-elle la même tâche qu'une des précédentes, même faite sur un autre site avec d'autres libellés ?
{taches}
Rends UNIQUEMENT ce JSON : {"meme_tache": true ou false, "nom": "nom court de la tâche, à l'infinitif (ex. Publier un bien sur plusieurs portails)", "occurrences": nombre de fois où elle a été faite}`;

// Repère une tâche faite au moins 2 fois. Crée le workflow une seule fois par observation.
// Qwen n'est appelé qu'à la fin d'une tâche ; le filet sur les portails, à chaque capture.
export async function detecter(observationId: string, finDeTache: boolean): Promise<{ id: string; nom: string; occurrences: number } | null> {
  const { data: existant } = await db.from('workflows').select('id, nom, occurrences').eq('observation_id', observationId).maybeSingle();
  if (existant) return existant;

  const { data: etapes } = await db.from('etapes').select('*').eq('observation_id', observationId).order('id').returns<Etape[]>();
  const finies = [...new Set((etapes ?? []).filter((e) => e.fin_de_tache).map((e) => e.tache))];

  let trouve: { nom: string; occurrences: number } | null = null;
  if (finDeTache && finies.length >= 2) {
    const texte = finies
      .map((t, i) => `Tâche ${i + 1} :\n` + etapes!.filter((e) => e.tache === t).map((e) => `- ${e.site} · ${e.ecran} · ${e.action} · ${e.champ ?? ''}`).join('\n'))
      .join('\n\n');
    const r = await raisonner<{ meme_tache: boolean; nom: string; occurrences: number }>(MEME.replace('{taches}', texte)).catch(() => null);
    if (r?.meme_tache) trouve = { nom: r.nom, occurrences: Math.max(2, r.occurrences) };
  }
  trouve ??= await filetPortails(observationId);
  if (!trouve) return null;

  const { data } = await db
    .from('workflows')
    .insert({ observation_id: observationId, nom: trouve.nom, occurrences: trouve.occurrences, statut: 'repere' })
    .select('id, nom, occurrences')
    .single();
  return data;
}

// Filet de sécurité : la même annonce publiée sur 2 portails depuis le début de l'observation.
async function filetPortails(observationId: string): Promise<{ nom: string; occurrences: number } | null> {
  const { data: obs } = await db.from('observations').select('cree_le').eq('id', observationId).single();
  const depuis = Date.parse(obs!.cree_le);
  const parTitre = new Map<string, number>();
  for (const url of Object.values(PORTAILS)) {
    const r = await fetch(url.replace(/\/[^/]+$/, '') + '/api/annonces', { cache: 'no-store' }).catch(() => null);
    if (!r?.ok) continue;
    const { annonces } = (await r.json()) as { annonces: { titre: string; cree_le: string }[] };
    for (const t of new Set(annonces.filter((a) => Date.parse(a.cree_le) >= depuis).map((a) => a.titre))) {
      parTitre.set(t, (parTitre.get(t) ?? 0) + 1);
    }
  }
  const max = Math.max(0, ...parTitre.values());
  return max >= 2 ? { nom: 'Publier un bien sur plusieurs portails', occurrences: max } : null;
}

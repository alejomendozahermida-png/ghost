import 'server-only';
import { db } from '@/lib/supabase';
import { holo, raisonner } from '@/lib/modeles';

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

const ADRESSE = `Image agrandie du haut d'une fenêtre de navigateur (onglets, barre d'adresse).
Recopie l'adresse de la barre d'adresse caractère par caractère, sans rien corriger, compléter ni deviner.
Attention aux caractères proches : l et I et 1, O et 0, rn et m, a et e, i et j.
Rends UNIQUEMENT ce JSON : {"url": "adresse telle qu'affichée, ou null si aucune barre d'adresse n'est visible"}`;

// Lit une capture et garde seulement sa description (jamais l'image). Renvoie null si rien d'utile.
// barre : le haut de la fenêtre, net et agrandi, envoyé seulement quand il a changé ; sinon l'adresse est celle de l'étape d'avant.
const ETAPES_MIN_TACHE = 3;

// exacte : l'adresse donnée par l'extension Ghost ; quand elle est là, on ne lit plus l'adresse dans l'image.
export async function lireCapture(observationId: string, image: string, barre?: string | null, exacte?: string | null): Promise<(Etape & { nouvelle_tache: boolean }) | null> {
  const [l, adresse] = await Promise.all([
    holo<Lecture>(LIRE, image),
    exacte ? Promise.resolve({ url: exacte }) : barre ? holo<{ url: string | null }>(ADRESSE, barre).catch(() => null) : Promise.resolve(null),
  ]);
  if (l.ecran_connexion) return null;
  // L'onglet de Ghost lui-même n'est pas du travail : il fausserait le découpage en tâches.
  if (/ghost-the-task\.vercel\.app|localhost:3000/.test(adresse?.url ?? l.url ?? '') || /^ghost$/i.test(l.site?.trim() ?? '')) return null;

  const { data: derniere } = await db
    .from('etapes')
    .select('*')
    .eq('observation_id', observationId)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle<Etape>();
  // Un écran qui ne bouge pas : seule son arrivée compte (une navigation). Même écran, même action : rien de nouveau.
  l.url = adresse?.url?.replace(/\s+/g, '') || (barre || exacte ? l.url : derniere?.url ?? l.url);
  if (l.action === 'none') {
    if (derniere?.site === l.site && derniere?.ecran === l.ecran) return null;
    l.action = 'navigate';
  }
  if (derniere && (['site', 'ecran', 'action', 'champ', 'valeur'] as const).every((c) => derniere[c] === l[c])) return null;

  // Beaucoup de tâches n'affichent aucune confirmation (une cellule remplie, un champ copié) : revenir à l'écran
  // où la tâche a commencé, après quelques étapes, la termine aussi (on passe au ticket, à la ligne suivante).
  if (derniere && !derniere.fin_de_tache) {
    const { data: tacheEnCours } = await db.from('etapes').select('id, site, ecran').eq('observation_id', observationId).eq('tache', derniere.tache).order('id');
    const debut = tacheEnCours?.[0];
    if (debut && (tacheEnCours?.length ?? 0) >= ETAPES_MIN_TACHE && debut.site === l.site && debut.ecran === l.ecran) {
      await db.from('etapes').update({ fin_de_tache: true }).eq('id', derniere.id);
      derniere.fin_de_tache = true;
    }
  }
  const tache = derniere ? derniere.tache + (derniere.fin_de_tache ? 1 : 0) : 0;
  const { data } = await db
    .from('etapes')
    .insert({ observation_id: observationId, tache, site: l.site, ecran: l.ecran, action: l.action, champ: l.champ, valeur: l.valeur, url: l.url, fin_de_tache: !!l.fin_de_tache })
    .select('*')
    .single<Etape>();
  // nouvelle_tache : la tâche d'avant vient de se terminer, avec ou sans confirmation à l'écran.
  return data && { ...data, nouvelle_tache: !!derniere && tache > derniere.tache };
}

// Tâches sans fin visible (recopier d'un tableau à l'autre) : on cherche la répétition dans le flux des étapes lui-même.
const REPETITION = `Voici, dans l'ordre, les étapes observées sur le poste d'une personne (site · écran · action · champ · valeur) :
{etapes}
La personne répète-t-elle la même suite d'actions au moins 2 fois, sur des valeurs différentes (une ligne, un client, un ticket après l'autre) ?
Rends UNIQUEMENT ce JSON : {"repetee": true ou false, "nom": "nom court de la tâche, à l'infinitif (ex. Recopier le téléphone des tickets dans le fichier clients)", "occurrences": nombre de répétitions vues}`;
const ETAPES_AVANT_FLUX = 8; // assez d'étapes pour deux passages
const PAS_FLUX = 3; // Qwen n'est rappelé que toutes les 3 nouvelles étapes

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
  const nb = etapes?.length ?? 0;
  if (!trouve && nb >= ETAPES_AVANT_FLUX && nb % PAS_FLUX === 0) {
    const texte = (etapes ?? []).slice(-40).map((e) => `- ${e.site} · ${e.ecran} · ${e.action} · ${e.champ ?? ''} · ${e.valeur ?? ''}`).join('\n');
    const r = await raisonner<{ repetee: boolean; nom: string; occurrences: number }>(REPETITION.replace('{etapes}', texte)).catch(() => null);
    if (r?.repetee) trouve = { nom: r.nom, occurrences: Math.max(2, r.occurrences) };
  }
  trouve ??= await filetPortails(observationId);
  if (!trouve) return null;

  const { data } = await db
    .from('workflows')
    .insert({ observation_id: observationId, user_id: (await db.from('observations').select('user_id').eq('id', observationId).single()).data?.user_id, nom: trouve.nom, occurrences: trouve.occurrences, statut: 'repere' })
    .select('id, nom, occurrences')
    .single();
  return data;
}

// Analyse demandée par l'utilisateur (« J'ai fini ») : toutes les étapes vont à Qwen, qui décrit la tâche même vue une seule fois.
const DEBRIEF = `Voici, dans l'ordre, toutes les étapes observées sur le poste d'une personne (site · écran · action · champ · valeur) :
{etapes}
La personne vient de terminer une tâche qu'elle veut confier à un agent. Décris la tâche principale, en ignorant les gestes sans rapport.
Pour savoir où elle lit et où elle écrit, suis les valeurs : une valeur vue d'abord dans un document puis saisie dans un autre va du premier (la source) vers le second (la destination). Les actions peuvent être mal étiquetées : fie-toi au trajet des valeurs.
Chaque élément traité (une ligne, un client, un ticket) compte comme une occurrence.
Rends UNIQUEMENT ce JSON :
{"nom": "nom court à l'infinitif",
 "resume": "2 phrases au plus : ce qu'elle fait, où elle lit, où elle écrit",
 "etapes": ["étape 1 en quelques mots", "étape 2", "…"],
 "occurrences": nombre de fois où la tâche a été faite (1 au moins)}`;
const ETAPES_MIN_ANALYSE = 3;

export interface Debrief {
  id: string;
  nom: string;
  occurrences: number;
  resume?: string;
  etapes?: string[];
}

export async function analyser(observationId: string): Promise<Debrief | { erreur: string }> {
  const { data: etapes } = await db.from('etapes').select('*').eq('observation_id', observationId).order('id').returns<Etape[]>();
  if ((etapes?.length ?? 0) < ETAPES_MIN_ANALYSE) return { erreur: 'Ghost n’a pas encore vu assez d’étapes : faites la tâche au moins une fois en entier.' };
  const texte = etapes!.slice(-80).map((e) => `- ${e.site} · ${e.ecran} · ${e.action} · ${e.champ ?? ''} · ${e.valeur ?? ''}`).join('\n');
  const r = await raisonner<{ nom: string; resume: string; etapes: string[]; occurrences: number }>(DEBRIEF.replace('{etapes}', texte)).catch(() => null);
  if (!r?.nom) return { erreur: 'L’analyse n’a pas abouti. Réessayez dans un instant.' };
  const occurrences = Math.max(1, Number(r.occurrences) || 1);

  // Un workflow déjà repéré pour cette observation est mis à jour plutôt que doublé.
  const { data: existant } = await db.from('workflows').select('id').eq('observation_id', observationId).maybeSingle();
  const { data, error } = existant
    ? await db.from('workflows').update({ nom: r.nom, occurrences }).eq('id', existant.id).select('id, nom, occurrences').single()
    : await db
        .from('workflows')
        .insert({ observation_id: observationId, user_id: (await db.from('observations').select('user_id').eq('id', observationId).single()).data?.user_id, nom: r.nom, occurrences, statut: 'repere' })
        .select('id, nom, occurrences')
        .single();
  if (error || !data) return { erreur: error?.message ?? 'Workflow non créé.' };
  return { ...data, resume: r.resume, etapes: (r.etapes ?? []).slice(0, 8) };
}

// Filet de sécurité propre à nos sites de test : la même annonce publiée sur 2 portails depuis le début de l'observation.
// shortcut: ne vaut que pour nos 3 portails (leur API de lecture) ; ailleurs, seuls Holo et Qwen repèrent la tâche.
const PORTAILS_TEST = ['a', 'b', 'c'].map((x) => `https://portail-${x}-ghost.vercel.app/api/annonces`);
async function filetPortails(observationId: string): Promise<{ nom: string; occurrences: number } | null> {
  const { data: obs } = await db.from('observations').select('cree_le').eq('id', observationId).single();
  const depuis = Date.parse(obs!.cree_le);
  const parTitre = new Map<string, number>();
  for (const url of PORTAILS_TEST) {
    const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10_000) }).catch(() => null);
    if (!r?.ok) continue;
    const { annonces } = (await r.json()) as { annonces: { titre: string; cree_le: string }[] };
    for (const t of new Set(annonces.filter((a) => Date.parse(a.cree_le) >= depuis).map((a) => a.titre))) {
      parTitre.set(t, (parTitre.get(t) ?? 0) + 1);
    }
  }
  const max = Math.max(0, ...parTitre.values());
  return max >= 2 ? { nom: 'Publier un bien sur plusieurs portails', occurrences: max } : null;
}

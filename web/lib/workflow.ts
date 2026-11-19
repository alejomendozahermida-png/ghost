import 'server-only';
import { db } from '@/lib/supabase';
import { raisonner } from '@/lib/modeles';
import { enregistrerAgent, enregistrerSkill } from '@/lib/h';
import { lireSheet } from '@/lib/sheet';
import type { Etape } from '@/lib/observation';
import { coffreDe } from '@/lib/acces';

export interface Destination {
  site: string;
  url: string | null;
}

export type Source = 'lecture' | 'sheet' | 'formulaire' | 'aucune';

export interface Procedure {
  nom: string;
  source?: Source;
  source_nom?: string | null; // document ou page où les valeurs sont lues, tel qu'affiché à l'écran
  objectif: string;
  destinations: Destination[];
  etapes: { site: string; texte: string }[];
  champs: { champ: string; colonne: string }[]; // libellé vu sur le site -> donnée (colonne du Sheet ou champ du formulaire)
  demande: string;
}

export interface Workflow {
  id: string;
  nom: string;
  statut: 'repere' | 'preparation' | 'pret' | 'erreur';
  occurrences: number;
  observation_id: string | null;
  procedure: Procedure | null;
  skill: string | null;
  agent: string | null;
  sheet_url: string | null;
  source: Source | null;
  source_nom: string | null;
  destinations: Destination[] | null;
  regles: string[] | null;
  surveillance: boolean;
  user_id: string | null;
}

const SYNTHESE = `Une personne a été observée pendant qu'elle travaillait. Voici les étapes vues à l'écran, dans l'ordre
(site · adresse · écran · action · champ · valeur) :
{etapes}

{source}
Elle a répété la même tâche plusieurs fois. Décris cette tâche pour qu'un agent la refasse seul, sur de nouvelles données.
Rends UNIQUEMENT ce JSON :
{"nom": "nom court à l'infinitif",
 "objectif": "une phrase",
 "source": "lecture si les valeurs étaient lues à l'écran dans un document ou une page (Google Sheet, tableau, CRM), formulaire si elles changent d'une fois à l'autre sans être lues à l'écran, aucune si la tâche se refait à l'identique",
 "source_nom": "titre exact du document ou de la page où les valeurs sont lues, tel qu'affiché à l'écran, ou null",
 "destinations": [{"site": "nom du site où le travail est fait", "url": "adresse de la page de départ (le formulaire), ou null"}],
 "etapes": [{"site": "...", "texte": "action à faire, avec les libellés exacts vus à l'écran"}],
 "champs": [{"champ": "libellé du champ sur le site", "colonne": "nom de la donnée : la colonne du Sheet, ou un nom court (Prix, Ville) s'il n'y a pas de Sheet"}],
 "demande": "la demande qu'on enverrait à l'agent pour une nouvelle ligne, à l'impératif"}
Règles : les destinations sont les sites où l'on saisit (pas la source : un Google Sheet n'est jamais une destination). N'invente ni site ni adresse : seulement ce qui a été vu.
Une étape par site suffit si les actions se ressemblent. Avec un Sheet, relie CHAQUE colonne (sauf l'identifiant de la première)
au champ le plus probable : l'observation ne montre souvent qu'une partie des saisies. Sans données variables (source aucune), champs est vide.`;

// Règles valables pour toute tâche, sur tout site : c'est le cœur de la fiabilité de l'agent.
const REGLES_COMMUNES = [
  'Contrôle avant d’agir : si une valeur nécessaire est vide ou incohérente avec les règles ci-dessous, n’agis sur aucun site et réponds statut = "signale" avec la raison.',
  'Copie chaque valeur caractère par caractère, exactement comme fournie : ne reformule, ne traduis et n’accorde rien.',
  'Les libellés changent d’un site à l’autre : associe-les par leur sens (titre/intitulé, prix/montant, surface/superficie, ville/commune).',
  'Dans un menu déroulant, choisis l’option qui correspond à la valeur. Coche une case de certification si elle est obligatoire.',
  'Ne paie rien, ne supprime rien, n’écris à personne.',
  'Si un site demande de se connecter, utilise les identifiants enregistrés pour ce site : ne les invente jamais et ne les demande pas.',
  'Ne réponds qu’une fois chaque site terminé, avec dans publications l’adresse de la page qui montre le résultat (la page publiée), ou une liste vide si la tâche ne crée aucune page.',
];

const slug = (t: string) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

export function skillMarkdown(p: Procedure, destinations: Destination[], regles: string[]): string {
  return [
    `# ${p.nom}`, '', '## Objectif', p.objectif, '',
    '## Sites, dans cet ordre', ...destinations.map((d) => `- ${d.site} : ${d.url}`), '',
    '## Étapes', ...p.etapes.map((e, i) => `${i + 1}. ${e.site} : ${e.texte}`),
    p.champs.length ? 'Sur chaque site, y compris un site ajouté sans étape détaillée : remplis tous les champs du formulaire avec la valeur correspondante de la ligne, valide, puis attends la page de confirmation.' : 'Refais ces étapes telles quelles, puis attends la page de confirmation.', '',
    ...(p.champs.length ? ['## Correspondance des champs', ...p.champs.map((c) => `- « ${c.champ} » : donnée « ${c.colonne} »`), ''] : []),
    '## Règles', ...[...REGLES_COMMUNES, ...regles].map((r) => `- ${r}`), '',
  ].join('\n');
}

export async function lireWorkflow(id: string): Promise<Workflow | null> {
  const { data } = await db.from('workflows').select('*').eq('id', id).maybeSingle<Workflow>();
  return data;
}

const estSheet = (u: string) => u.includes('docs.google.com/spreadsheets');
const base = (u: string) => u.split(/[?#]/)[0].replace(/\/edit$/, '');

function distance(a: string, b: string): number {
  let ligne = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const suivante = [i];
    for (let j = 1; j <= b.length; j++) suivante[j] = Math.min(ligne[j] + 1, suivante[j - 1] + 1, ligne[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    ligne = suivante;
  }
  return ligne[b.length];
}

async function joignable(url: string): Promise<boolean> {
  if (estSheet(url)) return lireSheet(url).then(() => true, () => false);
  const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(8000) }).catch(() => null);
  return !!r && r.status !== 404 && r.status !== 410 && r.status < 500;
}

// Dans la police de Chrome, I majuscule et l minuscule (comme O et 0) sont identiques : aucune lecture ne peut trancher.
// On essaie donc ces variantes dans l'identifiant d'un Sheet et on garde celle qui s'ouvre.
const AMBIGUS: Record<string, string[]> = { I: ['l', '1'], l: ['I', '1'], '1': ['l', 'I'], O: ['0'], '0': ['O'] };
const MAX_VARIANTES = 64;

async function variantesSheet(url: string): Promise<string | null> {
  const id = url.match(/\/spreadsheets\/d\/([\w-]+)/)?.[1];
  if (!id) return null;
  const positions = [...id].flatMap((c, i) => (AMBIGUS[c] ? [i] : []));
  let ids = [id];
  for (const i of positions) {
    ids = ids.flatMap((x) => [x, ...AMBIGUS[x[i]].map((c) => x.slice(0, i) + c + x.slice(i + 1))]);
    if (ids.length > MAX_VARIANTES) break; // shortcut: au-delà, on renonce aux positions suivantes
  }
  for (let k = 1; k < ids.length; k += 8) {
    const lot = ids.slice(k, k + 8).map((x) => url.replace(id, x));
    const ok = await Promise.all(lot.map(joignable));
    const trouve = lot.find((_, j) => ok[j]);
    if (trouve) return trouve;
  }
  return null;
}

// Holo lit l'adresse dans la barre du navigateur et se trompe parfois (« portal » pour « portail », lettres d'un identifiant de Sheet).
// On garde l'adresse si elle répond, sinon la plus proche qui répond parmi celles déjà vues ; sinon null : la fiche la demande.
async function reparer(url: string | null, candidats: string[]): Promise<string | null> {
  if (!url) return null;
  if (await joignable(url)) return url;
  if (estSheet(url)) {
    const v = await variantesSheet(url);
    if (v) return v;
  }
  const proches = [...new Set(candidats)]
    .filter((c) => c !== url && estSheet(c) === estSheet(url))
    .map((c) => ({ c, d: distance(base(c), base(url)) }))
    .filter((x) => x.d <= Math.max(3, base(url).length * 0.2))
    .sort((a, b) => a.d - b.d);
  // Chaque lecture a ses erreurs : une autre peut n'avoir qu'une confusion I/l, que les variantes rattrapent.
  for (const { c } of proches.slice(0, 5)) {
    if (await joignable(c)) return c;
    const v = estSheet(c) ? await variantesSheet(c) : null;
    if (v) return v;
  }
  return null;
}

// Observation -> procédure (Qwen3) -> Skill (notre code) -> agent H propre à ce workflow.
export async function preparer(id: string): Promise<Workflow> {
  const w = (await lireWorkflow(id))!;
  const { data: etapes } = await db.from('etapes').select('*').eq('observation_id', w.observation_id).order('id').returns<Etape[]>();
  const { data: autres } = await db.from('workflows').select('sheet_url, destinations').eq('user_id', w.user_id ?? '').neq('id', id);
  const candidats = [
    ...(etapes ?? []).map((e) => e.url),
    ...(autres ?? []).flatMap((a) => [a.sheet_url, ...((a.destinations ?? []) as Destination[]).map((d) => d.url)]),
  ].filter((u): u is string => !!u);
  const etapeSheet = etapes?.find((e) => e.url && estSheet(e.url));
  const vuSheet = w.source !== 'formulaire' && w.source !== 'aucune' ? (w.sheet_url ?? etapeSheet?.url ?? null) : null;
  // Lue par l'agent, une adresse fausse n'est qu'un indice : il retrouve le document par son nom. On garde la meilleure qu'on ait.
  const sheetUrl = (await reparer(vuSheet, candidats)) ?? (w.source === 'sheet' ? null : vuSheet);
  const colonnes = sheetUrl ? (await lireSheet(sheetUrl).catch(() => null))?.colonnes : null;

  let procedure = w.procedure;
  if (!procedure) {
    const texte = (etapes ?? []).map((e) => `- ${e.site} · ${e.url ?? '?'} · ${e.ecran} · ${e.action} · ${e.champ ?? ''} · ${e.valeur ?? ''}`).join('\n');
    const source = colonnes ? `Source des données : un Google Sheet dont les colonnes sont : ${colonnes.join(', ')}.` : '';
    procedure = await raisonner<Procedure>(SYNTHESE.replace('{etapes}', texte).replace('{source}', source));
  }

  const destinations = await Promise.all((w.destinations ?? procedure.destinations).map(async (d) => ({ ...d, url: await reparer(d.url, candidats) })));
  // Un document lu à l'écran fait foi, même si Qwen ne l'a pas noté : l'agent ira le lire lui-même. Sinon son avis, sinon un formulaire.
  const source: Source = w.source ?? (vuSheet ? 'lecture' : procedure.source && procedure.source !== 'sheet' ? procedure.source : 'formulaire');
  const sourceNom = w.source_nom ?? procedure.source_nom ?? etapeSheet?.ecran ?? null;
  const pret = destinations.length > 0 && destinations.every((d) => d.url)
    && (source !== 'sheet' || !!sheetUrl) && (source !== 'lecture' || !!(sheetUrl || sourceNom));
  let agent = w.agent;
  let skill = w.skill;
  if (pret) {
    const nom = `ghost-${slug(procedure.nom)}-${id.slice(0, 8)}`;
    skill = skillMarkdown(procedure, destinations, w.regles ?? []);
    await enregistrerSkill(nom, `Utiliser pour : ${procedure.nom.toLowerCase()}.`, skill);
    await enregistrerAgent(
      nom,
      `${procedure.nom}, appris en observant le travail.`,
      `Tu es l'agent Ghost « ${procedure.nom} ». Tu reçois une ligne de données et tu fais la tâche sur les sites de ta Skill « ${nom} », en suivant ses règles.`,
      nom,
      destinations[0].url!,
      w.user_id ? await coffreDe(w.user_id) : undefined, // ses accès : H remplit les connexions sans que le modèle voie les secrets
    );
    agent = nom;
  }
  const { data } = await db
    .from('workflows')
    .update({ nom: procedure.nom, procedure, source, source_nom: sourceNom, sheet_url: sheetUrl ?? w.sheet_url, destinations, skill, agent, statut: pret ? 'pret' : 'preparation' })
    .eq('id', id)
    .select('*')
    .single<Workflow>();
  return data!;
}

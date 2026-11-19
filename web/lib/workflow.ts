import 'server-only';
import { db } from '@/lib/supabase';
import { raisonner } from '@/lib/modeles';
import { enregistrerAgent, enregistrerSkill } from '@/lib/h';
import { lireSheet } from '@/lib/sheet';
import type { Etape } from '@/lib/observation';

export interface Destination {
  site: string;
  url: string | null;
}

export interface Procedure {
  nom: string;
  objectif: string;
  destinations: Destination[];
  etapes: { site: string; texte: string }[];
  champs: { champ: string; colonne: string }[]; // libellé vu sur le site -> colonne du Sheet
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
  destinations: Destination[] | null;
  regles: string[] | null;
  surveillance: boolean;
}

const SYNTHESE = `Une personne a été observée pendant qu'elle travaillait. Voici les étapes vues à l'écran, dans l'ordre
(site · adresse · écran · action · champ · valeur) :
{etapes}

{source}
Elle a répété la même tâche plusieurs fois. Décris cette tâche pour qu'un agent la refasse seul, sur de nouvelles données.
Rends UNIQUEMENT ce JSON :
{"nom": "nom court à l'infinitif",
 "objectif": "une phrase",
 "destinations": [{"site": "nom du site où le travail est fait", "url": "adresse de la page de départ (le formulaire), ou null"}],
 "etapes": [{"site": "...", "texte": "action à faire, avec les libellés exacts vus à l'écran"}],
 "champs": [{"champ": "libellé du champ sur le site", "colonne": "colonne de la source d'où vient la valeur"}],
 "demande": "la demande qu'on enverrait à l'agent pour une nouvelle ligne, à l'impératif"}
Règles : les destinations sont les sites où l'on saisit (pas la source). N'invente ni site ni adresse : seulement ce qui a été vu.
Une étape par site suffit si les actions se ressemblent. Dans champs, relie CHAQUE colonne de la source (sauf l'identifiant de la
première colonne) au champ le plus probable : l'observation ne montre souvent qu'une partie des saisies.`;

// Règles valables pour toute tâche, sur tout site : c'est le cœur de la fiabilité de l'agent.
const REGLES_COMMUNES = [
  'Contrôle avant d’agir : si une valeur nécessaire est vide ou incohérente avec les règles ci-dessous, n’agis sur aucun site et réponds statut = "signale" avec la raison.',
  'Copie chaque valeur caractère par caractère, exactement comme fournie : ne reformule, ne traduis et n’accorde rien.',
  'Les libellés changent d’un site à l’autre : associe-les par leur sens (titre/intitulé, prix/montant, surface/superficie, ville/commune).',
  'Dans un menu déroulant, choisis l’option qui correspond à la valeur. Coche une case de certification si elle est obligatoire.',
  'Ne paie rien, ne supprime rien, n’écris à personne.',
  'Ne réponds qu’une fois chaque site terminé, avec dans publications l’adresse de la page qui montre le résultat (la page publiée).',
];

const slug = (t: string) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

export function skillMarkdown(p: Procedure, destinations: Destination[], regles: string[]): string {
  return [
    `# ${p.nom}`, '', '## Objectif', p.objectif, '',
    '## Sites, dans cet ordre', ...destinations.map((d) => `- ${d.site} : ${d.url}`), '',
    '## Étapes', ...p.etapes.map((e, i) => `${i + 1}. ${e.site} : ${e.texte}`),
    'Sur chaque site, y compris un site ajouté sans étape détaillée : remplis tous les champs du formulaire avec la valeur correspondante de la ligne, valide, puis attends la page de confirmation.', '',
    '## Correspondance des champs', ...p.champs.map((c) => `- « ${c.champ} » : colonne « ${c.colonne} »`), '',
    '## Règles', ...[...REGLES_COMMUNES, ...regles].map((r) => `- ${r}`), '',
  ].join('\n');
}

export async function lireWorkflow(id: string): Promise<Workflow | null> {
  const { data } = await db.from('workflows').select('*').eq('id', id).maybeSingle<Workflow>();
  return data;
}

// Observation -> procédure (Qwen3) -> Skill (notre code) -> agent H propre à ce workflow.
export async function preparer(id: string): Promise<Workflow> {
  const w = (await lireWorkflow(id))!;
  const { data: etapes } = await db.from('etapes').select('*').eq('observation_id', w.observation_id).order('id').returns<Etape[]>();
  const sheetUrl = w.sheet_url ?? etapes?.find((e) => e.url?.includes('docs.google.com/spreadsheets'))?.url ?? null;
  const colonnes = sheetUrl ? (await lireSheet(sheetUrl).catch(() => null))?.colonnes : null;

  let procedure = w.procedure;
  if (!procedure) {
    const texte = (etapes ?? []).map((e) => `- ${e.site} · ${e.url ?? '?'} · ${e.ecran} · ${e.action} · ${e.champ ?? ''} · ${e.valeur ?? ''}`).join('\n');
    const source = colonnes ? `Source des données : un Google Sheet dont les colonnes sont : ${colonnes.join(', ')}.` : '';
    procedure = await raisonner<Procedure>(SYNTHESE.replace('{etapes}', texte).replace('{source}', source));
  }

  const destinations = w.destinations ?? procedure.destinations;
  const pret = destinations.length > 0 && destinations.every((d) => d.url) && !!sheetUrl;
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
    );
    agent = nom;
  }
  const { data } = await db
    .from('workflows')
    .update({ nom: procedure.nom, procedure, sheet_url: sheetUrl, destinations, skill, agent, statut: pret ? 'pret' : 'preparation' })
    .eq('id', id)
    .select('*')
    .single<Workflow>();
  return data!;
}

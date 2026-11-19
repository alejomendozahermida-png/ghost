import 'server-only';
import mandats from '@/data/mandats.json';

// Portage en TypeScript de reference/agent-h-v1 (lancer_agent.py et portails.py), qui avait publié 3 portails sur 3.

export interface Mandat {
  ref: string;
  titre: string;
  prix: number;
  surface_m2: number;
  ville: string;
  description: string;
  classe_energie: string | null;
  piege: { type: string } | null;
}

export const MANDATS = mandats as Mandat[];
export const mandat = (ref: string): Mandat | undefined => MANDATS.find((m) => m.ref === ref);

export const PORTAILS: Record<string, string> = {
  'Portail A': (process.env.PORTAIL_A_URL ?? 'https://ghost-portail-a.vercel.app') + '/deposer',
  'Portail B': (process.env.PORTAIL_B_URL ?? 'https://ghost-portail-b.vercel.app') + '/nouvelle',
  'Portail C': (process.env.PORTAIL_C_URL ?? 'https://ghost-portail-c.vercel.app') + '/publier',
};
const CHAMPS = ['titre', 'prix', 'surface_m2', 'ville', 'description'] as const;
const PRIX_M2 = [1500, 6000];

// « Appartement T3 » -> « A-p-p-a-r-t-e-m-e-n-t / T-3 » : épelé, l'agent ne traduit plus (série du 19/11).
export const epeler = (t: string) => t.split(/\s+/).map((m) => [...m].join('-')).join(' / ');

// `portails` : seulement ceux qui restent à faire (relance après une panne de la session H).
export function consigne(m: Mandat, portails: string[] = Object.keys(PORTAILS)): string {
  const valeurs = CHAMPS.map((c) => `- ${c} : « ${m[c]} »`).join('\n');
  const sites = portails.map((p) => `- ${PORTAILS[p]}`).join('\n');
  return (
    `CONTRÔLE AVANT TOUTE PUBLICATION : vérifie que la classe énergie est renseignée et que le prix au m² ` +
    `(prix ÷ surface) est cohérent, entre ${PRIX_M2[0]} et ${PRIX_M2[1]} €/m². Sinon, ne publie sur aucun site et ` +
    `réponds tout de suite statut = "signale" avec la raison dans raison. Si tout est correct, publie et réponds statut = "publie".\n` +
    `Classe énergie du bien : ${m.classe_energie ?? 'non renseignée'} (pour le contrôle seulement, les sites n'ont pas ce champ).\n\n` +
    `Pour chaque portail de la liste : ouvre la page, remplis titre, prix, surface, ville et description avec les valeurs ` +
    `fournies, valide le formulaire et attends la page de confirmation.\n\n` +
    `Portails, dans cet ordre :\n${sites}\n\nValeurs à saisir :\n${valeurs}\n\n` +
    `RÈGLE ABSOLUE : copie chaque valeur caractère par caractère, exactement comme entre les guillemets. ` +
    `Ne reformule rien, n'ajoute aucun mot, ne change aucun adjectif. Le texte est en français : ne traduis aucun mot ` +
    `et ne change jamais le genre d'un adjectif. Le titre s'épelle exactement ainsi, lettre par lettre : ${epeler(m.titre)}. ` +
    `Avant de valider chaque formulaire, relis le titre mot par mot : si un seul mot diffère, vide entièrement le champ ` +
    `(Ctrl+A puis Suppr) et retape-le. Les libellés changent d'un site à l'autre : associe-les par leur sens ` +
    `(titre/intitulé/accroche, prix/montant, surface/superficie, ville/commune/localisation, description/texte/descriptif). ` +
    `Si un menu déroulant propose la ville avec son code postal, choisis l'option de cette ville. ` +
    `Si une case de certification est obligatoire, coche-la. Ne réponds qu'une fois chaque annonce publiée. ` +
    `Dans portails_publies, mets seulement les portails où tu as vu la confirmation (« Portail A », « Portail B », « Portail C »).`
  );
}

export type Etat = 'ok' | 'faux' | 'absent' | 'sans_photo';
interface AnnoncePortail {
  id: string;
  cree_le: string;
  photo?: boolean;
  [champ: string]: unknown;
}

const egal = (lu: unknown, attendu: unknown) =>
  typeof attendu === 'string'
    ? String(lu ?? '').split(/\s+/).join(' ').trim() === attendu.split(/\s+/).join(' ').trim()
    : lu === attendu;

async function annoncesRecentes(nom: string, depuis: string): Promise<AnnoncePortail[]> {
  const racine = PORTAILS[nom].replace(/\/[^/]+$/, '');
  const r = await fetch(`${racine}/api/annonces`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${nom} : /api/annonces a répondu ${r.status}`);
  const { annonces } = (await r.json()) as { annonces: AnnoncePortail[] };
  return annonces.filter((a) => Date.parse(a.cree_le) >= Date.parse(depuis));
}

// La preuve : on relit chaque portail, jamais la réponse de l'agent.
// shortcut: la photo du Portail C est vérifiée présente, pas comparée par empreinte (le stockage est sur le Supabase de l'équipe) ; à refaire quand les portails seront redéployés sur ton Supabase.
export async function verifier(m: Mandat, depuis: string): Promise<Record<string, Etat>> {
  const res: Record<string, Etat> = {};
  for (const nom of Object.keys(PORTAILS)) {
    const recentes = await annoncesRecentes(nom, depuis);
    const justes = recentes.filter((a) => CHAMPS.every((c) => egal(a[c], m[c])));
    res[nom] = justes.some((a) => a.photo !== false) ? 'ok' : justes.length ? 'sans_photo' : recentes.length ? 'faux' : 'absent';
  }
  return res;
}

// Pour un piège : a-t-on publié une annonce de CE bien (même titre) quelque part ?
export async function publieQuelquePart(m: Mandat, depuis: string): Promise<boolean> {
  for (const nom of Object.keys(PORTAILS)) {
    if ((await annoncesRecentes(nom, depuis)).some((a) => egal(a.titre, m.titre))) return true;
  }
  return false;
}

// Les mots qui diffèrent, pour pointer l'erreur exacte (« commerciaux » au lieu de « commerces »).
function motsFaux(lu: unknown, attendu: unknown): string {
  const a = String(lu ?? '').split(/\s+/);
  const b = String(attendu).split(/\s+/);
  if (a.length !== b.length) return `« ${lu} » au lieu de « ${attendu} »`;
  return a.flatMap((x, i) => (x === b[i] ? [] : [`« ${x} » au lieu de « ${b[i]} »`])).join(', ');
}

// Champs faux de la dernière annonce de ce portail créée après `depuis`.
async function ecarts(nom: string, m: Mandat, depuis: string): Promise<string> {
  const recentes = await annoncesRecentes(nom, depuis);
  const derniere = recentes.sort((x, y) => Date.parse(y.cree_le) - Date.parse(x.cree_le))[0];
  if (!derniere) return '';
  return CHAMPS.filter((c) => !egal(derniere[c], m[c])).map((c) => `${c} : ${motsFaux(derniere[c], m[c])}`).join(' ; ');
}

export async function correction(etats: Record<string, Etat>, m: Mandat, depuis: string): Promise<string> {
  const lignes = await Promise.all(
    Object.entries(etats)
      .filter(([, e]) => e !== 'ok')
      .map(async ([nom, e]) =>
        e === 'absent'
          ? `- ${nom} : aucune annonce publiée. Publie-la.`
          : e === 'sans_photo'
            ? `- ${nom} : l'annonce n'a pas de photo. Republie-la avec la photo déposée dans /home/hai/Downloads.`
            : `- ${nom} : ${await ecarts(nom, m, depuis)}. Republie une nouvelle annonce avec les valeurs exactes.`,
      ),
  );
  return (
    'Notre vérification sur les portails a trouvé des erreurs :\n' + lignes.join('\n') +
    '\nNe touche pas aux portails corrects. Vide entièrement chaque champ faux (Ctrl+A puis Suppr) avant de retaper ' +
    'la valeur exacte, sans la traduire ni l\'accorder. Puis réponds à nouveau.'
  );
}

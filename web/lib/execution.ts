import 'server-only';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { db } from '@/lib/supabase';
import { changements, demarrerSession, deposerFichier, envoyer, session, statut } from '@/lib/h';
import { lireWorkflow, type Destination, type Workflow } from '@/lib/workflow';
import { lireSheet, type Ligne } from '@/lib/sheet';
import { relirePage, trouveDans } from '@/lib/relecture';
import { raisonner } from '@/lib/modeles';

const MAX_RELANCES = 2; // nouvelles sessions pour un même bien (panne chez H, ou valeur fausse vue à la relecture)
const FINIS = ['idle', 'completed', 'failed', 'timed_out', 'interrupted'];
const PHOTO = /photo|image/i;
const MAX_LIGNES_LUES = 20;
const CONTROLE = `Règles de l'utilisateur :
{regles}

Ligne à traiter :
{ligne}

La ligne respecte-t-elle TOUTES les règles ? Une règle qui ne concerne pas cette ligne est respectée. Une règle qui dit comment travailler (recopier exactement, vérifier une page) n'est pas une condition sur la ligne : elle est respectée. Une valeur vide ne respecte pas une règle qui l'exige.
Rends UNIQUEMENT ce JSON : {"respecte": true ou false, "raison": "la règle non respectée et pourquoi, en une phrase, ou null"}`;
const MAX_SESSIONS = 6; // sessions H ouvertes en même temps pour une exécution

export type Etat = 'ok' | 'faux' | 'absent' | 'sans_photo';

export interface ResultatLigne {
  cle: string;
  statut: 'publie' | 'signale' | 'echec';
  portails: Record<string, Etat>;
  raison?: string;
}

// Avancement d'une ligne : ses agents (un par site), puis la relecture de ses pages.
export interface EtatLigne {
  phase?: 'agir' | 'relire';
  sessions?: { site: string; id: string; photo: boolean }[];
  relecture?: string;
  publications?: { site: string; url: string }[];
  etats?: Record<string, Etat>;
  relances?: number;
  resultat?: ResultatLigne;
}

// Avancement, gardé dans la colonne `verification`.
export interface Progres {
  courant: number; // lignes terminées
  lignes?: EtatLigne[];
  phase?: 'lire';
  consigne?: string; // source lue par l'agent : quelles lignes prendre
  lien?: string;
  cout: number;
  resultats: ResultatLigne[];
}

export interface Execution {
  id: string;
  workflow_id: string;
  statut: 'en_cours' | 'completed' | 'failed';
  etape: string;
  lignes: Ligne[];
  session_id: string | null;
  version: number;
  verification: Progres | null;
  resume: string | null;
  duree_s: number | null;
  cout_usd: number | null;
  cree_le: string;
}

const FORMAT_AGIR = {
  type: 'object',
  required: ['statut', 'publications', 'resume'],
  properties: {
    statut: { type: 'string', enum: ['publie', 'signale'] },
    raison: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    publications: { type: 'array', items: { type: 'object', required: ['site', 'url'], properties: { site: { type: 'string' }, url: { type: 'string' } } } },
    resume: { type: 'string' },
  },
};
interface ReponseAgir {
  statut: 'publie' | 'signale';
  raison?: string | null;
  publications: { site: string; url: string }[];
}

const FORMAT_LIRE = {
  type: 'object',
  required: ['pages'],
  properties: {
    pages: {
      type: 'array',
      items: {
        type: 'object',
        required: ['site', 'trouve', 'valeurs', 'photo'],
        properties: {
          site: { type: 'string' },
          trouve: { type: 'boolean' },
          valeurs: { type: 'object', additionalProperties: { type: 'string' } },
          photo: { type: 'boolean' },
        },
      },
    },
  },
};
interface ReponseLire {
  pages: { site: string; trouve: boolean; valeurs: Record<string, string>; photo: boolean }[];
}

const FORMAT_LIGNES = {
  type: 'object',
  required: ['lignes'],
  properties: {
    lignes: {
      type: 'array',
      items: { type: 'object', required: ['cle', 'valeurs'], properties: { cle: { type: 'string' }, valeurs: { type: 'object', additionalProperties: { type: 'string' } } } },
    },
    raison: { anyOf: [{ type: 'string' }, { type: 'null' }] },
  },
};
interface ReponseLignes {
  lignes?: { cle?: unknown; valeurs?: Record<string, unknown> }[];
  raison?: string | null;
}

// L'agent ouvre lui-même la source dans son navigateur, comme la personne observée : aucun Sheet à connecter.
function messageLecture(w: Workflow, consigne: string, faites: string[]): string {
  const nom = w.source_nom ? `« ${w.source_nom} »` : 'le document où sont les données';
  return [
    'Lecture seulement : ne modifie rien, ne publie rien, ne va sur aucun site de destination.',
    w.sheet_url ? `Ouvre ${nom} : ${w.sheet_url}` : `Ouvre ${nom}.`,
    `Si l'adresse ne s'ouvre pas, retrouve ce document par son nom (par exemple dans Google Drive, avec les identifiants enregistrés).`,
    `Éléments à lire (lignes d'un tableau, tickets, fiches…) : ${consigne}.`,
    faites.length ? `Ceux-ci sont déjà faits, ignore-les : ${faites.join(', ')}.` : '',
    `Pour chacun : dans cle, ce qui l'identifie (première colonne d'un tableau, numéro de ticket) ; dans valeurs, chaque champ (nom exact affiché) avec sa valeur recopiée caractère par caractère, vide comprise.`,
    `Au plus ${MAX_LIGNES_LUES} éléments. Si tu ne trouves pas la source, rends lignes = [] et explique pourquoi dans raison.`,
  ].filter(Boolean).join('\n');
}

// Empreinte des valeurs d'une ligne : une ligne déjà tentée n'est refaite que si ses valeurs ont changé dans la source.
export const empreinte = (l: Ligne) =>
  createHash('sha1').update(JSON.stringify(Object.entries(l.valeurs).sort(([a], [b]) => a.localeCompare(b)))).digest('hex');

// Lignes de la source pas encore tentées avec ces valeurs-là. Une ligne marquée avant l'empreinte compte comme faite.
export async function nouvellesLignes(workflowId: string, lignes: Ligne[]): Promise<Ligne[]> {
  const { data } = await db.from('lignes_traitees').select('cle_ligne, empreinte').eq('workflow_id', workflowId);
  const vues = new Map((data ?? []).map((t) => [t.cle_ligne as string, t.empreinte as string | null]));
  return lignes.filter((l) => l.cle && (!vues.has(l.cle) || (vues.get(l.cle) !== null && vues.get(l.cle) !== empreinte(l))));
}

const epeler = (t: string) => t.split(/\s+/).map((m) => [...m].join('-')).join(' / ');
const estNombre = (v: string) => /^[\d\s.,€]+$/.test(v.trim());
const norme = (v: string) => v.replace(/\s+/g, ' ').trim();

// Compare ce qui est affiché sur la page à la valeur de la ligne. Les nombres : chiffres seuls (« 139 000 € » = 139000).
function egal(lu: string | undefined, attendu: string): boolean {
  if (lu == null) return false;
  if (estNombre(attendu)) return lu.replace(/[^\d]/g, '') === attendu.replace(/[^\d]/g, '');
  return norme(lu) === norme(attendu) || norme(lu).replace(/\s*\(.*\)$/, '') === norme(attendu);
}

// La demande vient de notre code, pas du texte généré : celui-ci citait parfois une partie des sites seulement.
function messageAgir(ligne: Ligne, sites: Destination[], tache: string, ecarts: string[]): string {
  const valeurs = Object.entries(ligne.valeurs).filter(([c]) => !PHOTO.test(c));
  const vides = valeurs.filter(([, v]) => !v.trim()).map(([c]) => c);
  const textes = valeurs.filter(([, v]) => v && !estNombre(v) && v.length <= 60);
  const longs = valeurs.filter(([, v]) => v && !estNombre(v) && v.length > 60).map(([c]) => c);
  // Tâche sans données : on la refait telle qu'observée.
  if (!valeurs.length) return [`Fais la tâche « ${tache} » sur ce(s) site(s), en suivant les étapes de ta Skill :`, ...sites.map((s) => `- ${s.site} : ${s.url}`)].join('\n');
  return [
    `Fais la tâche « ${tache} » pour la ligne « ${ligne.cle} », sur les ${sites.length} site(s) ci-dessous, tous, dans cet ordre :`,
    ...sites.map((s) => `- ${s.site} : ${s.url}`),
    sites.length === 1 ? `Ne fais que ${sites[0].site} : les autres sites sont faits en même temps par d'autres agents. N'en ouvre aucun autre.` : '',
    `Valeurs :`, ...valeurs.map(([c, v]) => `- ${c} : « ${v} »`),
    vides.length ? `Valeurs vides dans cette ligne : ${vides.join(', ')}.` : '',
    ...textes.map(([c, v]) => `${c} s'épelle lettre par lettre : ${epeler(v)}.`),
    longs.length ? `${longs.join(', ')} : tape le texte mot pour mot, avec la même ponctuation. Ne corrige, n'accorde, ne raccourcis et ne remplace AUCUN mot, même s'il te semble faux (garde « commerces », n'écris pas « commerciaux »). Relis-le avant de valider.` : '',
    // Erreurs vues en vrai : « Apartment » pour « Appartement », « idéal » pour « Idéal ». La relecture après publication les voit, mais trop tard.
    `Garde chaque majuscule, chaque accent et la langue d'origine : ne traduis rien en anglais (« Appartement », jamais « Apartment »).`,
    `Avant de cliquer sur le bouton qui publie, relis chaque champ rempli du formulaire et compare-le lettre par lettre avec les valeurs ci-dessus. S'il y a la moindre différence, corrige le champ, puis relis encore. Ne publie qu'un formulaire identique.`,
    ecarts.length ? `Attention, lors d'un essai précédent : ${ecarts.join(' ; ')}.` : '',
  ].filter(Boolean).join('\n');
}

function messageRelire(publications: { site: string; url: string }[], colonnes: string[]): string {
  return [
    'Relecture seulement : ne clique sur rien qui modifie quoi que ce soit.',
    'Ouvre chacune de ces pages :', ...publications.map((p) => `- ${p.site} : ${p.url}`),
    `Pour chaque page, recopie exactement, caractère par caractère, la valeur affichée pour : ${colonnes.join(', ')}.`,
    'Dans valeurs, utilise ces noms tels quels comme clés. Indique si une photo du bien est affichée.',
    'Si la page n’existe pas ou ne montre pas de résultat, mets trouve = false.',
  ].join('\n');
}

async function photoBase64(valeur: string): Promise<{ nom: string; base64: string } | null> {
  if (!valeur) return null;
  if (/^https?:\/\//.test(valeur)) {
    const r = await fetch(valeur, { signal: AbortSignal.timeout(15_000) });
    return r.ok ? { nom: valeur.split('/').pop()!.split('?')[0], base64: Buffer.from(await r.arrayBuffer()).toString('base64') } : null;
  }
  const nom = path.basename(valeur);
  const fichier = await readFile(path.join(process.cwd(), 'public', 'photos', nom)).catch(() => null);
  if (fichier) return { nom, base64: fichier.toString('base64') };
  // En ligne, les fichiers de public/ ne sont pas dans la fonction : on les demande au site lui-même.
  const site = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const r = site ? await fetch(`https://${site}/photos/${encodeURIComponent(nom)}`, { signal: AbortSignal.timeout(15_000) }).catch(() => null) : null;
  return r?.ok ? { nom, base64: Buffer.from(await r.arrayBuffer()).toString('base64') } : null;
}

// Fait avancer l'exécution d'un cran. Appelée à chaque rafraîchissement : aucun serveur ne tourne en permanence.
// Toutes les lignes avancent en même temps, chacune avec un agent par site, dans la limite de MAX_SESSIONS sessions ouvertes.
export async function avancer(id: string): Promise<Execution> {
  const { data } = await db.from('executions').select('*').eq('id', id).single<Execution>();
  if (!data || data.statut !== 'en_cours') return data!;

  // Verrou : un seul appel à la fois fait avancer l'exécution (deux onglets ne lancent pas deux sessions).
  const { data: pris } = await db.from('executions').update({ version: data.version + 1 }).eq('id', id).eq('version', data.version).select('id');
  if (!pris?.length) return data;

  const w = (await lireWorkflow(data.workflow_id))!;
  const tous = w.destinations ?? [];
  const p: Progres = data.verification ?? { courant: 0, cout: 0, resultats: [] };
  if (!data.lignes.length) return lireSource(data, w, p);
  const etats: EtatLigne[] = p.lignes ?? data.lignes.map(() => ({}));
  const maj: Partial<Execution> = { resume: null };
  const traitees: { cle_ligne: string; empreinte: string; statut: string }[] = [];

  async function avancerLigne(ligne: Ligne, e: EtatLigne): Promise<void> {
    // Une relance ne refait que les sites en échec la fois d'avant.
    const destinations = ligne.sites?.length ? tous.filter((d) => ligne.sites!.includes(d.site)) : tous;
    const colonnes = Object.keys(ligne.valeurs).filter((c) => !PHOTO.test(c));
    const colonnePhoto = Object.keys(ligne.valeurs).find((c) => PHOTO.test(c));

    const terminer = (r: ResultatLigne) => {
      Object.assign(e, { resultat: r, phase: undefined, sessions: undefined, relecture: undefined });
      // Toute ligne tentée est notée, refusée ou en échec comprise : la veille ne la relance pas en boucle, sauf si ses valeurs changent.
      if (w.source === 'lecture' || w.source === 'sheet') traitees.push({ cle_ligne: r.cle, empreinte: empreinte(ligne), statut: r.statut });
    };
    // Un agent par site, ouvert directement sur le formulaire.
    // shortcut: si un démarrage échoue, les sessions déjà lancées continuent seules chez H ; à arrêter proprement si ça arrive souvent.
    const lancerAgir = async (sites: Destination[], ecarts: string[]) => {
      const lancees = await Promise.all(sites.map((d) =>
        demarrerSession({ agent: w.agent!, message: messageAgir(ligne, [d], w.procedure!.nom, ecarts), format: FORMAT_AGIR, startUrl: d.url!, sites: 1 })));
      const sansPhoto = !colonnePhoto || !ligne.valeurs[colonnePhoto];
      Object.assign(e, { phase: 'agir', sessions: lancees.map((s, i) => ({ site: sites[i].site, id: s.id, photo: sansPhoto })) });
      p.lien ??= (await session(lancees[0].id)).agent_view_url;
    };
    const lancerRelire = async () => {
      const pubs = e.publications!;
      const s = await demarrerSession({ agent: 'h/web-surfer-pro', message: messageRelire(pubs, colonnes), format: FORMAT_LIRE, startUrl: pubs[0].url, sites: pubs.length });
      Object.assign(e, { phase: 'relire', relecture: s.id });
    };

    // Compare ce que montrent les pages à la ligne, jamais ce que l'agent a déclaré.
    const conclure = async (pages: { site: string; trouve: boolean; verifie: (c: string) => boolean }[]) => {
      // Une valeur de 1 à 3 lettres (« C ») se retrouve n'importe où dans une page (« Portail C ») : on ne peut pas la vérifier.
      const verifiable = (v: string) => !!v.trim() && (estNombre(v) || v.trim().length > 3);
      // Chaque champ que la tâche remplit est vérifié sur chaque page, même si aucune ne le montre à l'identique
      // (sinon un texte modifié partout passait). Les autres colonnes (identifiant, classe énergie) le sont seulement si une page les affiche.
      const remplies = new Set((w.procedure?.champs ?? []).map((c) => c.colonne));
      const affichees = colonnes
        .filter((c) => ligne.valeurs[c] !== ligne.cle && verifiable(ligne.valeurs[c] ?? ''))
        .filter((c) => remplies.has(c) || pages.some((x) => x.trouve && x.verifie(c)));
      const parSite: Record<string, Etat> = {};
      const ecarts: string[] = [];
      for (const d of destinations) {
        const page = pages.find((x) => x.site.toLowerCase().startsWith(d.site.toLowerCase()));
        if (!page?.trouve) { parSite[d.site] = 'absent'; continue; }
        const faux = affichees.filter((c) => !page.verifie(c));
        faux.forEach((c) => ecarts.push(`${d.site}, ${c} : la page n'affiche pas « ${ligne.valeurs[c]} »`));
        // La photo ne bloque pas : chaque site décide s'il en affiche une (A et B n'ont pas de champ photo).
        parSite[d.site] = faux.length ? 'faux' : 'ok';
      }
      e.etats = parSite;
      // Relancer ne sert que là où rien n'a été publié. Une valeur fausse est signalée sans republier :
      // un nouvel envoi créerait une seconde annonce (les sites ne se modifient pas tous), et l'agent ne supprime rien.
      const absents = destinations.filter((d) => parSite[d.site] === 'absent');
      const fausses = destinations.filter((d) => parSite[d.site] === 'faux');
      if (!absents.length && !fausses.length) terminer({ cle: ligne.cle, statut: 'publie', portails: parSite });
      else if (absents.length && !fausses.length && (e.relances ?? 0) < MAX_RELANCES) {
        e.relances = (e.relances ?? 0) + 1;
        await lancerAgir(absents, []);
      } else {
        const manquants = absents.map((d) => `${d.site} : aucune annonce trouvée`);
        terminer({ cle: ligne.cle, statut: 'echec', portails: parSite, raison: [...ecarts, ...manquants].join(' ; ') || 'Résultat absent.' });
      }
    };

    if (!e.phase) {
      // Contrôles faits une fois, avant tout agent, au lieu d'être laissés au jugement de chaque agent sur son site.
      // 1. Une valeur vide bloque seulement si la tâche s'en sert pour remplir un champ.
      const utilisees = new Set((w.procedure?.champs ?? []).map((c) => c.colonne));
      const vides = colonnes.filter((c) => utilisees.has(c) && !ligne.valeurs[c]?.trim());
      if (vides.length) return terminer({ cle: ligne.cle, statut: 'signale', portails: {}, raison: `Valeur vide : ${vides.join(', ')}. Rien n'a été publié.` });
      // 2. Les règles écrites par l'utilisateur, jugées une seule fois pour la ligne (une erreur de Qwen : on réessaie au prochain appel).
      const regles = w.regles ?? [];
      if (regles.length) {
        const v = await raisonner<{ respecte: boolean; raison: string | null }>(CONTROLE
          .replace('{regles}', regles.map((r) => `- ${r}`).join('\n'))
          .replace('{ligne}', Object.entries(ligne.valeurs).filter(([c]) => !PHOTO.test(c)).map(([c, x]) => `- ${c} : « ${x} »`).join('\n')));
        if (v.respecte === false) return terminer({ cle: ligne.cle, statut: 'signale', portails: {}, raison: `${v.raison ?? 'Une de vos règles n’est pas respectée.'} Rien n'a été publié.` });
      }
      await lancerAgir(destinations, ligne.ecarts ?? []).catch((err: Error) => terminer({ cle: ligne.cle, statut: 'echec', portails: {}, raison: `L'agent n'a pas pu démarrer : ${err.message}` }));
      return;
    }

    if (e.phase === 'relire') {
      const st = await statut(e.relecture!);
      if (!FINIS.includes(st.status)) return;
      const ch = await changements(e.relecture!);
      p.cout += ch.metrics?.total_cost ?? 0;
      const pages = (ch.answer as ReponseLire | undefined)?.pages;
      if (!pages && (e.relances ?? 0) < MAX_RELANCES) {
        e.relances = (e.relances ?? 0) + 1; // la relecture elle-même a échoué : on relit, on ne republie pas
        return lancerRelire();
      }
      const affiche = (v?: string) => !!v?.trim() && !/non affich/i.test(v);
      return conclure((pages ?? []).map((x) => ({ site: x.site, trouve: x.trouve, verifie: (c: string) => affiche(x.valeurs[c]) && egal(x.valeurs[c], ligne.valeurs[c]) })));
    }

    const sessions = e.sessions ?? [];
    const f = sessions.some((s) => !s.photo) ? await photoBase64(ligne.valeurs[colonnePhoto!]) : null;
    for (const s of sessions.filter((x) => !x.photo && f)) {
      // Le navigateur de la session démarre en quelques secondes : avant, H répond 404. On réessaie au prochain appel.
      const depose = await deposerFichier(s.id, f!.nom, f!.base64).catch(() => null);
      if (depose) {
        await envoyer(s.id, `Quand un site demande une photo, envoie exactement le fichier ${depose.path}. N'en crée et n'en choisis aucune autre.`);
        s.photo = true;
      }
    }
    const sts = await Promise.all(sessions.map((s) => statut(s.id)));
    if (sessions.some((_, i) => !FINIS.includes(sts[i].status))) return;

    const chs = await Promise.all(sessions.map((s) => changements(s.id)));
    p.cout += chs.reduce((n, ch) => n + (ch.metrics?.total_cost ?? 0), 0);
    const reps = chs.map((ch) => ch.answer as ReponseAgir | undefined);
    const signal = reps.find((r) => r?.statut === 'signale');
    if (signal) return terminer({ cle: ligne.cle, statut: 'signale', portails: {}, raison: signal.raison ?? undefined });

    // Publications déjà relues comme justes (essai précédent) + celles de ces sessions.
    e.publications = [...(e.publications ?? []).filter((x) => e.etats?.[x.site] === 'ok'), ...reps.flatMap((r) => r?.publications ?? [])];
    if (!e.publications.length && !Object.values(ligne.valeurs).some((v) => v.trim())) {
      // Tâche sans données et sans page de résultat (un export, un tri) : rien à relire, on s'en tient à la réponse de l'agent.
      return terminer({ cle: ligne.cle, statut: 'publie', portails: Object.fromEntries(destinations.map((d) => [d.site, 'ok'])) });
    }
    if (e.publications.length) {
      // Relecture par le serveur : on télécharge chaque page publiée. Si une page ne se lit pas sans navigateur, un agent relit.
      const lues = await Promise.all(e.publications.map((x) => relirePage(x.site, x.url)));
      if (lues.every((x) => x.texte)) return conclure(lues.map((x) => ({ site: x.site, trouve: true, verifie: (c: string) => trouveDans(x.texte!, ligne.valeurs[c]) })));
      return lancerRelire();
    }
    if ((e.relances ?? 0) < MAX_RELANCES) {
      e.relances = (e.relances ?? 0) + 1; // session morte chez H sans rien publier : on recommence
      return lancerAgir(destinations, []);
    }
    terminer({ cle: ligne.cle, statut: 'echec', portails: Object.fromEntries(destinations.map((d) => [d.site, 'absent'])), raison: sts.find((s) => s.error)?.error ?? 'Aucune publication.' });
  }

  const ouvertes = () => etats.reduce((n, e) => n + (e.phase === 'agir' ? e.sessions?.length ?? 0 : e.phase === 'relire' ? 1 : 0), 0);
  const etape = async (i: number) => {
    try {
      await avancerLigne(data.lignes[i], etats[i]);
    } catch (err) {
      maj.resume = err instanceof Error ? err.message : String(err); // erreur passagère : on retente au prochain appel
    }
  };
  // Les lignes déjà lancées avancent ensemble ; les suivantes démarrent tant qu'il reste des places.
  await Promise.all(etats.map((e, i) => (e.phase ? etape(i) : null)));
  for (const i of etats.keys()) {
    if (etats[i].phase || etats[i].resultat) continue;
    if (ouvertes() + tous.length > MAX_SESSIONS && ouvertes() > 0) break;
    await etape(i);
  }

  p.lignes = etats;
  p.resultats = etats.flatMap((e) => (e.resultat ? [e.resultat] : []));
  p.courant = p.resultats.length;
  const active = etats.find((e) => e.phase === 'agir');
  maj.session_id = active?.sessions?.[0]?.id ?? etats.find((e) => e.phase === 'relire')?.relecture ?? null; // la vue en direct suit un agent au travail
  maj.etape = active ? 'en_cours' : etats.some((e) => e.phase === 'relire') ? 'verification' : 'agent_pret';
  if (p.courant === data.lignes.length) {
    const ok = p.resultats.every((x) => x.statut !== 'echec');
    Object.assign(maj, {
      statut: ok ? 'completed' : 'failed',
      etape: 'terminee',
      session_id: null,
      duree_s: Math.round((Date.now() - Date.parse(data.cree_le)) / 1000),
      cout_usd: Math.round(p.cout * 10000) / 10000,
      resume: ok
        ? `${p.resultats.length} ligne(s) traitée(s), chaque résultat relu sur la page publiée.`
        : `Échec sur : ${p.resultats.filter((x) => x.statut === 'echec').map((x) => x.cle).join(', ')}.`,
    });
  }

  // Mémoire des lignes faites : la prochaine lecture de la source les ignore.
  if (traitees.length) await db.from('lignes_traitees').upsert(traitees.map((t) => ({ ...t, workflow_id: w.id, execution_id: id })));
  const { data: apres } = await db.from('executions').update({ ...maj, verification: p }).eq('id', id).select('*').single<Execution>();
  return apres!;
}

// Phase de lecture : une session ouvre la source et rapporte les lignes ; ensuite le moteur fait chaque ligne comme pour un Sheet.
async function lireSource(data: Execution, w: Workflow, p: Progres): Promise<Execution> {
  const maj: Partial<Execution> = { resume: null };
  const finir = (statut: 'completed' | 'failed', resume: string) => Object.assign(maj, {
    statut, resume, etape: 'terminee', session_id: null,
    duree_s: Math.round((Date.now() - Date.parse(data.cree_le)) / 1000),
    cout_usd: Math.round(p.cout * 10000) / 10000,
  });
  try {
    const direct = !data.session_id && w.sheet_url ? await lireSheet(w.sheet_url).catch(() => null) : null;
    if (direct) {
      // Rapide : le Sheet s'ouvre par lien, Ghost le lit lui-même en une seconde. L'agent ne lit que si ce n'est pas possible.
      let choisies = await nouvellesLignes(w.id, direct.lignes);
      if (p.consigne) {
        // « M-0143 et M-0144 », « les biens de Lyon » : Qwen choisit parmi toutes les lignes, déjà faites comprises (on peut vouloir refaire).
        const apercu = direct.lignes.map((l) => `${l.cle} : ${Object.values(l.valeurs).filter((v) => v && v !== l.cle).slice(0, 4).join(' · ')}`).join('\n');
        const r = await raisonner<{ cles: string[] }>(`Lignes d'un tableau :\n${apercu}\n\nDemande : « ${p.consigne} »\nRends UNIQUEMENT ce JSON : {"cles": ["clés des lignes demandées"]}`);
        const voulues = new Set((r.cles ?? []).map(String));
        choisies = direct.lignes.filter((l) => voulues.has(l.cle));
      }
      if (choisies.length) Object.assign(maj, { lignes: choisies.slice(0, MAX_LIGNES_LUES), etape: 'recue' });
      else finir('completed', 'Aucune nouvelle ligne à faire dans la source.');
    } else if (!data.session_id) {
      const { data: faites } = await db.from('lignes_traitees').select('cle_ligne').eq('workflow_id', w.id);
      const s = await demarrerSession({
        agent: w.agent!,
        message: messageLecture(w, p.consigne || 'les lignes pas encore faites', (faites ?? []).map((f) => f.cle_ligne)),
        format: FORMAT_LIGNES,
        startUrl: w.sheet_url ?? 'https://drive.google.com',
        sites: 1,
      });
      Object.assign(p, { phase: 'lire', lien: (await session(s.id)).agent_view_url });
      Object.assign(maj, { session_id: s.id, etape: 'lecture' });
    } else {
      const st = await statut(data.session_id);
      if (!FINIS.includes(st.status)) {
        maj.etape = 'lecture';
      } else {
        const ch = await changements(data.session_id);
        p.cout += ch.metrics?.total_cost ?? 0;
        const rep = ch.answer as ReponseLignes | undefined;
        const vues = new Set<string>();
        const lues: Ligne[] = (rep?.lignes ?? [])
          .filter((l) => l?.cle && l.valeurs && typeof l.valeurs === 'object')
          .map((l) => ({ cle: String(l.cle).trim(), valeurs: Object.fromEntries(Object.entries(l.valeurs!).map(([c, v]) => [c, String(v ?? '')])) }))
          .filter((l) => l.cle && !vues.has(l.cle) && vues.add(l.cle))
          .slice(0, MAX_LIGNES_LUES);
        // L'agent choisit les lignes ; si le Sheet s'ouvre par lien, on reprend ses valeurs exactes (une lecture à l'écran peut se tromper d'un mot).
        const exact = w.sheet_url ? await lireSheet(w.sheet_url).catch(() => null) : null;
        if (exact) lues.forEach((l, i) => { const vraie = exact.lignes.find((x) => x.cle === l.cle); if (vraie) lues[i] = vraie; });
        if (lues.length) {
          p.phase = undefined;
          Object.assign(maj, { lignes: lues, session_id: null, etape: 'recue' });
        } else if (rep?.raison || st.error) {
          finir('failed', `L'agent n'a pas pu lire la source : ${rep?.raison ?? st.error}`);
        } else {
          finir('completed', 'Aucune nouvelle ligne à faire dans la source.');
        }
      }
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (!data.session_id) finir('failed', `L'agent n'a pas pu démarrer : ${message}`);
    else maj.resume = message;
  }
  const { data: apres } = await db.from('executions').update({ ...maj, verification: p }).eq('id', data.id).select('*').single<Execution>();
  return apres!;
}

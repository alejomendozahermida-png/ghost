import 'server-only';
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
    `Lignes à lire : ${consigne}.`,
    faites.length ? `Ces lignes sont déjà faites, ignore-les : ${faites.join(', ')}.` : '',
    `Pour chaque ligne : dans cle, la valeur de la première colonne ; dans valeurs, chaque colonne (nom exact de l'en-tête) avec sa valeur recopiée caractère par caractère, vide comprise.`,
    `Au plus ${MAX_LIGNES_LUES} lignes. Si tu ne trouves pas le document, rends lignes = [] et explique pourquoi dans raison.`,
  ].filter(Boolean).join('\n');
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
  // Tâche sans données : on la refait telle qu'observée.
  if (!valeurs.length) return [`Fais la tâche « ${tache} » sur ce(s) site(s), en suivant les étapes de ta Skill :`, ...sites.map((s) => `- ${s.site} : ${s.url}`)].join('\n');
  return [
    `Fais la tâche « ${tache} » pour la ligne « ${ligne.cle} », sur les ${sites.length} site(s) ci-dessous, tous, dans cet ordre :`,
    ...sites.map((s) => `- ${s.site} : ${s.url}`),
    sites.length === 1 ? `Ne fais que ${sites[0].site} : les autres sites sont faits en même temps par d'autres agents. N'en ouvre aucun autre.` : '',
    `Valeurs :`, ...valeurs.map(([c, v]) => `- ${c} : « ${v} »`),
    vides.length ? `Valeurs vides dans cette ligne : ${vides.join(', ')}.` : '',
    ...textes.map(([c, v]) => `${c} s'épelle lettre par lettre : ${epeler(v)}.`),
    ecarts.length ? `Une relecture a trouvé des erreurs à corriger : ${ecarts.join(' ; ')}. Publie de nouveau avec les valeurs exactes.` : '',
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
    const r = await fetch(valeur);
    return r.ok ? { nom: valeur.split('/').pop()!.split('?')[0], base64: Buffer.from(await r.arrayBuffer()).toString('base64') } : null;
  }
  const fichier = await readFile(path.join(process.cwd(), 'public', 'photos', path.basename(valeur))).catch(() => null);
  return fichier ? { nom: path.basename(valeur), base64: fichier.toString('base64') } : null;
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
  const destinations = w.destinations ?? [];
  const p: Progres = data.verification ?? { courant: 0, cout: 0, resultats: [] };
  if (!data.lignes.length) return lireSource(data, w, p);
  const etats: EtatLigne[] = p.lignes ?? data.lignes.map(() => ({}));
  const maj: Partial<Execution> = { resume: null };
  const traitees: string[] = [];

  async function avancerLigne(ligne: Ligne, e: EtatLigne): Promise<void> {
    const colonnes = Object.keys(ligne.valeurs).filter((c) => !PHOTO.test(c));
    const colonnePhoto = Object.keys(ligne.valeurs).find((c) => PHOTO.test(c));

    const terminer = (r: ResultatLigne) => {
      Object.assign(e, { resultat: r, phase: undefined, sessions: undefined, relecture: undefined });
      if (r.statut === 'publie' && (w.source === 'lecture' || w.source === 'sheet')) traitees.push(r.cle);
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
      // shortcut: une colonne qu'aucune page ne montre (identifiant, classe énergie) n'est pas comparée ; une valeur fausse sur TOUTES les pages passerait donc, à revoir avec la liste des champs affichés.
      // Une valeur de 1 à 3 lettres (« C ») se retrouve n'importe où dans une page (« Portail C ») : on ne peut pas la vérifier.
      const verifiable = (v: string) => !!v.trim() && (estNombre(v) || v.trim().length > 3);
      // La colonne identifiant d'un Sheet (sa valeur est la clé de la ligne) n'est pas affichée sur les sites.
      const affichees = colonnes.filter((c) => ligne.valeurs[c] !== ligne.cle).filter((c) => verifiable(ligne.valeurs[c] ?? '') && pages.some((x) => x.trouve && x.verifie(c)));
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
      const restants = destinations.filter((d) => parSite[d.site] !== 'ok');
      if (!restants.length) terminer({ cle: ligne.cle, statut: 'publie', portails: parSite });
      else if ((e.relances ?? 0) < MAX_RELANCES) {
        e.relances = (e.relances ?? 0) + 1;
        await lancerAgir(restants, ecarts);
      } else terminer({ cle: ligne.cle, statut: 'echec', portails: parSite, raison: ecarts.join(' ; ') || 'Résultat absent.' });
    };

    if (!e.phase) {
      // Une ligne de tableau avec une valeur vide n'est jamais publiée : le contrôle est fait par notre code, pas laissé au jugement de l'agent.
      const vides = w.source === 'lecture' || w.source === 'sheet' ? colonnes.filter((c) => !ligne.valeurs[c]?.trim()) : [];
      if (vides.length) terminer({ cle: ligne.cle, statut: 'signale', portails: {}, raison: `Valeur vide : ${vides.join(', ')}. Rien n'a été publié.` });
      else await lancerAgir(destinations, []).catch((err: Error) => terminer({ cle: ligne.cle, statut: 'echec', portails: {}, raison: `L'agent n'a pas pu démarrer : ${err.message}` }));
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
    if (ouvertes() + destinations.length > MAX_SESSIONS && ouvertes() > 0) break;
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
  if (traitees.length) await db.from('lignes_traitees').upsert(traitees.map((c) => ({ workflow_id: w.id, cle_ligne: c, execution_id: id })));
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
      const { data: faites } = await db.from('lignes_traitees').select('cle_ligne').eq('workflow_id', w.id);
      const dejaFaites = new Set((faites ?? []).map((f) => f.cle_ligne));
      let choisies = direct.lignes.filter((l) => l.cle && !dejaFaites.has(l.cle));
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

import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { db } from '@/lib/supabase';
import { changements, demarrerSession, deposerFichier, envoyer, session, statut } from '@/lib/h';
import { lireWorkflow, type Destination } from '@/lib/workflow';
import type { Ligne } from '@/lib/sheet';
import { relirePage, trouveDans } from '@/lib/relecture';

const MAX_RELANCES = 2; // nouvelles sessions pour un même bien (panne chez H, ou valeur fausse vue à la relecture)
const FINIS = ['idle', 'completed', 'failed', 'timed_out', 'interrupted'];
const PHOTO = /photo|image/i;

export type Etat = 'ok' | 'faux' | 'absent' | 'sans_photo';

export interface ResultatLigne {
  cle: string;
  statut: 'publie' | 'signale' | 'echec';
  portails: Record<string, Etat>;
  raison?: string;
}

// Avancement, gardé dans la colonne `verification` : une session d'action puis une session de relecture par ligne.
export interface Progres {
  courant: number;
  phase?: 'agir' | 'relire';
  publications?: { site: string; url: string }[];
  etats?: Record<string, Etat>;
  ecarts?: string[];
  photo?: boolean;
  relances?: number;
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
  return [
    `Fais la tâche « ${tache} » pour la ligne « ${ligne.cle} », sur les ${sites.length} site(s) ci-dessous, tous, dans cet ordre :`,
    ...sites.map((s) => `- ${s.site} : ${s.url}`),
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
export async function avancer(id: string): Promise<Execution> {
  const { data } = await db.from('executions').select('*').eq('id', id).single<Execution>();
  if (!data || data.statut !== 'en_cours') return data!;

  // Verrou : un seul appel à la fois fait avancer l'exécution (deux onglets ne lancent pas deux sessions).
  const { data: pris } = await db.from('executions').update({ version: data.version + 1 }).eq('id', id).eq('version', data.version).select('id');
  if (!pris?.length) return data;

  const w = (await lireWorkflow(data.workflow_id))!;
  const destinations = w.destinations ?? [];
  const p: Progres = data.verification ?? { courant: 0, cout: 0, resultats: [] };
  const ligne = data.lignes[p.courant];
  const colonnes = Object.keys(ligne.valeurs).filter((c) => !PHOTO.test(c));
  const colonnePhoto = Object.keys(ligne.valeurs).find((c) => PHOTO.test(c));
  const maj: Partial<Execution> = { resume: null };

  const lancerAgir = async (sites: Destination[], ecarts: string[]) => {
    const s = await demarrerSession({ agent: w.agent!, message: messageAgir(ligne, sites, w.procedure!.nom, ecarts), format: FORMAT_AGIR, startUrl: sites[0].url!, sites: sites.length });
    Object.assign(p, { phase: 'agir', photo: !colonnePhoto || !ligne.valeurs[colonnePhoto], lien: (await session(s.id)).agent_view_url });
    Object.assign(maj, { session_id: s.id, etape: 'agent_pret' });
  };
  const lancerRelire = async () => {
    const pubs = p.publications!;
    const s = await demarrerSession({ agent: 'h/web-surfer-pro', message: messageRelire(pubs, colonnes), format: FORMAT_LIRE, startUrl: pubs[0].url, sites: pubs.length });
    p.phase = 'relire';
    Object.assign(maj, { session_id: s.id, etape: 'verification' });
  };
  const terminerLigne = (r: ResultatLigne) => {
    p.resultats.push(r);
    Object.assign(p, { courant: p.courant + 1, phase: undefined, publications: [], etats: undefined, ecarts: [], relances: 0 });
    maj.session_id = null;
    if (p.courant === data.lignes.length) {
      const ok = p.resultats.every((x) => x.statut !== 'echec');
      Object.assign(maj, {
        statut: ok ? 'completed' : 'failed',
        etape: 'terminee',
        duree_s: Math.round((Date.now() - Date.parse(data.cree_le)) / 1000),
        cout_usd: Math.round(p.cout * 10000) / 10000,
        resume: ok
          ? `${p.resultats.length} ligne(s) traitée(s), chaque résultat relu sur la page publiée.`
          : `Échec sur : ${p.resultats.filter((x) => x.statut === 'echec').map((x) => x.cle).join(', ')}.`,
      });
    }
  };

  // Compare ce que montrent les pages à la ligne, jamais ce que l'agent a déclaré.
  const conclure = async (pages: { site: string; trouve: boolean; verifie: (c: string) => boolean; photo: boolean }[]) => {
    // shortcut: une colonne qu'aucune page ne montre (identifiant, classe énergie) n'est pas comparée ; une valeur fausse sur TOUTES les pages passerait donc, à revoir avec la liste des champs affichés.
    // Une valeur de 1 à 3 lettres (« C ») se retrouve n'importe où dans une page (« Portail C ») : on ne peut pas la vérifier.
    const verifiable = (v: string) => !!v.trim() && (estNombre(v) || v.trim().length > 3);
    const affichees = colonnes.slice(1).filter((c) => verifiable(ligne.valeurs[c] ?? '') && pages.some((x) => x.trouve && x.verifie(c)));
    const etats: Record<string, Etat> = {};
    const ecarts: string[] = [];
    for (const d of destinations) {
      const page = pages.find((x) => x.site.toLowerCase().startsWith(d.site.toLowerCase()));
      if (!page?.trouve) { etats[d.site] = 'absent'; continue; }
      const faux = affichees.filter((c) => !page.verifie(c));
      faux.forEach((c) => ecarts.push(`${d.site}, ${c} : la page n'affiche pas « ${ligne.valeurs[c]} »`));
      // La photo ne bloque pas : chaque site décide s'il en affiche une (A et B n'ont pas de champ photo).
      etats[d.site] = faux.length ? 'faux' : 'ok';
    }
    p.etats = etats;
    const restants = destinations.filter((d) => etats[d.site] !== 'ok');
    if (!restants.length) {
      terminerLigne({ cle: ligne.cle, statut: 'publie', portails: etats });
    } else if ((p.relances ?? 0) < MAX_RELANCES) {
      p.relances = (p.relances ?? 0) + 1;
      p.ecarts = ecarts;
      await lancerAgir(restants, ecarts);
    } else {
      terminerLigne({ cle: ligne.cle, statut: 'echec', portails: etats, raison: ecarts.join(' ; ') || 'Résultat absent.' });
    }
  };

  try {
    if (!data.session_id) {
      await lancerAgir(destinations, []);
    } else {
      const sid = data.session_id;
      if (p.phase === 'agir' && !p.photo) {
        // Le navigateur de la session démarre en quelques secondes : avant, H répond 404. On réessaie au prochain appel.
        const f = await photoBase64(ligne.valeurs[colonnePhoto!]);
        const depose = f ? await deposerFichier(sid, f.nom, f.base64).catch(() => null) : null;
        if (depose) {
          await envoyer(sid, `Quand un site demande une photo, envoie exactement le fichier ${depose.path}. N'en crée et n'en choisis aucune autre.`);
          p.photo = true;
        }
      }
      const st = await statut(sid);
      if (!FINIS.includes(st.status)) {
        maj.etape = p.phase === 'relire' ? 'verification' : 'en_cours';
      } else {
        const ch = await changements(sid);
        p.cout += ch.metrics?.total_cost ?? 0;

        if (p.phase === 'agir') {
          const rep = ch.answer as ReponseAgir | undefined;
          if (rep?.statut === 'signale') {
            terminerLigne({ cle: ligne.cle, statut: 'signale', portails: {}, raison: rep.raison ?? undefined });
          } else {
            // Publications déjà relues comme justes (essai précédent) + celles de cette session.
            p.publications = [...(p.publications ?? []).filter((x) => p.etats?.[x.site] === 'ok'), ...(rep?.publications ?? [])];
            if (p.publications.length) {
              // Relecture par le serveur : on télécharge chaque page publiée. Si une page ne se lit pas sans navigateur, un agent relit.
              const lues = await Promise.all(p.publications.map((x) => relirePage(x.site, x.url)));
              if (lues.every((x) => x.texte)) {
                await conclure(lues.map((x) => ({ site: x.site, trouve: true, verifie: (c: string) => trouveDans(x.texte!, ligne.valeurs[c]), photo: x.photo })));
              } else {
                await lancerRelire();
              }
            } else if ((p.relances ?? 0) < MAX_RELANCES) {
              p.relances = (p.relances ?? 0) + 1; // session morte chez H sans rien publier : on recommence
              await lancerAgir(destinations, []);
            } else {
              terminerLigne({ cle: ligne.cle, statut: 'echec', portails: Object.fromEntries(destinations.map((d) => [d.site, 'absent'])), raison: st.error ?? 'Aucune publication.' });
            }
          }
        } else {
          const pages = (ch.answer as ReponseLire | undefined)?.pages;
          if (!pages && (p.relances ?? 0) < MAX_RELANCES) {
            // La relecture elle-même a échoué : on relit, on ne republie pas.
            p.relances = (p.relances ?? 0) + 1;
            await lancerRelire();
          } else {
            const affiche = (v?: string) => !!v?.trim() && !/non affich/i.test(v);
            await conclure((pages ?? []).map((x) => ({ site: x.site, trouve: x.trouve, verifie: (c: string) => affiche(x.valeurs[c]) && egal(x.valeurs[c], ligne.valeurs[c]), photo: x.photo })));
          }
        }
      }
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // Session impossible à lancer (crédits, agent) : échec net. Sinon erreur passagère : on retente au prochain appel.
    if (!data.session_id) Object.assign(maj, { statut: 'failed', etape: 'terminee', resume: `L'agent n'a pas pu démarrer : ${message}` });
    else maj.resume = message;
  }

  const { data: apres } = await db.from('executions').update({ ...maj, verification: p }).eq('id', id).select('*').single<Execution>();
  return apres!;
}

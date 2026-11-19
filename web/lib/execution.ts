import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { db } from '@/lib/supabase';
import { changements, demarrerSession, deposerFichier, envoyer, session, statut, type ReponseAgent } from '@/lib/h';
import { consigne, correction, mandat, PORTAILS, publieQuelquePart, verifier, type Etat } from '@/lib/annonce';

const MAX_CORRECTIONS = 2;
const MAX_RELANCES = 1;
const FINIS = ['idle', 'completed', 'failed', 'timed_out', 'interrupted'];

export interface ResultatLigne {
  ref: string;
  reussi: boolean;
  portails: Record<string, Etat>;
  raison?: string;
}

// Avancement d'une exécution, gardé dans la colonne `verification` (une session H par bien, l'une après l'autre).
export interface Progres {
  courant: number;
  depuis?: string; // début de la session du bien courant : seules les annonces créées après comptent
  photo?: boolean;
  relances?: number; // nouvelles sessions lancées pour ce bien après une panne chez H
  lien?: string; // écran en direct de l'agent chez H
  cout: number;
  resultats: ResultatLigne[];
}

export interface Execution {
  id: string;
  statut: 'en_cours' | 'completed' | 'failed';
  etape: string;
  lignes: string[];
  session_id: string | null;
  version: number;
  corrections: number;
  verification: Progres | null;
  resume: string | null;
  duree_s: number | null;
  cout_usd: number | null;
  cree_le: string;
}

async function photoBase64(ref: string): Promise<{ nom: string; base64: string }> {
  const dossier = path.join(process.cwd(), 'public', 'photos');
  const nom = await readFile(path.join(dossier, `${ref}.jpg`)).then(() => `${ref}.jpg`, () => 'generique.png');
  return { nom, base64: (await readFile(path.join(dossier, nom))).toString('base64') };
}

// Fait avancer l'exécution d'un cran. Appelée à chaque rafraîchissement : aucun serveur ne tourne en permanence.
export async function avancer(id: string): Promise<Execution> {
  const { data } = await db.from('executions').select('*').eq('id', id).single<Execution>();
  if (!data || data.statut !== 'en_cours') return data!;

  // Verrou : un seul appel à la fois fait avancer l'exécution (deux onglets ne lancent pas deux sessions).
  const { data: pris } = await db
    .from('executions')
    .update({ version: data.version + 1 })
    .eq('id', id)
    .eq('version', data.version)
    .select('id');
  if (!pris?.length) return data;

  const p: Progres = data.verification ?? { courant: 0, cout: 0, resultats: [] };
  const m = mandat(data.lignes[p.courant])!;
  const maj: Partial<Execution> = { resume: null }; // efface l'erreur passagère du tour précédent

  try {
    if (!data.session_id) {
      const s = await demarrerSession(consigne(m), PORTAILS['Portail A'], 3);
      Object.assign(p, { depuis: new Date().toISOString(), photo: false, relances: 0, lien: (await session(s.id)).agent_view_url });
      Object.assign(maj, { session_id: s.id, etape: 'agent_pret', corrections: 0 });
    } else {
      const sid = data.session_id;
      if (!p.photo) {
        // Le navigateur de la session démarre en quelques secondes : avant, H répond 404. On réessaie au prochain appel.
        const f = await photoBase64(m.ref);
        const depose = await deposerFichier(sid, f.nom, f.base64).catch(() => null);
        if (depose) {
          await envoyer(sid, `Pour la photo demandée par le Portail C, envoie exactement le fichier ${depose.path}. C'est la photo du bien : n'en crée et n'en choisis aucune autre.`);
          p.photo = true;
        }
      }
      const st = await statut(sid);
      if (!FINIS.includes(st.status)) {
        maj.etape = 'en_cours';
      } else {
        maj.etape = 'verification';
        const ch = await changements(sid);
        const rep = ch.answer as ReponseAgent | undefined;
        const etats = await verifier(m, p.depuis!);
        const piege = !!m.piege;
        const tout = Object.values(etats).every((e) => e === 'ok');

        const restants = Object.keys(etats).filter((n) => etats[n] !== 'ok');
        if (!piege && !tout && st.status === 'idle' && data.corrections < MAX_CORRECTIONS) {
          await envoyer(sid, await correction(etats, m, p.depuis!));
          Object.assign(maj, { etape: 'en_cours', corrections: data.corrections + 1 });
        } else if (!piege && !tout && st.status !== 'idle' && (p.relances ?? 0) < MAX_RELANCES) {
          // La session est morte chez H (erreur interne, délai) : on sait ce qui manque, on relance sur ces portails seulement.
          const s = await demarrerSession(consigne(m, restants), PORTAILS[restants[0]], restants.length);
          p.cout += ch.metrics?.total_cost ?? 0;
          Object.assign(p, { photo: !restants.includes('Portail C'), relances: (p.relances ?? 0) + 1, lien: (await session(s.id)).agent_view_url });
          Object.assign(maj, { session_id: s.id, etape: 'agent_pret', corrections: 0 });
        } else {
          const reussi = piege ? rep?.statut === 'signale' && !(await publieQuelquePart(m, p.depuis!)) : tout;
          p.resultats.push({ ref: m.ref, reussi, portails: etats, raison: rep?.raison ?? st.error ?? undefined });
          p.cout += ch.metrics?.total_cost ?? 0;
          p.courant += 1;
          maj.session_id = null;
          if (p.courant === data.lignes.length) {
            const ok = p.resultats.every((r) => r.reussi);
            Object.assign(maj, {
              statut: ok ? 'completed' : 'failed',
              etape: 'terminee',
              duree_s: Math.round((Date.now() - Date.parse(data.cree_le)) / 1000),
              cout_usd: Math.round(p.cout * 10000) / 10000,
              resume: ok
                ? `${p.resultats.length} bien(s) traité(s), chaque annonce relue sur les portails.`
                : `Échec sur : ${p.resultats.filter((r) => !r.reussi).map((r) => r.ref).join(', ')}.`,
            });
          }
        }
      }
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // Session impossible à lancer (crédits, clé) : échec net. Sinon erreur passagère : on retente au prochain appel.
    if (!data.session_id) Object.assign(maj, { statut: 'failed', etape: 'terminee', resume: `L'agent n'a pas pu démarrer : ${message}` });
    else maj.resume = message;
  }

  const { data: apres } = await db
    .from('executions')
    .update({ ...maj, verification: p })
    .eq('id', id)
    .select('*')
    .single<Execution>();
  return apres!;
}

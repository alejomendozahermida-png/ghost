'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { minutes, type WorkflowVue } from '@/lib/types';
import { EcranAgent } from '@/components/EcranAgent';
import { Logo } from '@/components/Logo';
import { boutonPrincipal } from '@/components/PageEntete';
import { ChargementSimple } from '@/components/Preparation';

const champ = 'w-full rounded-xl border border-champ bg-surface px-4 py-3 text-[15px] outline-none transition focus:border-nuit';
const LONG = /description|texte|message|commentaire/i;

const ETAPES = ['Demande reçue', 'Agent prêt', 'Agent en cours', 'Vérification', 'Terminé'];
const INDEX: Record<string, number> = { recue: 0, lecture: 1, agent_pret: 1, en_cours: 2, verification: 3, terminee: 4 };
const ETAT: Record<string, string> = { faux: 'valeur fausse', absent: 'absente' };
const PHRASE: Record<string, string> = {
  recue: 'Ghost prépare la demande…',
  lecture: 'L’agent ouvre votre source et lit les lignes…',
  agent_pret: 'L’agent démarre son navigateur…',
  en_cours: 'L’agent travaille sur les sites…',
  verification: 'Ghost relit les pages publiées…',
};

interface Suivi {
  statut: 'en_cours' | 'completed' | 'failed';
  etape: string;
  courant: number;
  lignes: { cle: string; valeurs: Record<string, string> }[];
  phases: ('agir' | 'relire' | null)[];
  resultats: { cle: string; statut: 'publie' | 'signale' | 'echec'; portails: Record<string, string>; raison?: string }[];
  lien_session_h: string | null;
  resume: string | null;
  duree_s: number | null;
  cout_usd: number | null;
  cree_le: string;
}

export default function Lancer({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ execution?: string }> }) {
  const { id } = use(params);
  const { execution } = use(searchParams);
  const router = useRouter();
  const [w, setW] = useState<WorkflowVue | null>(null);
  const [choix, setChoix] = useState<string[]>([]);
  const [saisie, setSaisie] = useState<Record<string, string>>({});
  const [texte, setTexte] = useState('');
  const [consigne, setConsigne] = useState('');
  const [lecture, setLecture] = useState(false);
  const [cle] = useState(() => crypto.randomUUID()); // même clé si on relance : pas de doublon
  const [execId, setExecId] = useState<string | null>(execution ?? null); // ?execution= : on rejoint une exécution déjà lancée
  const [suivi, setSuivi] = useState<Suivi | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [maintenant, setMaintenant] = useState(0);

  useEffect(() => {
    fetch(`/api/workflows/${id}`).then((r) => r.json()).then(setW);
  }, [id]);

  useEffect(() => {
    if (!execId || suivi?.statut === 'completed' || suivi?.statut === 'failed') return;
    let actif = true;
    const lire = async () => {
      const r = await fetch(`/api/executions/${execId}`);
      if (actif && r.ok) setSuivi(await r.json());
    };
    lire();
    const i = setInterval(lire, 2000);
    const t = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => {
      actif = false;
      clearInterval(i);
      clearInterval(t);
    };
  }, [execId, suivi?.statut]);

  if (!w) return <ChargementSimple />;

  const sites = (w.destinations ?? []).map((d) => d.site);
  const source = w.source ?? 'sheet';
  const [, colTitre, ...autres] = w.colonnes;
  const detail = autres.filter((c) => !/photo|image|description/i.test(c)).slice(0, 3);
  const champs = [...new Set((w.procedure?.champs ?? []).map((c) => c.colonne))];
  // Les lignes envoyées, quelle que soit leur origine : le suivi les affiche de la même façon.
  const lignes =
    source === 'lecture' ? suivi?.lignes ?? []
    : source === 'aucune' ? [{ cle: 'Exécution', valeurs: {} as Record<string, string> }]
    : source === 'formulaire' ? [{ cle: 'Saisie 1', valeurs: saisie }]
    : w.lignes.filter((l) => choix.includes(l.cle));
  const titre = (l: { cle: string; valeurs: Record<string, string> }) =>
    (source === 'sheet' && colTitre ? l.valeurs[colTitre] : null)
    || Object.entries(l.valeurs).find(([c, v]) => /titre|intitul|nom|objet/i.test(c) && v?.trim())?.[1]
    || Object.entries(l.valeurs).find(([c, v]) => !/photo|image/i.test(c) && v?.trim() && v !== l.cle)?.[1]
    || w.nom;
  const pret = source === 'aucune' || source === 'lecture' || (source === 'formulaire' ? Object.values(saisie).some((v) => v.trim()) : lignes.length > 0);

  async function lancer() {
    setEnvoi(true);
    setErreur(null);
    const r = await fetch('/api/executions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflow_id: id, cles: choix, saisies: source === 'formulaire' ? [saisie] : undefined, consigne, cle_demande: cle }),
    }).catch(() => null);
    const corps = r ? await r.json().catch(() => ({})) : {};
    if (r?.ok) {
      setExecId(corps.id);
      router.replace(`/workflows/${id}/lancer?execution=${corps.id}`); // l'adresse permet de revenir sur ce suivi plus tard
    }
    else setErreur(corps.erreur ?? 'Le service ne répond pas. Réessayez dans un instant.');
    setEnvoi(false);
  }

  async function remplir() {
    setLecture(true);
    setErreur(null);
    const r = await fetch(`/api/workflows/${id}/extraire`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texte }) }).catch(() => null);
    const corps = r ? await r.json().catch(() => ({})) : {};
    if (r?.ok) setSaisie({ ...saisie, ...Object.fromEntries(Object.entries(corps.valeurs as Record<string, string>).filter(([, v]) => v)) });
    else setErreur(corps.erreur ?? 'Ghost n’a pas pu lire ce texte. Remplissez les champs à la main.');
    setLecture(false);
  }

  const TITRES = { lecture: 'Quelles lignes faire ?', sheet: 'Quelles lignes traiter ?', formulaire: 'Avec quelles données ?', aucune: 'Lancer la tâche' };
  const SOUS_TITRES = {
    lecture: `L’agent ouvre lui-même ${w.source_nom ? `« ${w.source_nom} »` : 'votre source'} dans son navigateur, lit les lignes, puis les fait sur ${sites.join(', ')}.`,
    sheet: `Les lignes de votre Google Sheet. L’agent les fait sur ${sites.join(', ')}.`,
    formulaire: `L’agent fait la tâche sur ${sites.join(', ')} avec ces valeurs. Collez un texte, Ghost remplit les champs ; vous relisez avant de lancer.`,
    aucune: `L’agent refait la tâche telle que vous l’avez faite, sur ${sites.join(', ')}.`,
  };

  if (!execId) {
    return (
      <section className="mx-auto max-w-2xl pt-10">
        <Link href={`/workflows/${id}`} className="lien text-sm text-discret first-letter:uppercase">{w.nom}</Link>
        <h1 className="monter mt-4 text-4xl font-bold tracking-[-0.03em]">{TITRES[source]}</h1>
        <p className="monter mt-3 text-lg text-texte [animation-delay:80ms]">{SOUS_TITRES[source]}</p>

        {source === 'sheet' && w.lignes.length === 0 && (
          <div role="alert" className="monter mt-10 rounded-2xl border border-alerte/30 bg-alerte-clair px-6 py-5 [animation-delay:160ms]">
            <p className="text-[15px] font-semibold text-alerte">Ghost ne trouve aucune ligne dans votre Google Sheet.</p>
            <p className="mt-1 text-[15px] text-texte">
              Vérifiez son lien sur la fiche : il doit s’ouvrir pour « Tous les utilisateurs disposant du lien ».{' '}
              <Link href={`/workflows/${id}`} className="lien font-medium text-nuit">Corriger le lien</Link>
            </p>
          </div>
        )}

        {source === 'sheet' && (
          <fieldset className="monter mt-10 divide-y divide-trait border-y border-trait [animation-delay:160ms]">
            <legend className="sr-only">Lignes à traiter</legend>
            {w.lignes.map((l) => (
              <label key={l.cle} className="flex cursor-pointer items-center gap-5 py-5 transition-colors hover:bg-surface/70">
                <input
                  type="checkbox"
                  checked={choix.includes(l.cle)}
                  onChange={(e) => setChoix(e.target.checked ? [...choix, l.cle] : choix.filter((r) => r !== l.cle))}
                  className="h-5 w-5 accent-nuit"
                />
                <span className="flex-1">
                  <span className="block text-[15px] font-medium text-encre">{colTitre ? l.valeurs[colTitre] : l.cle}</span>
                  <span className="mt-0.5 block text-sm text-texte">{detail.map((c) => l.valeurs[c]).filter(Boolean).join(' · ')}</span>
                </span>
                <span className="font-mono text-sm text-discret">{l.cle}</span>
              </label>
            ))}
          </fieldset>
        )}

        {source === 'lecture' && (
          <div className="monter mt-10 [animation-delay:160ms]">
            <label htmlFor="consigne" className="text-sm font-semibold text-encre">Lignes à faire</label>
            <input
              id="consigne"
              value={consigne}
              onChange={(e) => setConsigne(e.target.value)}
              placeholder="Les lignes pas encore faites"
              className={`${champ} mt-2`}
            />
            <p className="mt-2 text-sm text-discret">Laissez vide pour les nouvelles lignes, ou précisez : « M-0143 et M-0144 », « les biens de Lyon ».</p>
          </div>
        )}

        {source === 'formulaire' && (
          <div className="monter mt-10 space-y-8 [animation-delay:160ms]">
            <div className="rounded-2xl bg-surface p-6 shadow-[0_1px_0_#e6e6e1]">
              <label htmlFor="texte" className="text-sm font-semibold text-encre">Remplir à partir d’un texte</label>
              <textarea
                id="texte"
                rows={3}
                value={texte}
                onChange={(e) => setTexte(e.target.value)}
                placeholder="Ex. : appartement 3 pièces rue des Lilas à Lyon, 68 m², 315 000 €"
                className={`${champ} mt-2 resize-y`}
              />
              <button onClick={remplir} disabled={!texte.trim() || lecture} className="bouton mt-3 rounded-full border border-trait bg-surface px-5 py-2.5 text-sm font-semibold hover:border-encre/30 disabled:opacity-40">
                {lecture ? 'Lecture…' : 'Remplir les champs'}
              </button>
            </div>
            <fieldset className="grid gap-5 md:grid-cols-2">
              <legend className="sr-only">Valeurs de la tâche</legend>
              {champs.map((c, i) => (
                <div key={c} className={LONG.test(c) ? 'md:col-span-2' : ''}>
                  <label htmlFor={`champ-${i}`} className="text-sm font-medium">{c}</label>
                  {LONG.test(c) ? (
                    <textarea id={`champ-${i}`} rows={4} value={saisie[c] ?? ''} onChange={(e) => setSaisie({ ...saisie, [c]: e.target.value })} className={`${champ} mt-2 resize-y`} />
                  ) : (
                    <input id={`champ-${i}`} value={saisie[c] ?? ''} onChange={(e) => setSaisie({ ...saisie, [c]: e.target.value })} className={`${champ} mt-2`} />
                  )}
                </div>
              ))}
            </fieldset>
          </div>
        )}

        <div className="mt-10 flex flex-wrap items-center justify-between gap-6">
          <p className="text-sm text-texte">
            {source !== 'sheet' ? '' : w.gain.agent_s ? `Environ ${minutes(lignes.length * w.gain.agent_s)} pour ${lignes.length} ligne(s).` : `${lignes.length} ligne(s) choisie(s).`}
          </p>
          <button disabled={!pret || envoi} onClick={lancer} className={boutonPrincipal}>
            {envoi ? 'Envoi…' : 'Lancer l’agent'}
          </button>
        </div>
        {erreur && <p role="alert" className="monter mt-6 text-[15px] text-alerte">{erreur}</p>}
      </section>
    );
  }

  const etape = suivi ? INDEX[suivi.etape] ?? 0 : 0;
  const fini = suivi?.statut === 'completed' || suivi?.statut === 'failed';
  const ecoule = suivi?.duree_s ?? (suivi && maintenant ? Math.max(0, Math.round((maintenant - Date.parse(suivi.cree_le)) / 1000)) : 0);

  return (
    <section className="mx-auto max-w-5xl pt-10">
      <div className="flex items-center gap-5">
        {fini && <Logo taille={64} anime humeur={suivi?.statut === 'completed' ? 'joie' : 'souci'} decoratif />}
        <h1 className="text-4xl font-semibold tracking-[-0.02em]">
          {!fini ? 'L’agent travaille' : suivi?.statut === 'completed' ? 'Terminé' : 'Terminé avec des erreurs'}
        </h1>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-6">
        <p className="font-mono text-[15px] text-discret">{minutes(ecoule)}</p>
        {suivi?.lien_session_h && !fini && (
          <a href={suivi.lien_session_h} target="_blank" rel="noreferrer" className="lien text-sm font-medium text-nuit">Regarder l’agent travailler</a>
        )}
        {!fini && (
          <p className="text-sm text-texte">
            Vous pouvez quitter cette page : l’agent continue seul.{' '}
            <Link href="/workflows" className="lien font-medium text-nuit">Lancer un autre workflow</Link>
          </p>
        )}
      </div>

      {!fini && (
        <div className="mt-10">
          <EcranAgent executionId={execId} actif={!fini} phrase={PHRASE[suivi?.etape ?? 'recue'] ?? PHRASE.en_cours} />
        </div>
      )}

      <ol className="mt-10 grid grid-cols-5 gap-2" aria-label="Avancement">
        {ETAPES.map((e, i) => (
          <li key={e} aria-current={i === etape ? 'step' : undefined}>
            <div className="h-1 overflow-hidden rounded-full bg-trait">
              <div className={`h-1 rounded-full bg-nuit transition-[width] duration-700 ease-[var(--ease-doux)] ${i < etape || fini ? 'w-full' : i === etape ? 'w-1/2' : 'w-0'}`} />
            </div>
            {/* Sur téléphone, seule l'étape en cours garde son libellé : cinq libellés ne tiennent pas sur une ligne. */}
            <p className={`mt-3 text-sm ${i <= etape ? 'font-medium text-encre' : 'text-discret'} ${i === etape || fini ? '' : 'hidden sm:block'}`}>{e}</p>
          </li>
        ))}
      </ol>

      <p role="status" className="sr-only">{fini ? suivi?.resume : `Étape : ${ETAPES[etape]}`}</p>
      <ul className="mt-14 divide-y divide-trait border-y border-trait">
        {(suivi?.lignes?.length ? suivi.lignes : lignes).map((l, i) => {
          const res = suivi?.resultats.find((r) => r.cle === l.cle);
          const enCours = !res && !fini && !!suivi?.phases?.[i];
          return (
            <li key={l.cle} className="grid gap-4 py-6 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="text-[15px] font-medium">{titre(l)}</p>
                <p className={`mt-1 text-sm ${res?.statut === 'signale' ? 'text-succes' : res?.statut === 'echec' ? 'text-alerte' : 'text-texte'}`}>
                  {res?.statut === 'signale' ? `Non fait, l’agent a refusé : ${res.raison}` : res?.statut === 'echec' ? res.raison : enCours ? (suivi?.phases?.[i] === 'relire' ? 'Relecture…' : 'En cours…') : res ? (Object.keys(l.valeurs).length ? 'Fait et relu sur chaque site.' : 'Fait.') : 'En attente'}
                </p>
              </div>
              {res?.statut !== 'signale' && (
                <ul className="flex flex-wrap gap-2">
                  {sites.map((d) => {
                    const e = res?.portails[d];
                    return (
                      <li key={d} className={`rounded-full px-3.5 py-1.5 text-sm transition-colors duration-500 ${e === 'ok' ? 'bg-succes-clair text-succes' : e ? 'bg-alerte-clair text-alerte' : 'bg-trait/60 text-discret'}`}>
                        {e === 'ok' ? '✓ ' : ''}{d}{e && e !== 'ok' ? ` : ${ETAT[e] ?? e}` : ''}
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {fini && (
        <div className="monter mt-10 flex flex-wrap items-center justify-between gap-6">
          <p className="text-[15px] text-texte">{suivi?.resume} {suivi?.cout_usd != null && `Coût : ${suivi.cout_usd.toFixed(2)} $.`}</p>
          <Link href={`/workflows/${id}`} className="bouton rounded-full border border-trait bg-surface px-6 py-3 text-sm font-medium hover:border-encre/30">Retour au workflow</Link>
        </div>
      )}
    </section>
  );
}

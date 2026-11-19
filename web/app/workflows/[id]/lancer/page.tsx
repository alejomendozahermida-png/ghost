'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { minutes, WORKFLOW_DEMO as w, WORKFLOW_DEMO_UUID } from '@/lib/demo';

const ETAPES = ['Demande reçue', 'Agent prêt', 'Agent en cours', 'Vérification', 'Terminé'];
const INDEX: Record<string, number> = { recue: 0, agent_pret: 1, en_cours: 2, verification: 3, terminee: 4 };
const PRIX = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const ETAT: Record<string, string> = { faux: 'champ faux', absent: 'absente', sans_photo: 'sans photo' };

interface Suivi {
  statut: 'en_cours' | 'completed' | 'failed';
  etape: string;
  courant: number;
  resultats: { ref: string; reussi: boolean; portails: Record<string, string>; raison?: string }[];
  lien_session_h: string | null;
  resume: string | null;
  duree_s: number | null;
  cout_usd: number | null;
  cree_le: string;
}

export default function Lancer() {
  const [choix, setChoix] = useState<string[]>(w.lignes.slice(0, 1).map((l) => l.ref));
  const [cle] = useState(() => crypto.randomUUID()); // même clé si on relance : pas de doublon
  const [execId, setExecId] = useState<string | null>(null);
  const [suivi, setSuivi] = useState<Suivi | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [maintenant, setMaintenant] = useState(0);
  const lignes = w.lignes.filter((l) => choix.includes(l.ref));

  useEffect(() => {
    if (!execId || suivi?.statut === 'completed' || suivi?.statut === 'failed') return;
    let actif = true;
    const lire = async () => {
      const r = await fetch(`/api/executions/${execId}`);
      if (actif && r.ok) setSuivi(await r.json());
    };
    lire();
    const i = setInterval(lire, 3000);
    const t = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => {
      actif = false;
      clearInterval(i);
      clearInterval(t);
    };
  }, [execId, suivi?.statut]);

  async function lancer() {
    setEnvoi(true);
    setErreur(null);
    const r = await fetch('/api/executions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflow_id: WORKFLOW_DEMO_UUID, refs: choix, cle_demande: cle }),
    }).catch(() => null);
    const corps = r ? await r.json().catch(() => ({})) : {};
    if (r?.ok) setExecId(corps.id);
    else setErreur(corps.erreur ?? 'Le service ne répond pas. Réessayez dans un instant.');
    setEnvoi(false);
  }

  if (!execId) {
    return (
      <section className="mx-auto max-w-2xl pt-10">
        <Link href={`/workflows/${w.id}`} className="lien text-sm text-discret">{w.nom}</Link>
        <h1 className="monter mt-4 text-4xl font-semibold tracking-[-0.02em]">Quels biens publier ?</h1>
        <p className="monter mt-3 text-lg text-texte [animation-delay:80ms]">Les lignes de votre Google Sheet qui ne sont pas encore publiées.</p>

        <fieldset className="monter mt-10 divide-y divide-trait border-y border-trait [animation-delay:160ms]">
          <legend className="sr-only">Biens à publier</legend>
          {w.lignes.map((l) => (
            <label key={l.ref} className="flex cursor-pointer items-center gap-5 py-5 transition-colors hover:bg-surface/70">
              <input
                type="checkbox"
                checked={choix.includes(l.ref)}
                onChange={(e) => setChoix(e.target.checked ? [...choix, l.ref] : choix.filter((r) => r !== l.ref))}
                className="h-5 w-5 accent-nuit"
              />
              <span className="flex-1">
                <span className="block text-[15px] font-medium text-encre">{l.titre}</span>
                <span className="mt-0.5 block text-sm text-texte">{l.ville} · {l.surface_m2} m² · {PRIX.format(l.prix)}</span>
              </span>
              <span className="font-mono text-sm text-discret">{l.ref}</span>
            </label>
          ))}
        </fieldset>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-6">
          <p className="text-sm text-texte">
            Environ {minutes(lignes.length * w.gain.agent_s)} pour {lignes.length} bien{lignes.length > 1 ? 's' : ''} sur 3 portails.
          </p>
          <button
            disabled={lignes.length === 0 || envoi}
            onClick={lancer}
            className="bouton rounded-full bg-nuit px-8 py-3.5 text-[15px] font-medium text-white hover:shadow-[0_10px_30px_-10px_rgb(11_29_69/0.6)] disabled:pointer-events-none disabled:opacity-40"
          >
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
    <section className="mx-auto max-w-3xl pt-10">
      <h1 className="text-4xl font-semibold tracking-[-0.02em]">
        {!fini ? 'L’agent travaille' : suivi?.statut === 'completed' ? 'Terminé' : 'Terminé avec des erreurs'}
      </h1>
      <div className="mt-3 flex flex-wrap items-center gap-6">
        <p className="font-mono text-[15px] text-discret">{minutes(ecoule)}</p>
        {suivi?.lien_session_h && !fini && (
          <a href={suivi.lien_session_h} target="_blank" rel="noreferrer" className="lien text-sm font-medium text-nuit">
            Regarder l’agent travailler
          </a>
        )}
      </div>

      <ol className="mt-10 grid grid-cols-5 gap-2" aria-label="Avancement">
        {ETAPES.map((e, i) => (
          <li key={e} aria-current={i === etape ? 'step' : undefined}>
            <div className="h-1 overflow-hidden rounded-full bg-trait">
              <div className={`h-1 rounded-full bg-nuit transition-[width] duration-700 ease-[var(--ease-doux)] ${i < etape || fini ? 'w-full' : i === etape ? 'w-1/2' : 'w-0'}`} />
            </div>
            <p className={`mt-3 text-sm ${i <= etape ? 'font-medium text-encre' : 'text-discret'}`}>{e}</p>
          </li>
        ))}
      </ol>

      <ul className="mt-14 divide-y divide-trait border-y border-trait">
        {lignes.map((l, i) => {
          const res = suivi?.resultats.find((r) => r.ref === l.ref);
          const enCours = !res && suivi?.courant === i && !fini;
          return (
            <li key={l.ref} className="grid gap-4 py-6 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="text-[15px] font-medium">{l.titre}</p>
                {res && l.piege ? (
                  <p className={`monter mt-1 text-sm ${res.reussi ? 'text-succes' : 'text-alerte'}`}>
                    {res.reussi ? `Non publié : ${l.piege.toLowerCase()}. L’agent a refusé, comme prévu.` : 'Le contrôle n’a pas bloqué ce bien.'}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-texte">{enCours ? 'En cours…' : res ? `${l.ville} · ${PRIX.format(l.prix)}` : 'En attente'}</p>
                )}
              </div>
              {!l.piege && (
                <ul className="flex flex-wrap gap-2">
                  {w.destinations.map((d) => {
                    const e = res?.portails[d];
                    return (
                      <li
                        key={d}
                        className={`rounded-full px-3.5 py-1.5 text-sm transition-colors duration-500 ${
                          e === 'ok' ? 'bg-succes-clair text-succes' : e ? 'bg-alerte-clair text-alerte' : 'bg-trait/60 text-discret'
                        }`}
                      >
                        {e === 'ok' ? '✓ ' : ''}{d}{e && e !== 'ok' ? ` : ${ETAT[e]}` : ''}
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
          <p className="text-[15px] text-texte">
            {suivi?.resume} {suivi?.cout_usd != null && `Coût : ${suivi.cout_usd.toFixed(2)} $.`}
          </p>
          <Link href={`/workflows/${w.id}`} className="bouton rounded-full border border-trait bg-surface px-6 py-3 text-sm font-medium hover:border-encre/30">
            Retour au workflow
          </Link>
        </div>
      )}
    </section>
  );
}

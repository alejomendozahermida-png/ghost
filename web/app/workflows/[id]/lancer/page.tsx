'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { minutes, type WorkflowVue } from '@/lib/types';

const ETAPES = ['Demande reçue', 'Agent prêt', 'Agent en cours', 'Vérification', 'Terminé'];
const INDEX: Record<string, number> = { recue: 0, agent_pret: 1, en_cours: 2, verification: 3, terminee: 4 };
const ETAT: Record<string, string> = { faux: 'valeur fausse', absent: 'absente' };

interface Suivi {
  statut: 'en_cours' | 'completed' | 'failed';
  etape: string;
  courant: number;
  resultats: { cle: string; statut: 'publie' | 'signale' | 'echec'; portails: Record<string, string>; raison?: string }[];
  lien_session_h: string | null;
  resume: string | null;
  duree_s: number | null;
  cout_usd: number | null;
  cree_le: string;
}

export default function Lancer({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [w, setW] = useState<WorkflowVue | null>(null);
  const [choix, setChoix] = useState<string[]>([]);
  const [cle] = useState(() => crypto.randomUUID()); // même clé si on relance : pas de doublon
  const [execId, setExecId] = useState<string | null>(null);
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
    const i = setInterval(lire, 3000);
    const t = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => {
      actif = false;
      clearInterval(i);
      clearInterval(t);
    };
  }, [execId, suivi?.statut]);

  if (!w) return <p className="pt-16 text-[15px] text-discret">Chargement du workflow…</p>;

  const sites = (w.destinations ?? []).map((d) => d.site);
  const [, colTitre, ...autres] = w.colonnes;
  const detail = autres.filter((c) => !/photo|image|description/i.test(c)).slice(0, 3);
  const lignes = w.lignes.filter((l) => choix.includes(l.cle));

  async function lancer() {
    setEnvoi(true);
    setErreur(null);
    const r = await fetch('/api/executions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflow_id: id, cles: choix, cle_demande: cle }),
    }).catch(() => null);
    const corps = r ? await r.json().catch(() => ({})) : {};
    if (r?.ok) setExecId(corps.id);
    else setErreur(corps.erreur ?? 'Le service ne répond pas. Réessayez dans un instant.');
    setEnvoi(false);
  }

  if (!execId) {
    return (
      <section className="mx-auto max-w-2xl pt-10">
        <Link href={`/workflows/${id}`} className="lien text-sm text-discret first-letter:uppercase">{w.nom}</Link>
        <h1 className="monter mt-4 text-4xl font-semibold tracking-[-0.02em]">Quelles lignes traiter ?</h1>
        <p className="monter mt-3 text-lg text-texte [animation-delay:80ms]">Les lignes de votre Google Sheet. L’agent les fait sur {sites.join(', ')}.</p>

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

        <div className="mt-10 flex flex-wrap items-center justify-between gap-6">
          <p className="text-sm text-texte">
            {w.gain.agent_s ? `Environ ${minutes(lignes.length * w.gain.agent_s)} pour ${lignes.length} ligne(s).` : `${lignes.length} ligne(s) choisie(s).`}
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
          <a href={suivi.lien_session_h} target="_blank" rel="noreferrer" className="lien text-sm font-medium text-nuit">Regarder l’agent travailler</a>
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
          const res = suivi?.resultats.find((r) => r.cle === l.cle);
          const enCours = !res && suivi?.courant === i && !fini;
          return (
            <li key={l.cle} className="grid gap-4 py-6 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="text-[15px] font-medium">{colTitre ? l.valeurs[colTitre] : l.cle}</p>
                <p className={`mt-1 text-sm ${res?.statut === 'signale' ? 'text-succes' : res?.statut === 'echec' ? 'text-alerte' : 'text-texte'}`}>
                  {res?.statut === 'signale' ? `Non fait, l’agent a refusé : ${res.raison}` : res?.statut === 'echec' ? res.raison : enCours ? 'En cours…' : res ? 'Fait et relu sur chaque site.' : 'En attente'}
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

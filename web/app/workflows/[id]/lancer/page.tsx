'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { minutes, WORKFLOW_DEMO as w, type Bien } from '@/lib/demo';

const ETAPES = ['Demande reçue', 'Agent prêt', 'Agent en cours', 'Vérification', 'Terminé'];
const PRIX = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

// shortcut: exécution simulée (une étape toutes les quelques secondes) ; remplacée par le suivi réel de la session H.
function useSimulation(actif: boolean, lignes: Bien[]) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!actif) return;
    const i = setInterval(() => setT((x) => x + 1), 1000);
    return () => clearInterval(i);
  }, [actif]);
  const parLigne = 9;
  const fin = 6 + lignes.length * parLigne + 3;
  const etape = t < 2 ? 0 : t < 6 ? 1 : t < fin - 3 ? 2 : t < fin ? 3 : 4;
  // Nombre de portails vérifiés pour la ligne i à l'instant t
  const verifies = (i: number) => Math.max(0, Math.min(3, Math.floor((t - 6 - i * parLigne) / 3) + 1));
  return { t, etape, verifies, termine: t >= fin };
}

export default function Lancer() {
  const [choix, setChoix] = useState<string[]>(w.lignes.slice(0, 2).map((l) => l.ref));
  const [lance, setLance] = useState(false);
  const lignes = w.lignes.filter((l) => choix.includes(l.ref));
  const { t, etape, verifies, termine } = useSimulation(lance, lignes);

  if (!lance) {
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
            disabled={lignes.length === 0}
            onClick={() => setLance(true)}
            className="bouton rounded-full bg-nuit px-8 py-3.5 text-[15px] font-medium text-white hover:shadow-[0_10px_30px_-10px_rgb(11_29_69/0.6)] disabled:pointer-events-none disabled:opacity-40"
          >
            Lancer l’agent
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl pt-10">
      <h1 className="text-4xl font-semibold tracking-[-0.02em]">
        {termine ? 'Terminé' : 'L’agent travaille'}
      </h1>
      <p className="mt-3 font-mono text-[15px] text-discret">{minutes(t)}</p>

      <ol className="mt-10 grid grid-cols-5 gap-2" aria-label="Avancement">
        {ETAPES.map((e, i) => (
          <li key={e} aria-current={i === etape ? 'step' : undefined}>
            <div className="h-1 overflow-hidden rounded-full bg-trait">
              <div className={`h-1 rounded-full bg-nuit transition-[width] duration-700 ease-[var(--ease-doux)] ${i < etape || termine ? 'w-full' : i === etape ? 'w-1/2' : 'w-0'}`} />
            </div>
            <p className={`mt-3 text-sm ${i <= etape ? 'font-medium text-encre' : 'text-discret'}`}>{e}</p>
          </li>
        ))}
      </ol>

      <ul className="mt-14 divide-y divide-trait border-y border-trait">
        {lignes.map((l, i) => {
          const n = verifies(i);
          return (
            <li key={l.ref} className="grid gap-4 py-6 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="text-[15px] font-medium">{l.titre}</p>
                {l.piege && n > 0 ? (
                  <p className="monter mt-1 text-sm text-alerte">Non publié : {l.piege.toLowerCase()}. L’agent a refusé, comme prévu.</p>
                ) : (
                  <p className="mt-1 text-sm text-texte">{l.ville} · {PRIX.format(l.prix)}</p>
                )}
              </div>
              {!l.piege && (
                <ul className="flex gap-2">
                  {w.destinations.map((d, j) => (
                    <li
                      key={d}
                      className={`rounded-full px-3.5 py-1.5 text-sm transition-colors duration-500 ${j < n ? 'bg-succes-clair text-succes' : 'bg-trait/60 text-discret'}`}
                    >
                      {j < n ? '✓ ' : ''}{d}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {termine && (
        <div className="monter mt-10 flex flex-wrap items-center justify-between gap-6">
          <p className="text-[15px] text-texte">
            Chaque annonce a été relue sur le portail avant d’être cochée.
          </p>
          <Link href={`/workflows/${w.id}`} className="bouton rounded-full border border-trait bg-surface px-6 py-3 text-sm font-medium hover:border-encre/30">
            Retour au workflow
          </Link>
        </div>
      )}
    </section>
  );
}

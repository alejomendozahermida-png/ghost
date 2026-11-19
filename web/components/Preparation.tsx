'use client';

import { useEffect, useState } from 'react';
import { Logo } from '@/components/Logo';

// Ce que fait le serveur pendant la préparation, dans l'ordre. L'avancement est estimé au temps (environ 4 s par étape) :
// la dernière étape reste active jusqu'à la réponse, elle ne se déclare jamais finie toute seule.
const ETAPES = ['Ghost relit votre observation', 'Il rédige la procédure', 'Il vérifie les adresses', 'Il crée l’agent'];
const PAS_MS = 4000;

export function Preparation({ titre }: { titre: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((x) => Math.min(x + 1, ETAPES.length - 1)), PAS_MS);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="grid gap-12 pt-10 md:grid-cols-[1.5fr_1fr]" aria-busy="true">
      <div>
        <div className="attente h-4 w-28 rounded" />
        <div className="flex items-center gap-5">
          <Logo taille={64} anime humeur="travaille" decoratif />
          <h1 className="mt-4 text-3xl font-bold tracking-[-0.03em] md:text-4xl">{titre}</h1>
        </div>
        <ol className="mt-10 space-y-4" aria-live="polite">
          {ETAPES.map((e, i) => (
            <li key={e} className={`flex items-center gap-4 text-[15px] transition-colors duration-500 ${i < n ? 'text-succes' : i === n ? 'font-semibold text-encre' : 'text-discret'}`}>
              <span aria-hidden="true" className={`grid h-6 w-6 place-items-center rounded-full text-xs ${i < n ? 'bg-succes-clair' : i === n ? 'pulse-doux bg-nuit text-white' : 'bg-trait'}`}>
                {i < n ? '✓' : i + 1}
              </span>
              <span>{e}{i === n ? '…' : ''}</span>
            </li>
          ))}
        </ol>
        <div className="mt-12 space-y-3">
          {[0, 1, 2].map((i) => <div key={i} className="attente h-16 rounded-2xl" />)}
        </div>
      </div>
      <div className="attente hidden h-80 rounded-3xl md:block" />
    </section>
  );
}

export function ChargementSimple() {
  return (
    <section className="mx-auto max-w-2xl space-y-4 pt-10" aria-busy="true">
      <div className="attente h-4 w-40 rounded" />
      <div className="attente h-10 w-3/4 rounded-xl" />
      <div className="attente h-5 w-full rounded" />
      <div className="mt-8 space-y-3">{[0, 1, 2].map((i) => <div key={i} className="attente h-16 rounded-2xl" />)}</div>
    </section>
  );
}

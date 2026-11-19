'use client';

import Link from 'next/link';
import { useState } from 'react';
import { minutes, WORKFLOW_DEMO as w } from '@/lib/demo';

// Source à gauche, destinations à droite, reliées par des courbes où passent des impulsions.
function Trajet() {
  const ys = [36, 100, 164];
  return (
    <svg viewBox="0 0 560 200" className="w-full" role="img" aria-label={`${w.source} vers ${w.destinations.join(', ')}`}>
      {ys.map((y) => (
        <g key={y}>
          <path d={`M150 100 C 260 100, 300 ${y}, 400 ${y}`} fill="none" stroke="#e6e6e1" strokeWidth="2" />
          <path d={`M150 100 C 260 100, 300 ${y}, 400 ${y}`} fill="none" stroke="#0b1d45" strokeWidth="2" className="flux" />
        </g>
      ))}
      <rect x="0" y="78" width="150" height="44" rx="22" fill="#0b1d45" />
      <text x="75" y="105" textAnchor="middle" fontSize="14" fontWeight="500" fill="#fff">{w.source}</text>
      {w.destinations.map((d, i) => (
        <g key={d}>
          <rect x="400" y={ys[i] - 20} width="160" height="40" rx="20" fill="#fff" stroke="#e6e6e1" />
          <text x="480" y={ys[i] + 5} textAnchor="middle" fontSize="14" fontWeight="500" fill="#0b1220">{d}</text>
        </g>
      ))}
    </svg>
  );
}

export default function FicheWorkflow() {
  const [veille, setVeille] = useState(false);
  const part = Math.round((w.gain.agent_s / w.gain.manuel_s) * 100);

  return (
    <div className="grid gap-16 pt-10 md:grid-cols-[1.5fr_1fr]">
      <article>
        <Link href="/observer" className="lien text-sm text-discret">Observation</Link>
        <h1 className="monter mt-4 text-4xl font-semibold leading-tight tracking-[-0.02em] md:text-5xl">{w.nom}</h1>
        <p className="monter mt-3 text-lg text-texte [animation-delay:80ms]">
          Repéré {w.occurrences} fois pendant votre observation.
        </p>

        <div className="monter mt-12 [animation-delay:160ms]">
          <Trajet />
        </div>

        <h2 className="mt-14 text-sm font-medium uppercase tracking-[0.14em] text-discret">Ce que Ghost a compris</h2>
        <ol className="mt-4 divide-y divide-trait border-y border-trait">
          {w.etapes.map((e, i) => (
            <li key={e.texte} className="flex gap-6 py-5">
              <span className="font-mono text-sm text-discret">{i + 1}</span>
              <div>
                <p className="text-sm font-medium text-nuit">{e.site}</p>
                <p className="mt-1 text-[15px] text-texte">{e.texte}</p>
              </div>
            </li>
          ))}
        </ol>

        <h2 className="mt-14 text-sm font-medium uppercase tracking-[0.14em] text-discret">Ce qui change à chaque fois</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {w.donnees.map((d) => (
            <li key={d} className="rounded-full border border-trait bg-surface px-4 py-2 text-sm text-encre">{d}</li>
          ))}
        </ul>

        <h2 className="mt-14 text-sm font-medium uppercase tracking-[0.14em] text-discret">Les règles de l’agent</h2>
        <ul className="mt-4 space-y-3 text-[15px] text-texte">
          {w.regles.map((r) => (
            <li key={r} className="border-l-2 border-nuit/20 pl-4">{r}</li>
          ))}
        </ul>
      </article>

      <aside className="md:sticky md:top-10 md:self-start">
        <div className="monter rounded-3xl bg-surface p-8 shadow-[0_1px_0_#e6e6e1,0_20px_50px_-30px_rgb(11_29_69/0.35)] [animation-delay:200ms]">
          <p className="text-sm text-discret">Temps par bien</p>
          <div className="mt-5 space-y-4">
            <div>
              <div className="flex justify-between text-sm"><span className="text-texte">À la main</span><span className="font-mono">{minutes(w.gain.manuel_s)}</span></div>
              <div className="mt-2 h-2 rounded-full bg-trait"><div className="remplir h-2 w-full rounded-full bg-encre/25" /></div>
            </div>
            <div>
              <div className="flex justify-between text-sm"><span className="font-medium text-nuit">Avec Ghost</span><span className="font-mono text-nuit">{minutes(w.gain.agent_s)}</span></div>
              <div className="mt-2 h-2 rounded-full bg-trait"><div className="remplir h-2 rounded-full bg-nuit [animation-delay:300ms]" style={{ width: `${part}%` }} /></div>
            </div>
          </div>

          <Link
            href={`/workflows/${w.id}/lancer`}
            className="bouton mt-8 block rounded-full bg-nuit py-3.5 text-center text-[15px] font-medium text-white hover:shadow-[0_10px_30px_-10px_rgb(11_29_69/0.6)]"
          >
            Lancer l’agent
          </Link>

          <div className="mt-6 flex items-start justify-between gap-4 border-t border-trait pt-6">
            <div>
              <p id="veille" className="text-[15px] font-medium">Surveiller le Sheet</p>
              <p className="mt-1 text-sm text-texte">Chaque nouvelle ligne est publiée automatiquement.</p>
            </div>
            <button
              role="switch"
              aria-checked={veille}
              aria-labelledby="veille"
              onClick={() => setVeille(!veille)}
              className={`bouton relative mt-0.5 h-8 w-14 shrink-0 rounded-full ${veille ? 'bg-succes' : 'bg-trait'}`}
            >
              <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-[left] duration-300 ${veille ? 'left-7' : 'left-1'}`} />
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

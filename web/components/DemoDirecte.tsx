'use client';

import { useEffect, useState } from 'react';
import { Logo } from '@/components/Logo';

// Démonstration en boucle sur l'accueil : une tâche repérée, puis l'agent qui la fait site par site.
// Purement illustrative (aria-hidden) ; elle s'arrête si l'utilisateur préfère moins d'animations.
const SCENES = [
  { humeur: 'observe' as const, titre: 'Ghost observe', detail: 'Annonce M-0143 · formulaire de Portail A' },
  { humeur: 'joie' as const, titre: 'Tâche repérée', detail: 'Publier un bien sur plusieurs portails · 2 fois' },
  { humeur: 'travaille' as const, titre: 'L’agent travaille', detail: 'Remplit Prix : 315 000 €' },
  { humeur: 'joie' as const, titre: 'Fait et relu', detail: 'Publié sur 2 portails en 1 min 42' },
];
const SITES = ['Portail A', 'Portail B'];
const PAS_MS = 2600;

export function DemoDirecte() {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return setN(SCENES.length - 1);
    const t = setInterval(() => setN((x) => (x + 1) % SCENES.length), PAS_MS);
    return () => clearInterval(t);
  }, []);
  const scene = SCENES[n];

  return (
    <div aria-hidden="true" className="relative">
      <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-nuit-clair via-transparent to-transparent" />
      <div className="rounded-3xl border border-trait bg-surface p-6 shadow-[0_40px_80px_-48px_rgb(11_29_69/0.55)]">
        <div className="flex items-center gap-4">
          <Logo taille={56} anime humeur={scene.humeur} decoratif />
          <div key={n} className="fondu min-w-0">
            <p className="text-[15px] font-semibold text-encre">{scene.titre}</p>
            <p className="mt-0.5 truncate text-sm text-texte">{scene.detail}</p>
          </div>
        </div>
        <div className="mt-6 space-y-2.5">
          {SITES.map((s, i) => {
            const fait = n === 3 || (n === 2 && i === 0);
            const enCours = n === 2 && i === 1;
            return (
              <div key={s} className="flex items-center justify-between rounded-2xl bg-fond px-4 py-3">
                <span className="text-sm font-medium text-encre">{s}</span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-500 ${fait ? 'bg-succes-clair text-succes' : enCours ? 'bg-nuit text-white' : 'bg-trait/70 text-discret'}`}>
                  {fait ? '✓ Fait et relu' : enCours ? 'En cours…' : 'En attente'}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-5 h-1 overflow-hidden rounded-full bg-trait">
          <div className="h-1 rounded-full bg-nuit transition-[width] duration-700 ease-[var(--ease-doux)]" style={{ width: `${((n + 1) / SCENES.length) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';

export type Humeur = 'repos' | 'observe' | 'travaille' | 'joie' | 'souci' | 'discret'; // discret : yeux fermés (mot de passe)

interface LogoProps {
  taille?: number;
  anime?: boolean;
  humeur?: Humeur;
  suivreSouris?: boolean; // les yeux suivent le pointeur
  decoratif?: boolean; // à côté du mot « Ghost » ou purement visuel : caché des lecteurs d'écran
}

const CORPS = 'M12 65 C18 58 24 48 27 37 C31 22 42 6 58 6 C76 6 88 20 88 39 C88 62 72 79 40 83 C43 78 42 70 36 67 C30 64 20 66 13 66.5 Z';
const VISIERE = 'M52 21 H70 A13 13 0 0 1 83 34 V39 A13 13 0 0 1 70 52 H52 A13 13 0 0 1 39 39 V34 A13 13 0 0 1 52 21 Z';
// Chaque humeur : une animation du corps et une des yeux (classes définies dans globals.css).
const CORPS_ANIM: Record<Humeur, string> = { repos: 'flotter', observe: 'flotter', travaille: 'besogner', joie: 'sautiller', souci: '', discret: 'flotter' };
const YEUX_ANIM: Record<Humeur, string> = { repos: 'cligner', observe: 'scruter', travaille: 'affairer', joie: '', souci: '', discret: '' };

// Le fantôme Ghost : la visière est un trou (le fond passe au travers), seuls les yeux restent pleins.
export function Logo({ taille = 32, anime = false, humeur = 'repos', suivreSouris = false, decoratif = false }: LogoProps) {
  const svg = useRef<SVGSVGElement>(null);
  const [regard, setRegard] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!suivreSouris || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const suivre = (e: PointerEvent) => {
      const b = svg.current?.getBoundingClientRect();
      if (!b) return;
      const dx = e.clientX - (b.left + b.width * 0.62);
      const dy = e.clientY - (b.top + b.height * 0.4);
      const d = Math.hypot(dx, dy) || 1;
      const force = Math.min(1, d / 300);
      setRegard({ x: (dx / d) * 5 * force, y: (dy / d) * 3 * force });
    };
    addEventListener('pointermove', suivre);
    return () => removeEventListener('pointermove', suivre);
  }, [suivreSouris]);

  const yeux =
    humeur === 'discret' ? (
      <g fill="none" stroke="#0b1d45" strokeWidth="3.2" strokeLinecap="round">
        <path d="M57 38 Q60.75 42.5 64.5 38" />
        <path d="M72 38 Q75.75 42.5 79.5 38" />
      </g>
    ) : humeur === 'joie' ? (
      <g fill="none" stroke="#0b1d45" strokeWidth="3.2" strokeLinecap="round">
        <path d="M57 40 Q60.75 31 64.5 40" />
        <path d="M72 40 Q75.75 31 79.5 40" />
      </g>
    ) : (
      <g fill="#0b1d45" transform={humeur === 'souci' ? 'translate(0 4) scale(1 0.8)' : undefined}>
        <rect x="57" y="30" width="7.5" height="14" rx="3.75" />
        <rect x="72" y="30" width="7.5" height="14" rx="3.75" />
      </g>
    );

  return (
    <svg
      ref={svg}
      viewBox="0 0 100 92"
      width={taille}
      height={(taille * 92) / 100}
      {...(decoratif ? { 'aria-hidden': true } : { role: 'img', 'aria-label': 'Ghost' })}
      className={anime ? CORPS_ANIM[humeur] : undefined}
      overflow="visible"
    >
      <path fill="#0b1d45" fillRule="evenodd" d={`${CORPS} ${VISIERE}`} />
      <g style={{ transform: `translate(${regard.x}px, ${regard.y}px)`, transition: 'transform 0.25s cubic-bezier(0.16,1,0.3,1)' }}>
        <g className={anime ? YEUX_ANIM[humeur] : undefined}>{yeux}</g>
      </g>
    </svg>
  );
}

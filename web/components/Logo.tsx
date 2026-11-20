'use client';

import { useEffect, useRef } from 'react';

export type Humeur = 'repos' | 'observe' | 'travaille' | 'joie' | 'souci' | 'discret'; // discret : yeux fermés (mot de passe)

interface LogoProps {
  taille?: number;
  anime?: boolean;
  humeur?: Humeur;
  suivreSouris?: boolean; // les yeux suivent le pointeur
  decoratif?: boolean; // à côté du mot « Ghost » ou purement visuel : caché des lecteurs d'écran
  couleur?: string; // corps et yeux ; blanc sur fond bleu nuit (la visière reste transparente)
}

const CORPS = 'M12 65 C18 58 24 48 27 37 C31 22 42 6 58 6 C76 6 88 20 88 39 C88 62 72 79 40 83 C43 78 42 70 36 67 C30 64 20 66 13 66.5 Z';
const VISIERE = 'M52 21 H70 A13 13 0 0 1 83 34 V39 A13 13 0 0 1 70 52 H52 A13 13 0 0 1 39 39 V34 A13 13 0 0 1 52 21 Z';
const SOUPLESSE = 0.2; // part de la distance rattrapée à chaque image : plus haut = plus vif

// Chaque humeur : une animation du corps et une des yeux (classes définies dans globals.css).
const CORPS_ANIM: Record<Humeur, string> = { repos: 'flotter', observe: 'flotter', travaille: 'besogner', joie: 'sautiller', souci: '', discret: 'flotter' };
const YEUX_ANIM: Record<Humeur, string> = { repos: 'cligner', observe: 'scruter', travaille: 'affairer', joie: '', souci: '', discret: '' };

// Le fantôme Ghost : la visière est un trou (le fond passe au travers), seuls les yeux restent pleins.
export function Logo({ taille = 32, anime = false, humeur = 'repos', suivreSouris = false, decoratif = false, couleur = '#0b1d45' }: LogoProps) {
  const svg = useRef<SVGSVGElement>(null);
  const regard = useRef<SVGGElement>(null);

  // Le regard suit le pointeur à chaque image de l'écran, sans repasser par React : la cible bouge avec la souris,
  // les yeux la rattrapent en douceur (un peu de la distance restante à chaque image).
  useEffect(() => {
    if (!suivreSouris || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cible = { x: 0, y: 0 };
    const pos = { x: 0, y: 0 };
    let image = 0;
    const suivre = (e: PointerEvent) => {
      const b = svg.current?.getBoundingClientRect();
      if (!b) return;
      const dx = e.clientX - (b.left + b.width * 0.62);
      const dy = e.clientY - (b.top + b.height * 0.4);
      const d = Math.hypot(dx, dy) || 1;
      const force = Math.min(1, d / 300);
      cible.x = (dx / d) * 5 * force;
      cible.y = (dy / d) * 3 * force;
    };
    const animer = () => {
      pos.x += (cible.x - pos.x) * SOUPLESSE;
      pos.y += (cible.y - pos.y) * SOUPLESSE;
      if (regard.current) regard.current.style.transform = `translate(${pos.x.toFixed(2)}px, ${pos.y.toFixed(2)}px)`;
      image = requestAnimationFrame(animer);
    };
    addEventListener('pointermove', suivre, { passive: true });
    image = requestAnimationFrame(animer);
    return () => {
      removeEventListener('pointermove', suivre);
      cancelAnimationFrame(image);
    };
  }, [suivreSouris]);

  const yeux =
    humeur === 'discret' ? (
      <g fill="none" stroke={couleur} strokeWidth="3.2" strokeLinecap="round">
        <path d="M57 38 Q60.75 42.5 64.5 38" />
        <path d="M72 38 Q75.75 42.5 79.5 38" />
      </g>
    ) : humeur === 'joie' ? (
      <g fill="none" stroke={couleur} strokeWidth="3.2" strokeLinecap="round">
        <path d="M57 40 Q60.75 31 64.5 40" />
        <path d="M72 40 Q75.75 31 79.5 40" />
      </g>
    ) : (
      <g fill={couleur} transform={humeur === 'souci' ? 'translate(0 4) scale(1 0.8)' : undefined}>
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
      <path fill={couleur} fillRule="evenodd" d={`${CORPS} ${VISIERE}`} />
      <g ref={regard} style={{ willChange: suivreSouris ? 'transform' : undefined }}>
        <g className={anime ? YEUX_ANIM[humeur] : undefined}>{yeux}</g>
      </g>
    </svg>
  );
}

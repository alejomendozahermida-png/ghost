interface LogoProps {
  taille?: number;
  anime?: boolean;
  decoratif?: boolean; // à côté du mot « Ghost » ou purement visuel : caché des lecteurs d'écran
}

// Le fantôme Ghost : la visière est un trou (le fond passe au travers), seuls les yeux restent pleins.
export function Logo({ taille = 32, anime = false, decoratif = false }: LogoProps) {
  return (
    <svg
      viewBox="0 0 100 92"
      width={taille}
      height={(taille * 92) / 100}
      {...(decoratif ? { 'aria-hidden': true } : { role: 'img', 'aria-label': 'Ghost' })}
      className={anime ? 'flotter' : undefined}
    >
      <path
        fill="#0b1d45"
        fillRule="evenodd"
        d="M12 65 C18 58 24 48 27 37 C31 22 42 6 58 6 C76 6 88 20 88 39 C88 62 72 79 40 83 C43 78 42 70 36 67 C30 64 20 66 13 66.5 Z
           M52 21 H70 A13 13 0 0 1 83 34 V39 A13 13 0 0 1 70 52 H52 A13 13 0 0 1 39 39 V34 A13 13 0 0 1 52 21 Z"
      />
      <g className={anime ? 'cligner' : undefined} fill="#0b1d45">
        <rect x="57" y="30" width="7.5" height="14" rx="3.75" />
        <rect x="72" y="30" width="7.5" height="14" rx="3.75" />
      </g>
    </svg>
  );
}

interface LogoProps {
  taille?: number;
  anime?: boolean;
}

// Le fantôme Ghost, redessiné en vectoriel d'après le logo fourni.
export function Logo({ taille = 32, anime = false }: LogoProps) {
  return (
    <svg
      viewBox="0 0 100 92"
      width={taille}
      height={(taille * 92) / 100}
      role="img"
      aria-label="Ghost"
      className={anime ? 'flotter' : undefined}
    >
      <path
        fill="#0b1d45"
        d="M12 65 C18 58 24 48 27 37 C31 22 42 6 58 6 C76 6 88 20 88 39 C88 62 72 79 40 83 C43 78 42 70 36 67 C30 64 20 66 13 66.5 Z"
      />
      <rect x="39" y="21" width="44" height="31" rx="13" fill="#0a0a0a" />
      <g className={anime ? 'cligner' : undefined}>
        <rect x="57" y="30" width="7.5" height="14" rx="3.75" fill="#0b1d45" />
        <rect x="72" y="30" width="7.5" height="14" rx="3.75" fill="#0b1d45" />
      </g>
    </svg>
  );
}

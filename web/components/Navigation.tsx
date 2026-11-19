'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const LIENS = [
  ['/observer', 'Observer'],
  ['/workflows', 'Mes workflows'],
  ['/acces', 'Mes accès'],
] as const;

// Liens en ligne sur ordinateur, menu repliable sur téléphone (la ligne complète ne tient pas en 390 px).
export function Navigation({ connecte }: { connecte: boolean }) {
  const chemin = usePathname();
  const [ouvert, setOuvert] = useState(false);
  useEffect(() => setOuvert(false), [chemin]);

  if (!connecte) {
    return chemin === '/connexion' ? null : (
      <Link href="/connexion" className="bouton rounded-full border border-trait bg-surface px-5 py-2.5 text-sm font-medium text-encre">Se connecter</Link>
    );
  }

  const liens = LIENS.map(([href, nom]) => (
    <Link key={href} href={href} aria-current={chemin.startsWith(href) ? 'page' : undefined} className={`lien py-3 hover:text-encre ${chemin.startsWith(href) ? 'text-encre' : ''}`}>
      {nom}
    </Link>
  ));
  const sortie = (
    <form action="/api/deconnexion" method="post">
      <button className="lien py-3 text-discret hover:text-encre">Se déconnecter</button>
    </form>
  );

  return (
    <nav aria-label="Navigation principale" className="text-sm text-texte">
      <div className="hidden items-center gap-7 md:flex">{liens}{sortie}</div>
      <button
        aria-expanded={ouvert}
        aria-controls="menu-mobile"
        onClick={() => setOuvert(!ouvert)}
        className="bouton rounded-full border border-trait bg-surface px-5 py-2.5 font-medium text-encre md:hidden"
      >
        {ouvert ? 'Fermer' : 'Menu'}
      </button>
      {ouvert && (
        <div id="menu-mobile" className="monter absolute inset-x-6 top-20 z-20 flex flex-col rounded-2xl bg-surface px-6 py-3 shadow-[0_20px_50px_-20px_rgb(11_29_69/0.35)] md:hidden">
          {liens}
          {sortie}
        </div>
      )}
    </nav>
  );
}

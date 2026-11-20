'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const LIENS = [
  ['/observer', 'Observer'],
  ['/workflows', 'Mes workflows'],
  ['/acces', 'Mes accès'],
  ['/tarifs', 'Tarifs'],
] as const;

// Liens en ligne sur ordinateur, menu repliable sur téléphone (la ligne complète ne tient pas en 390 px).
export function Navigation({ connecte }: { connecte: boolean }) {
  const chemin = usePathname();
  const [ouvert, setOuvert] = useState(false);
  useEffect(() => setOuvert(false), [chemin]);

  if (!connecte) {
    return chemin === '/connexion' ? null : (
      <div className="flex items-center gap-5">
        <Link href="/tarifs" aria-current={chemin === '/tarifs' ? 'page' : undefined} className={`lien py-2 text-sm hover:text-encre ${chemin === '/tarifs' ? 'text-encre' : 'text-texte'}`}>Tarifs</Link>
        <Link href="/connexion" className="bouton rounded-full bg-nuit px-5 py-2 text-sm font-semibold text-white">Se connecter</Link>
      </div>
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
        className="bouton rounded-full border border-white/80 bg-white/60 px-4 py-2 font-medium text-encre md:hidden"
      >
        {ouvert ? 'Fermer' : 'Menu'}
      </button>
      {ouvert && (
        <div id="menu-mobile" className="monter verre absolute inset-x-0 top-[4.5rem] z-20 carte-rayon flex flex-col px-6 py-3 md:hidden">
          {liens}
          {sortie}
        </div>
      )}
    </nav>
  );
}

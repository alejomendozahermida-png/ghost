'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

// L'essentiel seulement ; Tarifs et la déconnexion passent dans le menu du compte.
const LIENS = [
  ['/observer', 'Observer'],
  ['/workflows', 'Workflows'],
  ['/acces', 'Accès'],
  ['/espace', 'Équipe'],
] as const;

// Survol : une pastille teintée de bleu nuit ; page en cours : pastille pleine.
const pastille = (actif: boolean) =>
  `rounded-full px-3.5 py-2 font-medium transition-colors duration-200 ${actif ? 'bg-nuit text-white' : 'text-texte hover:bg-nuit/[0.07] hover:text-nuit'}`;
const ligneMenu = 'block w-full rounded-xl px-3 py-2.5 text-left font-medium text-texte transition-colors hover:bg-nuit/[0.07] hover:text-nuit';

function MenuCompte({ email }: { email: string }) {
  const [ouvert, setOuvert] = useState(false);
  const zone = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ouvert) return;
    const fermer = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !zone.current?.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener('mousedown', fermer);
    document.addEventListener('keydown', fermer);
    return () => { document.removeEventListener('mousedown', fermer); document.removeEventListener('keydown', fermer); };
  }, [ouvert]);

  return (
    <div ref={zone} className="relative">
      <button
        aria-expanded={ouvert}
        aria-haspopup="menu"
        aria-label="Votre compte"
        onClick={() => setOuvert(!ouvert)}
        className="bouton grid h-9 w-9 place-items-center rounded-full bg-nuit-clair text-sm font-semibold uppercase text-nuit transition-colors hover:bg-nuit hover:text-white"
      >
        {email.charAt(0) || '?'}
      </button>
      {ouvert && (
        <div role="menu" className="verre monter absolute right-0 top-12 z-20 w-60 rounded-[1.25rem] p-2">
          <p className="truncate px-3 pb-2 pt-1.5 text-[13px] text-discret">{email}</p>
          <Link role="menuitem" href="/tarifs" className={ligneMenu}>Tarifs</Link>
          <form action="/api/deconnexion" method="post">
            <button role="menuitem" className={ligneMenu}>Se déconnecter</button>
          </form>
        </div>
      )}
    </div>
  );
}

export function Navigation({ email }: { email: string | null }) {
  const chemin = usePathname();
  const [ouvert, setOuvert] = useState(false);
  useEffect(() => setOuvert(false), [chemin]);

  if (!email) {
    return chemin === '/connexion' ? null : (
      <div className="flex items-center gap-1 text-sm">
        <Link href="/tarifs" aria-current={chemin === '/tarifs' ? 'page' : undefined} className={pastille(chemin === '/tarifs')}>Tarifs</Link>
        <Link href="/connexion" className="bouton rounded-full bg-nuit px-5 py-2 font-semibold text-white">Se connecter</Link>
      </div>
    );
  }

  const liens = (classe: (actif: boolean) => string) =>
    LIENS.map(([href, nom]) => {
      const actif = chemin.startsWith(href);
      return <Link key={href} href={href} aria-current={actif ? 'page' : undefined} className={classe(actif)}>{nom}</Link>;
    });

  return (
    <nav aria-label="Navigation principale" className="flex items-center gap-2 text-sm">
      <div className="hidden items-center gap-1 md:flex">{liens(pastille)}</div>
      <div className="hidden md:block"><MenuCompte email={email} /></div>
      <button
        aria-expanded={ouvert}
        aria-controls="menu-mobile"
        onClick={() => setOuvert(!ouvert)}
        className="bouton rounded-full border border-white/80 bg-white/60 px-4 py-2 font-medium text-encre md:hidden"
      >
        {ouvert ? 'Fermer' : 'Menu'}
      </button>
      {ouvert && (
        <div id="menu-mobile" className="monter verre absolute inset-x-0 top-[4.5rem] z-20 flex flex-col gap-0.5 rounded-[1.25rem] p-2 md:hidden">
          {liens((actif) => (actif ? `${ligneMenu} bg-nuit text-white hover:bg-nuit hover:text-white` : ligneMenu))}
          <Link href="/tarifs" className={ligneMenu}>Tarifs</Link>
          <form action="/api/deconnexion" method="post">
            <button className={ligneMenu}>Se déconnecter</button>
          </form>
        </div>
      )}
    </nav>
  );
}

import Link from 'next/link';
import { Logo } from '@/components/Logo';

const COLONNES: [string, [string, string][]][] = [
  ['Produit', [['Observer', '/observer'], ['Mes workflows', '/workflows'], ['Mes accès', '/acces'], ['Comment ça marche', '/#comment']]],
  ['Légal', [['Mentions légales', '/mentions-legales'], ['Confidentialité', '/confidentialite'], ['Conditions d’utilisation', '/conditions'], ['Cookies', '/cookies']]],
];

export function PiedDePage() {
  return (
    <footer className="mt-24">
      <div className="mx-auto grid max-w-5xl gap-10 px-6 py-14 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <Logo taille={28} decoratif />
            <span className="text-[17px] font-bold tracking-tight text-encre">Ghost</span>
          </div>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-texte">Ghost voit ce que vous répétez, et le fait à votre place.</p>
          <p className="mt-4 text-xs text-discret">Prototype réalisé lors du hackathon Eugenia × H Company.</p>
        </div>
        {COLONNES.map(([titre, liens]) => (
          <nav key={titre} aria-label={titre}>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-discret">{titre}</p>
            <ul className="mt-3 space-y-2">
              {liens.map(([nom, href]) => (
                <li key={href}><Link href={href} className="lien text-sm text-texte hover:text-encre">{nom}</Link></li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div>
        <p className="mx-auto max-w-5xl px-6 pb-8 text-xs text-discret">© 2026 Ghost. Tous droits réservés.</p>
      </div>
    </footer>
  );
}

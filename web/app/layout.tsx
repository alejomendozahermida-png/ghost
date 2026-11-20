import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { Notifications } from '@/components/Notifications';
import { PiedDePage } from '@/components/PiedDePage';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { utilisateur } from '@/lib/session';
import { Navigation } from '@/components/Navigation';
import './globals.css';

// Plus Jakarta Sans : professionnelle et chaleureuse (recommandée pour les outils B2B) ; Geist Mono pour les chiffres.
// Polices hébergées avec l'application (variables, latin) : aucune dépendance à Google Fonts au build ni à l'affichage.
const jakarta = localFont({ src: './polices/plus-jakarta-sans.woff2', variable: '--font-jakarta', weight: '200 800', display: 'swap' });
const geistMono = localFont({ src: './polices/geist-mono.woff2', variable: '--font-geist-mono', weight: '100 900', display: 'swap' });

export const metadata: Metadata = {
  title: 'Ghost',
  description: 'Ghost voit ce que vous répétez, et le fait à votre place.',
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const moi = await utilisateur();
  return (
    <html lang="fr">
      <body className={`${jakarta.variable} ${geistMono.variable} antialiased`}>
        <a href="#contenu" className="sr-only rounded-full bg-nuit text-sm font-medium text-white focus:not-sr-only focus:fixed focus:left-6 focus:top-4 focus:z-30 focus:px-5 focus:py-3">
          Aller au contenu
        </a>
        {/* En-tête flottant en verre : il reste en haut et laisse passer la page qui défile dessous. */}
        <header className="sticky top-3 z-30 mx-auto mt-3 max-w-5xl px-4">
          <div className="verre relative flex items-center justify-between rounded-full py-2 pl-5 pr-2">
          <Link href="/" className="flex items-center gap-2.5 rounded-md focus-visible:outline-2 focus-visible:outline-nuit">
            <Logo taille={30} decoratif />
            <span className="text-[17px] font-semibold tracking-tight text-nuit">Ghost</span>
          </Link>
          <Navigation email={moi?.email ?? null} />
          {moi && <Notifications />}
          </div>
        </header>
        <main id="contenu" tabIndex={-1} className="mx-auto max-w-5xl px-6 outline-none">{children}</main>
        <PiedDePage />
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { utilisateur } from '@/lib/session';
import { Navigation } from '@/components/Navigation';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Ghost',
  description: 'Ghost voit ce que vous répétez, et le fait à votre place.',
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const moi = await utilisateur();
  return (
    <html lang="fr">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <a href="#contenu" className="sr-only rounded-full bg-nuit text-sm font-medium text-white focus:not-sr-only focus:fixed focus:left-6 focus:top-4 focus:z-30 focus:px-5 focus:py-3">
          Aller au contenu
        </a>
        <header className="relative mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
          <Link href="/" className="flex items-center gap-2.5 rounded-md focus-visible:outline-2 focus-visible:outline-nuit">
            <Logo taille={30} decoratif />
            <span className="text-[17px] font-semibold tracking-tight text-nuit">Ghost</span>
          </Link>
          <Navigation connecte={!!moi} />
        </header>
        <main id="contenu" tabIndex={-1} className="mx-auto max-w-5xl px-6 pb-24 outline-none">{children}</main>
      </body>
    </html>
  );
}

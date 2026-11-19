import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Ghost',
  description: 'Ghost voit ce que vous répétez, et le fait à votre place.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
          <Link href="/" className="flex items-center gap-2.5 rounded-md focus-visible:outline-2 focus-visible:outline-nuit">
            <Logo taille={30} />
            <span className="text-[17px] font-semibold tracking-tight text-nuit">Ghost</span>
          </Link>
          <nav className="flex items-center gap-7 text-sm text-texte">
            <Link href="/workflows" className="lien py-3 hover:text-encre">Mes workflows</Link>
            <Link href="/acces" className="lien py-3 hover:text-encre">Mes accès</Link>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-6 pb-24">{children}</main>
      </body>
    </html>
  );
}

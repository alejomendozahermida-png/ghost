'use client';

import { useEffect, useState } from 'react';
import { Logo } from '@/components/Logo';
import { boutonPrincipal } from '@/components/PageEntete';
import { notifier } from '@/lib/notifier';
import { FenetreObservee, MethodeEcrite, SitesFaits } from '@/components/Illustrations';

// Premier passage : trois idées, puis l'autorisation des notifications demandée au moment où elle sert.
// Court, sautable à chaque écran, et jamais montré deux fois.

const ECRANS = [
  {
    surtitre: '1 · Montrez une fois',
    titre: 'Travaillez normalement.',
    texte: 'Partagez votre fenêtre et faites votre tâche habituelle, deux fois. Ghost lit chaque écran et ne garde que sa description, jamais l’image.',
    visuel: <FenetreObservee />,
  },
  {
    surtitre: '2 · Ghost comprend',
    titre: 'Il écrit la méthode.',
    texte: 'Ghost repère la répétition, vous prévient et rédige les étapes. Vous les relisez et ajoutez vos règles, comme « pas de vente sans classe énergie ».',
    visuel: <MethodeEcrite />,
  },
  {
    surtitre: '3 · Il le fait pour vous',
    titre: 'Un agent prend le relais.',
    texte: 'Lancez-le d’un clic, à une heure fixe ou quand votre Sheet change. Chaque résultat est relu sur la page publiée avant d’être marqué comme fait.',
    visuel: <SitesFaits />,
  },
];

export default function Bienvenue() {
  const [n, setN] = useState(0); // 0..2 : les idées ; 3 : les notifications
  const [permission, setPermission] = useState<NotificationPermission | 'indisponible'>('default');
  const suite = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('suite') : null;

  useEffect(() => {
    setPermission(typeof Notification === 'undefined' ? 'indisponible' : Notification.permission);
  }, []);

  // Flèches du clavier pour avancer ou revenir.
  useEffect(() => {
    const clavier = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setN((x) => Math.min(x + 1, ECRANS.length));
      if (e.key === 'ArrowLeft') setN((x) => Math.max(x - 1, 0));
    };
    addEventListener('keydown', clavier);
    return () => removeEventListener('keydown', clavier);
  }, []);

  async function terminer(vers: string) {
    await fetch('/api/profil', { method: 'POST' }).catch(() => null);
    window.location.href = vers;
  }

  async function activer() {
    const p = await Notification.requestPermission();
    setPermission(p);
    if (p === 'granted') await notifier('Ghost', 'C’est prêt : vous serez prévenu ici.', { tag: `ghost-bienvenue-${Date.now()}` });
  }

  const ecran = ECRANS[n];
  return (
    <section className="mx-auto max-w-5xl pt-8">
      <div className="flex items-center justify-between">
        <div className="flex gap-2" aria-label={`Étape ${n + 1} sur ${ECRANS.length + 1}`}>
          {[...ECRANS, null].map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i === n ? 'w-8 bg-nuit' : i < n ? 'w-4 bg-nuit/40' : 'w-4 bg-trait'}`} />
          ))}
        </div>
        <button onClick={() => terminer(suite ?? '/workflows')} className="lien py-2 text-sm text-discret">Passer</button>
      </div>

      {ecran ? (
        <div key={n} className="mt-12 grid items-center gap-12 md:grid-cols-[1fr_1fr]">
          <div>
            <p className="monter text-[13px] font-semibold uppercase tracking-[0.16em] text-nuit/70">{ecran.surtitre}</p>
            <h1 className="monter mt-3 text-[40px] font-bold leading-[1.05] tracking-[-0.03em] text-encre [animation-delay:60ms] md:text-[52px]">{ecran.titre}</h1>
            <p className="monter mt-5 max-w-md text-[17px] leading-relaxed text-texte [animation-delay:120ms]">{ecran.texte}</p>
            <div className="monter mt-10 flex flex-wrap items-center gap-4 [animation-delay:180ms]">
              <button onClick={() => setN(n + 1)} className={boutonPrincipal} autoFocus>Continuer</button>
              {n > 0 && <button onClick={() => setN(n - 1)} className="bouton rounded-full px-5 py-3 text-sm font-medium text-texte">Retour</button>}
            </div>
          </div>
          <div className="monter [animation-delay:120ms]" aria-hidden="true">{ecran.visuel}</div>
        </div>
      ) : (
        <div key="fin" className="mt-12 grid items-center gap-12 md:grid-cols-[auto_1fr]">
          <Logo taille={140} anime humeur={permission === 'granted' ? 'joie' : 'observe'} suivreSouris decoratif />
          <div>
            <p className="monter text-[13px] font-semibold uppercase tracking-[0.16em] text-nuit/70">Dernière chose</p>
            <h1 className="monter mt-3 text-[40px] font-bold leading-[1.05] tracking-[-0.03em] text-encre [animation-delay:60ms] md:text-[52px]">Restez prévenu.</h1>
            <p className="monter mt-5 max-w-md text-[17px] leading-relaxed text-texte [animation-delay:120ms]">
              Ghost vous prévient quand il repère une tâche répétitive, et quand un agent a fini son travail.
            </p>
            <div className="monter mt-8 [animation-delay:180ms]" role="status">
              {permission === 'granted' ? (
                <p className="flex items-center gap-2 text-[15px] font-medium text-succes"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-succes" />Notifications activées</p>
              ) : permission === 'default' ? (
                <button onClick={activer} className="bouton rounded-full border border-trait bg-surface px-6 py-3 text-sm font-semibold hover:border-encre/30">Activer les notifications</button>
              ) : (
                <p className="max-w-md text-sm text-texte">
                  {permission === 'denied' ? 'Les notifications sont bloquées pour ce site : vous pourrez les autoriser plus tard avec l’icône à gauche de l’adresse.' : 'Ce navigateur ne sait pas afficher de notifications.'}
                </p>
              )}
            </div>
            <div className="monter mt-10 flex flex-wrap items-center gap-4 [animation-delay:240ms]">
              <button onClick={() => terminer('/observer')} className={boutonPrincipal}>Commencer ma première observation</button>
              <button onClick={() => terminer(suite ?? '/workflows')} className="bouton rounded-full px-5 py-3 text-sm font-medium text-texte">Explorer d’abord</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

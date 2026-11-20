'use client';

import { useEffect, useState } from 'react';
import { Logo } from '@/components/Logo';
import { boutonPrincipal } from '@/components/PageEntete';
import { notifier } from '@/lib/notifier';

// Premier passage : trois idées, puis l'autorisation des notifications demandée au moment où elle sert.
// Court, sautable à chaque écran, et jamais montré deux fois.

function FenetreObservee() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-trait bg-surface p-6 shadow-[0_30px_60px_-40px_rgb(11_29_69/0.5)]">
      <div className="h-3 w-1/3 rounded bg-encre/10" />
      {[0.9, 0.7, 0.8].map((w, i) => (
        <div key={i} className="mt-4 h-8 rounded-lg border border-trait" style={{ width: `${w * 100}%` }} />
      ))}
      <div className="mt-5 h-9 w-28 rounded-full bg-nuit/85" />
      <div className="balayer absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-transparent via-nuit/10 to-transparent" />
    </div>
  );
}

function MethodeEcrite() {
  const pas = ['Ouvre le formulaire de dépôt', 'Remplit Titre, Prix, Ville', 'Vérifie la classe énergie', 'Publie, puis relit la page'];
  return (
    <ol className="space-y-2.5">
      {pas.map((p, i) => (
        <li key={p} className="monter flex items-center gap-3 rounded-xl bg-surface px-4 py-3 text-[15px] text-texte shadow-[0_1px_0_#e6e6e1]" style={{ animationDelay: `${i * 140}ms` }}>
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-nuit-clair font-mono text-xs text-nuit">{i + 1}</span>
          {p}
        </li>
      ))}
    </ol>
  );
}

function SitesFaits() {
  return (
    <div className="space-y-3">
      {['Portail A', 'Portail B', 'Google Sheet'].map((s, i) => (
        <div key={s} className="monter flex items-center justify-between rounded-2xl bg-surface px-5 py-4 shadow-[0_1px_0_#e6e6e1]" style={{ animationDelay: `${150 + i * 220}ms` }}>
          <span className="text-[15px] font-semibold text-encre">{s}</span>
          <span className="rounded-full bg-succes-clair px-3 py-1 text-sm font-medium text-succes">✓ Fait et relu</span>
        </div>
      ))}
    </div>
  );
}

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

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/Logo';

type Etat = 'pret' | 'en_cours' | 'pause';
interface Ligne {
  site: string;
  action: string;
}

// shortcut: observation simulée pour construire l'écran ; à remplacer par le vrai partage d'écran (useObservation).
const SCENARIO: Ligne[] = [
  { site: 'Google Sheet', action: 'Lit la ligne 1 : Appartement T3 lumineux, Massy' },
  { site: 'Portail A', action: 'Ouvre « Déposer une annonce »' },
  { site: 'Portail A', action: 'Remplit le titre, le prix et la surface' },
  { site: 'Portail A', action: 'Publie l’annonce' },
  { site: 'Portail B', action: 'Ouvre « Nouvelle annonce »' },
  { site: 'Portail B', action: 'Remplit l’intitulé, le montant et la commune' },
  { site: 'Portail B', action: 'Publie l’annonce' },
];

function duree(s: number): string {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export default function Observer() {
  const [etat, setEtat] = useState<Etat>('pret');
  const [secondes, setSecondes] = useState(0);
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const repere = lignes.length === SCENARIO.length;

  useEffect(() => {
    if (etat !== 'en_cours') return;
    const t = setInterval(() => setSecondes((s) => s + 1), 1000);
    const l = setInterval(
      () => setLignes((ls) => (ls.length < SCENARIO.length ? [...ls, SCENARIO[ls.length]] : ls)),
      2600,
    );
    return () => {
      clearInterval(t);
      clearInterval(l);
    };
  }, [etat]);

  useEffect(() => {
    if (repere && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification('Workflow repéré', { body: 'Publier un bien sur plusieurs portails. Vous l’avez fait 2 fois.' });
    }
  }, [repere]);

  async function demarrer() {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') await Notification.requestPermission();
    setEtat('en_cours');
  }

  if (etat === 'pret') {
    return (
      <section className="mx-auto max-w-2xl pt-16">
        <h1 className="monter text-4xl font-semibold tracking-[-0.02em]">Observer votre travail</h1>
        <p className="monter mt-4 text-lg leading-relaxed text-texte [animation-delay:80ms]">
          Partagez votre fenêtre Chrome, puis travaillez comme d’habitude. Ghost vous prévient dès qu’une tâche se répète.
        </p>
        <ul className="monter mt-10 space-y-4 border-l border-trait pl-6 text-[15px] text-texte [animation-delay:160ms]">
          <li>Aucune vidéo n’est enregistrée : seule la description de chaque écran est gardée.</li>
          <li>Les pages de connexion sont ignorées. Mettez en pause pour toute action privée.</li>
          <li>Vous arrêtez quand vous voulez.</li>
        </ul>
        <button
          onClick={demarrer}
          className="monter mt-12 rounded-full bg-nuit px-7 py-3.5 text-[15px] font-medium text-white transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-10px_rgb(11_29_69/0.6)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-nuit [animation-delay:240ms]"
        >
          Démarrer l’observation
        </button>
      </section>
    );
  }

  return (
    <section className="grid gap-12 pt-10 md:grid-cols-[1fr_1.5fr]">
      <aside className="md:sticky md:top-10 md:self-start">
        <Logo taille={120} anime={etat === 'en_cours'} />
        <div className="mt-8 flex items-center gap-3">
          <span className={`h-2.5 w-2.5 rounded-full ${etat === 'en_cours' ? 'pulse-doux bg-alerte' : 'bg-discret'}`} />
          <span className="text-[15px] font-medium">{etat === 'en_cours' ? 'Observation en cours' : 'En pause'}</span>
          <span className="font-mono text-[15px] text-discret">{duree(secondes)}</span>
        </div>
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => setEtat(etat === 'en_cours' ? 'pause' : 'en_cours')}
            className="rounded-full border border-trait bg-surface px-5 py-2.5 text-sm font-medium transition hover:border-encre/30"
          >
            {etat === 'en_cours' ? 'Pause' : 'Reprendre'}
          </button>
          <button
            onClick={() => {
              setEtat('pret');
              setSecondes(0);
              setLignes([]);
            }}
            className="rounded-full px-5 py-2.5 text-sm font-medium text-alerte transition hover:bg-alerte-clair"
          >
            Arrêter
          </button>
        </div>
      </aside>

      <div>
        {repere && (
          <div className="monter mb-10 rounded-2xl bg-nuit p-7 text-white shadow-[0_24px_60px_-24px_rgb(11_29_69/0.7)]">
            <p className="text-sm text-white/60">Workflow repéré</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">Publier un bien sur plusieurs portails</p>
            <p className="mt-2 text-[15px] text-white/70">Vous l’avez fait 2 fois. Ghost peut le faire à votre place.</p>
            <Link
              href="/workflows/demo"
              className="mt-6 inline-block rounded-full bg-white px-6 py-3 text-sm font-medium text-nuit transition hover:-translate-y-0.5"
            >
              Voir ce que Ghost a compris
            </Link>
          </div>
        )}
        <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-discret">Ce que Ghost voit</h2>
        {lignes.length === 0 ? (
          <p className="mt-6 text-[15px] text-discret">En attente de votre première action…</p>
        ) : (
          <ol className="mt-4 divide-y divide-trait">
            {[...lignes].reverse().map((l, i) => (
              <li key={lignes.length - i} className="monter flex gap-6 py-4">
                <span className="w-28 shrink-0 text-sm font-medium text-nuit">{l.site}</span>
                <span className="text-[15px] text-texte">{l.action}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

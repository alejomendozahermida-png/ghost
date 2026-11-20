import Link from 'next/link';
import { Logo, type Humeur } from '@/components/Logo';

interface Offre {
  nom: string;
  prix: number;
  pour: string;
  actions: string;
  agents: number;
  humeur: Humeur;
  inclus: string[];
  bouton: string;
  vedette?: boolean;
}

// Les fantômes posés sur chaque carte = les agents qui travaillent en même temps : on voit ce qu'on achète.
const OFFRES: Offre[] = [
  {
    nom: 'Découverte', prix: 0, pour: 'Pour voir Ghost à l’œuvre.', actions: '50 actions par mois', agents: 1, humeur: 'repos',
    inclus: ['2 workflows', 'Lancement à la main', 'Observation illimitée'], bouton: 'Commencer gratuitement',
  },
  {
    nom: 'Pro', prix: 29, pour: 'Pour confier ses tâches pour de bon.', actions: '400 actions par mois', agents: 3, humeur: 'travaille', vedette: true,
    inclus: ['Workflows illimités', 'Veille : chaque nouvelle ligne est faite', 'Planification et lancement par lien', '0,09 € l’action au-delà'], bouton: 'Passer à Pro',
  },
  {
    nom: 'Équipe', prix: 99, pour: 'Pour toute une équipe.', actions: '1 500 actions par mois', agents: 6, humeur: 'joie',
    inclus: ['Tout ce qu’offre Pro', 'Accès partagés entre collègues', '0,07 € l’action au-delà'], bouton: 'Choisir Équipe',
  },
];

function Carte({ o, rang }: { o: Offre; rang: number }) {
  const clair = !o.vedette;
  return (
    <article
      className={`carte monter relative flex flex-col transition duration-300 hover:-translate-y-1 ${o.vedette ? 'verre-nuit md:-mt-8' : 'verre'}`}
      style={{ animationDelay: `${120 + rang * 90}ms` }}
    >
      <div aria-hidden="true" className="mb-6 flex h-14 items-end">
        {Array.from({ length: o.agents }, (_, i) => (
          <span key={i} className={i ? '-ml-3' : ''} style={{ zIndex: o.agents - i }}>
            <Logo taille={o.agents > 3 ? 40 : 52} anime humeur={o.humeur} couleur={clair ? '#0b1d45' : '#ffffff'} decoratif />
          </span>
        ))}
      </div>
      <h2 className={`text-[15px] font-semibold ${clair ? 'text-nuit' : 'text-white/80'}`}>{o.nom}</h2>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="font-mono text-[44px] font-medium leading-none tracking-tight">{o.prix} €</span>
        {o.prix > 0 && <span className={`text-sm ${clair ? 'text-texte' : 'text-white/70'}`}>/ mois</span>}
      </p>
      <p className={`mt-3 text-[15px] ${clair ? 'text-texte' : 'text-white/80'}`}>{o.pour}</p>
      <p className={`mt-6 text-[17px] font-semibold ${clair ? 'text-encre' : 'text-white'}`}>{o.actions}</p>
      <p className={`text-sm ${clair ? 'text-texte' : 'text-white/70'}`}>{o.agents === 1 ? '1 agent à la fois' : `${o.agents} agents en même temps`}</p>
      <ul className="mt-5 flex-1 space-y-2.5">
        {o.inclus.map((x) => (
          <li key={x} className={`flex gap-2.5 text-[15px] ${clair ? 'text-texte' : 'text-white/85'}`}>
            <span aria-hidden="true" className={clair ? 'text-succes' : 'text-[#86efac]'}>✓</span>{x}
          </li>
        ))}
      </ul>
      <Link
        href="/connexion"
        className={`bouton mt-8 block rounded-xl py-3.5 text-center text-[15px] font-semibold ${o.vedette ? 'bg-white text-nuit hover:shadow-[0_12px_32px_-12px_rgb(255_255_255/0.6)]' : 'border border-nuit/15 bg-white/60 text-nuit hover:border-nuit/30'}`}
      >
        {o.bouton}
      </Link>
    </article>
  );
}

export default function Tarifs() {
  return (
    <section className="pb-10 pt-12">
      <header className="mx-auto max-w-2xl text-center">
        <h1 className="monter text-[40px] font-bold leading-[1.05] tracking-[-0.03em] text-encre md:text-[52px]">
          Payez ce que Ghost fait.
          <span className="block text-nuit/60">Rien de plus.</span>
        </h1>
        <p className="monter mt-5 text-[17px] leading-relaxed text-texte [animation-delay:60ms]">
          Une action, c’est une ligne faite et relue sur un site. Une action ratée n’est jamais comptée.
        </p>
      </header>
      <div className="mt-16 grid items-start gap-5 md:grid-cols-[1fr_1.12fr_1fr]">
        {OFFRES.map((o, i) => <Carte key={o.nom} o={o} rang={i} />)}
      </div>
      <p className="monter mt-14 text-center text-sm text-discret [animation-delay:400ms]">Sans engagement. Vous changez d’offre quand vous voulez.</p>
    </section>
  );
}

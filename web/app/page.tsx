import Link from 'next/link';
import { Logo } from '@/components/Logo';

const ETAPES = [
  ['Vous travaillez normalement', 'Ghost regarde votre écran, avec votre accord, sans rien enregistrer en vidéo.'],
  ['Ghost repère ce que vous répétez', 'Dès qu’une tâche revient, il vous prévient et vous montre ce qu’il a compris.'],
  ['L’agent le fait à votre place', 'Sur les sites sans API, et chaque résultat est vérifié avant d’être affiché.'],
];

export default function Accueil() {
  return (
    <>
      <section className="grid items-center gap-12 pt-16 md:grid-cols-[1.25fr_1fr] md:pt-24">
        <div className="monter">
          <h1 className="text-[44px] font-semibold leading-[1.05] tracking-[-0.03em] text-encre md:text-[60px]">
            Ghost voit ce que vous répétez.
            <span className="block text-nuit/60">Et le fait à votre place.</span>
          </h1>
          <div className="mt-10 flex flex-wrap items-center gap-5">
            <Link
              href="/observer"
              className="bouton rounded-full bg-nuit px-7 py-3.5 text-[15px] font-medium text-white hover:shadow-[0_10px_30px_-10px_rgb(11_29_69/0.6)]"
            >
              Commencer l’observation
            </Link>
            <Link href="/workflows" className="lien py-3 text-[15px] font-medium text-nuit">
              Voir mes workflows
            </Link>
          </div>
        </div>
        <div className="monter flex justify-center [animation-delay:150ms] md:justify-end">
          <Logo taille={260} anime decoratif />
        </div>
      </section>

      <section className="mt-28 grid gap-10 md:grid-cols-[1fr_1.4fr]">
        <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-discret">Comment ça marche</h2>
        <ol className="divide-y divide-trait border-y border-trait">
          {ETAPES.map(([titre, texte], i) => (
            <li key={titre} className="monter flex gap-6 py-7" style={{ animationDelay: `${300 + i * 120}ms` }}>
              <span className="font-mono text-sm text-discret">0{i + 1}</span>
              <div>
                <p className="text-lg font-medium text-encre">{titre}</p>
                <p className="mt-1.5 text-[15px] leading-relaxed text-texte">{texte}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

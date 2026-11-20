import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { boutonPrincipal } from '@/components/PageEntete';
import { FenetreObservee, MethodeEcrite, SitesFaits } from '@/components/Illustrations';

const ETAPES = [
  { titre: 'Montrez une fois', texte: 'Partagez votre fenêtre et faites votre tâche habituelle. Ghost lit chaque écran et ne garde que sa description, jamais l’image.', visuel: <FenetreObservee /> },
  { titre: 'Ghost comprend', texte: 'Il repère la répétition, vous prévient et écrit la méthode. Vous la relisez et ajoutez vos règles métier.', visuel: <MethodeEcrite /> },
  { titre: 'Il le fait pour vous', texte: 'Un agent refait la tâche dans son propre navigateur, sur chaque site, puis relit le résultat publié.', visuel: <SitesFaits /> },
];

const CAS = [
  { metier: 'Immobilier', tache: 'Publier un bien sur plusieurs portails', detail: 'Une ligne du tableau des mandats, trois annonces en ligne, chacune relue.', large: true },
  { metier: 'Support client', tache: 'Recopier un numéro de ticket vers le CRM', detail: 'Ghost retrouve la fiche client et la complète, sans doublon.' },
  { metier: 'E-commerce', tache: 'Mettre à jour les fiches produits', detail: 'Prix et stocks recopiés depuis votre fichier fournisseur.' },
  { metier: 'Administratif', tache: 'Saisir les factures reçues', detail: 'De la boîte mail à l’outil de comptabilité, champ par champ.', large: true },
];

const DECLENCHEURS = [
  ['À la main', 'Un clic sur Lancer, en choisissant les lignes à faire.'],
  ['À heure fixe', 'Tous les jours, en semaine ou chaque lundi à 9 h.'],
  ['Quand votre Sheet change', 'Chaque nouvelle ligne est faite en moins d’une minute.'],
  ['Depuis un autre outil', 'Un lien que Zapier, Airtable ou un formulaire appelle.'],
];

const CONFIANCE = [
  ['Rien n’est filmé', 'Seule la description de chaque écran est gardée. Les pages de connexion sont ignorées.'],
  ['Vos mots de passe restent chez H', 'Ils vont directement dans votre coffre-fort. Ghost ne les voit jamais, l’agent non plus.'],
  ['Vos règles passent avant tout', 'Une ligne qui ne les respecte pas est refusée avant qu’un agent ne démarre.'],
  ['Chaque résultat est relu', 'Ghost vérifie la page publiée, jamais la seule parole de l’agent.'],
];

export default function Accueil() {
  return (
    <>
      <section className="grid items-center gap-14 pt-12 md:grid-cols-[1.2fr_1fr] md:pt-20">
        <div>
          <h1 className="monter text-[44px] font-bold leading-[1.03] tracking-[-0.035em] text-encre [animation-delay:60ms] md:text-[64px]">
            Ghost voit ce que vous répétez.
            <span className="block text-nuit/60">Et le fait à votre place.</span>
          </h1>
          <div className="monter mt-9 flex flex-wrap items-center gap-5 [animation-delay:180ms]">
            <Link href="/observer" className={boutonPrincipal}>Commencer l’observation</Link>
            <a href="#comment" className="lien py-3 text-[15px] font-medium text-nuit">Voir comment ça marche</a>
          </div>
        </div>
        <div className="monter flex justify-center [animation-delay:150ms] md:justify-end">
          <Logo taille={260} anime suivreSouris decoratif />
        </div>
      </section>

      <section id="comment" className="mt-32 scroll-mt-10">
        <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-nuit/70">Comment ça marche</p>
        <h2 className="mt-3 max-w-2xl text-[32px] font-bold leading-tight tracking-[-0.03em] text-encre md:text-[40px]">Trois minutes pour confier une tâche que vous faites tous les jours.</h2>
        <div className="mt-14 space-y-20">
          {ETAPES.map((e, i) => (
            <div key={e.titre} className={`grid items-center gap-10 md:grid-cols-2 ${i % 2 ? 'md:[&>*:first-child]:order-2' : ''}`}>
              <div>
                <span className="grid h-9 w-9 place-items-center rounded-full bg-nuit font-mono text-sm text-white">{i + 1}</span>
                <h3 className="mt-5 text-2xl font-bold tracking-[-0.02em] text-encre">{e.titre}</h3>
                <p className="mt-3 max-w-md text-[17px] leading-relaxed text-texte">{e.texte}</p>
              </div>
              <div aria-hidden="true">{e.visuel}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-32">
        <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-nuit/70">Pour qui</p>
        <h2 className="mt-3 max-w-2xl text-[32px] font-bold leading-tight tracking-[-0.03em] text-encre md:text-[40px]">Toute tâche qui consiste à lire quelque part et écrire ailleurs.</h2>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {CAS.map((c) => (
            <article key={c.tache} className={`rounded-3xl border border-trait bg-surface p-7 transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-34px_rgb(11_29_69/0.5)] ${c.large ? 'md:col-span-2' : ''}`}>
              <p className="text-sm font-semibold text-nuit">{c.metier}</p>
              <p className="mt-3 text-xl font-bold tracking-tight text-encre">{c.tache}</p>
              <p className="mt-2 text-[15px] leading-relaxed text-texte">{c.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-32 grid gap-12 md:grid-cols-[1fr_1.3fr]">
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-nuit/70">Déclencheurs</p>
          <h2 className="mt-3 text-[32px] font-bold leading-tight tracking-[-0.03em] text-encre md:text-[40px]">Il travaille même quand vous n’êtes pas là.</h2>
          <p className="mt-4 max-w-sm text-[17px] leading-relaxed text-texte">Fermez l’onglet : l’agent continue, et vous recevez une notification à la fin.</p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {DECLENCHEURS.map(([titre, texte]) => (
            <li key={titre} className="rounded-2xl bg-surface p-6 shadow-[0_1px_0_#e6e6e1]">
              <p className="text-[16px] font-semibold text-encre">{titre}</p>
              <p className="mt-1.5 text-[15px] leading-relaxed text-texte">{texte}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-32 rounded-[2rem] bg-nuit px-8 py-14 text-white md:px-14">
        <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-white/60">Confiance</p>
        <h2 className="mt-3 max-w-2xl text-[32px] font-bold leading-tight tracking-[-0.03em] md:text-[40px]">Un agent qui agit à votre place doit mériter votre confiance.</h2>
        <ul className="mt-12 grid gap-8 md:grid-cols-2">
          {CONFIANCE.map(([titre, texte]) => (
            <li key={titre} className="border-t border-white/15 pt-5">
              <p className="text-[17px] font-semibold">{titre}</p>
              <p className="mt-1.5 text-[15px] leading-relaxed text-white/75">{texte}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-32 grid items-center gap-10 pb-8 md:grid-cols-[auto_1fr]">
        <Logo taille={120} anime humeur="joie" suivreSouris decoratif />
        <div>
          <h2 className="text-[32px] font-bold leading-tight tracking-[-0.03em] text-encre md:text-[44px]">Montrez une tâche une fois.<span className="block text-nuit/60">Ghost s’occupe du reste.</span></h2>
          <div className="mt-8 flex flex-wrap items-center gap-5">
            <Link href="/observer" className={boutonPrincipal}>Commencer l’observation</Link>
            <Link href="/connexion?mode=inscription" className="lien py-3 text-[15px] font-medium text-nuit">Créer un compte</Link>
          </div>
        </div>
      </section>
    </>
  );
}

import { PageEntete } from '@/components/PageEntete';

// Maquette non fonctionnelle : l'espace d'équipe tel qu'on l'imagine (organisation > espaces > membres, workflows, accès partagés).
// Données fictives, aucune action branchée.

interface Espace {
  nom: string;
  texte: string;
  ouvert: boolean;
  membres: string[];
  workflows: string[];
  acces: string[];
  large?: boolean;
}

const MEMBRES = ['CL', 'TM', 'SB', 'NR', 'AK', 'JD', 'LP', 'MV'];
const ESPACES: Espace[] = [
  {
    nom: 'Toute l’agence', texte: 'Ouvert à tous. Les workflows que chacun peut lancer.', ouvert: true, large: true,
    membres: MEMBRES, workflows: ['Publier un bien sur plusieurs portails', 'Mettre à jour un contact client'], acces: ['Google', 'Portail A', 'Portail B'],
  },
  {
    nom: 'Support client', texte: 'Tickets et fiches clients.', ouvert: false,
    membres: ['SB', 'NR', 'AK'], workflows: ['Recopier le téléphone du ticket vers le CRM'], acces: ['Zendesk', 'HubSpot'],
  },
  {
    nom: 'Comptabilité', texte: 'Factures et relances. Accès restreint.', ouvert: false,
    membres: ['CL', 'JD'], workflows: ['Saisir les factures reçues'], acces: ['Google', 'Odoo'],
  },
];
const ROLES = [
  ['Administrateur', 'Gère l’abonnement, les membres et tous les espaces.'],
  ['Membre', 'Crée et lance des workflows dans ses espaces.'],
  ['Lecteur', 'Suit les exécutions et lit les bilans, sans rien lancer.'],
] as const;

function Avatars({ ids, max = 5 }: { ids: string[]; max?: number }) {
  return (
    <div className="flex items-center">
      {ids.slice(0, max).map((x, i) => (
        <span key={x} className={`grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-nuit-clair text-[11px] font-semibold text-nuit ${i ? '-ml-2' : ''}`}>{x}</span>
      ))}
      {ids.length > max && <span className="-ml-2 grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-white text-[11px] font-semibold text-texte">+{ids.length - max}</span>}
    </div>
  );
}

const bientot = 'bouton rounded-xl border border-nuit/15 bg-white/60 px-4 py-2.5 text-sm font-semibold text-nuit/60 cursor-not-allowed';

export default function EspaceEquipe() {
  return (
    <>
      <PageEntete
        surtitre="Bientôt"
        titre="Espace d’équipe"
        description="Rassemblez vos collègues par espace, avec leurs workflows et leurs accès. Voici ce qui arrive."
      />

      {/* L'organisation */}
      <div className="carte verre monter mt-10 flex flex-wrap items-center gap-5 [animation-delay:160ms]">
        <span aria-hidden="true" className="grid h-12 w-12 place-items-center rounded-xl bg-nuit text-lg font-bold text-white">H</span>
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-semibold text-encre">Agence Horizon</p>
          <p className="text-sm text-texte">Offre Équipe · {MEMBRES.length} membres · 3 espaces</p>
        </div>
        <Avatars ids={MEMBRES} />
        <span aria-disabled="true" title="Bientôt disponible" className={bientot}>Inviter</span>
      </div>

      {/* Les espaces */}
      <h2 className="mt-16 text-2xl font-bold tracking-[-0.02em] text-encre">Espaces</h2>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {ESPACES.map((e, i) => (
          <article key={e.nom} className={`carte verre monter flex flex-col ${e.large ? 'md:col-span-2' : ''}`} style={{ animationDelay: `${220 + i * 80}ms` }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="flex items-center gap-2 text-[13px] font-medium text-texte">
                  <span aria-hidden="true" className={`h-2 w-2 rounded-full ${e.ouvert ? 'bg-succes' : 'border border-discret'}`} />
                  {e.ouvert ? 'Ouvert' : 'Restreint'}
                </p>
                <h3 className="mt-1 text-xl font-bold tracking-tight text-encre">{e.nom}</h3>
                <p className="mt-1 text-[15px] text-texte">{e.texte}</p>
              </div>
              <Avatars ids={e.membres} max={4} />
            </div>
            <div className={`mt-6 grid gap-6 ${e.large ? 'sm:grid-cols-2' : ''}`}>
              <div>
                <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-discret">Workflows</p>
                <ul className="mt-2 space-y-2">
                  {e.workflows.map((w) => (
                    <li key={w} className="flex items-center gap-2.5 rounded-xl bg-white/55 px-3 py-2.5 text-[15px] text-encre">
                      <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-succes" />{w}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-discret">Accès partagés</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {e.acces.map((a) => <span key={a} className="rounded-xl bg-nuit-clair/80 px-3 py-2 text-sm font-medium text-nuit">{a}</span>)}
                </div>
              </div>
            </div>
          </article>
        ))}
        <div className="carte monter grid place-items-center border border-dashed border-nuit/20 text-center md:col-span-2 [animation-delay:460ms]">
          <div>
            <p className="text-[15px] font-semibold text-nuit/70">Nouvel espace</p>
            <p className="mt-1 text-sm text-discret">Bientôt disponible</p>
          </div>
        </div>
      </div>

      {/* Les rôles */}
      <h2 className="mt-16 text-2xl font-bold tracking-[-0.02em] text-encre">Rôles</h2>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {ROLES.map(([nom, texte], i) => (
          <div key={nom} className="carte verre monter" style={{ animationDelay: `${500 + i * 60}ms` }}>
            <p className="text-[17px] font-semibold text-encre">{nom}</p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-texte">{texte}</p>
          </div>
        ))}
      </div>
    </>
  );
}

import Link from 'next/link';

export interface WorkflowLigne {
  id: string;
  nom: string;
  statut: string;
  surveillance: boolean;
  planification: { frequence: string; heure: string } | null;
  lien: boolean;
  en_cours: string | null;
  destinations: { site: string }[] | null;
  derniere_execution: string | null;
  reussite: number | null;
}

const DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function etat(w: WorkflowLigne): { texte: string; point: string } {
  if (w.en_cours) return { texte: 'L’agent travaille', point: 'pulse-doux bg-nuit' };
  if (w.statut !== 'pret') return { texte: 'À compléter', point: 'border border-discret' };
  if (w.surveillance) return { texte: 'En veille', point: 'bg-succes' };
  if (w.planification) return { texte: 'Planifié', point: 'bg-succes' };
  return { texte: 'Prêt', point: 'bg-succes' };
}

function declenchement(w: WorkflowLigne): string {
  const m = [
    w.surveillance && 'Nouvelle ligne',
    w.planification && (w.planification.frequence === 'heure' ? 'Toutes les heures' : `Chaque jour à ${w.planification.heure}`),
    w.lien && 'Par lien',
  ].filter(Boolean);
  return m.length ? m.join(', ') : 'À la main';
}

// Un workflow = un module en verre. Le nom et l'action d'abord ; le détail se déplie au survol (ou au clavier, toujours visible au toucher).
export function CarteWorkflow({ w, rang = 0 }: { w: WorkflowLigne; rang?: number }) {
  const e = etat(w);
  const sites = (w.destinations ?? []).map((d) => d.site).join(', ') || '—';
  const detail: [string, string][] = [
    ['Sites', sites],
    ['Déclenchement', declenchement(w)],
    ['Lancé le', w.derniere_execution ? DATE.format(new Date(w.derniere_execution)) : 'Jamais'],
    ['Réussite', w.reussite === null ? '—' : `${w.reussite} %`],
  ];
  const action = w.en_cours
    ? { href: `/workflows/${w.id}/lancer?execution=${w.en_cours}`, texte: 'Suivre', style: 'bg-nuit-clair text-nuit' }
    : w.statut === 'pret'
      ? { href: `/workflows/${w.id}/lancer`, texte: 'Lancer', style: 'bg-nuit text-white hover:shadow-[0_10px_24px_-10px_rgb(11_29_69/0.6)]' }
      : { href: `/workflows/${w.id}`, texte: 'Compléter', style: 'border border-nuit/20 bg-white/60 text-nuit' };

  return (
    <li
      className="carte carte-compacte verre group monter relative transition duration-300 hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.9),0_28px_60px_-30px_rgb(11_29_69/0.45)]"
      style={{ animationDelay: `${80 + rang * 50}ms` }}
    >
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[13px] font-medium text-texte">
            <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${e.point}`} />
            {e.texte}
          </p>
          <h3 className="mt-1 truncate text-[17px] font-semibold tracking-tight text-encre first-letter:uppercase">
            <Link href={`/workflows/${w.id}`} className="carte-lien after:absolute after:inset-0 after:rounded-[inherit]">{w.nom}</Link>
          </h3>
        </div>
        <Link href={action.href} className={`bouton relative z-10 shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold ${action.style}`}>{action.texte}</Link>
      </div>
      <div className="detail-survol">
        <div>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-encre/[0.08] pt-4 sm:grid-cols-4">
            {detail.map(([t, v]) => (
              <div key={t} className="min-w-0">
                <dt className="text-[12px] font-medium uppercase tracking-[0.08em] text-discret">{t}</dt>
                <dd className="mt-0.5 truncate text-sm text-encre">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </li>
  );
}

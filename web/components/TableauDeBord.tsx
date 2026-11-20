'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Workflow {
  id: string;
  nom: string;
  statut: string;
  surveillance: boolean;
  planification: { frequence: string; heure: string } | null;
  en_cours: string | null;
  executions: number;
  reussite: number | null;
}
interface Fin { id: string; lien: string; titre: string; texte: string }

const ACTIONS = [
  { href: '/observer', titre: 'Observer une tâche', texte: 'Montrez une nouvelle tâche à Ghost.' },
  { href: '/workflows', titre: 'Mes workflows', texte: 'Lancer, planifier, relier à un outil.' },
  { href: '/acces', titre: 'Mes accès', texte: 'Les comptes que l’agent peut utiliser.' },
];

function Chiffre({ valeur, legende }: { valeur: string; legende: string }) {
  return (
    <div className="px-6 first:pl-0">
      <p className="font-mono text-3xl font-medium tracking-tight text-encre">{valeur}</p>
      <p className="mt-1 text-sm text-texte">{legende}</p>
    </div>
  );
}

// Accueil d'un utilisateur connecté : ce qui tourne, ce qui vient de finir, et où aller.
export function TableauDeBord() {
  const [workflows, setWorkflows] = useState<Workflow[] | null>(null);
  const [fins, setFins] = useState<Fin[]>([]);

  useEffect(() => {
    const lire = () => {
      fetch('/api/workflows').then((r) => (r.ok ? r.json() : [])).then(setWorkflows).catch(() => setWorkflows([]));
      fetch('/api/notifications').then((r) => (r.ok ? r.json() : [])).then(setFins).catch(() => null);
    };
    lire();
    const t = setInterval(lire, 15_000); // ce qui tourne change : on rafraîchit sans recharger la page
    return () => clearInterval(t);
  }, []);

  if (workflows === null) {
    return <div className="mt-24 space-y-3" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="attente h-20 rounded-2xl" />)}</div>;
  }

  const enCours = workflows.filter((w) => w.en_cours);
  const automatiques = workflows.filter((w) => w.surveillance || w.planification).length;
  const executions = workflows.reduce((n, w) => n + w.executions, 0);
  const reussies = workflows.reduce((n, w) => n + Math.round(((w.reussite ?? 0) * w.executions) / 100), 0);

  return (
    <section className="mt-24" aria-label="Votre espace">
      <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-nuit/70">Votre espace</p>

      <div className="mt-5 flex flex-wrap divide-x divide-trait">
        <Chiffre valeur={String(workflows.length)} legende={workflows.length > 1 ? 'workflows' : 'workflow'} />
        <Chiffre valeur={String(enCours.length)} legende="en cours maintenant" />
        <Chiffre valeur={String(automatiques)} legende="qui se lancent seuls" />
        <Chiffre valeur={executions ? `${Math.round((reussies / executions) * 100)} %` : '—'} legende={`de réussite sur ${executions} exécution${executions > 1 ? 's' : ''}`} />
      </div>

      <div className="mt-14 grid gap-12 md:grid-cols-[1.3fr_1fr]">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-encre">En ce moment</h2>
          {enCours.length ? (
            <ul className="mt-4 space-y-2">
              {enCours.map((w) => (
                <li key={w.id}>
                  <Link href={`/workflows/${w.id}/lancer?execution=${w.en_cours}`} className="group flex items-center gap-4 rounded-2xl bg-nuit px-5 py-4 text-white transition hover:-translate-y-0.5">
                    <span aria-hidden="true" className="pulse-doux h-2 w-2 shrink-0 rounded-full bg-white" />
                    <span className="flex-1 font-semibold first-letter:uppercase">{w.nom}</span>
                    <span className="text-sm text-white/75 group-hover:text-white">Suivre →</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-2xl border border-dashed border-champ/60 px-5 py-6 text-[15px] text-texte">
              Aucun agent ne travaille en ce moment.{' '}
              {workflows.length ? <Link href="/workflows" className="lien font-medium text-nuit">Lancer un workflow</Link> : <Link href="/observer" className="lien font-medium text-nuit">Observer votre première tâche</Link>}
            </p>
          )}

          <h2 className="mt-12 text-lg font-semibold tracking-tight text-encre">Derniers résultats</h2>
          {fins.length ? (
            <ul className="mt-4 divide-y divide-trait border-y border-trait">
              {fins.slice(0, 5).map((f) => (
                <li key={f.id}>
                  <Link href={f.lien} className="group block py-4">
                    <p className={`text-[15px] font-semibold ${f.titre.startsWith('Terminé avec') ? 'text-alerte' : 'text-encre'} first-letter:uppercase`}>{f.titre}</p>
                    <p className="mt-0.5 text-sm text-texte group-hover:text-encre">{f.texte}</p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-[15px] text-discret">Les exécutions des dernières 24 heures apparaîtront ici.</p>
          )}
        </div>

        <aside>
          <h2 className="text-lg font-semibold tracking-tight text-encre">Aller à</h2>
          <ul className="mt-4 space-y-3">
            {ACTIONS.map((a) => (
              <li key={a.href}>
                <Link href={a.href} className="group block rounded-2xl border border-trait bg-surface px-5 py-4 transition hover:-translate-y-0.5 hover:border-nuit/25 hover:shadow-[0_18px_40px_-28px_rgb(11_29_69/0.5)]">
                  <span className="flex items-center justify-between text-[15px] font-semibold text-encre">
                    {a.titre}
                    <span aria-hidden="true" className="text-discret transition-transform group-hover:translate-x-1 group-hover:text-nuit">→</span>
                  </span>
                  <span className="mt-0.5 block text-sm text-texte">{a.texte}</span>
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  );
}

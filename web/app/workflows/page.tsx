'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/Logo';
import { PageEntete, boutonPrincipal } from '@/components/PageEntete';

interface Ligne {
  id: string;
  nom: string;
  statut: string;
  occurrences: number;
  surveillance: boolean;
  destinations: { site: string }[] | null;
  derniere_execution: string | null;
  executions: number;
  reussite: number | null;
}

const DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function Chiffre({ valeur, legende }: { valeur: string; legende: string }) {
  return (
    <div className="px-6 first:pl-0">
      <p className="font-mono text-3xl font-medium tracking-tight text-encre">{valeur}</p>
      <p className="mt-1 text-sm text-texte">{legende}</p>
    </div>
  );
}

export default function MesWorkflows() {
  const [liste, setListe] = useState<Ligne[] | null>(null);

  useEffect(() => {
    fetch('/api/workflows').then((r) => r.json()).then(setListe);
  }, []);

  const executions = liste?.reduce((n, w) => n + w.executions, 0) ?? 0;
  const reussites = liste?.reduce((n, w) => n + Math.round(((w.reussite ?? 0) * w.executions) / 100), 0) ?? 0;

  return (
    <>
      <PageEntete
        surtitre="Vos agents"
        titre="Mes workflows"
        description="Chaque tâche repérée devient un agent H, avec sa méthode, ses sites et ses déclencheurs."
        action={<Link href="/observer" className={boutonPrincipal}>Observer une nouvelle tâche</Link>}
      />

      {liste === null ? (
        <div className="mt-12 space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => <div key={i} className="attente h-24 rounded-2xl" />)}
        </div>
      ) : liste.length === 0 ? (
        <div className="monter mt-16 grid items-center gap-10 md:grid-cols-[auto_1fr]">
          <Logo taille={120} anime humeur="observe" decoratif />
          <div className="max-w-md">
            <p className="text-2xl font-semibold tracking-tight text-encre">Aucun workflow pour l’instant.</p>
            <p className="mt-3 text-[16px] leading-relaxed text-texte">Lancez une observation et travaillez normalement : Ghost repère vos tâches répétitives et vous propose de les confier à un agent.</p>
          </div>
        </div>
      ) : (
        <>
          <section aria-label="En bref" className="monter mt-10 flex flex-wrap divide-x divide-trait [animation-delay:200ms]">
            <Chiffre valeur={String(liste.length)} legende={liste.length > 1 ? 'workflows' : 'workflow'} />
            <Chiffre valeur={String(liste.filter((w) => w.surveillance).length)} legende="en veille automatique" />
            <Chiffre valeur={executions ? `${Math.round((reussites / executions) * 100)} %` : '—'} legende={`de réussite sur ${executions} exécution${executions > 1 ? 's' : ''}`} />
          </section>

          <ul className="mt-12 space-y-3">
            {liste.map((w, i) => (
              <li key={w.id} className="monter" style={{ animationDelay: `${260 + i * 60}ms` }}>
                <Link
                  href={`/workflows/${w.id}`}
                  className="group grid items-center gap-5 rounded-2xl border border-trait bg-surface px-6 py-5 transition duration-300 ease-[var(--ease-doux)] hover:-translate-y-0.5 hover:border-nuit/25 hover:shadow-[0_18px_40px_-28px_rgb(11_29_69/0.5)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nuit md:grid-cols-[auto_1fr_auto_auto]"
                >
                  <span className="hidden h-12 w-12 place-items-center rounded-xl bg-nuit-clair md:grid" aria-hidden="true">
                    <Logo taille={28} decoratif />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[17px] font-semibold tracking-tight text-encre first-letter:uppercase">{w.nom}</p>
                      {w.surveillance && <span className="rounded-full bg-succes-clair px-2.5 py-0.5 text-xs font-semibold text-succes">En veille</span>}
                      {w.statut !== 'pret' && <span className="rounded-full bg-nuit-clair px-2.5 py-0.5 text-xs font-semibold text-nuit">À compléter</span>}
                    </div>
                    <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Sites">
                      {(w.destinations ?? []).map((d) => (
                        <li key={d.site} className="rounded-md bg-fond px-2 py-0.5 text-xs font-medium text-texte">{d.site}</li>
                      ))}
                    </ul>
                  </div>
                  <p className="text-sm text-texte md:text-right">
                    {w.derniere_execution ? <>Dernière exécution<br /><span className="font-medium text-encre">{DATE.format(new Date(w.derniere_execution))}</span></> : 'Jamais lancé'}
                  </p>
                  <div className="flex items-center gap-4">
                    {w.reussite !== null && (
                      <div className="w-24" aria-label={`${w.reussite} % de réussite`}>
                        <p className="font-mono text-sm text-encre">{w.reussite} %</p>
                        <div className="mt-1.5 h-1.5 rounded-full bg-trait"><div className="h-1.5 rounded-full bg-nuit" style={{ width: `${w.reussite}%` }} /></div>
                      </div>
                    )}
                    <span aria-hidden="true" className="text-xl text-discret transition-transform duration-300 group-hover:translate-x-1 group-hover:text-nuit">→</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

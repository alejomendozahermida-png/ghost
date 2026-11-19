'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

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

const DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

export default function MesWorkflows() {
  const [liste, setListe] = useState<Ligne[] | null>(null);

  useEffect(() => {
    fetch('/api/workflows').then((r) => r.json()).then(setListe);
  }, []);

  return (
    <section className="mx-auto max-w-3xl pt-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <h1 className="monter text-4xl font-semibold tracking-[-0.02em]">Mes workflows</h1>
        <Link href="/observer" className="bouton rounded-full bg-nuit px-6 py-3 text-sm font-medium text-white">Observer une nouvelle tâche</Link>
      </div>

      {liste === null ? (
        <p className="mt-10 text-[15px] text-discret">Chargement…</p>
      ) : liste.length === 0 ? (
        <div className="monter mt-16 max-w-md">
          <p className="text-lg text-encre">Aucun workflow pour l’instant.</p>
          <p className="mt-2 text-[15px] text-texte">Lancez une observation et travaillez normalement : Ghost les repère pour vous.</p>
        </div>
      ) : (
        <ul className="mt-10 divide-y divide-trait border-y border-trait">
          {liste.map((w, i) => (
            <li key={w.id} className="monter" style={{ animationDelay: `${i * 60}ms` }}>
              <Link href={`/workflows/${w.id}`} className="group grid gap-3 py-6 transition-colors hover:bg-surface/70 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <p className="text-lg font-medium text-encre first-letter:uppercase group-hover:text-nuit">{w.nom}</p>
                  <p className="mt-1 text-sm text-texte">
                    {(w.destinations ?? []).map((d) => d.site).join(', ') || 'Sites à confirmer'}
                    {w.derniere_execution ? ` · dernière exécution le ${DATE.format(new Date(w.derniere_execution))}` : ' · jamais lancé'}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  {w.surveillance && <span className="rounded-full bg-succes-clair px-3 py-1.5 text-succes">En veille</span>}
                  {w.statut !== 'pret' && <span className="rounded-full bg-nuit-clair px-3 py-1.5 text-nuit">À compléter</span>}
                  {w.reussite !== null && <span className="font-mono text-discret">{w.reussite} % sur {w.executions}</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

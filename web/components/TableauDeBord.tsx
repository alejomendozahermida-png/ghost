'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CarteWorkflow, type WorkflowLigne } from '@/components/CarteWorkflow';

const REFRESH_MS = 15_000;
const MAX = 5;

// Accueil d'un utilisateur connecté : ses workflows, en modules, prêts à lancer. Le détail se lit au survol.
export function TableauDeBord() {
  const [workflows, setWorkflows] = useState<WorkflowLigne[] | null>(null);

  useEffect(() => {
    const lire = () => fetch('/api/workflows').then((r) => (r.ok ? r.json() : [])).then(setWorkflows).catch(() => setWorkflows([]));
    lire();
    const t = setInterval(lire, REFRESH_MS);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="mt-40" aria-labelledby="vos-workflows">
      <div className="flex items-end justify-between gap-4">
        <h2 id="vos-workflows" className="text-2xl font-bold tracking-[-0.02em] text-encre">Vos workflows</h2>
        <Link href="/observer" className="bouton shrink-0 rounded-full border border-white/80 bg-white/60 px-4 py-2.5 text-sm font-semibold text-nuit backdrop-blur">Observer une tâche</Link>
      </div>

      {workflows === null ? (
        <div className="mt-6 space-y-3" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="attente h-[88px] rounded-[2rem]" />)}</div>
      ) : workflows.length ? (
        <>
          <ul className="mt-6 space-y-3">
            {workflows.slice(0, MAX).map((w, i) => <CarteWorkflow key={w.id} w={w} rang={i} />)}
          </ul>
          {workflows.length > MAX && <Link href="/workflows" className="lien mt-5 inline-block text-sm font-semibold text-nuit">Voir les {workflows.length} workflows</Link>}
        </>
      ) : (
        <div className="carte verre mt-6">
          <p className="text-[17px] font-semibold text-encre">Aucun workflow pour l’instant.</p>
          <p className="mt-1 text-[15px] text-texte">Faites une tâche deux fois devant Ghost : il la reconnaîtra et vous proposera de la confier à un agent.</p>
        </div>
      )}
    </section>
  );
}

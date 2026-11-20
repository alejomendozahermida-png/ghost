'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/Logo';
import { PageEntete, boutonPrincipal } from '@/components/PageEntete';
import { CarteWorkflow, type WorkflowLigne } from '@/components/CarteWorkflow';

export default function MesWorkflows() {
  const [liste, setListe] = useState<WorkflowLigne[] | null>(null);

  useEffect(() => {
    fetch('/api/workflows').then((r) => r.json()).then(setListe);
  }, []);


  return (
    <>
      <PageEntete
        surtitre="Vos agents"
        titre="Mes workflows"
        description="Les tâches que vous avez confiées à Ghost."
        action={<Link href="/observer" className={boutonPrincipal}>Observer une nouvelle tâche</Link>}
      />

      {liste === null ? (
        <div className="mt-12 space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => <div key={i} className="attente h-[88px] rounded-[2rem]" />)}
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
        <ul className="mt-10 space-y-3">
          {liste.map((w, i) => <CarteWorkflow key={w.id} w={w} rang={i} />)}
        </ul>
      )}
    </>
  );
}

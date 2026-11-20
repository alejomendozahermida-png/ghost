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
  planification: { frequence: string; heure: string } | null;
  lien: boolean;
  en_cours: string | null;
  destinations: { site: string }[] | null;
  derniere_execution: string | null;
  executions: number;
  reussite: number | null;
}

const DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function MesWorkflows() {
  const [liste, setListe] = useState<Ligne[] | null>(null);

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
        <ul className="mt-10 divide-y divide-trait border-y border-trait">
          {liste.map((w, i) => {
            const modes = [w.en_cours && 'En cours', w.surveillance && 'En veille', w.planification && 'Planifié', w.lien && 'Par lien', w.statut !== 'pret' && 'À compléter'].filter(Boolean) as string[];
            const sites = (w.destinations ?? []).map((d) => d.site).join(', ');
            return (
              <li key={w.id} className="monter flex items-center gap-5 py-5" style={{ animationDelay: `${120 + i * 50}ms` }}>
                <Link href={`/workflows/${w.id}`} className="group min-w-0 flex-1 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-nuit">
                  <p className="truncate text-[17px] font-semibold tracking-tight text-encre transition-colors first-letter:uppercase group-hover:text-nuit">{w.nom}</p>
                  <p className="mt-1 truncate text-[15px] text-texte">
                    {[modes.join(' · ') || 'À la main', sites, w.derniere_execution ? `dernière fois le ${DATE.format(new Date(w.derniere_execution))}` : 'jamais lancé'].filter(Boolean).join(' — ')}
                  </p>
                </Link>
                {w.reussite !== null && <p className="hidden shrink-0 font-mono text-sm text-texte sm:block" title="Réussite">{w.reussite} %</p>}
                {w.en_cours ? (
                  <Link href={`/workflows/${w.id}/lancer?execution=${w.en_cours}`} className="shrink-0 rounded-full bg-nuit/[0.07] px-4 py-2 text-sm font-semibold text-nuit backdrop-blur">Suivre</Link>
                ) : w.statut === 'pret' ? (
                  <Link href={`/workflows/${w.id}/lancer`} className="bouton shrink-0 rounded-full bg-nuit px-4 py-2 text-sm font-semibold text-white">Lancer</Link>
                ) : (
                  <Link href={`/workflows/${w.id}`} className="shrink-0 text-sm font-semibold text-nuit">Compléter</Link>
                )}
              </li>
            );
          })}
        </ul>
        </>
      )}
    </>
  );
}

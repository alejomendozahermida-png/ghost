'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Workflow {
  id: string;
  nom: string;
  statut: string;
  surveillance: boolean;
  planification: { frequence: string; heure: string } | null;
  lien: boolean;
  en_cours: string | null;
}
interface Fin { id: string; lien: string; nom: string; statut: string; quand: string; texte: string }

const REFRESH_MS = 15_000;

function ilYa(iso: string): string {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `il y a ${h} h` : 'hier';
}

function mode(w: Workflow): string {
  if (w.statut !== 'pret') return 'À compléter';
  const m = [w.surveillance && 'En veille', w.planification && (w.planification.frequence === 'heure' ? 'Toutes les heures' : `Chaque jour à ${w.planification.heure}`), w.lien && 'Par lien'].filter(Boolean);
  return m.length ? m.join(' · ') : 'À la main';
}

// Accueil d'un utilisateur connecté : ses workflows à lancer, ce qui tourne, et les dernières exécutions. Rien d'autre.
export function TableauDeBord() {
  const [workflows, setWorkflows] = useState<Workflow[] | null>(null);
  const [fins, setFins] = useState<Fin[]>([]);

  useEffect(() => {
    const lire = () => {
      fetch('/api/workflows').then((r) => (r.ok ? r.json() : [])).then(setWorkflows).catch(() => setWorkflows([]));
      fetch('/api/notifications').then((r) => (r.ok ? r.json() : [])).then(setFins).catch(() => null);
    };
    lire();
    const t = setInterval(lire, REFRESH_MS);
    return () => clearInterval(t);
  }, []);

  if (workflows === null) return <div className="mt-40 space-y-2" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="attente h-16 rounded-2xl" />)}</div>;

  const enCours = workflows.filter((w) => w.en_cours);
  const dernier = (nom: string) => fins.find((f) => f.nom === nom);

  return (
    <section className="mt-40" aria-label="Votre espace">
      {enCours.length > 0 && (
        <Link
          href={`/workflows/${enCours[0].id}/lancer?execution=${enCours[0].en_cours}`}
          className="monter group mb-8 flex items-center gap-3 rounded-2xl border border-nuit/10 bg-nuit/[0.06] px-5 py-3.5 backdrop-blur transition hover:bg-nuit/10"
        >
          <span aria-hidden="true" className="pulse-doux h-2 w-2 rounded-full bg-nuit" />
          <span className="flex-1 text-[15px] text-encre">
            <b className="font-semibold">{enCours.length === 1 ? enCours[0].nom : `${enCours.length} agents`}</b>
            {enCours.length === 1 ? ' : l’agent travaille' : ' travaillent en ce moment'}
          </span>
          <span className="text-sm font-semibold text-nuit transition group-hover:translate-x-0.5">Suivre →</span>
        </Link>
      )}

      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-2xl font-bold tracking-[-0.02em] text-encre">Vos workflows</h2>
        <Link href="/observer" className="lien text-[15px] font-semibold text-nuit">+ Observer une tâche</Link>
      </div>

      {workflows.length ? (
        <ul className="mt-5 divide-y divide-trait border-y border-trait">
          {workflows.slice(0, 6).map((w) => {
            const f = dernier(w.nom);
            return (
              <li key={w.id} className="flex items-center gap-4 py-4">
                <Link href={`/workflows/${w.id}`} className="group min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-semibold text-encre transition-colors first-letter:uppercase group-hover:text-nuit">{w.nom}</span>
                  <span className="mt-0.5 block truncate text-sm text-texte">
                    {mode(w)}
                    {f && <> · {f.statut === 'completed' ? 'fait' : <span className="text-alerte">erreur</span>} {ilYa(f.quand)}</>}
                  </span>
                </Link>
                {w.en_cours ? (
                  <Link href={`/workflows/${w.id}/lancer?execution=${w.en_cours}`} className="shrink-0 text-sm font-semibold text-nuit">Suivre</Link>
                ) : w.statut === 'pret' ? (
                  <Link href={`/workflows/${w.id}/lancer`} className="bouton shrink-0 rounded-full bg-nuit px-4 py-2 text-sm font-semibold text-white">Lancer</Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-5 text-[16px] text-texte">Aucun workflow pour l’instant. Faites une tâche deux fois devant Ghost : il la reconnaîtra.</p>
      )}
      {workflows.length > 6 && <Link href="/workflows" className="lien mt-4 inline-block text-sm font-medium text-nuit">Voir les {workflows.length} workflows</Link>}

      {fins.length > 0 && (
        <>
          <h3 className="mt-14 text-lg font-semibold tracking-tight text-encre">Dernières exécutions</h3>
          <ul className="mt-3 space-y-1">
            {fins.slice(0, 3).map((f) => (
              <li key={f.id}>
                <Link href={f.lien} className="-mx-3 flex items-baseline gap-3 rounded-xl px-3 py-2.5 transition hover:bg-surface">
                  <span aria-hidden="true" className={`h-2 w-2 shrink-0 translate-y-[-1px] rounded-full ${f.statut === 'completed' ? 'bg-succes' : 'bg-alerte'}`} />
                  <span className="min-w-0 flex-1 truncate text-[15px] text-encre"><b className="font-semibold first-letter:uppercase">{f.nom}</b> <span className="text-texte">· {f.texte}</span></span>
                  <span className="shrink-0 text-sm text-texte">{ilYa(f.quand)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

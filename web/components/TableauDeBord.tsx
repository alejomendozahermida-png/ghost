'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/Logo';
import { boutonPrincipal } from '@/components/PageEntete';

interface Workflow {
  id: string;
  nom: string;
  statut: string;
  surveillance: boolean;
  planification: { frequence: string; heure: string } | null;
  lien: boolean;
  en_cours: string | null;
}
interface Fin { id: string; lien: string; nom: string; statut: string; origine: string; quand: string; duree_s: number | null; texte: string }

const ORIGINE: Record<string, string> = { manuel: 'Lancé par vous', veille: 'Nouvelle ligne du Sheet', planifie: 'Heure planifiée', webhook: 'Lien de déclenchement' };
const REFRESH_MS = 15_000;

function ilYa(iso: string): string {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `il y a ${h} h` : 'hier';
}
const duree = (s: number | null) => (s == null ? null : s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')}`);

// Accueil d'un utilisateur connecté : d'abord l'état en une phrase, puis ce qui tourne, ce qui vient de finir, et ses workflows à portée de main.
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

  if (workflows === null) {
    return <div className="mt-24 grid gap-4 md:grid-cols-[1.4fr_1fr]" aria-busy="true"><div className="attente h-64 rounded-3xl" /><div className="attente h-64 rounded-3xl" /></div>;
  }

  const enCours = workflows.filter((w) => w.en_cours);
  const prets = workflows.filter((w) => w.statut === 'pret');
  const etat = enCours.length
    ? `${enCours.length === 1 ? 'Un agent travaille' : `${enCours.length} agents travaillent`} pour vous en ce moment.`
    : prets.length
      ? `Tout est calme. ${prets.length === 1 ? 'Un workflow est prêt' : `${prets.length} workflows sont prêts`} à travailler.`
      : 'Montrez une première tâche à Ghost pour commencer.';

  return (
    <section className="mt-40" aria-label="Votre espace">
      <h2 className="max-w-2xl text-[32px] font-bold leading-tight tracking-[-0.03em] text-encre md:text-[40px]">{etat}</h2>

      <div className="mt-10 grid gap-4 md:grid-cols-[1.4fr_1fr]">
        {/* La carte principale : les agents au travail, sinon l'invitation à confier une nouvelle tâche. */}
        {enCours.length ? (
          <div className="rounded-3xl bg-nuit p-8 text-white shadow-[0_30px_70px_-40px_rgb(11_29_69/0.8)]">
            <div className="flex items-center gap-4">
              <Logo taille={48} anime humeur="travaille" couleur="#ffffff" decoratif />
              <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-white/70">En ce moment</p>
            </div>
            <ul className="mt-6 space-y-2">
              {enCours.map((w) => (
                <li key={w.id}>
                  <Link href={`/workflows/${w.id}/lancer?execution=${w.en_cours}`} className="group flex items-center gap-4 rounded-2xl bg-white/10 px-5 py-4 transition hover:bg-white/15">
                    <span aria-hidden="true" className="pulse-doux h-2 w-2 shrink-0 rounded-full bg-white" />
                    <span className="flex-1 text-[16px] font-semibold first-letter:uppercase">{w.nom}</span>
                    <span className="text-sm text-white/75 transition group-hover:translate-x-0.5 group-hover:text-white">Suivre →</span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-sm text-white/70">Vous pouvez fermer la page : une notification arrivera à la fin.</p>
          </div>
        ) : (
          <div className="flex flex-col justify-between gap-8 rounded-3xl border border-trait bg-surface p-8 md:flex-row md:items-center">
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-nuit/70">Nouvelle tâche</p>
              <p className="mt-3 max-w-sm text-xl font-bold leading-snug tracking-tight text-encre">Une tâche vous prend encore du temps ? Faites-la deux fois devant Ghost.</p>
              <Link href="/observer" className={`${boutonPrincipal} mt-6`}>Commencer l’observation</Link>
            </div>
            <Logo taille={96} anime humeur="observe" decoratif />
          </div>
        )}

        {/* Activité récente, datée : chaque exécution avec son état, son origine et sa durée. */}
        <div className="rounded-3xl border border-trait bg-surface p-8">
          <div className="flex items-baseline justify-between">
            <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-nuit/70">Activité</p>
            <p className="text-xs text-discret">24 dernières heures</p>
          </div>
          {fins.length ? (
            <ol className="mt-5 space-y-1">
              {fins.slice(0, 4).map((f) => {
                const ok = f.statut === 'completed';
                return (
                  <li key={f.id}>
                    <Link href={f.lien} className="group -mx-3 flex gap-3 rounded-xl px-3 py-3 transition hover:bg-fond">
                      <span aria-hidden="true" className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${ok ? 'bg-succes' : 'bg-alerte'}`} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="truncate text-[15px] font-semibold text-encre first-letter:uppercase">{f.nom}</span>
                          <span className="shrink-0 text-xs text-discret">{ilYa(f.quand)}</span>
                        </span>
                        <span className={`mt-0.5 block text-sm ${ok ? 'text-texte' : 'text-alerte'}`}>{ok ? '' : 'Erreur · '}{f.texte}</span>
                        <span className="mt-1 block text-xs text-discret">{[ORIGINE[f.origine] ?? 'Lancé', duree(f.duree_s)].filter(Boolean).join(' · ')}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="mt-5 text-[15px] leading-relaxed text-texte">Rien ces dernières 24 heures. Chaque exécution apparaîtra ici, même lancée sans vous.</p>
          )}
        </div>
      </div>

      {/* Les workflows à portée de main : lancer en un clic, voir d'un coup d'œil ce qui se lance seul. */}
      {workflows.length > 0 && (
        <div className="mt-14">
          <div className="flex items-baseline justify-between">
            <h3 className="text-lg font-semibold tracking-tight text-encre">Vos workflows</h3>
            <Link href="/workflows" className="lien text-sm font-medium text-nuit">Tout voir</Link>
          </div>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {workflows.slice(0, 4).map((w) => {
              const seul = [w.surveillance && 'En veille', w.planification && (w.planification.frequence === 'heure' ? 'Toutes les heures' : `Planifié à ${w.planification.heure}`), w.lien && 'Lien actif'].filter(Boolean);
              return (
                <li key={w.id} className="flex items-center gap-4 rounded-2xl border border-trait bg-surface px-5 py-4">
                  <Link href={`/workflows/${w.id}`} className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-encre first-letter:uppercase hover:text-nuit">{w.nom}</span>
                    <span className="mt-0.5 block truncate text-xs text-discret">{w.statut !== 'pret' ? 'À compléter' : seul.length ? seul.join(' · ') : 'Lancement à la main'}</span>
                  </Link>
                  {w.statut === 'pret' && !w.en_cours && (
                    <Link href={`/workflows/${w.id}/lancer`} className="bouton shrink-0 rounded-full bg-nuit px-4 py-2 text-sm font-semibold text-white">Lancer</Link>
                  )}
                  {w.en_cours && <span className="shrink-0 rounded-full bg-nuit-clair px-3 py-1.5 text-xs font-semibold text-nuit">En cours</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

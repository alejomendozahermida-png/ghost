'use client';

import { useEffect, useState } from 'react';
import { Logo } from '@/components/Logo';

interface Action {
  texte: string;
  x: number | null;
  y: number | null;
  clic: boolean;
}
interface Vue {
  titre: string | null;
  site: string | null;
  capture: number;
  actions: Action[];
}

// Ce que voit l'agent, en direct : sa dernière capture, l'endroit où il agit, et le fil de ses actions.
export function EcranAgent({ executionId, actif, phrase }: { executionId: string; actif: boolean; phrase: string }) {
  const [vue, setVue] = useState<Vue | null>(null);
  const [image, setImage] = useState<string | null>(null);

  useEffect(() => {
    if (!actif) return;
    let vivant = true;
    const lire = async () => {
      const r = await fetch(`/api/executions/${executionId}/direct`).catch(() => null);
      const v = r?.ok ? ((await r.json()) as Vue | null) : null;
      if (!vivant || !v) return;
      setVue(v);
      if (v.capture) {
        // On charge la nouvelle capture avant de l'afficher : l'écran change sans clignoter.
        const src = `/api/executions/${executionId}/ecran?n=${v.capture}`;
        const img = new Image();
        img.onload = () => vivant && setImage(src);
        img.src = src;
      }
    };
    lire();
    const i = setInterval(lire, 2500);
    return () => {
      vivant = false;
      clearInterval(i);
    };
  }, [executionId, actif]);

  const derniere = vue?.actions[0];

  return (
    <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
      <figure className="monter overflow-hidden rounded-2xl border border-trait bg-surface shadow-[0_30px_70px_-40px_rgb(11_29_69/0.45)]">
        <div className="flex items-center gap-3 border-b border-trait px-4 py-3">
          <span className="flex gap-1.5" aria-hidden="true">
            <i className="h-2.5 w-2.5 rounded-full bg-trait" /><i className="h-2.5 w-2.5 rounded-full bg-trait" /><i className="h-2.5 w-2.5 rounded-full bg-trait" />
          </span>
          <span className="min-w-0 flex-1 truncate rounded-full bg-fond px-4 py-1.5 font-mono text-xs text-texte">
            {vue?.site ?? 'Le navigateur de l’agent démarre…'}
          </span>
        </div>
        <div className="relative aspect-[1200/838] bg-fond">
          {image ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- capture privée relayée par notre serveur, rien à optimiser */}
              <img key={image} src={image} alt={`Écran de l’agent : ${vue?.titre ?? 'page en cours'}`} className="fondu absolute inset-0 h-full w-full object-cover object-top" />
              {derniere?.x != null && derniere.y != null && (
                <span className="pointer-events-none absolute" style={{ left: `${derniere.x * 100}%`, top: `${derniere.y * 100 * (1200 / 838)}%` }} aria-hidden="true">
                  {derniere.clic && <span className="onde absolute left-0 top-0 h-10 w-10 rounded-full border-2 border-nuit" />}
                  <span className="absolute left-0 top-0 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-nuit ring-4 ring-white/80 transition-[left,top] duration-500" />
                </span>
              )}
            </>
          ) : (
            <div className="attente flex h-full flex-col items-center justify-center gap-5">
              <Logo taille={88} anime humeur="travaille" decoratif />
              <p className="text-sm text-texte">L’agent ouvre son navigateur…</p>
            </div>
          )}
        </div>
      </figure>

      <div>
        <div className="flex items-center gap-4">
          <Logo taille={52} anime humeur={actif ? 'travaille' : 'repos'} decoratif />
          <p className="text-[15px] font-medium text-encre">{phrase}</p>
        </div>
        <h2 className="mt-8 text-sm font-medium uppercase tracking-[0.14em] text-discret">Ce que fait l’agent</h2>
        {vue?.actions.length ? (
          <ol aria-live="polite" aria-relevant="additions" className="mt-3 space-y-1">
            {vue.actions.map((a, i) => (
              <li key={`${vue.actions.length - i}-${a.texte}`} className={`monter flex gap-3 rounded-xl px-3 py-2.5 text-[15px] ${i === 0 ? 'bg-nuit-clair text-nuit' : 'text-texte'}`}>
                <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${i === 0 ? 'pulse-doux bg-nuit' : 'bg-trait'}`} aria-hidden="true" />
                {a.texte}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-[15px] text-discret">Les actions de l’agent s’afficheront ici.</p>
        )}
      </div>
    </div>
  );
}

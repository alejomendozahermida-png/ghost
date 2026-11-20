'use client';

import { useEffect, useRef, useState } from 'react';
import { Logo } from '@/components/Logo';

interface Action {
  texte: string;
  x: number | null;
  y: number | null;
  clic: boolean;
}
interface Vue {
  session: string;
  titre: string | null;
  site: string | null;
  capture: number;
  actions: Action[];
}

// Ce que voit l'agent, en direct : sa dernière capture, l'endroit où il agit, et le fil de ses actions.
const INTERVALLE_LECTURE_MS = 1500;
const PAS_IMAGE_MS = 800; // une capture toutes les 0,8 s : léger décalage, mais un défilement continu
const RETARD_MAX = 6; // au-delà, on saute les plus anciennes pour ne pas trop traîner derrière l'agent

// Ce que voit l'agent, en direct : chacune de ses captures rejouée dans l'ordre avec un fondu, l'endroit où il agit, et le fil de ses actions.
export function EcranAgent({ executionId, actif, phrase }: { executionId: string; actif: boolean; phrase: string }) {
  const [vue, setVue] = useState<Vue | null>(null);
  const [images, setImages] = useState<{ avant: string | null; maintenant: string | null }>({ avant: null, maintenant: null });
  const file = useRef<string[]>([]);
  const vues = useRef<Map<string, number>>(new Map()); // dernière capture mise en file, par session

  // 1. Lecture : chaque nouvelle capture de chaque agent entre dans la file.
  useEffect(() => {
    if (!actif) return;
    let vivant = true;
    const lire = async () => {
      const r = await fetch(`/api/executions/${executionId}/direct`).catch(() => null);
      const v = r?.ok ? ((await r.json()) as Vue | null) : null;
      if (!vivant || !v) return;
      setVue(v);
      const deja = vues.current.get(v.session) ?? Math.max(0, v.capture - 1); // en arrivant, on part de la dernière
      for (let n = deja + 1; n <= v.capture; n++) file.current.push(`/api/executions/${executionId}/ecran?s=${v.session}&n=${n}`);
      vues.current.set(v.session, Math.max(deja, v.capture));
      if (file.current.length > RETARD_MAX) file.current = file.current.slice(-RETARD_MAX);
    };
    lire();
    const i = setInterval(lire, INTERVALLE_LECTURE_MS);
    return () => {
      vivant = false;
      clearInterval(i);
    };
  }, [executionId, actif]);

  // 2. Lecture à rythme régulier : l'image suivante est chargée avant d'être montrée, puis fond sur la précédente.
  useEffect(() => {
    let vivant = true;
    let occupe = false;
    const t = setInterval(() => {
      const src = file.current[0];
      if (!src || occupe) return;
      occupe = true;
      const img = new Image();
      img.onload = img.onerror = () => {
        file.current.shift();
        occupe = false;
        if (vivant && img.naturalWidth) setImages((x) => ({ avant: x.maintenant, maintenant: src }));
      };
      img.src = src;
    }, PAS_IMAGE_MS);
    return () => {
      vivant = false;
      clearInterval(t);
    };
  }, []);
  const image = images.maintenant;

  const derniere = vue?.actions[0];

  return (
    <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
      <figure className="monter overflow-hidden verre rounded-2xl">
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
              {/* L'image précédente reste dessous pendant le fondu : pas d'éclair entre deux captures. */}
              {images.avant && (
                // eslint-disable-next-line @next/next/no-img-element -- capture privée relayée par notre serveur, rien à optimiser
                <img src={images.avant} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover object-top" />
              )}
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

      {/* Sur ordinateur, la colonne prend la hauteur de l'écran de l'agent ; seule la liste des actions défile. */}
      <div className="flex flex-col lg:relative">
        <div className="flex flex-col lg:absolute lg:inset-0">
        <div className="flex shrink-0 items-center gap-4">
          <Logo taille={52} anime humeur={actif ? 'travaille' : 'repos'} decoratif />
          <p className="text-[15px] font-medium text-encre">{phrase}</p>
        </div>
        <h2 className="mt-8 shrink-0 text-sm font-medium uppercase tracking-[0.14em] text-discret">Ce que fait l’agent</h2>
        {vue?.actions.length ? (
          <ol aria-live="polite" aria-relevant="additions" className="defile mt-3 max-h-80 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1 lg:max-h-none">
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
    </div>
  );
}

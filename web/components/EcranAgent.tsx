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
const ZOOM = 1.45; // gros plan sur l'endroit où l'agent agit
const ZOOM_MS = 5000; // durée du gros plan après une action
const REFLEXION_MS = 2500; // sans image ni action depuis ce temps : « l'agent réfléchit »

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

  // Perception de fluidité : entre deux captures, la caméra, le curseur et la saisie bougent en continu.
  // 1. Caméra : elle s'approche de l'endroit où l'agent agit, puis recule s'il ne se passe plus rien.
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const [depuis, setDepuis] = useState({ cle: '', t: 0 }); // quand la dernière action est apparue
  const [derniereImage, setDerniereImage] = useState(0);
  const cleAction = derniere ? `${vue?.actions.length}-${derniere.texte}` : '';
  useEffect(() => { if (cleAction) setDepuis({ cle: cleAction, t: Date.now() }); }, [cleAction]);
  useEffect(() => { if (image) setDerniereImage(Date.now()); }, [image]);
  useEffect(() => {
    if (!actif) return;
    const t = setInterval(() => setMaintenant(Date.now()), 250);
    return () => clearInterval(t);
  }, [actif]);
  const recente = !!derniere && maintenant - depuis.t < ZOOM_MS;
  const point = derniere?.x != null && derniere.y != null ? { x: derniere.x * 100, y: derniere.y * 100 * (1200 / 838) } : null;
  const zoom = actif && recente && point ? ZOOM : 1;

  // 2. Saisie : le texte écrit par l'agent apparaît lettre par lettre près du curseur.
  const ecrit = derniere && /^Écrit « (.*) » dans/.exec(derniere.texte)?.[1];
  const [tape, setTape] = useState('');
  useEffect(() => {
    if (!ecrit) return setTape('');
    let n = 0;
    const t = setInterval(() => { n += 1; setTape(ecrit.slice(0, n)); if (n >= ecrit.length) clearInterval(t); }, Math.max(18, Math.min(45, 1400 / ecrit.length)));
    return () => clearInterval(t);
  }, [ecrit, cleAction]);

  // 3. Réflexion : sans nouvelle image depuis un moment, on le dit au lieu de laisser un écran figé.
  const reflechit = actif && !!image && maintenant - Math.max(derniereImage, depuis.t) > REFLEXION_MS;

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
        <div className="relative aspect-[1200/838] overflow-hidden bg-fond">
          {image ? (
            <>
              {/* Caméra : tout le contenu (captures et curseur) zoome ensemble vers l'action, en douceur. */}
              <div
                className={`camera absolute inset-0 ${zoom === 1 && actif ? 'derive' : ''}`}
                style={{ transform: `scale(${zoom})`, transformOrigin: point ? `${point.x}% ${point.y}%` : '50% 30%' }}
              >
                {/* L'image précédente reste dessous pendant le fondu : pas d'éclair entre deux captures. */}
                {images.avant && (
                  // eslint-disable-next-line @next/next/no-img-element -- capture privée relayée par notre serveur, rien à optimiser
                  <img src={images.avant} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover object-top" />
                )}
                {/* eslint-disable-next-line @next/next/no-img-element -- capture privée relayée par notre serveur, rien à optimiser */}
                <img key={image} src={image} alt={`Écran de l’agent : ${vue?.titre ?? 'page en cours'}`} className="fondu absolute inset-0 h-full w-full object-cover object-top [animation-duration:700ms]" />
                {point && (
                  <span className="curseur pointer-events-none absolute" style={{ left: `${point.x}%`, top: `${point.y}%` }} aria-hidden="true">
                    {derniere?.clic && <span key={cleAction} className="onde absolute left-0 top-0 h-10 w-10 rounded-full border-2 border-nuit" />}
                    <svg width="22" height="22" viewBox="0 0 24 24" className="absolute -left-[3px] -top-[2px] drop-shadow-[0_2px_4px_rgb(11_29_69/0.35)]">
                      <path d="M4 2 L4 19 L8.5 14.8 L11.6 21.5 L14.4 20.3 L11.3 13.7 L17.5 13.7 Z" fill="#0b1d45" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
                    </svg>
                    {tape && (
                      <span className="absolute left-5 top-5 max-w-[16rem] truncate rounded-lg bg-nuit px-2.5 py-1.5 font-mono text-[12px] text-white shadow-[0_8px_20px_-8px_rgb(11_29_69/0.6)]">
                        {tape}<span className="ml-px inline-block h-3 w-px translate-y-0.5 animate-pulse bg-white" />
                      </span>
                    )}
                  </span>
                )}
              </div>
              {reflechit && (
                <span className="fondu absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-white/85 px-3 py-1.5 text-[12px] font-medium text-nuit shadow-[0_6px_16px_-8px_rgb(11_29_69/0.5)] backdrop-blur">
                  <span className="flex gap-1" aria-hidden="true">{[0, 1, 2].map((k) => <span key={k} className="pulse-doux h-1.5 w-1.5 rounded-full bg-nuit" style={{ animationDelay: `${k * 0.2}s` }} />)}</span>
                  L’agent réfléchit…
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

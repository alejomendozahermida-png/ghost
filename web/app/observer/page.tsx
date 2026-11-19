'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Logo } from '@/components/Logo';

type Etat = 'pret' | 'en_cours' | 'pause';
interface Ligne {
  id: number;
  site: string | null;
  texte: string;
}
interface Repere {
  id: string;
  nom: string;
  occurrences: number;
}
interface Etape {
  id: number;
  site: string | null;
  ecran: string | null;
  action: string | null;
  champ: string | null;
  valeur: string | null;
  fin_de_tache: boolean;
}

const INTERVALLE_MS = 2000;
const SEUIL_CHANGEMENT = 3; // écart moyen de gris (0-255) entre deux vignettes au-delà duquel l'écran a changé

function phrase(e: Etape): string {
  if (e.fin_de_tache) return `Termine : ${e.ecran ?? 'confirmation affichée'}`;
  const sur = e.champ ? ` « ${e.champ} »` : '';
  switch (e.action) {
    case 'type': return `Remplit${sur}${e.valeur ? ` : ${e.valeur}` : ''}`;
    case 'click': case 'submit': return `Clique sur${sur}`;
    case 'select': return `Choisit${sur}${e.valeur ? ` : ${e.valeur}` : ''}`;
    case 'check': return `Coche${sur}`;
    case 'read': return `Lit ${e.ecran ?? 'la page'}`;
    default: return `Ouvre ${e.ecran ?? 'une page'}`;
  }
}

function duree(s: number): string {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export default function Observer() {
  const [etat, setEtat] = useState<Etat>('pret');
  const [secondes, setSecondes] = useState(0);
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [repere, setRepere] = useState<Repere | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [illisibles, setIllisibles] = useState(0); // captures que Holo n'a pas pu lire
  const flux = useRef<MediaStream | null>(null);
  const pause = useRef(false);

  useEffect(() => {
    pause.current = etat === 'pause';
    if (etat !== 'en_cours') return;
    const t = setInterval(() => setSecondes((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [etat]);

  useEffect(() => () => flux.current?.getTracks().forEach((t) => t.stop()), []);

  function arreter() {
    flux.current?.getTracks().forEach((t) => t.stop());
    flux.current = null;
    setEtat('pret');
  }

  async function demarrer() {
    setErreur(null);
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') await Notification.requestPermission();
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 5 }, audio: false });
    } catch {
      setErreur('Le partage d’écran a été refusé. Sans lui, Ghost ne peut rien voir.');
      return;
    }
    const r = await fetch('/api/observations', { method: 'POST' });
    if (!r.ok) {
      stream.getTracks().forEach((t) => t.stop());
      setErreur('Impossible de démarrer l’observation. Réessayez.');
      return;
    }
    const { id } = (await r.json()) as { id: string };
    flux.current = stream;
    stream.getVideoTracks()[0].addEventListener('ended', arreter); // bouton « Arrêter le partage » de Chrome
    setSecondes(0);
    setLignes([]);
    setRepere(null);
    setIllisibles(0);
    setEtat('en_cours');
    observer(id, stream);
  }

  // Une image toutes les 2 s ; seules celles qui ont changé partent au serveur, une à la fois.
  function observer(id: string, stream: MediaStream) {
    const video = document.createElement('video');
    video.muted = true;
    video.srcObject = stream;
    video.play();
    const mini = document.createElement('canvas');
    mini.width = 32;
    mini.height = 18;
    const grande = document.createElement('canvas');
    let precedente: Uint8ClampedArray | null = null;
    let enVol = false;
    let enAttente: string | null = null;
    let notifie = false;

    async function envoyer(image: string) {
      enVol = true;
      const r = await fetch(`/api/observations/${id}/captures`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image }),
      }).catch(() => null);
      const d = r?.ok ? ((await r.json()) as { etape: Etape | null; workflow: Repere | null; erreur?: string }) : null;
      if (!d || d.erreur) setIllisibles((n) => n + 1);
      if (d?.etape) {
        const e = d.etape;
        setLignes((ls) => [{ id: e.id, site: e.site, texte: phrase(e) }, ...ls]);
      }
      if (d?.workflow && !notifie) {
        notifie = true;
        setRepere(d.workflow);
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification('Workflow repéré', { body: `${d.workflow.nom}. Vous l’avez fait ${d.workflow.occurrences} fois.` });
        }
      }
      enVol = false;
      if (enAttente) {
        const suivante = enAttente;
        enAttente = null;
        envoyer(suivante);
      }
    }

    const minuteur = setInterval(() => {
      if (!flux.current) return clearInterval(minuteur);
      if (pause.current || !video.videoWidth) return;
      const m = mini.getContext('2d', { willReadFrequently: true })!;
      m.drawImage(video, 0, 0, 32, 18);
      const pixels = m.getImageData(0, 0, 32, 18).data;
      let ecart = 0;
      if (precedente) for (let i = 0; i < pixels.length; i += 4) ecart += Math.abs(pixels[i] - precedente[i]);
      const change = !precedente || ecart / (pixels.length / 4) > SEUIL_CHANGEMENT;
      precedente = pixels;
      if (!change) return;
      const echelle = Math.min(1, 1280 / video.videoWidth);
      grande.width = Math.round(video.videoWidth * echelle);
      grande.height = Math.round(video.videoHeight * echelle);
      grande.getContext('2d')!.drawImage(video, 0, 0, grande.width, grande.height);
      const image = grande.toDataURL('image/jpeg', 0.7);
      if (enVol) enAttente = image; // on garde seulement la plus récente
      else envoyer(image);
    }, INTERVALLE_MS);
  }

  if (etat === 'pret') {
    return (
      <section className="mx-auto max-w-2xl pt-16">
        <h1 className="monter text-4xl font-semibold tracking-[-0.02em]">Observer votre travail</h1>
        <p className="monter mt-4 text-lg leading-relaxed text-texte [animation-delay:80ms]">
          Partagez votre fenêtre Chrome, puis travaillez comme d’habitude. Ghost vous prévient dès qu’une tâche se répète.
        </p>
        <ul className="monter mt-10 space-y-4 border-l border-trait pl-6 text-[15px] text-texte [animation-delay:160ms]">
          <li>Aucune vidéo n’est enregistrée : seule la description de chaque écran est gardée.</li>
          <li>Les pages de connexion sont ignorées. Mettez en pause pour toute action privée.</li>
          <li>Vous arrêtez quand vous voulez.</li>
        </ul>
        <button
          onClick={demarrer}
          className="bouton monter mt-12 rounded-full bg-nuit px-7 py-3.5 text-[15px] font-medium text-white hover:shadow-[0_10px_30px_-10px_rgb(11_29_69/0.6)] [animation-delay:240ms]"
        >
          Démarrer l’observation
        </button>
        {erreur && <p role="alert" className="mt-6 text-[15px] text-alerte">{erreur}</p>}
      </section>
    );
  }

  return (
    <section className="grid gap-12 pt-10 md:grid-cols-[1fr_1.5fr]">
      <aside className="md:sticky md:top-10 md:self-start">
        <Logo taille={120} anime={etat === 'en_cours'} decoratif />
        <div className="mt-8 flex items-center gap-3">
          <span className={`h-2.5 w-2.5 rounded-full ${etat === 'en_cours' ? 'pulse-doux bg-alerte' : 'bg-discret'}`} />
          <span className="text-[15px] font-medium">{etat === 'en_cours' ? 'Observation en cours' : 'En pause'}</span>
          <span className="font-mono text-[15px] text-discret">{duree(secondes)}</span>
        </div>
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => setEtat(etat === 'en_cours' ? 'pause' : 'en_cours')}
            className="bouton rounded-full border border-trait bg-surface px-5 py-3 text-sm font-medium hover:border-encre/30"
          >
            {etat === 'en_cours' ? 'Pause' : 'Reprendre'}
          </button>
          <button onClick={arreter} className="bouton rounded-full px-5 py-3 text-sm font-medium text-alerte hover:bg-alerte-clair">
            Arrêter
          </button>
        </div>
      </aside>

      <div>
        {repere && (
          <div role="status" className="monter mb-10 rounded-2xl bg-nuit p-7 text-white shadow-[0_24px_60px_-24px_rgb(11_29_69/0.7)]">
            <p className="text-sm text-white/70">Workflow repéré</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{repere.nom}</p>
            <p className="mt-2 text-[15px] text-white/70">Vous l’avez fait {repere.occurrences} fois. Ghost peut le faire à votre place.</p>
            <Link href={`/workflows/${repere.id}`} className="bouton mt-6 inline-block rounded-full bg-white px-6 py-3 text-sm font-medium text-nuit">
              Voir ce que Ghost a compris
            </Link>
          </div>
        )}
        <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-discret">Ce que Ghost voit</h2>
        {illisibles > 0 && (
          <p className="mt-3 text-sm text-discret">
            {illisibles} écran{illisibles > 1 ? "s" : ""} n’{illisibles > 1 ? "ont" : "a"} pas pu être lu{illisibles > 1 ? "s" : ""}. L’observation continue.
          </p>
        )}
        {lignes.length === 0 ? (
          <p className="mt-6 text-[15px] text-discret">En attente de votre première action…</p>
        ) : (
          <ol aria-live="polite" aria-relevant="additions" className="mt-4 divide-y divide-trait">
            {lignes.map((l) => (
              <li key={l.id} className="monter flex gap-6 py-4">
                <span className="w-28 shrink-0 text-sm font-medium text-nuit">{l.site}</span>
                <span className="text-[15px] text-texte">{l.texte}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

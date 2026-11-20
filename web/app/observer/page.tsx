'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Logo } from '@/components/Logo';
import { notifier, type ResultatNotification } from '@/lib/notifier';
import { boutonPrincipal } from '@/components/PageEntete';


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
  resume?: string; // débrief de l'analyse demandée
  etapes?: string[];
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
const HAUT_BARRE = 0.11; // part haute de la fenêtre partagée : onglets et barre d'adresse
const LARGEUR_BARRE = 1600; // l'adresse est à gauche ; au-delà, des icônes
interface Envoi { image: string; barre: string | null }
const SEUIL_CHANGEMENT = 3; // écart moyen de gris (0-255) entre deux vignettes au-delà duquel l'écran a changé

type Permission = NotificationPermission | 'indisponible';
type Captureur = new (piste: MediaStreamTrack) => { grabFrame(): Promise<ImageBitmap> };

// Chrome ralentit les minuteurs d'un onglet en arrière-plan (jusqu'à une fois par minute) ; ceux d'un worker, non.
function minuteurFiable(ms: number, tic: () => void): () => void {
  const url = URL.createObjectURL(new Blob([`setInterval(() => postMessage(0), ${ms})`], { type: 'text/javascript' }));
  const w = new Worker(url);
  w.onmessage = tic;
  return () => { w.terminate(); URL.revokeObjectURL(url); };
}


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
  const [observation, setObservation] = useState<string | null>(null);
  const [analyse, setAnalyse] = useState<{ enCours: boolean; erreur: string | null }>({ enCours: false, erreur: null });
  const [erreur, setErreur] = useState<string | null>(null);
  const [permission, setPermission] = useState<Permission>('default');
  const [teste, setTeste] = useState<ResultatNotification | null>(null);
  const flux = useRef<MediaStream | null>(null);
  const pause = useRef(false);

  useEffect(() => {
    setPermission(typeof Notification === 'undefined' ? 'indisponible' : Notification.permission);
  }, []);

  // Le titre de l'onglet porte l'alerte jusqu'au retour sur la page.
  useEffect(() => {
    if (!repere) return;
    const titre = document.title;
    document.title = '(1) Tâche repérée · Ghost';
    const retour = () => { if (document.visibilityState === 'visible') document.title = titre; };
    document.addEventListener('visibilitychange', retour);
    return () => { document.removeEventListener('visibilitychange', retour); document.title = titre; };
  }, [repere]);

  async function activerNotifications() {
    setPermission(await Notification.requestPermission());
  }

  async function tester() {
    // Une étiquette nouvelle à chaque essai : avec la même, le navigateur remplace l'ancienne sans rien montrer.
    setTeste(await notifier('Ghost', 'Les notifications fonctionnent. Vous serez prévenu ici.', { tag: `ghost-essai-${Date.now()}` }));
    setPermission(Notification.permission);
  }

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

  // « J'ai fini » : Qwen analyse toutes les étapes vues et Ghost crée le workflow, sans attendre la détection automatique.
  async function analyserMaintenant() {
    if (!observation) return;
    setAnalyse({ enCours: true, erreur: null });
    const r = await fetch(`/api/observations/${observation}/analyser`, { method: 'POST' }).catch(() => null);
    const d = r ? await r.json().catch(() => null) : null;
    if (r?.ok && d) setRepere(d as Repere);
    setAnalyse({ enCours: false, erreur: r?.ok ? null : d?.erreur ?? 'L’analyse n’a pas abouti. Réessayez.' });
  }

  async function demarrer() {
    setErreur(null);
    if (permission === 'default') await activerNotifications();
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
    setObservation(id);
    flux.current = stream;
    stream.getVideoTracks()[0].addEventListener('ended', arreter); // bouton « Arrêter le partage » de Chrome
    setSecondes(0);
    setLignes([]);
    setRepere(null);
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
    const barreCanvas = document.createElement('canvas');
    let precedente: Uint8ClampedArray | null = null;
    let barrePrecedente: Uint8ClampedArray | null = null;
    let enVol = false;
    let enAttente: Envoi | null = null;
    let notifie = false;

    async function envoyer(envoi: Envoi) {
      enVol = true;
      const r = await fetch(`/api/observations/${id}/captures`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(envoi),
      }).catch(() => null);
      const d = r?.ok ? ((await r.json()) as { etape: Etape | null; workflow: Repere | null; erreur?: string }) : null;
      if (d?.etape) {
        const e = d.etape;
        setLignes((ls) => [{ id: e.id, site: e.site, texte: phrase(e) }, ...ls]);
      }
      if (d?.workflow && !notifie) {
        notifie = true;
        setRepere(d.workflow);
        notifier('Ghost a repéré une tâche répétitive', `${d.workflow.nom}. Vous l’avez faite ${d.workflow.occurrences} fois : Ghost peut s’en charger.`, { tag: `ghost-${d.workflow.id}`, lien: `/workflows/${d.workflow.id}`, garder: true });
      }
      enVol = false;
      if (enAttente) {
        const suivante = enAttente;
        enAttente = null;
        envoyer(suivante);
      }
    }

    // Chrome met en veille une vidéo cachée quand l'onglet passe en arrière-plan : on lit l'image directement sur la piste.
    const Capture = (window as unknown as { ImageCapture?: Captureur }).ImageCapture;
    const capteur = Capture ? new Capture(stream.getVideoTracks()[0]) : null;
    const delai = () => new Promise<null>((ok) => setTimeout(() => ok(null), 1500)); // écran immobile : pas d'image neuve
    let occupe = false;

    async function vue(): Promise<{ source: CanvasImageSource; l: number; h: number; fin: () => void } | null> {
      if (capteur) {
        const b = await Promise.race([capteur.grabFrame().catch(() => null), delai()]);
        return b && { source: b, l: b.width, h: b.height, fin: () => b.close() };
      }
      return video.videoWidth ? { source: video, l: video.videoWidth, h: video.videoHeight, fin: () => {} } : null;
    }

    const arret = minuteurFiable(INTERVALLE_MS, async () => {
      if (!flux.current) return arret();
      if (pause.current || occupe) return;
      occupe = true;
      const v = await vue();
      occupe = false;
      if (!v) return;
      const m = mini.getContext('2d', { willReadFrequently: true })!;
      m.drawImage(v.source, 0, 0, 32, 18);
      const pixels = m.getImageData(0, 0, 32, 18).data;
      let ecart = 0;
      if (precedente) for (let i = 0; i < pixels.length; i += 4) ecart += Math.abs(pixels[i] - precedente[i]);
      const change = !precedente || ecart / (pixels.length / 4) > SEUIL_CHANGEMENT;
      precedente = pixels;
      let barre: string | null = null;
      if (change) {
        const echelle = Math.min(1, 1280 / v.l);
        grande.width = Math.round(v.l * echelle);
        grande.height = Math.round(v.h * echelle);
        grande.getContext('2d')!.drawImage(v.source, 0, 0, grande.width, grande.height);
        // Réduite à 1280 px, l'adresse devient illisible (« portal » pour « portail ») : on envoie aussi le haut de la fenêtre, net et agrandi.
        const hb = Math.min(Math.round(v.h * HAUT_BARRE), 220);
        const lb = Math.min(v.l, LARGEUR_BARRE);
        const vb = mini.getContext('2d', { willReadFrequently: true })!;
        vb.drawImage(v.source, 0, 0, lb, hb, 0, 0, 32, 18);
        const pixelsBarre = vb.getImageData(0, 0, 32, 18).data;
        let ecartBarre = 0;
        if (barrePrecedente) for (let i = 0; i < pixelsBarre.length; i += 4) ecartBarre += Math.abs(pixelsBarre[i] - barrePrecedente[i]);
        if (!barrePrecedente || ecartBarre / (pixelsBarre.length / 4) > 1) {
          const zoom = Math.min(2, 2400 / lb);
          barreCanvas.width = Math.round(lb * zoom);
          barreCanvas.height = Math.round(hb * zoom);
          const b = barreCanvas.getContext('2d')!;
          b.imageSmoothingQuality = 'high';
          b.drawImage(v.source, 0, 0, lb, hb, 0, 0, barreCanvas.width, barreCanvas.height);
          barre = barreCanvas.toDataURL('image/jpeg', 0.92);
        }
        barrePrecedente = pixelsBarre;
      }
      v.fin();
      if (!change) return;
      const envoi = { image: grande.toDataURL('image/jpeg', 0.7), barre };
      if (enVol) enAttente = { ...envoi, barre: envoi.barre ?? enAttente?.barre ?? null }; // on garde la plus récente, sans perdre une adresse nouvelle
      else envoyer(envoi);
    });
  }

  if (etat === 'pret') {
    // Un seul message, un seul bouton : le fantôme, ce qu'il fait, et de quoi commencer.
    return (
      <section className="mx-auto flex max-w-xl flex-col items-center pb-10 pt-10 text-center lg:min-h-[calc(100svh-10rem)] lg:justify-center">
        <div className="monter">
          <Logo taille={132} anime humeur="observe" suivreSouris decoratif />
        </div>
        <h1 className="monter mt-8 text-[40px] font-bold leading-[1.05] tracking-[-0.03em] [animation-delay:60ms] md:text-[48px]">
          Travaillez normalement.
          <span className="block text-nuit/60">Ghost repère le reste.</span>
        </h1>
        <p className="monter mt-5 text-[17px] leading-relaxed text-texte [animation-delay:120ms]">
          Partagez votre fenêtre Chrome. Dès qu’une tâche revient, Ghost vous propose de la confier à un agent.
        </p>
        <button onClick={demarrer} className={`${boutonPrincipal} monter mt-9 [animation-delay:180ms]`}>Démarrer l’observation</button>
        {erreur && <p role="alert" className="mt-5 text-[15px] text-alerte">{erreur}</p>}
        <p className="monter mt-6 text-sm text-discret [animation-delay:240ms]">
          {permission === 'granted' ? (
            <>Notifications activées · <button onClick={tester} className="lien text-nuit">tester</button></>
          ) : permission === 'default' ? (
            <button onClick={activerNotifications} className="lien text-nuit">Activer les notifications</button>
          ) : permission === 'denied' ? (
            'Notifications bloquées : autorisez-les à gauche de l’adresse.'
          ) : null}
        </p>
        {teste && (
          <p role="status" className={`mt-2 text-sm ${teste === 'envoyee' ? 'text-discret' : 'text-alerte'}`}>
            {teste === 'envoyee'
              ? 'Envoyée. Rien ne s’affiche ? Coupez « Ne pas déranger » et autorisez Chrome dans les notifications du système.'
              : teste === 'non_autorisee'
                ? 'Notifications non autorisées pour ce site : autorisez-les à gauche de l’adresse, puis rechargez.'
                : 'Ce navigateur n’affiche pas de notifications. Ouvrez Ghost dans Chrome ou Edge.'}
          </p>
        )}
        <p className="monter mt-auto pt-14 text-[13px] text-discret [animation-delay:300ms]">Rien n’est filmé, les pages de connexion sont ignorées, et la pause est à un clic.</p>
      </section>
    );
  }

  const enCours = etat === 'en_cours';
  // Même grammaire que l'écran de départ : une colonne centrée, le fantôme au milieu, une barre d'outils en verre.
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center pb-10 pt-8 text-center lg:min-h-[calc(100svh-10rem)] lg:justify-center">
      {repere ? (
        <div role="status" className="carte verre-nuit monter w-full text-left">
          <Logo taille={56} anime humeur="joie" couleur="#ffffff" decoratif />
          <p className="mt-5 text-[13px] font-medium text-white/70">Tâche repérée</p>
          <p className="mt-1 text-2xl font-bold leading-snug tracking-tight first-letter:uppercase">{repere.nom}</p>
          {repere.resume && <p className="mt-3 text-[15px] leading-relaxed text-white/80">{repere.resume}</p>}
          {repere.etapes?.length ? (
            <ol className="mt-5 space-y-2">
              {repere.etapes.map((e, i) => (
                <li key={i} className="flex gap-3 text-[15px] text-white/85">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/15 font-mono text-xs">{i + 1}</span>
                  <span>{e}</span>
                </li>
              ))}
            </ol>
          ) : null}
          <Link href={`/workflows/${repere.id}`} className="bouton mt-7 block rounded-xl bg-white py-3.5 text-center text-[15px] font-semibold text-nuit">
            Confier cette tâche à un agent
          </Link>
        </div>
      ) : (
        <>
          <div className="monter relative grid h-72 w-72 place-items-center">
            <div aria-hidden="true" className="absolute inset-0 grid place-items-center">
              {enCours && [0, 1, 2].map((i) => (
                <span key={i} className="radar absolute h-48 w-48 rounded-full border border-nuit/20 bg-nuit/[0.03]" style={{ animationDelay: `${i * 0.9}s` }} />
              ))}
            </div>
            <div className={`relative transition-opacity duration-500 ${enCours ? '' : 'opacity-50'}`}>
              <Logo taille={150} anime humeur={enCours ? 'observe' : 'discret'} suivreSouris={enCours} decoratif />
            </div>
          </div>
          <p className="monter font-mono text-[40px] font-medium leading-none tracking-tight text-encre [animation-delay:60ms]">{duree(secondes)}</p>
          <p className="monter mt-3 text-[17px] text-texte [animation-delay:120ms]">
            {enCours ? (lignes.length ? 'Ghost observe. Continuez votre tâche.' : 'Ghost observe. Passez sur votre outil.') : 'En pause. Ghost ne regarde plus.'}
          </p>
          {/* Ce que Ghost vient de voir : une seule ligne, remplacée en fondu à chaque nouvel écran. */}
          <p aria-live="polite" className="mt-6 h-6 max-w-full truncate text-sm text-discret">
            {lignes[0] && <span key={lignes[0].id} className="fondu"><b className="font-semibold text-nuit">{lignes[0].site}</b> · {lignes[0].texte}</span>}
          </p>
          {analyse.erreur && <p role="alert" className="mt-3 text-sm text-alerte">{analyse.erreur}</p>}
        </>
      )}

      {/* Barre d'outils : pilule en verre, boutons pilules à marge égale (arrondis concentriques). */}
      <div className="verre monter mt-10 flex items-center gap-1 rounded-full p-1.5 [animation-delay:180ms]">
        <button onClick={() => setEtat(enCours ? 'pause' : 'en_cours')} className="bouton rounded-full px-5 py-2.5 text-sm font-semibold text-encre hover:bg-white/70">
          {enCours ? 'Pause' : 'Reprendre'}
        </button>
        <button onClick={arreter} className="bouton rounded-full px-5 py-2.5 text-sm font-semibold text-alerte hover:bg-alerte-clair">Arrêter</button>
        {!repere && (
          <button onClick={analyserMaintenant} disabled={analyse.enCours || lignes.length === 0} className="bouton rounded-full bg-nuit px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
            {analyse.enCours ? 'Analyse…' : 'J’ai fini'}
          </button>
        )}
      </div>
      <p className="sr-only" role="status">{enCours ? 'Observation en cours' : 'Observation en pause'}</p>
    </section>
  );
}

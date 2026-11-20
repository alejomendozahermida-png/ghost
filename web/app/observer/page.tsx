'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Logo } from '@/components/Logo';
import { notifier, type ResultatNotification } from '@/lib/notifier';
import { boutonPrincipal } from '@/components/PageEntete';

const GARANTIES = [
  ['Rien n’est filmé', 'Seule la description de chaque écran est gardée, jamais l’image.'],
  ['Vos connexions restent privées', 'Les pages de connexion sont ignorées. Mettez en pause pour toute action personnelle.'],
  ['Vous gardez la main', 'Pause et arrêt à tout moment. Rien n’est lancé sans votre accord.'],
] as const;

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
    return (
      <section className="grid items-center gap-10 pb-8 pt-6 lg:min-h-[calc(100svh-8rem)] lg:grid-cols-[1.35fr_1fr] lg:gap-14">
        <div>
          <p className="monter text-[13px] font-semibold uppercase tracking-[0.16em] text-nuit/70">Observation</p>
          <h1 className="monter mt-3 text-[40px] font-bold leading-[1.05] tracking-[-0.03em] [animation-delay:60ms] md:text-[44px] 2xl:text-[56px]">
            Travaillez normalement.
            <span className="block text-nuit/60">Ghost repère le reste.</span>
          </h1>
          <p className="monter mt-5 max-w-lg text-[17px] leading-relaxed text-texte [animation-delay:120ms]">
            Partagez votre fenêtre Chrome et faites votre travail habituel. Dès qu’une tâche revient, Ghost vous prévient et vous propose de la confier à un agent.
          </p>
          <div className="monter mt-8 flex flex-wrap items-center gap-5 [animation-delay:180ms]">
            <button onClick={demarrer} className={boutonPrincipal}>Démarrer l’observation</button>
            <p className="text-sm text-discret">Chrome ou Edge, sur ordinateur.</p>
          </div>
          <div className="monter mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm [animation-delay:240ms]">
            {permission === 'granted' ? (
              <>
                <span className="flex items-center gap-2 text-succes"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-succes" />Notifications activées</span>
                <button onClick={tester} className="lien py-2 text-nuit">Envoyer une notification d’essai</button>
              </>
            ) : permission === 'default' ? (
              <button onClick={activerNotifications} className="lien py-2 text-nuit">Activer les notifications pour être prévenu</button>
            ) : permission === 'denied' ? (
              <span className="text-texte">Notifications bloquées : autorisez-les avec l’icône à gauche de l’adresse, puis rechargez la page.</span>
            ) : null}
          </div>
          {teste && (
            <p role="status" className={`mt-1 max-w-lg text-sm ${teste === 'envoyee' ? 'text-discret' : 'text-alerte'}`}>
              {teste === 'envoyee'
                ? 'Envoyée par Ghost. Rien ne s’affiche ? Le blocage vient du système : coupez « Ne pas déranger » (Windows : Paramètres › Système › Notifications, puis autorisez Chrome ; Mac : Réglages › Notifications › Chrome).'
                : teste === 'non_autorisee'
                  ? 'Les notifications ne sont pas autorisées pour ce site : autorisez-les avec l’icône à gauche de l’adresse, puis rechargez.'
                  : 'Ce navigateur ne sait pas afficher de notifications. Ouvrez Ghost dans Chrome, Edge ou Firefox (sur iPhone : ajoutez d’abord Ghost à l’écran d’accueil).'}
            </p>
          )}
          {erreur && <p role="alert" className="mt-6 text-[15px] text-alerte">{erreur}</p>}
          <ul className="monter mt-8 grid gap-4 border-t border-trait pt-6 sm:grid-cols-3 [animation-delay:300ms]">
            {GARANTIES.map(([titre, texte], n) => (
              <li key={titre} className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-nuit-clair font-mono text-xs font-medium text-nuit">{n + 1}</span>
                <div>
                  <p className="text-sm font-semibold text-encre">{titre}</p>
                  <p className="mt-0.5 text-[13px] leading-snug text-texte">{texte}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Aperçu : une fenêtre de travail que le fantôme parcourt du regard. */}
        <figure aria-hidden="true" className="monter relative hidden sm:block [animation-delay:200ms]">
          <div className="overflow-hidden verre rounded-2xl">
            <div className="flex items-center gap-1.5 border-b border-trait px-4 py-3">
              <i className="h-2.5 w-2.5 rounded-full bg-trait" /><i className="h-2.5 w-2.5 rounded-full bg-trait" /><i className="h-2.5 w-2.5 rounded-full bg-trait" />
              <span className="ml-3 h-5 flex-1 rounded-full bg-fond" />
            </div>
            <div className="relative space-y-4 overflow-hidden p-7">
              <div className="h-4 w-2/5 rounded-md bg-encre/10" />
              {[0.9, 0.75, 0.85, 0.6].map((w, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-2.5 w-24 rounded bg-encre/10" />
                  <div className="h-9 rounded-lg border border-trait" style={{ width: `${w * 100}%` }} />
                </div>
              ))}
              <div className="h-10 w-32 rounded-full bg-nuit/85" />
              <div className="balayer absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-transparent via-nuit/10 to-transparent" />
            </div>
          </div>
          <div className="absolute -bottom-8 -left-6 verre rounded-2xl p-3">
            <Logo taille={72} anime humeur="observe" decoratif />
          </div>
        </figure>
      </section>
    );
  }

  return (
    <section className="pt-8">
      <header className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <p className="flex items-center gap-3 font-mono text-2xl font-medium tracking-tight text-encre">
          <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${etat === 'en_cours' ? 'pulse-doux bg-alerte' : 'bg-discret'}`} />
          {duree(secondes)}
          <span className="sr-only">{etat === 'en_cours' ? 'Observation en cours' : 'En pause'}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setEtat(etat === 'en_cours' ? 'pause' : 'en_cours')} className="bouton rounded-full border border-trait bg-surface/70 px-5 py-2.5 text-sm font-semibold backdrop-blur hover:border-encre/30">
            {etat === 'en_cours' ? 'Pause' : 'Reprendre'}
          </button>
          <button onClick={arreter} className="bouton rounded-full px-5 py-2.5 text-sm font-semibold text-alerte hover:bg-alerte-clair">Arrêter</button>
          <button onClick={analyserMaintenant} disabled={analyse.enCours || lignes.length === 0} className={boutonPrincipal}>
            {analyse.enCours ? 'Analyse…' : 'J’ai fini'}
          </button>
        </div>
      </header>

      <div className="mt-10 grid items-start gap-12 lg:grid-cols-[1fr_1.15fr]">
        {/* Le fantôme au centre : grand, avec un halo qui pulse tant qu'il observe. Remplacé par ce qu'il a compris dès qu'une tâche est repérée. */}
        <aside className="lg:sticky lg:top-10">
          {repere ? (
            <div role="status" className="verre-nuit monter rounded-3xl p-8">
              <Logo taille={64} anime humeur="joie" couleur="#ffffff" decoratif />
              <p className="mt-5 text-2xl font-bold leading-snug tracking-tight first-letter:uppercase">{repere.nom}</p>
              {repere.resume && <p className="mt-3 text-[15px] leading-relaxed text-white/85">{repere.resume}</p>}
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
              <Link href={`/workflows/${repere.id}`} className="bouton mt-7 inline-flex rounded-full bg-white px-6 py-3 text-sm font-semibold text-nuit">
                Confier cette tâche à un agent
              </Link>
            </div>
          ) : (
            <div className="relative grid place-items-center overflow-hidden verre rounded-[2rem] py-16">
              <div aria-hidden="true" className="absolute inset-0 grid place-items-center">
                {etat === 'en_cours' && [0, 1, 2].map((i) => (
                  <span key={i} className="radar absolute h-56 w-56 rounded-full border-2 border-nuit/25" style={{ animationDelay: `${i * 0.9}s` }} />
                ))}
              </div>
              <div className="relative">
                <Logo taille={180} anime humeur={etat === 'en_cours' ? 'observe' : 'repos'} decoratif />
              </div>
              <p className="relative mt-8 text-[17px] font-semibold text-encre">{etat === 'en_cours' ? 'Ghost observe' : 'En pause'}</p>
              {analyse.erreur && <p role="alert" className="relative mt-3 max-w-xs text-center text-sm text-alerte">{analyse.erreur}</p>}
            </div>
          )}
        </aside>

        <div>
          {lignes.length === 0 ? (
            <p className="pt-6 text-[17px] text-texte">Passez sur votre outil et faites votre tâche.</p>
          ) : (
            <ol aria-live="polite" aria-relevant="additions" className="max-h-[62svh] space-y-1 overflow-y-auto pb-10 [mask-image:linear-gradient(to_bottom,black_86%,transparent)]">
              {lignes.map((l, i) => (
                <li key={l.id} className={`monter grid grid-cols-[7rem_1fr] items-baseline gap-4 rounded-xl px-4 py-3 transition-colors ${i === 0 ? 'verre' : 'opacity-75'}`}>
                  <span className="truncate text-sm font-semibold text-nuit">{l.site}</span>
                  <span className="text-[15px] text-encre">{l.texte}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}

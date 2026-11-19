'use client';

import { useEffect } from 'react';

const INTERVALLE_MS = 20_000;
const CLE = 'ghost-notifiees';

interface Fin { id: string; lien: string; titre: string; texte: string }

const lire = (): string[] => { try { return JSON.parse(localStorage.getItem(CLE) ?? '[]'); } catch { return []; } };
const ecrire = (ids: string[]) => { try { localStorage.setItem(CLE, JSON.stringify(ids.slice(-100))); } catch { /* stockage indisponible : on notifiera peut-être deux fois */ } };

// Tant qu'un onglet Ghost est ouvert (même en arrière-plan), chaque exécution terminée donne une notification,
// y compris celles lancées par la veille, une heure planifiée ou un lien. Le tag évite les doublons entre onglets.
export function Notifications() {
  useEffect(() => {
    if (typeof Notification === 'undefined') return;
    let premier = true;
    const verifier = async () => {
      const r = await fetch('/api/notifications').catch(() => null);
      if (!r?.ok) return;
      const fins = (await r.json()) as Fin[];
      const vues = new Set(lire());
      // Au premier passage, ce qui est déjà terminé n'est pas une nouvelle : on le note sans prévenir.
      if (!premier && Notification.permission === 'granted') {
        for (const f of fins.filter((x) => !vues.has(x.id))) {
          const n = new Notification(f.titre, { body: f.texte, tag: f.id, icon: '/apple-icon' });
          n.onclick = () => { window.focus(); window.location.href = f.lien; n.close(); };
        }
      }
      premier = false;
      ecrire([...vues, ...fins.map((f) => f.id)].filter((x, i, t) => t.indexOf(x) === i));
    };
    verifier();
    const t = setInterval(verifier, INTERVALLE_MS);
    return () => clearInterval(t);
  }, []);
  return null;
}

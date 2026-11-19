// Affiche une notification Ghost. Passe par le service worker (seule voie sur Android, et la plus fiable ailleurs),
// sinon par l'API directe. Renvoie ce qui s'est réellement passé, pour le dire à l'utilisateur.
export type ResultatNotification = 'envoyee' | 'non_autorisee' | 'indisponible';

export async function notifier(titre: string, texte: string, o: { tag: string; lien?: string; garder?: boolean }): Promise<ResultatNotification> {
  if (typeof Notification === 'undefined') return 'indisponible';
  if (Notification.permission !== 'granted') return 'non_autorisee';
  const options: NotificationOptions = { body: texte, tag: o.tag, icon: '/apple-icon', badge: '/icon.svg', requireInteraction: !!o.garder, data: { lien: o.lien } };
  try {
    const sw = await navigator.serviceWorker?.register('/sw.js');
    if (sw) {
      await navigator.serviceWorker.ready;
      await sw.showNotification(titre, options);
      return 'envoyee';
    }
  } catch {
    // service worker refusé (navigation privée, certains navigateurs intégrés) : on tente l'API directe
  }
  try {
    const n = new Notification(titre, options);
    n.onclick = () => { window.focus(); if (o.lien) window.location.href = o.lien; n.close(); };
    return 'envoyee';
  } catch {
    return 'indisponible';
  }
}

// Ghost — adresses exactes.
// Seulement pendant une observation (la page Ghost l'annonce), l'adresse et le titre de l'onglet actif
// sont envoyés à l'onglet Ghost qui observe. Rien n'est envoyé ailleurs, rien n'est gardé.
// Le service worker s'endort après ~30 s : l'onglet qui observe est gardé dans le stockage de session.

const lire = async () => (await chrome.storage.session.get('ghost')).ghost ?? null;
const ecrire = (id) => chrome.storage.session.set({ ghost: id });

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type !== 'observation' || !sender.tab) return;
  (async () => {
    const ghost = await lire();
    if (msg.active) { await ecrire(sender.tab.id); signaler(); }
    else if (ghost === sender.tab.id) await ecrire(null);
  })();
});

async function signaler() {
  const ghost = await lire();
  if (ghost === null) return;
  const [onglet] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!onglet?.url) return;
  chrome.tabs.sendMessage(ghost, { type: 'onglet', url: onglet.url, titre: onglet.title ?? '' }).catch(() => ecrire(null));
}

chrome.tabs.onActivated.addListener(signaler);
chrome.tabs.onUpdated.addListener((_, change) => { if (change.url || change.title || change.status === 'complete') signaler(); });
chrome.windows.onFocusChanged.addListener(signaler);
chrome.tabs.onRemoved.addListener(async (id) => { if (id === (await lire())) ecrire(null); });

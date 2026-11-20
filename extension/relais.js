// Relais entre la page Ghost et l'extension : la page ne peut pas parler à l'extension directement.
window.postMessage({ source: 'ghost-compagnon', present: true }, location.origin);

window.addEventListener('message', (e) => {
  if (e.source !== window || e.data?.source !== 'ghost-page') return;
  if (e.data.question === 'present') window.postMessage({ source: 'ghost-compagnon', present: true }, location.origin);
  if (typeof e.data.observation === 'boolean') chrome.runtime.sendMessage({ type: 'observation', active: e.data.observation }).catch(() => {});
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'onglet') window.postMessage({ source: 'ghost-compagnon', url: msg.url, titre: msg.titre }, location.origin);
});

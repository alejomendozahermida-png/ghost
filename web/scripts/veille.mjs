// Veille en local : appelle /api/veille toutes les 30 s (en ligne, c'est pg_cron qui s'en charge).
// Lancer depuis web/ : node --env-file=.env.local scripts/veille.mjs
const URL_VEILLE = process.env.GHOST_URL_VEILLE ?? 'http://localhost:3000/api/veille';
const INTERVALLE_MS = 30_000;

async function passage() {
  const r = await fetch(URL_VEILLE, { method: 'POST', headers: { Authorization: `Bearer ${process.env.GHOST_CRON_SECRET}` } }).catch((e) => e);
  const corps = r instanceof Response ? await r.json().catch(() => ({})) : { erreur: String(r) };
  console.log(new Date().toLocaleTimeString('fr-FR'), r.status ?? '', JSON.stringify(corps));
}

await passage();
setInterval(passage, INTERVALLE_MS);

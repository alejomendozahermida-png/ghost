import 'server-only';

// API Agents de H (mêmes appels que le SDK Python hai-agents 1.5.1, relevés le 20/11).
const API = 'https://agp.eu.hcompany.ai/api/v2';

export class HError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function h<T>(chemin: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(API + chemin, {
    ...init,
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000), // H qui ne répond plus ne bloque pas l'exécution : on réessaie au prochain appel
    headers: { Authorization: `Bearer ${process.env.HAI_API_KEY}`, 'Content-Type': 'application/json' },
  });
  if (!r.ok) throw new HError(r.status, `H ${r.status} sur ${chemin} : ${(await r.text()).slice(0, 300)}`);
  const texte = await r.text(); // l'envoi d'un message répond sans corps
  return (texte ? JSON.parse(texte) : undefined) as T;
}

export type StatutH = 'pending' | 'running' | 'idle' | 'completed' | 'failed' | 'timed_out' | 'interrupted' | string;

interface Session {
  agent: string; // un agent du catalogue (h/web-surfer-pro) ou un agent créé par Ghost
  message: string;
  format: object; // forme imposée à la réponse finale
  startUrl: string;
  sites: number; // pour borner étapes et durée
  attenteCorrection?: boolean;
}

export function demarrerSession(s: Session): Promise<{ id: string }> {
  return h('/sessions', {
    method: 'POST',
    body: JSON.stringify({
      agent: s.agent,
      messages: s.message,
      max_steps: 45 * s.sites, // 35 ne laissait aucune marge pour retaper un champ avant de publier
      max_time_s: 150 * s.sites,
      idle_timeout_s: s.attenteCorrection ? 120 : 10,
      timezone: 'Europe/Paris',
      overrides: { 'agent.environments[kind=web].start_url': s.startUrl, 'agent.answer_format': s.format },
    }),
  });
}

// Crée ou met à jour (même nom) : une Skill = la méthode écrite, un agent = Skill + navigateur + règles.
async function creerOuRemplacer(type: 'skills' | 'agents', nom: string, corps: object) {
  try {
    return await h(`/${type}`, { method: 'POST', body: JSON.stringify({ name: nom, ...corps }) });
  } catch (e) {
    if (!(e instanceof HError) || e.status !== 409) throw e;
    return h(`/${type}/${nom}`, { method: 'PUT', body: JSON.stringify({ name: nom, ...corps }) });
  }
}

export const enregistrerSkill = (nom: string, description: string, body: string) =>
  creerOuRemplacer('skills', nom, { description, body });

// Modèle : holo4-27b (précis) ou holo3-1-35b-a3b (rapide : 3 étapes et 0,006 $ au lieu de ~10 et 0,03 $, mais plus de fautes de recopie).
export const enregistrerAgent = (nom: string, description: string, instructions: string, skill: string, startUrl: string, vaultId?: string, modele = 'holo4-27b') =>
  creerOuRemplacer('agents', nom, {
    description,
    instructions,
    skills: [skill],
    environments: [{ kind: 'web', id: 'web', host: 'cloud', start_url: startUrl, ...(vaultId ? { vault_id: vaultId } : {}) }],
    model: modele,
  });

export const session = (id: string) => h<{ agent_view_url?: string }>(`/sessions/${id}`);
export const statut = (id: string) => h<{ status: StatutH; error?: string | null }>(`/sessions/${id}/status`);
export const changements = (id: string) =>
  h<{ answer?: unknown; metrics?: { total_cost?: number; steps?: number } }>(`/sessions/${id}/changes?from_index=0&wait_for_seconds=0`);
export const envoyer = (id: string, message: string) =>
  h(`/sessions/${id}/messages`, { method: 'POST', body: JSON.stringify({ type: 'user_message', message }) });
// H n'accepte un fichier que dans /home/hai/Downloads (un chemin relatif répond 403).
export const deposerFichier = (id: string, nom: string, base64: string) =>
  h<{ path: string }>(`/sessions/${id}/files/write_file`, {
    method: 'POST',
    body: JSON.stringify({ path: `/home/hai/Downloads/${nom}`, content_base64: base64 }),
  });
export const quota = () => h<{ remaining: number; limit: number }>('/quota/tokens');

// Coffres-forts H : les secrets ne reviennent jamais dans les réponses, seulement la liste des champs remplis.
export const creerCoffre = (nom: string) =>
  h<{ id: string }>('/vaults', { method: 'POST', body: JSON.stringify({ name: nom, provider_config: { provider: 'internal' } }) });
export const ajouterSecret = (coffre: string, nom: string, url: string, valeurs: Record<string, string>) =>
  h<{ id: string; fields: string[] }>(`/vaults/${coffre}/items`, { method: 'POST', body: JSON.stringify({ name: nom, urls: [url], values: valeurs }) });
export const retirerSecret = (coffre: string, item: string) => h(`/vaults/${coffre}/items/${item}`, { method: 'DELETE' });

// Retire l'agent et sa Skill quand le workflow est effacé (absents : rien à faire).
export const supprimerAgent = (nom: string) =>
  Promise.all([h(`/agents/${nom}`, { method: 'DELETE' }), h(`/skills/${nom}`, { method: 'DELETE' })].map((p) => p.catch(() => null)));

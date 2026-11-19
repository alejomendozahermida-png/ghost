import 'server-only';

// API Agents de H (mêmes appels que le SDK Python hai-agents 1.5.1, relevés le 20/11).
const API = 'https://agp.eu.hcompany.ai/api/v2';

async function h<T>(chemin: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(API + chemin, {
    ...init,
    cache: 'no-store',
    headers: { Authorization: `Bearer ${process.env.HAI_API_KEY}`, 'Content-Type': 'application/json' },
  });
  if (!r.ok) throw new HError(r.status, `H ${r.status} sur ${chemin} : ${(await r.text()).slice(0, 300)}`);
  const texte = await r.text(); // l'envoi d'un message répond sans corps
  return (texte ? JSON.parse(texte) : undefined) as T;
}

export class HError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export type StatutH = 'pending' | 'running' | 'idle' | 'completed' | 'failed' | 'timed_out' | 'interrupted' | string;

// Réponse imposée à l'agent : on vérifie ensuite nous-mêmes, sans croire ce qu'il dit.
const FORMAT_REPONSE = {
  type: 'object',
  required: ['statut', 'portails_publies', 'resume'],
  properties: {
    statut: { type: 'string', enum: ['publie', 'signale'] },
    raison: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    portails_publies: { type: 'array', items: { type: 'string' } },
    resume: { type: 'string' },
  },
};

export interface ReponseAgent {
  statut: 'publie' | 'signale';
  raison?: string | null;
  portails_publies: string[];
  resume: string;
}

export function demarrerSession(consigne: string, startUrl: string, nbPortails: number): Promise<{ id: string }> {
  return h('/sessions', {
    method: 'POST',
    body: JSON.stringify({
      agent: 'h/web-surfer-pro', // flash reformulait les titres (session 8f893be4)
      messages: consigne,
      max_steps: 35 * nbPortails,
      max_time_s: 150 * nbPortails,
      idle_timeout_s: 120, // la session attend une éventuelle correction après sa réponse
      timezone: 'Europe/Paris',
      overrides: { 'agent.environments[kind=web].start_url': startUrl, 'agent.answer_format': FORMAT_REPONSE },
    }),
  });
}

export const session = (id: string) => h<{ agent_view_url?: string }>(`/sessions/${id}`);
export const statut = (id: string) => h<{ status: StatutH; error?: string | null }>(`/sessions/${id}/status`);
export const changements = (id: string) =>
  h<{ answer?: unknown; metrics?: { total_cost?: number } }>(`/sessions/${id}/changes?from_index=0&wait_for_seconds=0`);
export const envoyer = (id: string, message: string) =>
  h(`/sessions/${id}/messages`, { method: 'POST', body: JSON.stringify({ type: 'user_message', message }) });
// H n'accepte un fichier que dans /home/hai/Downloads (un chemin relatif répond 403).
export const deposerFichier = (id: string, nom: string, base64: string) =>
  h<{ path: string }>(`/sessions/${id}/files/write_file`, {
    method: 'POST',
    body: JSON.stringify({ path: `/home/hai/Downloads/${nom}`, content_base64: base64 }),
  });
export const quota = () => h<{ remaining: number; limit: number }>('/quota/tokens');

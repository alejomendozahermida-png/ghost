import 'server-only';
import { db } from '@/lib/supabase';

// Vue en direct d'une session H : sa dernière capture et ses dernières actions, traduites pour l'utilisateur.

interface Evenement {
  data?: { kind?: string; image?: { source?: string }; metadata?: { url?: string; title?: string }; tool_reqs?: { tool_name?: string; args?: Record<string, unknown> }[] };
}

export interface Action {
  texte: string;
  x: number | null; // position relative (0 à 1) sur l'écran de l'agent
  y: number | null;
  clic: boolean;
}

const hote = (u: unknown) => {
  try {
    return new URL(String(u)).host;
  } catch {
    return String(u);
  }
};

function phrase(outil: string, a: Record<string, unknown>): string | null {
  const el = a.element ? String(a.element) : 'la page';
  switch (outil) {
    case 'write': return `Écrit « ${String(a.text ?? '').slice(0, 60)} » dans ${el}`;
    case 'click_web': return `Clique sur ${el}`;
    case 'go_to_web': return `Ouvre ${hote(a.url)}`;
    case 'select_option': return `Choisit « ${a.option} » dans ${el}`;
    case 'upload_file_web': return `Joint le fichier ${String(a.path ?? '').split('/').pop()}`;
    case 'scroll_web': return 'Fait défiler la page';
    case 'load_skill': return 'Relit sa méthode';
    case 'answer': return 'Rend son rapport';
    default: return null; // outils internes sans intérêt pour l'utilisateur
  }
}

async function evenements(sessionId: string): Promise<Evenement[]> {
  const r = await fetch(`https://agp.eu.hcompany.ai/api/v2/sessions/${sessionId}/changes?from_index=0&wait_for_seconds=0&include_events=true`, {
    headers: { Authorization: `Bearer ${process.env.HAI_API_KEY}` },
    cache: 'no-store',
  });
  return r.ok ? ((await r.json()).new_events ?? []) : [];
}

export async function sessionDe(executionId: string): Promise<string | null> {
  const { data } = await db.from('executions').select('session_id').eq('id', executionId).maybeSingle();
  return data?.session_id ?? null;
}

export async function vueDirecte(sessionId: string) {
  const ev = await evenements(sessionId);
  const observations = ev.filter((e) => e.data?.kind === 'observation_event');
  const derniere = observations.at(-1)?.data;
  const actions: Action[] = ev
    .flatMap((e) => (e.data?.kind === 'policy_event' ? e.data.tool_reqs ?? [] : []))
    .map((t) => {
      const a = t.args ?? {};
      const texte = phrase(t.tool_name ?? '', a);
      return texte ? { texte, x: typeof a.x === 'number' ? a.x : null, y: typeof a.y === 'number' ? a.y : null, clic: t.tool_name !== 'write' } : null;
    })
    .filter((a): a is Action => a !== null);
  return {
    titre: derniere?.metadata?.title ?? null,
    site: derniere?.metadata?.url ? hote(derniere.metadata.url) : null,
    capture: observations.length, // numéro de la capture : l'écran ne se recharge que s'il change
    actions: actions.slice(-8).reverse(),
  };
}

// La dernière capture, relayée par notre serveur : son adresse chez H exige la clé, qui ne va jamais au navigateur.
export async function derniereCapture(sessionId: string): Promise<Response | null> {
  const source = (await evenements(sessionId)).filter((e) => e.data?.kind === 'observation_event').at(-1)?.data?.image?.source;
  if (!source) return null;
  const r = await fetch(source, { headers: { Authorization: `Bearer ${process.env.HAI_API_KEY}` } });
  return r.ok ? new Response(r.body, { headers: { 'Content-Type': r.headers.get('content-type') ?? 'image/png', 'Cache-Control': 'private, max-age=300' } }) : null;
}

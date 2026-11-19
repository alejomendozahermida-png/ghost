import 'server-only';

// Deux API compatibles OpenAI : Holo (H) lit les écrans, un modèle Hugging Face raisonne sur le texte.
async function chat(url: string, cle: string, model: string, content: unknown): Promise<string> {
  const r = await fetch(url, {
    method: 'POST',
    cache: 'no-store',
    headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, temperature: 0, messages: [{ role: 'user', content }] }),
  });
  if (!r.ok) throw new Error(`${model} ${r.status} : ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).choices[0].message.content as string;
}

// Le premier objet JSON de la réponse (le modèle l'entoure parfois de ```json).
function json<T>(texte: string): T {
  const bloc = texte.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)?.[1] ?? texte.slice(texte.indexOf('{'), texte.lastIndexOf('}') + 1);
  return JSON.parse(bloc) as T;
}

export async function holo<T>(prompt: string, imageDataUrl: string): Promise<T> {
  const texte = await chat('https://api.hcompany.ai/v1/chat/completions', process.env.HAI_API_KEY!, 'holo3-1-35b-a3b', [
    { type: 'image_url', image_url: { url: imageDataUrl } },
    { type: 'text', text: prompt },
  ]);
  return json<T>(texte);
}

export async function raisonner<T>(prompt: string): Promise<T> {
  const modele = process.env.HF_MODEL ?? 'Qwen/Qwen3-235B-A22B-Instruct-2507';
  return json<T>(await chat('https://router.huggingface.co/v1/chat/completions', process.env.HF_TOKEN!, modele, prompt));
}

import 'server-only';
import { idSheet } from '@/lib/sheet';

// Relecture sans API : on télécharge la page publiée et on y cherche chaque valeur, à l'identique.

const ENTITES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function texteDePage(html: string): string {
  return html
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (_, e: string) =>
      e[0] === '#' ? String.fromCodePoint(parseInt(e.slice(e[1] === 'x' || e[1] === 'X' ? 2 : 1), e[1] === 'x' || e[1] === 'X' ? 16 : 10)) : ENTITES[e.toLowerCase()] ?? `&${e};`)
    .replace(/[\s  ]+/g, ' ')
    .trim();
}

const estNombre = (v: string) => /^[\d\s.,€]+$/.test(v.trim());

// « 238000 » se trouve dans « 238 000 € » ; un texte doit apparaître tel quel (espaces normalisés).
export function trouveDans(texte: string, valeur: string): boolean {
  const v = valeur.replace(/\s+/g, ' ').trim();
  if (!v) return true;
  if (!estNombre(v)) return texte.includes(v);
  const chiffres = v.replace(/\D/g, '');
  return new RegExp(`(^|\\D)${[...chiffres].join('[\\s.,]?')}(\\D|$)`).test(texte);
}

export interface Page {
  site: string;
  texte: string | null; // null : page illisible sans navigateur (connexion, page générée en JavaScript)
  photo: boolean;
}

export async function relirePage(site: string, url: string): Promise<Page> {
  // Un Google Sheet ne montre ses cellules qu'au navigateur : on relit son export CSV (il doit s'ouvrir par lien).
  // shortcut: on vérifie que les valeurs sont dans le tableau, pas qu'elles sont sur la bonne ligne ; à affiner avec la clé de l'enregistrement.
  const id = idSheet(url);
  if (id) {
    const csv = await fetch(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv`, { cache: 'no-store', signal: AbortSignal.timeout(10_000) }).catch(() => null);
    return { site, texte: csv?.ok ? await csv.text() : null, photo: false };
  }
  const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15000) }).catch(() => null);
  if (!r?.ok) return { site, texte: null, photo: false };
  const html = await r.text();
  const texte = texteDePage(html);
  return { site, texte: texte.length > 100 ? texte : null, photo: /<img[^>]+src=/i.test(html) };
}

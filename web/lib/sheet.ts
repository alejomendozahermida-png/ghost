import 'server-only';

export interface Ligne {
  cle: string; // valeur de la première colonne (ex. M-0143) : identifie la ligne
  valeurs: Record<string, string>;
  sites?: string[]; // relance : seulement ces sites (ceux en échec la fois d'avant)
  ecarts?: string[]; // relance : les erreurs de la fois d'avant, dites à l'agent
}

// Un CSV avec guillemets, virgules et retours à la ligne dans les cellules (export Google Sheets).
export function lireCsv(texte: string): string[][] {
  const lignes: string[][] = [];
  let ligne: string[] = [];
  let cellule = '';
  let guillemets = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (guillemets) {
      if (c === '"' && texte[i + 1] === '"') { cellule += '"'; i++; }
      else if (c === '"') guillemets = false;
      else cellule += c;
    } else if (c === '"') guillemets = true;
    else if (c === ',') { ligne.push(cellule); cellule = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texte[i + 1] === '\n') i++;
      ligne.push(cellule);
      lignes.push(ligne);
      ligne = [];
      cellule = '';
    } else cellule += c;
  }
  if (cellule || ligne.length) lignes.push([...ligne, cellule]);
  return lignes.filter((l) => l.some((x) => x.trim()));
}

export const idSheet = (url: string) => url.match(/\/spreadsheets\/d\/([\w-]+)/)?.[1] ?? null;

// Lit un Google Sheet partagé en lecture par lien, sans API Google : son export CSV public.
export async function lireSheet(url: string): Promise<{ colonnes: string[]; lignes: Ligne[] }> {
  const id = idSheet(url);
  if (!id) throw new Error('Lien Google Sheet invalide.');
  const r = await fetch(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv`, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`Google Sheet illisible (${r.status}) : est-il partagé en lecture par lien ?`);
  const [entete, ...corps] = lireCsv(await r.text());
  return {
    colonnes: entete,
    lignes: corps.map((l) => ({ cle: l[0], valeurs: Object.fromEntries(entete.map((c, i) => [c, l[i] ?? ''])) })),
  };
}

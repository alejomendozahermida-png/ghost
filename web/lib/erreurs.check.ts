// Vérification de regroupe() : npx tsx --conditions=react-server lib/erreurs.check.ts
import assert from 'node:assert/strict';
import { regroupe } from './erreurs';

const r = regroupe([
  "Portail A, Titre : la page n'affiche pas « Appartement T3 »",
  "Portail A, Description : la page n'affiche pas « x » ; Portail B, Description : la page n'affiche pas « x »",
  "Portail A, Description : la page n'affiche pas « y »",
  'Portail B : aucune annonce trouvée',
  'Portail B : aucune annonce trouvée',
  'Valeur vide : Prix. Rien n’a été publié.',
]);
assert.deepEqual(r.map((x) => [x.site, x.champ, x.fois]), [['Portail A', 'Description', 2], ['Portail B', null, 2]]);
assert.match(r[0].regle, /Portail A.*« Description »/);
console.log('ok');

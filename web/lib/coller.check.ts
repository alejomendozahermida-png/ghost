// Vérification de aColler() : npx tsx --conditions=react-server lib/coller.check.ts
import assert from 'node:assert/strict';
import { aColler } from './execution';

const l = { cle: 'M-0142', valeurs: { Photo: 'M-0142.jpg', Titre: 'Appartement T3 lumineux proche RER', Ville: 'Massy', Mandat: 'M-0142', 'Prix (€)': '329000', Description: 'T3 au 2e étage avec ascenseur, séjour sur balcon exposé sud.', 'Surface (m²)': '68', 'Classe énergie': 'C' } };
// Sans historique d'erreur : tout est tapé (rapide).
assert.deepEqual(aColler(l, []), []);
// Le titre a déjà été faux sur ce workflow : il est collé, le reste tapé.
assert.deepEqual(aColler(l, [], new Set(['Titre'])), ['Titre']);
// Essai précédent faux sur la description : collée. Un mot court (Ville) reste tapé même s'il a été faux.
assert.deepEqual(aColler(l, ["Portail A, Description : la page n'affiche pas « x »", "Portail A, Ville : la page n'affiche pas « Massy »"]), ['Description']);
console.log('ok');

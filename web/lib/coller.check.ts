// Vérification de aColler() : npx tsx --conditions=react-server lib/coller.check.ts
import assert from 'node:assert/strict';
import { aColler } from './execution';

const l = { cle: 'M-0142', valeurs: { Photo: 'M-0142.jpg', Titre: 'Appartement T3 lumineux proche RER', Ville: 'Massy', Mandat: 'M-0142', 'Prix (€)': '329000', Description: 'T3 au 2e étage avec ascenseur, séjour sur balcon exposé sud.', 'Surface (m²)': '68', 'Classe énergie': 'C' } };
// Sans historique : tout est tapé (rapide).
assert.deepEqual(aColler(l, [], new Set(), 'Portail A'), []);
// Le titre se trompe souvent sur le Portail A : collé là, tapé sur le B.
const risques = new Set(['Portail A|Titre']);
assert.deepEqual(aColler(l, [], risques, 'Portail A'), ['Titre']);
assert.deepEqual(aColler(l, [], risques, 'Portail B'), []);
// Relance : la description fausse sur le B est collée sur le B seulement ; un mot court (Ville) reste tapé.
const ecarts = ["Portail B, Description : la page n'affiche pas « x »", "Portail B, Ville : la page n'affiche pas « Massy »"];
assert.deepEqual(aColler(l, ecarts, new Set(), 'Portail B'), ['Description']);
assert.deepEqual(aColler(l, ecarts, new Set(), 'Portail A'), []);
console.log('ok');

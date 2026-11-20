// Vérification de aColler() : npx tsx --conditions=react-server lib/coller.check.ts
import assert from 'node:assert/strict';
import { aColler } from './execution';

const l = { cle: 'M-0142', valeurs: { Photo: 'M-0142.jpg', Titre: 'Appartement T3 lumineux proche RER', Ville: 'Massy', Mandat: 'M-0142', 'Prix (€)': '329000', Description: 'T3 au 2e étage avec ascenseur, séjour sur balcon exposé sud.', 'Surface (m²)': '68', 'Classe énergie': 'C' } };
assert.deepEqual(aColler(l, []), ['Titre', 'Description']);
assert.deepEqual(aColler(l, ["Portail A, Ville : la page n'affiche pas « Massy »"]), ['Titre', 'Ville', 'Description']);
console.log('ok');

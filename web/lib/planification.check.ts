// Vérification rapide : node lib/planification.check.ts
import assert from 'node:assert/strict';
import { prochaine, valide } from './planification.ts';

const iso = (d: Date) => d.toISOString().slice(0, 16);

// Hiver (UTC+1) : jeudi 20/11/2026 08:00 UTC = 09:00 à Paris.
assert.equal(iso(prochaine({ frequence: 'jour', heure: '09:00' }, new Date('2026-11-20T07:00:00Z'))), '2026-11-20T08:00');
assert.equal(iso(prochaine({ frequence: 'jour', heure: '09:00' }, new Date('2026-11-20T08:00:00Z'))), '2026-11-21T08:00'); // déjà passé : demain
// Été (UTC+2) : 15/07/2026 09:00 Paris = 07:00 UTC.
assert.equal(iso(prochaine({ frequence: 'jour', heure: '09:00' }, new Date('2026-07-15T05:00:00Z'))), '2026-07-15T07:00');
// Jours ouvrés : vendredi 20/11 après l'heure -> lundi 23/11.
assert.equal(iso(prochaine({ frequence: 'ouvres', heure: '09:00' }, new Date('2026-11-20T09:00:00Z'))), '2026-11-23T08:00');
// Chaque mercredi (3) depuis le jeudi 19/11 -> 25/11.
assert.equal(iso(prochaine({ frequence: 'semaine', heure: '18:30', jour: 3 }, new Date('2026-11-19T12:00:00Z'))), '2026-11-25T17:30');
// Toutes les heures à :15.
assert.equal(iso(prochaine({ frequence: 'heure', heure: '00:15' }, new Date('2026-11-20T10:20:00Z'))), '2026-11-20T11:15');
// Passage à l'heure d'été (29/03/2026) : 09:00 Paris = 07:00 UTC.
assert.equal(iso(prochaine({ frequence: 'jour', heure: '09:00' }, new Date('2026-03-29T00:00:00Z'))), '2026-03-29T07:00');

assert.equal(valide({ frequence: 'semaine', heure: '9:00', jour: 3 }), false);
assert.equal(valide({ frequence: 'semaine', heure: '09:00', jour: 8 }), false);
assert.equal(valide({ frequence: 'jour', heure: '23:59' }), true);
console.log('planification : ok');

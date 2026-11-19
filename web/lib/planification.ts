// Prochaine exécution d'une tâche planifiée, à l'heure de Paris (changements d'heure compris). Sans dépendance.

export interface Planification {
  frequence: 'jour' | 'ouvres' | 'semaine' | 'heure';
  heure: string; // « 09:00 » ; pour « heure », seules les minutes comptent (toutes les heures à :MM)
  jour?: number; // 1 = lundi … 7 = dimanche, pour « semaine »
}

const FUSEAU = 'Europe/Paris';
const JOURS_CHERCHES = 8;

// Décalage de Paris par rapport à UTC, en minutes, à un instant donné (+60 l'hiver, +120 l'été).
function decalage(instant: Date): number {
  const nom = new Intl.DateTimeFormat('en-US', { timeZone: FUSEAU, timeZoneName: 'longOffset' }).formatToParts(instant).find((x) => x.type === 'timeZoneName')!.value;
  const m = nom.match(/GMT([+-])(\d{2}):(\d{2})/);
  return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
}

// Date et jour de la semaine à Paris pour un instant donné.
function aParis(instant: Date): { a: number; m: number; j: number; jourSemaine: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: FUSEAU, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(instant).map((x) => [x.type, x.value]),
  );
  return { a: Number(parts.year), m: Number(parts.month), j: Number(parts.day), jourSemaine: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(parts.weekday) + 1 };
}

// Heure de Paris -> instant UTC.
function versUtc(a: number, m: number, j: number, h: number, min: number): Date {
  const naif = Date.UTC(a, m - 1, j, h, min);
  return new Date(naif - decalage(new Date(naif)) * 60_000);
}

export function valide(p: unknown): p is Planification {
  const x = p as Planification;
  return !!x && ['jour', 'ouvres', 'semaine', 'heure'].includes(x.frequence) && /^([01]\d|2[0-3]):[0-5]\d$/.test(x.heure)
    && (x.frequence !== 'semaine' || (Number.isInteger(x.jour) && x.jour! >= 1 && x.jour! <= 7));
}

export function prochaine(p: Planification, depuis = new Date()): Date {
  const [h, min] = p.heure.split(':').map(Number);
  for (let d = 0; d < JOURS_CHERCHES; d++) {
    const jour = aParis(new Date(depuis.getTime() + d * 86_400_000));
    if (p.frequence === 'ouvres' && jour.jourSemaine > 5) continue;
    if (p.frequence === 'semaine' && jour.jourSemaine !== p.jour) continue;
    const heures = p.frequence === 'heure' ? Array.from({ length: 24 }, (_, i) => i) : [h];
    for (const hh of heures) {
      const t = versUtc(jour.a, jour.m, jour.j, hh, min);
      if (t.getTime() > depuis.getTime()) return t;
    }
  }
  throw new Error('Planification sans prochaine date.');
}

export function decrire(p: Planification): string {
  const JOURS = ['', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  if (p.frequence === 'heure') return `Toutes les heures, à :${p.heure.slice(3)}`;
  if (p.frequence === 'ouvres') return `Du lundi au vendredi à ${p.heure}`;
  if (p.frequence === 'semaine') return `Chaque ${JOURS[p.jour!]} à ${p.heure}`;
  return `Tous les jours à ${p.heure}`;
}

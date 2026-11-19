'use client';

import { useState } from 'react';
import type { WorkflowVue } from '@/lib/types';

type Frequence = 'jour' | 'ouvres' | 'semaine' | 'heure';
const FREQUENCES: { id: Frequence; nom: string }[] = [
  { id: 'jour', nom: 'Tous les jours' },
  { id: 'ouvres', nom: 'Du lundi au vendredi' },
  { id: 'semaine', nom: 'Chaque semaine' },
  { id: 'heure', nom: 'Toutes les heures' },
];
const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const DATE = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
const champ = 'rounded-xl border border-champ bg-surface px-3 py-2.5 text-[15px] outline-none transition focus:border-nuit';

function decrire(p: NonNullable<WorkflowVue['planification']>): string {
  if (p.frequence === 'heure') return `Toutes les heures, à :${p.heure.slice(3)}`;
  if (p.frequence === 'ouvres') return `Du lundi au vendredi à ${p.heure}`;
  if (p.frequence === 'semaine') return `Chaque ${JOURS[(p.jour ?? 1) - 1]} à ${p.heure}`;
  return `Tous les jours à ${p.heure}`;
}

interface Props {
  w: WorkflowVue;
  envoi: boolean;
  enregistrer: (corps: object, section: 'planif' | 'lien') => Promise<void>;
  retour: (section: 'planif' | 'lien') => React.ReactNode;
}

// Ce qui lance l'agent sans vous : une heure fixe, ou un lien qu'un autre outil appelle quand quelque chose change.
export function Declencheurs({ w, envoi, enregistrer, retour }: Props) {
  const [frequence, setFrequence] = useState<Frequence>(w.planification?.frequence ?? 'jour');
  const [heure, setHeure] = useState(w.planification?.heure ?? '09:00');
  const [jour, setJour] = useState(w.planification?.jour ?? 1);
  const [modifier, setModifier] = useState(false);
  const [copie, setCopie] = useState<string | null>(null);
  const formulaire = w.source === 'formulaire';
  const lien = w.webhook_jeton && typeof window !== 'undefined' ? `${window.location.origin}/api/declencheur/${w.webhook_jeton}` : null;
  const exemple = formulaire
    ? JSON.stringify({ valeurs: Object.fromEntries([...new Set((w.procedure?.champs ?? []).map((c) => c.colonne))].map((c) => [c, '…'])) })
    : '{}';
  const script = lien
    ? `function quandLeSheetChange(e) {\n  UrlFetchApp.fetch('${lien}', {\n    method: 'post', contentType: 'application/json',\n    payload: '${exemple}', muteHttpExceptions: true\n  });\n}`
    : '';

  async function copier(texte: string, quoi: string) {
    await navigator.clipboard.writeText(texte).catch(() => null);
    setCopie(quoi);
    setTimeout(() => setCopie(null), 2000);
  }

  return (
    <>
      <div className="mt-6 border-t border-trait pt-6">
        <p className="text-[15px] font-medium">Planifier</p>
        {w.planification && !modifier ? (
          <>
            <p className="mt-1 text-sm text-texte">{decrire(w.planification)}.</p>
            {w.prochaine_execution && <p className="mt-0.5 text-sm text-discret first-letter:uppercase">Prochaine : {DATE.format(new Date(w.prochaine_execution))}</p>}
            <div className="mt-3 flex gap-4">
              <button onClick={() => setModifier(true)} disabled={envoi} className="lien py-2 text-sm font-medium text-nuit">Modifier</button>
              <button onClick={() => enregistrer({ planification: null }, 'planif')} disabled={envoi} className="lien py-2 text-sm text-alerte">Arrêter</button>
            </div>
          </>
        ) : formulaire ? (
          <p className="mt-1 text-sm text-texte">Cette tâche attend des valeurs à chaque fois : déclenchez-la plutôt par un lien.</p>
        ) : (
          <form
            className="mt-3 flex flex-wrap items-center gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              await enregistrer({ planification: { frequence, heure, ...(frequence === 'semaine' ? { jour } : {}) } }, 'planif');
              setModifier(false);
            }}
          >
            <label htmlFor="frequence" className="sr-only">Fréquence</label>
            <select id="frequence" value={frequence} onChange={(e) => setFrequence(e.target.value as Frequence)} className={champ}>
              {FREQUENCES.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
            </select>
            {frequence === 'semaine' && (
              <>
                <label htmlFor="jour" className="sr-only">Jour</label>
                <select id="jour" value={jour} onChange={(e) => setJour(Number(e.target.value))} className={champ}>
                  {JOURS.map((j, i) => <option key={j} value={i + 1}>{j}</option>)}
                </select>
              </>
            )}
            <label htmlFor="heure" className="sr-only">Heure (Paris)</label>
            <input id="heure" type="time" required value={heure} onChange={(e) => setHeure(e.target.value)} className={champ} />
            <button disabled={envoi} className="bouton rounded-full border border-trait bg-surface px-4 py-2.5 text-sm font-semibold hover:border-encre/30 disabled:opacity-40">Planifier</button>
          </form>
        )}
        {retour('planif')}
      </div>

      <div className="mt-6 border-t border-trait pt-6">
        <p className="text-[15px] font-medium">Lien de déclenchement</p>
        <p className="mt-1 text-sm text-texte">Un autre outil (Google Sheets, Airtable, Zapier…) l’appelle quand quelque chose change, et l’agent se lance.</p>
        {lien ? (
          <>
            <div className="mt-3 flex gap-2">
              <label htmlFor="lien" className="sr-only">Lien de déclenchement</label>
              <input id="lien" readOnly value={lien} onFocus={(e) => e.target.select()} className={`${champ} min-w-0 flex-1 font-mono text-xs`} />
              <button onClick={() => copier(lien, 'lien')} className="bouton shrink-0 rounded-full border border-trait bg-surface px-4 text-sm font-semibold hover:border-encre/30">
                {copie === 'lien' ? 'Copié' : 'Copier'}
              </button>
            </div>
            <p className="mt-2 text-xs text-discret">Gardez ce lien secret : quiconque l’a peut lancer l’agent. Envoi : POST, corps JSON {exemple}.</p>
            <details className="mt-3 rounded-xl bg-fond px-4 py-3 text-sm">
              <summary className="cursor-pointer font-medium text-encre">Brancher un Google Sheet</summary>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-texte">
                <li>Dans le Sheet : Extensions › Apps Script, collez ce code.</li>
                <li>Déclencheurs › Ajouter : fonction « quandLeSheetChange », événement « Lors d’une modification ».</li>
              </ol>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-surface p-3 font-mono text-xs text-encre">{script}</pre>
              <button onClick={() => copier(script, 'script')} className="lien mt-2 py-1 text-sm font-medium text-nuit">{copie === 'script' ? 'Code copié' : 'Copier le code'}</button>
            </details>
            <button onClick={() => enregistrer({ webhook: 'retirer' }, 'lien')} disabled={envoi} className="lien mt-3 py-2 text-sm text-alerte">Révoquer le lien</button>
          </>
        ) : (
          <button onClick={() => enregistrer({ webhook: 'creer' }, 'lien')} disabled={envoi} className="bouton mt-3 rounded-full border border-trait bg-surface px-4 py-2.5 text-sm font-semibold hover:border-encre/30 disabled:opacity-40">
            Créer un lien
          </button>
        )}
        {retour('lien')}
      </div>
    </>
  );
}

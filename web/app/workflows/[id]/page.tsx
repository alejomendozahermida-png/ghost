'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { minutes, type Destination, type WorkflowVue } from '@/lib/types';
import { Preparation } from '@/components/Preparation';
import { Declencheurs } from '@/components/Declencheurs';

const champ = 'w-full rounded-xl border border-champ bg-surface px-4 py-3 text-[15px] outline-none transition focus:border-nuit';
type Section = 'sheet' | 'source' | 'sites' | 'regles' | 'veille' | 'planif' | 'lien';
type Source = 'lecture' | 'sheet' | 'formulaire' | 'aucune';
const SOURCES: { id: Source; nom: string; texte: string }[] = [
  { id: 'lecture', nom: 'L’agent la lit', texte: 'Il ouvre le document dans son navigateur, comme vous.' },
  { id: 'sheet', nom: 'Sheet connecté', texte: 'Ghost lit le tableau directement. Plus rapide.' },
  { id: 'formulaire', nom: 'Formulaire', texte: 'Vous donnez les valeurs au lancement, ou collez un texte.' },
  { id: 'aucune', nom: 'Aucune donnée', texte: 'La tâche se refait à l’identique.' },
];
const NOM_SOURCE: Record<Source, string> = { lecture: 'Votre source', sheet: 'Google Sheet', formulaire: 'Vos données', aucune: 'Ghost' };
const titre = 'mt-14 text-sm font-medium uppercase tracking-[0.14em] text-discret';

// Source à gauche, sites à droite, reliés par des courbes où passent des impulsions.
function Trajet({ sites, depart }: { sites: string[]; depart: string }) {
  const h = Math.max(200, sites.length * 64 + 8);
  const ys = sites.map((_, i) => (h / (sites.length + 1)) * (i + 1));
  return (
    <svg viewBox={`0 0 560 ${h}`} className="w-full" role="img" aria-label={`${depart} vers ${sites.join(', ')}`}>
      {ys.map((y) => (
        <g key={y}>
          <path d={`M150 ${h / 2} C 260 ${h / 2}, 300 ${y}, 400 ${y}`} fill="none" stroke="#e6e6e1" strokeWidth="2" />
          <path d={`M150 ${h / 2} C 260 ${h / 2}, 300 ${y}, 400 ${y}`} fill="none" stroke="#0b1d45" strokeWidth="2" className="flux" />
        </g>
      ))}
      <rect x="0" y={h / 2 - 22} width="150" height="44" rx="22" fill="#0b1d45" />
      <text x="75" y={h / 2 + 5} textAnchor="middle" fontSize="14" fontWeight="500" fill="#fff">{depart}</text>
      {sites.map((d, i) => (
        <g key={d}>
          <rect x="400" y={ys[i] - 20} width="160" height="40" rx="20" fill="#fff" stroke="#e6e6e1" />
          <text x="480" y={ys[i] + 5} textAnchor="middle" fontSize="14" fontWeight="500" fill="#0b1220">{d}</text>
        </g>
      ))}
    </svg>
  );
}

export default function FicheWorkflow({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [w, setW] = useState<WorkflowVue | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  // Section en cours d'enregistrement, et erreur rattachée à sa section (affichée à côté du champ).
  const [enCours, setEnCours] = useState<Section | null>(null);
  const [erreurDe, setErreurDe] = useState<{ section: Section; texte: string } | null>(null);
  const envoi = enCours !== null;
  const [sheet, setSheet] = useState('');
  const [sites, setSites] = useState<Destination[]>([]);
  const [regle, setRegle] = useState('');
  const [aEffacer, setAEffacer] = useState(false); // effacement demandé, en attente de confirmation
  const [erreurEffacer, setErreurEffacer] = useState<string | null>(null);

  async function effacer() {
    const r = await fetch(`/api/workflows/${id}`, { method: 'DELETE' });
    if (r.ok) return (window.location.href = '/workflows');
    setErreurEffacer((await r.json().catch(() => ({}))).erreur ?? 'Impossible d’effacer ce workflow.');
  }

  useEffect(() => {
    fetch(`/api/workflows/${id}`)
      .then((r) => r.json())
      .then((d: WorkflowVue & { erreur?: string }) => {
        if (d.erreur) return setErreur(d.erreur);
        setW(d);
        setSheet(d.sheet_url ?? '');
        setSites(d.destinations ?? []);
      });
  }, [id]);

  // Toute correction regénère la Skill et l'agent H côté serveur.
  async function enregistrer(corps: object, section: Section) {
    setEnCours(section);
    setErreurDe(null);
    const r = await fetch(`/api/workflows/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) });
    const d = await r.json();
    if (d.erreur) setErreurDe({ section, texte: d.erreur });
    else {
      const frais = await (await fetch(`/api/workflows/${id}`)).json();
      setW(frais);
      setSites(frais.destinations ?? []);
    }
    setEnCours(null);
  }

  // Retour visible pendant la regénération de l'agent (environ 10 s), puis l'erreur éventuelle, à côté de la section.
  const retour = (section: Section) =>
    enCours === section ? (
      <p role="status" className="mt-3 text-sm text-nuit">Enregistrement… Ghost met l’agent à jour, environ 10 secondes.</p>
    ) : erreurDe?.section === section ? (
      <p role="alert" className="mt-3 text-sm text-alerte">{erreurDe.texte}</p>
    ) : null;

  if (!w) {
    return erreur ? <p role="alert" className="pt-16 text-[15px] text-alerte">{erreur}</p> : <Preparation titre="Ghost prépare ce workflow" />;
  }

  const regles = w.regles ?? [];
  const pret = w.statut === 'pret';
  const source: Source = w.source ?? 'sheet';
  const depart = source === 'lecture' && w.source_nom ? w.source_nom.slice(0, 18) : NOM_SOURCE[source];
  const manque = [source === 'sheet' && !w.sheet_url && 'le lien du Google Sheet', source === 'lecture' && !w.sheet_url && !w.source_nom && 'l’adresse du document source', sites.some((s) => !s.url) && 'l’adresse de chaque site'].filter(Boolean);

  return (
    <div className="grid gap-16 pt-10 md:grid-cols-[1.5fr_1fr]">
      <article>
        <Link href="/workflows" className="lien text-sm text-discret">Mes workflows</Link>
        <h1 className="monter mt-4 text-4xl font-semibold leading-tight tracking-[-0.02em] first-letter:uppercase md:text-5xl">{w.nom}</h1>
        <p className="monter mt-3 text-lg text-texte [animation-delay:80ms]">
          {w.procedure?.objectif ?? `Repéré ${w.occurrences} fois pendant votre observation.`}
        </p>

        {sites.length > 0 && (
          <div className="monter mt-12 [animation-delay:160ms]">
            {/* Sur téléphone, le schéma rétréci rendrait ses textes illisibles : une phrase le remplace. */}
            <div className="hidden sm:block"><Trajet sites={sites.map((s) => s.site)} depart={depart} /></div>
            <p className="text-[15px] text-texte sm:hidden">{depart} <span aria-hidden="true">→</span><span className="sr-only">vers</span> {sites.map((s) => s.site).join(', ')}</p>
          </div>
        )}

        {w.procedure && (
          <>
            <h2 className={titre}>Ce que Ghost a compris</h2>
            <ol className="mt-4 divide-y divide-trait border-y border-trait">
              {w.procedure.etapes.map((e, i) => (
                <li key={i} className="flex gap-6 py-5">
                  <span className="font-mono text-sm text-discret">{i + 1}</span>
                  <div>
                    <p className="text-sm font-medium text-nuit">{e.site}</p>
                    <p className="mt-1 text-[15px] text-texte">{e.texte}</p>
                  </div>
                </li>
              ))}
            </ol>

          </>
        )}

        <h2 className={titre}>Vos règles</h2>
        <ul className="mt-4 space-y-3 text-[15px] text-texte">
          {regles.map((r) => (
            <li key={r} className="flex items-start justify-between gap-4 border-l-2 border-nuit/20 pl-4">
              {r}
              <button aria-label="Retirer la règle" disabled={envoi} onClick={() => enregistrer({ regles: regles.filter((x) => x !== r) }, 'regles')} className="bouton -mt-2.5 h-11 w-11 shrink-0 rounded-full text-discret hover:bg-alerte-clair hover:text-alerte disabled:opacity-40">×</button>
            </li>
          ))}
        </ul>
        <form className="mt-4 flex gap-3" onSubmit={(e) => { e.preventDefault(); if (regle.trim()) enregistrer({ regles: [...regles, regle.trim()] }, 'regles').then(() => setRegle('')); }}>
          <label htmlFor="regle" className="sr-only">Nouvelle règle</label>
          <input id="regle" value={regle} onChange={(e) => setRegle(e.target.value)} placeholder="Ex. : ne rien publier si le prix au m² dépasse 6 000 €" className={champ} />
          <button disabled={envoi || !regle.trim()} className="bouton shrink-0 rounded-full border border-trait bg-surface px-5 text-sm font-medium disabled:opacity-40">{enCours === 'regles' ? 'Enregistrement…' : 'Ajouter'}</button>
        </form>
        {retour('regles')}

        {/* Les réglages restent repliés tant que rien ne manque : la fiche montre d'abord ce que fait l'agent. */}
        <details open={!pret} className="reglages group mt-14 rounded-3xl border border-trait bg-surface/60 backdrop-blur">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-[15px] font-semibold text-encre">
            Données et sites
            <span aria-hidden="true" className="text-discret transition-transform duration-300 group-open:rotate-45">+</span>
          </summary>
          <div className="px-6 pb-6">
        <h2 className="text-sm font-medium text-discret">Source des données</h2>
        <div role="radiogroup" aria-label="Source des données" className="mt-4 grid gap-2 sm:grid-cols-2">
          {SOURCES.map((x) => (
            <button
              key={x.id}
              role="radio"
              aria-checked={source === x.id}
              disabled={envoi}
              onClick={() => source !== x.id && enregistrer({ source: x.id }, 'source')}
              className={`bouton rounded-2xl border px-4 py-3.5 text-left transition-colors disabled:opacity-60 ${source === x.id ? 'border-nuit bg-nuit-clair' : 'border-trait bg-surface hover:border-encre/30'}`}
            >
              <span className="block text-[15px] font-semibold text-encre">{x.nom}</span>
              <span className="mt-0.5 block text-sm text-texte">{x.texte}</span>
            </button>
          ))}
        </div>
        {retour('source')}
        {source === 'lecture' && (
          <p className="mt-4 text-sm text-texte">
            {w.source_nom ? <>Document vu pendant l’observation : <span className="font-medium text-encre">{w.source_nom}</span>. </> : null}
            L’adresse ci-dessous n’est qu’un indice : si elle ne s’ouvre pas, l’agent cherche le document par son nom.
          </p>
        )}
        {(source === 'sheet' || source === 'lecture') && <form className="mt-4 flex gap-3" onSubmit={(e) => { e.preventDefault(); enregistrer({ sheet_url: sheet }, 'sheet'); }}>
          <label htmlFor="sheet" className="sr-only">Lien du Google Sheet</label>
          <input id="sheet" value={sheet} onChange={(e) => setSheet(e.target.value)} placeholder="Lien du Google Sheet, partagé en lecture" className={champ} />
          <button disabled={envoi || sheet === (w.sheet_url ?? '')} className="bouton shrink-0 rounded-full border border-trait bg-surface px-5 text-sm font-medium disabled:opacity-40">{enCours === 'sheet' ? 'Enregistrement…' : 'Enregistrer'}</button>
        </form>}
        {retour('sheet')}

        <h2 className="mt-10 text-sm font-medium text-discret">Sites</h2>
        <ul className="mt-4 space-y-3">
          {sites.map((s, i) => (
            <li key={i} className="grid grid-cols-[9rem_1fr_auto] items-center gap-3">
              <label htmlFor={`site-${i}`} className="text-sm font-medium text-nuit">{s.site}</label>
              <input id={`site-${i}`} value={s.url ?? ''} placeholder="Adresse de la page de départ" onChange={(e) => setSites(sites.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} className={champ} />
              <button aria-label={`Retirer ${s.site}`} onClick={() => setSites(sites.filter((_, j) => j !== i))} className="bouton h-11 w-11 rounded-full text-discret hover:bg-alerte-clair hover:text-alerte">×</button>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex gap-3">
          <button onClick={() => setSites([...sites, { site: `Site ${sites.length + 1}`, url: '' }])} className="bouton rounded-full border border-trait bg-surface px-5 py-3 text-sm font-medium">Ajouter un site</button>
          <button disabled={envoi} onClick={() => enregistrer({ destinations: sites }, 'sites')} className="bouton rounded-full bg-nuit px-5 py-3 text-sm font-medium text-white disabled:opacity-40">{enCours === 'sites' ? 'Enregistrement…' : 'Enregistrer les sites'}</button>
        </div>
        {retour('sites')}
          </div>
        </details>

      </article>

      <aside className="md:sticky md:top-10 md:self-start">
        <div className="monter rounded-3xl border border-white/60 bg-surface/75 p-8 backdrop-blur-xl shadow-[0_1px_0_#e6e6e1,0_20px_50px_-30px_rgb(11_29_69/0.35)] [animation-delay:200ms]">
          <p className="text-sm text-discret">Temps par ligne, mesuré</p>
          <div className="mt-5 space-y-4">
            {[['À la main', w.gain.manuel_s, 'bg-encre/25'], ['Avec Ghost', w.gain.agent_s, 'bg-nuit']].map(([nom, s, couleur]) => (
              <div key={nom as string}>
                <div className="flex justify-between text-sm"><span className="text-texte">{nom}</span><span className="font-mono">{s ? minutes(s as number) : '—'}</span></div>
                <div className="mt-2 h-2 rounded-full bg-trait">
                  {s ? <div className={`remplir h-2 rounded-full ${couleur}`} style={{ width: `${Math.min(100, ((s as number) / Math.max(w.gain.manuel_s ?? 0, w.gain.agent_s ?? 0)) * 100)}%` }} /> : null}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-discret">{w.gain.executions} exécution(s) réussie(s).</p>

          {w.en_cours && (
            <Link href={`/workflows/${w.id}/lancer?execution=${w.en_cours}`} className="bouton mt-8 flex items-center gap-3 rounded-2xl bg-nuit-clair px-4 py-3 text-sm font-semibold text-nuit">
              <span aria-hidden="true" className="pulse-doux h-2 w-2 rounded-full bg-nuit" />L’agent travaille en ce moment : suivre
            </Link>
          )}
          {pret ? (
            <Link href={`/workflows/${w.id}/lancer`} className="bouton mt-8 block rounded-full bg-nuit py-3.5 text-center text-[15px] font-medium text-white hover:shadow-[0_10px_30px_-10px_rgb(11_29_69/0.6)]">
              Lancer l’agent
            </Link>
          ) : (
            <p className="mt-8 rounded-2xl bg-nuit-clair p-4 text-sm text-nuit">Pour créer l’agent, il manque {manque.join(' et ') || 'une information'}.</p>
          )}

          {pret && <details className="reglages group mt-6 border-t border-trait pt-5">
            <summary className="flex cursor-pointer list-none items-center justify-between text-[15px] font-semibold text-encre">
              Lancement automatique
              <span aria-hidden="true" className="text-discret transition-transform duration-300 group-open:rotate-45">+</span>
            </summary>
          {/* La veille n'a de sens que pour une source qui reçoit de nouvelles lignes. */}
          {(source === 'sheet' || source === 'lecture') && <div className="mt-6 flex items-start justify-between gap-4 border-t border-trait pt-6">
            <div>
              <p id="veille" className="text-[15px] font-medium">Surveiller le Sheet</p>
              <p className="mt-1 text-sm text-texte">Chaque nouvelle ligne est faite automatiquement, en moins d’une minute. Le Sheet doit s’ouvrir par lien.</p>
            </div>
            <button
              role="switch"
              aria-checked={w.surveillance}
              aria-labelledby="veille"
              disabled={!pret || envoi}
              onClick={() => enregistrer({ surveillance: !w.surveillance }, 'veille')}
              className={`bouton relative mt-0.5 h-8 w-14 shrink-0 rounded-full disabled:opacity-40 ${w.surveillance ? 'bg-succes' : 'bg-trait'}`}
            >
              <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-[left] duration-300 ${w.surveillance ? 'left-7' : 'left-1'}`} />
            </button>
          </div>}
          {retour('veille')}
          <Declencheurs w={w} envoi={envoi} enregistrer={enregistrer} retour={retour} />
          </details>}
        </div>
        <div className="mt-6 border-t border-trait pt-6">
          {aEffacer ? (
            <div role="group" aria-label="Confirmer l’effacement">
              <p className="text-sm text-texte">Effacer définitivement ce workflow ? Son historique et son agent seront supprimés.</p>
              <div className="mt-3 flex gap-2">
                <button onClick={effacer} className="bouton rounded-full bg-alerte px-4 py-2.5 text-sm font-medium text-white">Effacer</button>
                <button onClick={() => { setAEffacer(false); setErreurEffacer(null); }} className="bouton rounded-full px-4 py-2.5 text-sm text-texte">Annuler</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAEffacer(true)} className="lien py-2 text-sm text-alerte">Effacer ce workflow</button>
          )}
          {erreurEffacer && <p role="alert" className="mt-2 text-sm text-alerte">{erreurEffacer}</p>}
        </div>
      </aside>
    </div>
  );
}

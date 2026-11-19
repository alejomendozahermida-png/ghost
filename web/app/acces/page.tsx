'use client';

import { useEffect, useState } from 'react';
import { PageEntete, boutonPrincipal } from '@/components/PageEntete';

interface Acces {
  id: string;
  plateforme: string;
  url: string;
  cree_le: string;
}

const champ = 'w-full rounded-xl border border-champ bg-surface px-4 py-3 text-[15px] outline-none transition focus:border-nuit';
const PROTECTION = [
  ['Envoyé au coffre-fort H', 'Le mot de passe part directement chez H. Ghost ne le garde pas.'],
  ['Jamais montré à l’agent', 'L’agent sait seulement où le taper, au moment de la connexion.'],
  ['Retirable à tout moment', 'Un clic l’efface du coffre-fort, pour tous vos workflows.'],
] as const;

// Services courants : le bon nom et la bonne page de connexion sont déjà remplis, il reste l'e-mail et le mot de passe.
const MODELES = [
  { id: 'google', nom: 'Google', detail: 'Gmail, Drive, Sheets', url: 'https://accounts.google.com' },
  { id: 'linkedin', nom: 'LinkedIn', detail: 'Profil, messages', url: 'https://www.linkedin.com' },
  { id: 'hubspot', nom: 'HubSpot', detail: 'CRM', url: 'https://app.hubspot.com' },
  { id: 'salesforce', nom: 'Salesforce', detail: 'CRM', url: 'https://login.salesforce.com' },
  { id: 'notion', nom: 'Notion', detail: 'Pages, bases', url: 'https://www.notion.so' },
  { id: 'airtable', nom: 'Airtable', detail: 'Bases', url: 'https://airtable.com' },
] as const;
type Modele = (typeof MODELES)[number];
const modeleDe = (url: string) => MODELES.find((m) => new URL(m.url).origin === url);

function Icone({ modele, nom }: { modele?: Modele; nom: string }) {
  return (
    <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-nuit-clair text-[17px] font-bold text-nuit">
      {/* eslint-disable-next-line @next/next/no-img-element -- petite icône locale en SVG */}
      {modele ? <img src={`/icones/${modele.id}.svg`} alt="" width={22} height={22} /> : nom.trim().charAt(0).toUpperCase()}
    </span>
  );
}

const VIDE = { plateforme: '', url: '', identifiant: '', motDePasse: '', totp: '' };

export default function MesAcces() {
  const [liste, setListe] = useState<Acces[] | null>(null);
  const [form, setForm] = useState(VIDE);
  const [ouvert, setOuvert] = useState(false);
  const [deuxFacteurs, setDeuxFacteurs] = useState(false);
  const [choix, setChoix] = useState<Modele | 'autre' | null>(null); // service choisi, ou « autre site »
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [aConfirmer, setAConfirmer] = useState<string | null>(null); // retrait demandé, en attente de confirmation

  const charger = () => fetch('/api/acces').then((r) => r.json()).then(setListe);
  useEffect(() => {
    charger();
  }, []);

  async function ajouter(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    const r = await fetch('/api/acces', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setEnvoi(false);
    if (!r.ok) return setErreur((await r.json()).erreur);
    setForm(VIDE); // le mot de passe ne reste pas dans la page
    setChoix(null);
    setOuvert(false);
    charger();
  }

  async function retirer(a: Acces) {
    await fetch(`/api/acces/${a.id}`, { method: 'DELETE' });
    setAConfirmer(null);
    charger();
  }

  const saisie = (k: keyof typeof VIDE) => ({ value: form[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value }) });

  return (
    <>
      <PageEntete
        surtitre="Sécurité"
        titre="Mes accès"
        description="Les identifiants des sites où l’agent doit se connecter. Ils partent directement dans votre coffre-fort H."
        action={!ouvert && <button onClick={() => setOuvert(true)} className={boutonPrincipal}>Ajouter une plateforme</button>}
      />

      <div className="mt-12 grid gap-12 lg:grid-cols-[1.6fr_1fr]">
        <div>
          {ouvert && (
            <form onSubmit={ajouter} className="monter mb-10 grid gap-5 rounded-3xl bg-surface p-8 shadow-[0_1px_0_#e6e6e1,0_20px_50px_-30px_rgb(11_29_69/0.35)] md:grid-cols-2">
              <p className="text-lg font-semibold tracking-tight text-encre md:col-span-2">Nouvelle plateforme</p>
              {!choix && (
                <div role="group" aria-label="Choisir le service" className="grid gap-2 sm:grid-cols-2 md:col-span-2">
                  {[...MODELES, null].map((m) => (
                    <button
                      key={m?.id ?? 'autre'}
                      type="button"
                      onClick={() => { setChoix(m ?? 'autre'); setForm({ ...form, plateforme: m?.nom ?? '', url: m?.url ?? '' }); }}
                      className="bouton flex items-center gap-3 rounded-2xl border border-trait bg-surface px-4 py-3 text-left hover:border-nuit/30"
                    >
                      <Icone modele={m ?? undefined} nom={m?.nom ?? '+'} />
                      <span>
                        <span className="block text-[15px] font-semibold text-encre">{m?.nom ?? 'Autre site'}</span>
                        <span className="block text-sm text-texte">{m?.detail ?? 'Nom et adresse à indiquer'}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {choix && choix !== 'autre' && (
                <div className="flex items-center gap-3 md:col-span-2">
                  <Icone modele={choix} nom={choix.nom} />
                  <div className="flex-1">
                    <p className="text-[15px] font-semibold text-encre">{choix.nom}</p>
                    <p className="text-sm text-texte">Connexion sur {new URL(choix.url).host}</p>
                  </div>
                  <button type="button" onClick={() => setChoix(null)} className="lien py-2 text-sm text-nuit">Changer</button>
                </div>
              )}
              {choix === 'autre' && <><div>
                <label htmlFor="plateforme" className="text-sm font-medium">Plateforme</label>
                <input id="plateforme" required placeholder="Portail A" className={`${champ} mt-2`} {...saisie('plateforme')} />
              </div>
              <div>
                <label htmlFor="url" className="text-sm font-medium">Adresse du site</label>
                <input id="url" type="url" required placeholder="https://…" className={`${champ} mt-2`} {...saisie('url')} />
              </div></>}
              {choix && <><div>
                <label htmlFor="identifiant" className="text-sm font-medium">{choix === 'autre' ? 'Identifiant ou e-mail' : 'Adresse e-mail'}</label>
                <input id="identifiant" required type={choix === 'autre' ? 'text' : 'email'} autoComplete="off" className={`${champ} mt-2`} {...saisie('identifiant')} />
              </div>
              <div>
                <label htmlFor="mdp" className="text-sm font-medium">Mot de passe</label>
                <input id="mdp" type="password" required autoComplete="new-password" className={`${champ} mt-2`} {...saisie('motDePasse')} />
              </div>
              {deuxFacteurs ? (
                <div className="md:col-span-2">
                  <label htmlFor="totp" className="text-sm font-medium">Clé de double authentification (application de codes)</label>
                  <input id="totp" autoComplete="off" placeholder="Clé secrète ou lien otpauth://" className={`${champ} mt-2`} {...saisie('totp')} />
                </div>
              ) : (
                <button type="button" onClick={() => setDeuxFacteurs(true)} className="lien justify-self-start py-2 text-sm text-nuit md:col-span-2">Ce site demande un code de double authentification</button>
              )}
              </>}
              <div className="flex flex-wrap gap-3 md:col-span-2">
                <button disabled={envoi || !choix} className={boutonPrincipal}>{envoi ? 'Enregistrement…' : 'Enregistrer dans le coffre-fort'}</button>
                <button type="button" onClick={() => { setOuvert(false); setForm(VIDE); setChoix(null); setErreur(null); }} className="bouton rounded-full px-5 py-3 text-sm font-medium text-texte">Annuler</button>
              </div>
              {erreur && <p role="alert" className="text-[15px] text-alerte md:col-span-2">{erreur}</p>}
            </form>
          )}

          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold tracking-tight text-encre">Plateformes enregistrées</h2>
            {liste && liste.length > 0 && <p className="text-sm text-discret">{liste.length}</p>}
          </div>

          {liste === null ? (
            <div className="mt-5 space-y-3" aria-busy="true">
              {[0, 1].map((i) => <div key={i} className="attente h-20 rounded-2xl" />)}
            </div>
          ) : liste.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-champ/60 px-6 py-10">
              <p className="text-[15px] text-texte">Aucun accès enregistré.</p>
              <p className="mt-1 text-sm text-discret">Ajoutez-en un quand un site vous demande de vous connecter.</p>
            </div>
          ) : (
            <ul className="mt-5 space-y-3">
              {liste.map((a, i) => (
                <li key={a.id} className="monter flex flex-wrap items-center gap-5 rounded-2xl border border-trait bg-surface px-5 py-4" style={{ animationDelay: `${i * 60}ms` }}>
                  <Icone modele={modeleDe(a.url)} nom={a.plateforme} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[16px] font-semibold text-encre">{a.plateforme}</p>
                    <p className="mt-0.5 truncate text-sm text-texte">{a.url}</p>
                  </div>
                  {aConfirmer === a.id ? (
                    <div role="group" aria-label={`Retirer l’accès à ${a.plateforme}`} className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-texte">Effacer du coffre-fort ?</span>
                      <button onClick={() => retirer(a)} className="bouton rounded-full bg-alerte px-4 py-2.5 text-sm font-medium text-white">Retirer</button>
                      <button onClick={() => setAConfirmer(null)} className="bouton rounded-full px-4 py-2.5 text-sm text-texte">Annuler</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1.5 rounded-full bg-succes-clair px-3 py-1.5 text-sm font-medium text-succes">
                        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-succes" />Protégé
                      </span>
                      <button onClick={() => setAConfirmer(a.id)} className="bouton rounded-full px-4 py-2.5 text-sm text-alerte hover:bg-alerte-clair">Retirer</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="lg:sticky lg:top-10 lg:self-start">
          <div className="rounded-3xl bg-nuit p-8 text-white">
            <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-white/70">Comment c’est protégé</p>
            <ol className="mt-6 space-y-6">
              {PROTECTION.map(([titre, texte], n) => (
                <li key={titre} className="flex gap-4">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 font-mono text-[13px]">{n + 1}</span>
                  <div>
                    <p className="text-[15px] font-semibold">{titre}</p>
                    <p className="mt-1 text-sm leading-relaxed text-white/75">{texte}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </>
  );
}

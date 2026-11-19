'use client';

import { useEffect, useState } from 'react';

interface Acces {
  id: string;
  plateforme: string;
  url: string;
  cree_le: string;
}

const champ = 'w-full rounded-xl border border-trait bg-surface px-4 py-3 text-[15px] outline-none transition focus:border-nuit';
const VIDE = { plateforme: '', url: '', identifiant: '', motDePasse: '', totp: '' };

export default function MesAcces() {
  const [liste, setListe] = useState<Acces[] | null>(null);
  const [form, setForm] = useState(VIDE);
  const [ouvert, setOuvert] = useState(false);
  const [deuxFacteurs, setDeuxFacteurs] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

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
    setOuvert(false);
    charger();
  }

  async function retirer(a: Acces) {
    if (!confirm(`Retirer l’accès à ${a.plateforme} ? Il sera effacé du coffre-fort.`)) return;
    await fetch(`/api/acces/${a.id}`, { method: 'DELETE' });
    charger();
  }

  const saisie = (k: keyof typeof VIDE) => ({ value: form[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value }) });

  return (
    <section className="mx-auto max-w-3xl pt-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <h1 className="monter text-4xl font-semibold tracking-[-0.02em]">Mes accès</h1>
        {!ouvert && (
          <button onClick={() => setOuvert(true)} className="bouton rounded-full bg-nuit px-6 py-3 text-sm font-medium text-white">Ajouter une plateforme</button>
        )}
      </div>
      <p className="monter mt-4 max-w-xl text-[15px] leading-relaxed text-texte [animation-delay:80ms]">
        Les identifiants des sites où l’agent doit se connecter. Ils vont directement dans votre coffre-fort H : Ghost ne les garde pas, et l’agent ne les voit jamais. Il sait seulement où les taper.
      </p>

      {ouvert && (
        <form onSubmit={ajouter} className="monter mt-10 grid gap-4 rounded-3xl bg-surface p-8 shadow-[0_1px_0_#e6e6e1,0_20px_50px_-30px_rgb(11_29_69/0.35)] md:grid-cols-2">
          <div>
            <label htmlFor="plateforme" className="text-sm font-medium">Plateforme</label>
            <input id="plateforme" required placeholder="Portail A" className={`${champ} mt-2`} {...saisie('plateforme')} />
          </div>
          <div>
            <label htmlFor="url" className="text-sm font-medium">Adresse du site</label>
            <input id="url" type="url" required placeholder="https://…" className={`${champ} mt-2`} {...saisie('url')} />
          </div>
          <div>
            <label htmlFor="identifiant" className="text-sm font-medium">Identifiant ou e-mail</label>
            <input id="identifiant" required autoComplete="off" className={`${champ} mt-2`} {...saisie('identifiant')} />
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
          <div className="flex gap-3 md:col-span-2">
            <button disabled={envoi} className="bouton rounded-full bg-nuit px-6 py-3 text-sm font-medium text-white disabled:opacity-50">{envoi ? 'Enregistrement…' : 'Enregistrer dans le coffre-fort'}</button>
            <button type="button" onClick={() => { setOuvert(false); setForm(VIDE); setErreur(null); }} className="bouton rounded-full px-5 py-3 text-sm font-medium text-texte">Annuler</button>
          </div>
          {erreur && <p role="alert" className="text-[15px] text-alerte md:col-span-2">{erreur}</p>}
        </form>
      )}

      {liste === null ? (
        <p className="mt-10 text-[15px] text-discret">Chargement…</p>
      ) : liste.length === 0 ? (
        !ouvert && <p className="mt-12 text-[15px] text-texte">Aucun accès enregistré. Ajoutez-en un quand un site vous demande de vous connecter.</p>
      ) : (
        <ul className="mt-10 divide-y divide-trait border-y border-trait">
          {liste.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-6 py-5">
              <div>
                <p className="text-[15px] font-medium text-encre">{a.plateforme}</p>
                <p className="mt-1 text-sm text-texte">{a.url}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="rounded-full bg-succes-clair px-3 py-1.5 text-sm text-succes">Protégé</span>
                <button onClick={() => retirer(a)} className="bouton rounded-full px-4 py-2.5 text-sm text-alerte hover:bg-alerte-clair">Retirer</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

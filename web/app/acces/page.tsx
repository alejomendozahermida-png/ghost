'use client';

import { useEffect, useState } from 'react';
import { PageEntete, boutonPrincipal } from '@/components/PageEntete';

interface Acces {
  id: string;
  plateforme: string;
  url: string;
  cree_le: string;
}

const champ = 'verre-champ w-full rounded-xl border border-champ/70 px-4 py-3 text-[15px] outline-none transition focus:border-nuit';
// Services courants : le bon nom et la bonne page de connexion sont déjà remplis, il reste l'e-mail et le mot de passe.
const MODELES = [
  { id: 'google', nom: 'Google', detail: 'Gmail, Drive, Sheets', url: 'https://accounts.google.com', categorie: 'Essentiels' },
  { id: 'linkedin', nom: 'LinkedIn', detail: 'Profil, messages', url: 'https://www.linkedin.com', categorie: 'Essentiels' },
  { id: 'slack', nom: 'Slack', detail: 'Messagerie d’équipe', url: 'https://slack.com', categorie: 'Essentiels' },
  { id: 'dropbox', nom: 'Dropbox', detail: 'Fichiers', url: 'https://www.dropbox.com', categorie: 'Essentiels' },
  { id: 'hubspot', nom: 'HubSpot', detail: 'CRM', url: 'https://app.hubspot.com', categorie: 'CRM et ventes' },
  { id: 'salesforce', nom: 'Salesforce', detail: 'CRM', url: 'https://login.salesforce.com', categorie: 'CRM et ventes' },
  { id: 'zoho', nom: 'Zoho', detail: 'CRM, facturation', url: 'https://accounts.zoho.eu', categorie: 'CRM et ventes' },
  { id: 'odoo', nom: 'Odoo', detail: 'ERP, CRM', url: 'https://www.odoo.com', categorie: 'CRM et ventes' },
  { id: 'zendesk', nom: 'Zendesk', detail: 'Tickets, support', url: 'https://www.zendesk.com', categorie: 'Support client' },
  { id: 'intercom', nom: 'Intercom', detail: 'Conversations, support', url: 'https://app.intercom.com', categorie: 'Support client' },
  { id: 'notion', nom: 'Notion', detail: 'Pages, bases', url: 'https://www.notion.so', categorie: 'Organisation' },
  { id: 'airtable', nom: 'Airtable', detail: 'Bases', url: 'https://airtable.com', categorie: 'Organisation' },
  { id: 'trello', nom: 'Trello', detail: 'Tableaux', url: 'https://trello.com', categorie: 'Organisation' },
  { id: 'asana', nom: 'Asana', detail: 'Projets', url: 'https://app.asana.com', categorie: 'Organisation' },
  { id: 'clickup', nom: 'ClickUp', detail: 'Projets', url: 'https://app.clickup.com', categorie: 'Organisation' },
  { id: 'jira', nom: 'Jira', detail: 'Tickets, projets', url: 'https://id.atlassian.com', categorie: 'Organisation' },
  { id: 'shopify', nom: 'Shopify', detail: 'Boutique', url: 'https://accounts.shopify.com', categorie: 'Site et boutique' },
  { id: 'wordpress', nom: 'WordPress', detail: 'Site, blog', url: 'https://wordpress.com', categorie: 'Site et boutique' },
  { id: 'wix', nom: 'Wix', detail: 'Site', url: 'https://users.wix.com', categorie: 'Site et boutique' },
  { id: 'webflow', nom: 'Webflow', detail: 'Site', url: 'https://webflow.com', categorie: 'Site et boutique' },
  { id: 'mailchimp', nom: 'Mailchimp', detail: 'E-mailing', url: 'https://login.mailchimp.com', categorie: 'Marketing' },
  { id: 'brevo', nom: 'Brevo', detail: 'E-mailing, SMS', url: 'https://login.brevo.com', categorie: 'Marketing' },
  { id: 'typeform', nom: 'Typeform', detail: 'Formulaires', url: 'https://admin.typeform.com', categorie: 'Marketing' },
  { id: 'calendly', nom: 'Calendly', detail: 'Rendez-vous', url: 'https://calendly.com', categorie: 'Marketing' },
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
  const [recherche, setRecherche] = useState('');
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
        description="Vos mots de passe partent dans le coffre-fort H. L’agent ne les voit jamais, et vous les retirez d’un clic."
        action={!ouvert && <button onClick={() => setOuvert(true)} className={boutonPrincipal}>Ajouter une plateforme</button>}
      />

      <div className="mt-12 max-w-3xl">
        <div>
          {ouvert && (
            <form onSubmit={ajouter} className="carte verre monter mb-12 grid gap-5 md:grid-cols-2">
              <p className="text-lg font-semibold tracking-tight text-encre md:col-span-2">Nouvelle plateforme</p>
              {!choix && (
                <div className="space-y-5 md:col-span-2">
                  <div>
                    <label htmlFor="recherche" className="sr-only">Rechercher un service</label>
                    <input id="recherche" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher un service (Zendesk, Shopify…)" className={champ} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {MODELES.filter((m) => { const q = recherche.trim().toLowerCase(); return !q || `${m.nom} ${m.detail} ${m.categorie}`.toLowerCase().includes(q); }).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => { setChoix(m); setForm({ ...form, plateforme: m.nom, url: m.url }); }}
                        className="bouton flex items-center gap-3 rounded-xl border border-white/80 bg-white/55 px-3 py-2.5 text-left transition hover:-translate-y-0.5 hover:border-nuit/30 hover:shadow-[0_10px_24px_-16px_rgb(11_29_69/0.5)]"
                      >
                        <Icone modele={m} nom={m.nom} />
                        <span className="text-[15px] font-semibold text-encre">{m.nom}</span>
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => { setChoix('autre'); setForm({ ...form, plateforme: recherche.trim(), url: '' }); }}
                    className="bouton flex items-center gap-3 rounded-xl border border-dashed border-champ/70 px-3 py-2.5 text-left hover:border-nuit/30"
                  >
                    <Icone nom="+" />
                    <span className="text-[15px] font-semibold text-encre">Autre site</span>
                  </button>
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
                <button disabled={envoi || !choix} className={`${boutonPrincipal} rounded-xl!`}>{envoi ? 'Enregistrement…' : 'Enregistrer dans le coffre-fort'}</button>
                <button type="button" onClick={() => { setOuvert(false); setForm(VIDE); setChoix(null); setRecherche(''); setErreur(null); }} className="bouton rounded-xl px-5 py-3 text-sm font-medium text-texte">Annuler</button>
              </div>
              {erreur && <p role="alert" className="text-[15px] text-alerte md:col-span-2">{erreur}</p>}
            </form>
          )}


          {liste === null ? (
            <div className="space-y-3" aria-busy="true">
              {[0, 1].map((i) => <div key={i} className="attente h-20 rounded-2xl" />)}
            </div>
          ) : liste.length === 0 ? (
            <p className="text-[16px] text-texte">Aucun accès pour l’instant. Ajoutez-en un quand un site demande de se connecter.</p>
          ) : (
            <ul className="space-y-3">
              {liste.map((a, i) => (
                <li key={a.id} className="carte carte-compacte verre monter flex flex-wrap items-center gap-4" style={{ animationDelay: `${i * 60}ms` }}>
                  <Icone modele={modeleDe(a.url)} nom={a.plateforme} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[16px] font-semibold text-encre">{a.plateforme}</p>
                    <p className="mt-0.5 truncate text-sm text-texte">{new URL(a.url).host}</p>
                  </div>
                  {aConfirmer === a.id ? (
                    <div role="group" aria-label={`Retirer l’accès à ${a.plateforme}`} className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-texte">Effacer du coffre-fort ?</span>
                      <button onClick={() => retirer(a)} className="bouton rounded-xl bg-alerte px-4 py-2.5 text-sm font-medium text-white">Retirer</button>
                      <button onClick={() => setAConfirmer(null)} className="bouton rounded-xl px-4 py-2.5 text-sm text-texte">Annuler</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <button onClick={() => setAConfirmer(a.id)} className="bouton rounded-xl px-4 py-2.5 text-sm text-texte transition-colors hover:bg-alerte-clair hover:text-alerte">Retirer</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </>
  );
}

'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Logo } from '@/components/Logo';

const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
const champ = 'w-full rounded-xl border border-trait bg-surface px-4 py-3.5 text-[15px] outline-none transition focus:border-nuit';

export default function Connexion() {
  const [mode, setMode] = useState<'connexion' | 'inscription'>('connexion');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [message, setMessage] = useState<{ texte: string; erreur: boolean } | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function valider(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    setMessage(null);
    const { data, error } =
      mode === 'connexion'
        ? await sb.auth.signInWithPassword({ email, password: motDePasse })
        : await sb.auth.signUp({ email, password: motDePasse });
    setEnvoi(false);
    if (error) return setMessage({ texte: error.message === 'Invalid login credentials' ? 'E-mail ou mot de passe incorrect.' : error.message, erreur: true });
    if (!data.session) return setMessage({ texte: 'Compte créé. Ouvrez le lien reçu par e-mail pour l’activer, puis connectez-vous.', erreur: false });
    window.location.href = new URLSearchParams(window.location.search).get('suite') ?? '/observer';
  }

  return (
    <section className="mx-auto max-w-sm pt-16">
      <Logo taille={56} />
      <h1 className="monter mt-8 text-3xl font-semibold tracking-[-0.02em]">{mode === 'connexion' ? 'Se connecter' : 'Créer un compte'}</h1>
      <form onSubmit={valider} className="monter mt-8 space-y-4 [animation-delay:80ms]">
        <div>
          <label htmlFor="email" className="text-sm font-medium">E-mail</label>
          <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`${champ} mt-2`} />
        </div>
        <div>
          <label htmlFor="mdp" className="text-sm font-medium">Mot de passe</label>
          <input id="mdp" type="password" required minLength={8} autoComplete={mode === 'connexion' ? 'current-password' : 'new-password'} value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} className={`${champ} mt-2`} />
        </div>
        <button disabled={envoi} className="bouton w-full rounded-full bg-nuit py-3.5 text-[15px] font-medium text-white disabled:opacity-50">
          {envoi ? 'Un instant…' : mode === 'connexion' ? 'Se connecter' : 'Créer le compte'}
        </button>
      </form>
      {message && <p role="alert" className={`mt-5 text-[15px] ${message.erreur ? 'text-alerte' : 'text-succes'}`}>{message.texte}</p>}
      <button onClick={() => { setMode(mode === 'connexion' ? 'inscription' : 'connexion'); setMessage(null); }} className="lien mt-8 py-2 text-sm text-nuit">
        {mode === 'connexion' ? 'Pas encore de compte ? Créer un compte' : 'Déjà un compte ? Se connecter'}
      </button>
    </section>
  );
}

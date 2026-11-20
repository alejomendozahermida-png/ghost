'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Logo, type Humeur } from '@/components/Logo';
import { boutonPrincipal } from '@/components/PageEntete';

const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
const champ = 'w-full rounded-xl border border-champ bg-surface px-4 py-3.5 text-[15px] outline-none transition focus:border-nuit';

// Où l'utilisateur voulait aller, dit en clair.
function destination(suite: string | null): string | null {
  if (!suite) return null;
  if (suite.includes('/lancer')) return 'le suivi de votre agent';
  if (/^\/workflows\/./.test(suite)) return 'votre workflow';
  return ({ '/workflows': 'Mes workflows', '/observer': 'Observer', '/acces': 'Mes accès', '/bienvenue': 'l’accueil' } as Record<string, string>)[suite] ?? null;
}

// Solidité du mot de passe, sur 3 : longueur, lettres et chiffres mêlés, longueur généreuse.
function solidite(m: string): number {
  if (m.length < 8) return 0;
  return 1 + (/[a-zA-Z]/.test(m) && /\d/.test(m) ? 1 : 0) + (m.length >= 12 ? 1 : 0);
}
const SOLIDITE = ['Au moins 8 caractères', 'Correct', 'Bien', 'Solide'];

export default function Connexion() {
  const [mode, setMode] = useState<'connexion' | 'inscription'>('connexion');
  const [suite, setSuite] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [voir, setVoir] = useState(false);
  const [focus, setFocus] = useState<'email' | 'mdp' | null>(null);
  const [message, setMessage] = useState<{ texte: string; erreur: boolean } | null>(null);
  const [reussi, setReussi] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setSuite(p.get('suite'));
    if (p.get('mode') === 'inscription') setMode('inscription');
  }, []);

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
    setReussi(true);
    const vers = suite ?? '/observer';
    // Premier passage : l'accueil d'abord, puis la page demandée.
    const profil = await fetch('/api/profil').then((r) => r.json()).catch(() => null);
    window.location.href = profil && !profil.onboarding_fini ? `/bienvenue?suite=${encodeURIComponent(vers)}` : vers;
  }

  // Le fantôme réagit : il regarde pendant l'e-mail, ferme les yeux pendant le mot de passe, sourit ou s'inquiète à la fin.
  const humeur: Humeur = reussi ? 'joie' : message?.erreur ? 'souci' : focus === 'mdp' && !voir ? 'discret' : focus === 'email' ? 'observe' : 'repos';
  const vers = destination(suite);
  const titre = mode === 'connexion' ? 'Bon retour sur Ghost.' : 'Créez votre compte.';
  const sousTitre = vers
    ? `Connectez-vous pour continuer vers ${vers}.`
    : mode === 'connexion'
      ? 'Vos agents vous attendent là où vous les avez laissés.'
      : 'Votre premier agent est prêt en trois minutes : montrez une tâche, Ghost s’occupe du reste.';
  const niveau = solidite(motDePasse);

  return (
    <section className="grid items-center gap-12 pb-10 pt-8 md:min-h-[calc(100svh-9rem)] md:grid-cols-[1fr_1fr] md:gap-16">
      <div className="mx-auto w-full max-w-sm md:mx-0">
        <div className="md:hidden"><Logo taille={72} anime humeur={humeur} decoratif /></div>
        <p className="monter mt-6 text-[13px] font-semibold uppercase tracking-[0.16em] text-nuit/70 md:mt-0">{mode === 'connexion' ? 'Connexion' : 'Inscription'}</p>
        <h1 className="monter mt-3 text-[36px] font-bold leading-[1.08] tracking-[-0.03em] text-encre [animation-delay:60ms]">{titre}</h1>
        <p className="monter mt-3 text-[16px] leading-relaxed text-texte [animation-delay:100ms]">{sousTitre}</p>

        <form onSubmit={valider} className="monter mt-9 space-y-5 [animation-delay:140ms]">
          <div>
            <label htmlFor="email" className="text-sm font-medium">E-mail</label>
            <input
              id="email" type="email" required autoComplete="email" value={email}
              onChange={(e) => setEmail(e.target.value)} onFocus={() => setFocus('email')} onBlur={() => setFocus(null)}
              className={`${champ} mt-2`}
            />
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="mdp" className="text-sm font-medium">Mot de passe</label>
              <button type="button" onClick={() => setVoir(!voir)} aria-pressed={voir} aria-controls="mdp" className="lien py-1 text-sm text-nuit">{voir ? 'Masquer' : 'Afficher'}</button>
            </div>
            <input
              id="mdp" type={voir ? 'text' : 'password'} required minLength={8}
              autoComplete={mode === 'connexion' ? 'current-password' : 'new-password'} value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)} onFocus={() => setFocus('mdp')} onBlur={() => setFocus(null)}
              aria-describedby={mode === 'inscription' ? 'solidite' : undefined}
              className={`${champ} mt-2`}
            />
            {mode === 'inscription' && (
              <div id="solidite" className="mt-2.5 flex items-center gap-3" aria-live="polite">
                <div className="flex flex-1 gap-1.5" aria-hidden="true">
                  {[1, 2, 3].map((i) => (
                    <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${niveau >= i ? (niveau === 1 ? 'bg-alerte' : niveau === 2 ? 'bg-nuit/60' : 'bg-succes') : 'bg-trait'}`} />
                  ))}
                </div>
                <span className="w-36 text-right text-xs text-discret">{motDePasse ? SOLIDITE[niveau] : SOLIDITE[0]}</span>
              </div>
            )}
          </div>
          <button disabled={envoi || reussi} className={`${boutonPrincipal} w-full justify-center`}>
            {reussi ? 'C’est parti…' : envoi ? 'Un instant…' : mode === 'connexion' ? 'Se connecter' : 'Créer le compte'}
          </button>
        </form>
        {message && <p role="alert" className={`mt-5 text-[15px] ${message.erreur ? 'text-alerte' : 'text-succes'}`}>{message.texte}</p>}
        <p className="mt-8 text-sm text-texte">
          {mode === 'connexion' ? 'Pas encore de compte ? ' : 'Déjà un compte ? '}
          <button onClick={() => { setMode(mode === 'connexion' ? 'inscription' : 'connexion'); setMessage(null); }} className="lien py-2 font-medium text-nuit">
            {mode === 'connexion' ? 'Créer un compte' : 'Se connecter'}
          </button>
        </p>
        {mode === 'inscription' && (
          <p className="mt-2 text-xs leading-relaxed text-discret">
            En créant un compte, vous acceptez les <a href="/conditions" className="underline">conditions d’utilisation</a> et la <a href="/confidentialite" className="underline">politique de confidentialité</a>.
          </p>
        )}
      </div>

      <div className="relative hidden h-full min-h-[460px] place-items-center overflow-hidden rounded-[2rem] bg-surface md:grid" aria-hidden="true">
        <div className="absolute inset-0 bg-gradient-to-br from-nuit-clair/70 via-transparent to-transparent" />
        <div className="relative flex flex-col items-center">
          <Logo taille={220} anime humeur={humeur} suivreSouris={humeur !== 'discret'} decoratif />
          <p className="mt-10 text-lg font-semibold tracking-tight text-encre">Ghost voit ce que vous répétez.</p>
          <p className="mt-1 text-[15px] text-texte">Et le fait à votre place.</p>
        </div>
      </div>
    </section>
  );
}

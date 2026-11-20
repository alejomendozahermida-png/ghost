'use client';

import Link from 'next/link';
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
    // Plein écran bleu nuit, par-dessus l'en-tête et le pied de page du site : un moment à part, centré sur le fantôme.
    <section className="fixed inset-0 z-40 overflow-y-auto bg-nuit text-white">
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[18%] h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgb(255_255_255/0.16),transparent_65%)]" />
      <div className="relative mx-auto flex min-h-full max-w-md flex-col px-6 pb-8 pt-6">
        <Link href="/" className="lien inline-flex items-center gap-2 self-start py-2 text-sm font-semibold text-white/80 hover:text-white">
          <Logo taille={22} couleur="#ffffff" decoratif />Ghost
        </Link>

        <div className="flex flex-1 flex-col items-center justify-center py-8">
          <div className="drop-shadow-[0_0_36px_rgb(255_255_255/0.35)]">
            <Logo taille={132} anime humeur={humeur} suivreSouris={humeur !== 'discret'} couleur="#ffffff" decoratif />
          </div>

          <div className="monter mt-10 w-full rounded-3xl bg-surface p-8 text-encre shadow-[0_40px_90px_-30px_rgb(0_0_0/0.6)]">
            <h1 className="text-[28px] font-bold leading-tight tracking-[-0.03em]">{titre}</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-texte">{sousTitre}</p>

            <form onSubmit={valider} className="mt-7 space-y-5">
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
          </div>

          <p className="mt-7 text-sm text-white/75">
            {mode === 'connexion' ? 'Pas encore de compte ? ' : 'Déjà un compte ? '}
            <button onClick={() => { setMode(mode === 'connexion' ? 'inscription' : 'connexion'); setMessage(null); }} className="lien py-2 font-semibold text-white">
              {mode === 'connexion' ? 'Créer un compte' : 'Se connecter'}
            </button>
          </p>
        </div>

        <p className="text-center text-xs leading-relaxed text-white/50">
          {mode === 'inscription' ? 'En créant un compte, vous acceptez les ' : ''}
          <a href="/conditions" className="underline hover:text-white/80">conditions d’utilisation</a>
          {mode === 'inscription' ? ' et la ' : ' · '}
          <a href="/confidentialite" className="underline hover:text-white/80">politique de confidentialité</a>
          {mode === 'inscription' ? '.' : ''}
        </p>
      </div>
    </section>
  );
}

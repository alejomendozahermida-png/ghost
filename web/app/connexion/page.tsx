'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Logo, type Humeur } from '@/components/Logo';

const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

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
      ? 'Vos agents vous attendent.'
      : 'Votre premier agent en trois minutes.';
  const niveau = solidite(motDePasse);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const mdpOk = motDePasse.length >= 8;
  // Couleur d'un champ selon ce qu'on y a tapé : neutre tant que vide, vert si valide, rouge si non (une fois quitté pour l'e-mail).
  const bord = (vide: boolean, ok: boolean, montrer: boolean) =>
    vide || (!ok && !montrer) ? 'border-white/20 focus:border-white/60' : ok ? 'border-[#86efac]/70 focus:border-[#86efac]' : 'border-[#fca5a5]/80 focus:border-[#fca5a5]';
  const regles = mode === 'inscription'
    ? [['8 caractères au moins', mdpOk], ['Des lettres et des chiffres', /[a-zA-Z]/.test(motDePasse) && /\d/.test(motDePasse)], ['12 caractères pour un mot de passe solide', motDePasse.length >= 12]] as const
    : [['8 caractères au moins', mdpOk]] as const;

  return (
    // Plein écran bleu nuit, par-dessus l'en-tête et le pied de page du site : un moment à part, centré sur le fantôme.
    <section className="fixed inset-0 z-40 overflow-y-auto bg-nuit text-white">
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[14%] h-[620px] w-[620px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgb(120_150_255/0.22),transparent_62%)]" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -right-40 h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle,rgb(255_255_255/0.08),transparent_65%)]" />
      <div className="relative mx-auto flex min-h-full max-w-md flex-col px-6 pb-8 pt-6">
        <Link href="/" className="lien inline-flex items-center gap-2 self-start py-2 text-sm font-semibold text-white/80 hover:text-white">
          <Logo taille={22} couleur="#ffffff" decoratif />Ghost
        </Link>

        <div className="flex flex-1 flex-col items-center justify-center py-8">
          <div className="drop-shadow-[0_0_40px_rgb(255_255_255/0.4)]">
            <Logo taille={124} anime humeur={humeur} suivreSouris={humeur !== 'discret'} couleur="#ffffff" decoratif />
          </div>

          {/* Carte en verre dépoli : le halo du fantôme passe au travers. */}
          <div key={message?.erreur ? message.texte : 'carte'} className={`carte monter mt-10 w-full border border-white/15 bg-white/[0.07] shadow-[0_40px_90px_-30px_rgb(0_0_0/0.7)] backdrop-blur-xl ${message?.erreur ? 'secouer' : ''}`}>
            <h1 className="text-[28px] font-bold leading-tight tracking-[-0.03em]">{titre}</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-white/70">{sousTitre}</p>

            <form onSubmit={valider} className="mt-7 space-y-5" noValidate>
              <div>
                <label htmlFor="email" className="text-sm font-medium text-white/85">E-mail</label>
                <div className="relative mt-2">
                  <input
                    id="email" type="email" required autoComplete="email" value={email}
                    onChange={(e) => setEmail(e.target.value)} onFocus={() => setFocus('email')} onBlur={() => setFocus(null)}
                    aria-invalid={!!email && !emailOk && focus !== 'email'}
                    className={`w-full rounded-xl border bg-white/[0.08] px-4 py-3.5 pr-11 text-[15px] text-white outline-none transition-colors duration-200 placeholder:text-white/35 ${bord(!email, emailOk, focus !== 'email')}`}
                    placeholder="vous@entreprise.fr"
                  />
                  {email && emailOk && <span aria-hidden="true" className="fondu absolute right-4 top-1/2 -translate-y-1/2 text-[#86efac]">✓</span>}
                </div>
                {email && !emailOk && focus !== 'email' && <p className="mt-2 text-sm text-[#fca5a5]">Cette adresse e-mail n’est pas complète.</p>}
              </div>

              <div>
                <div className="flex items-baseline justify-between">
                  <label htmlFor="mdp" className="text-sm font-medium text-white/85">Mot de passe</label>
                  <button type="button" onClick={() => setVoir(!voir)} aria-pressed={voir} aria-controls="mdp" className="lien py-1 text-sm text-white/70 hover:text-white">{voir ? 'Masquer' : 'Afficher'}</button>
                </div>
                <input
                  id="mdp" type={voir ? 'text' : 'password'} required minLength={8}
                  autoComplete={mode === 'connexion' ? 'current-password' : 'new-password'} value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)} onFocus={() => setFocus('mdp')} onBlur={() => setFocus(null)}
                  aria-describedby="regles-mdp"
                  className={`mt-2 w-full rounded-xl border bg-white/[0.08] px-4 py-3.5 text-[15px] text-white outline-none transition-colors duration-200 ${bord(!motDePasse, mdpOk, true)}`}
                />
                {mode === 'inscription' && (
                  <div className="mt-3 flex gap-1.5" aria-hidden="true">
                    {[1, 2, 3].map((i) => (
                      <span key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${niveau >= i ? (niveau === 1 ? 'bg-[#fca5a5]' : niveau === 2 ? 'bg-[#fcd34d]' : 'bg-[#86efac] shadow-[0_0_12px_rgb(134_239_172/0.6)]') : 'bg-white/15'}`} />
                    ))}
                  </div>
                )}
                <ul id="regles-mdp" className="mt-3 space-y-1.5" aria-live="polite">
                  {regles.map(([texte, ok]) => (
                    <li key={texte} className={`flex items-center gap-2 text-sm transition-colors duration-300 ${ok ? 'text-[#86efac]' : motDePasse ? 'text-white/70' : 'text-white/50'}`}>
                      <span aria-hidden="true" className={`grid h-4 w-4 place-items-center rounded-full text-[10px] transition-all duration-300 ${ok ? 'scale-100 bg-[#86efac] text-nuit' : 'scale-90 border border-white/30'}`}>{ok ? '✓' : ''}</span>
                      {texte}
                    </li>
                  ))}
                </ul>
              </div>

              <button disabled={envoi || reussi || !emailOk || !mdpOk} className="bouton w-full rounded-xl bg-white py-3.5 text-[15px] font-semibold text-nuit transition hover:shadow-[0_12px_40px_-10px_rgb(255_255_255/0.5)] disabled:opacity-40">
                {reussi ? 'C’est parti…' : envoi ? 'Un instant…' : mode === 'connexion' ? 'Se connecter' : 'Créer le compte'}
              </button>
            </form>
            {message && <p role="alert" className={`mt-5 text-[15px] ${message.erreur ? 'text-[#fca5a5]' : 'text-[#86efac]'}`}>{message.texte}</p>}
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

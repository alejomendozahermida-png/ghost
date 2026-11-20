// Petites scènes qui montrent Ghost au travail : accueil du site et premier passage.

export function FenetreObservee() {
  return (
    <div className="carte relative overflow-hidden verre">
      <div className="h-3 w-1/3 rounded bg-encre/10" />
      {[0.9, 0.7, 0.8].map((w, i) => (
        <div key={i} className="mt-4 h-8 rounded-xl border border-trait" style={{ width: `${w * 100}%` }} />
      ))}
      <div className="mt-5 h-9 w-28 rounded-xl bg-nuit/85" />
      <div className="balayer absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-transparent via-nuit/10 to-transparent" />
    </div>
  );
}

export function MethodeEcrite() {
  const pas = ['Ouvre le formulaire de dépôt', 'Remplit Titre, Prix, Ville', 'Vérifie la classe énergie', 'Publie, puis relit la page'];
  return (
    <ol className="space-y-2.5">
      {pas.map((p, i) => (
        <li key={p} className="monter flex items-center gap-3 rounded-xl bg-surface px-4 py-3 text-[15px] text-texte shadow-[0_1px_0_#e6e6e1]" style={{ animationDelay: `${i * 140}ms` }}>
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-nuit-clair font-mono text-xs text-nuit">{i + 1}</span>
          {p}
        </li>
      ))}
    </ol>
  );
}

export function SitesFaits() {
  return (
    <div className="space-y-3">
      {['Portail A', 'Portail B', 'Google Sheet'].map((s, i) => (
        <div key={s} className="monter flex items-center justify-between verre rounded-2xl px-5 py-4" style={{ animationDelay: `${150 + i * 220}ms` }}>
          <span className="text-[15px] font-semibold text-encre">{s}</span>
          <span className="rounded-full bg-succes-clair px-3 py-1 text-sm font-medium text-succes">✓ Fait et relu</span>
        </div>
      ))}
    </div>
  );
}

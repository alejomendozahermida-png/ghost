interface PageEnteteProps {
  surtitre: string;
  titre: string;
  description?: string;
  action?: React.ReactNode;
}

// En-tête commun des pages : aligné à gauche, une seule action principale à droite.
export function PageEntete({ surtitre, titre, description, action }: PageEnteteProps) {
  return (
    <header className="flex flex-col gap-6 pb-4 pt-8 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        <p className="monter text-[13px] font-semibold uppercase tracking-[0.16em] text-nuit/70">{surtitre}</p>
        <h1 className="monter mt-3 text-[40px] font-bold leading-[1.05] tracking-[-0.03em] text-encre [animation-delay:60ms] md:text-[52px]">{titre}</h1>
        {description && <p className="monter mt-4 text-[17px] leading-relaxed text-texte [animation-delay:120ms]">{description}</p>}
      </div>
      {action && <div className="monter shrink-0 [animation-delay:180ms]">{action}</div>}
    </header>
  );
}

export const boutonPrincipal =
  'bouton inline-flex items-center gap-2 rounded-full bg-nuit px-6 py-3.5 text-[15px] font-semibold text-white hover:shadow-[0_12px_32px_-12px_rgb(11_29_69/0.65)] disabled:pointer-events-none disabled:opacity-40';

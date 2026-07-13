/** Theme-aware hero backdrop for `/events` — mirrors home hero mobile light/dark treatment. */
export default function MarketplaceBrowseHeroBackdrop({
  isDark,
}: {
  isDark: boolean;
}) {
  return (
    <>
      {isDark ? (
        <div className="absolute inset-0 md:hidden bg-triboo-black" aria-hidden>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,rgba(255,90,31,0.22),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_30%,rgba(242,60,53,0.12),transparent_45%)]" />
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent to-triboo-black" />
        </div>
      ) : (
        <div className="absolute inset-0 md:hidden" aria-hidden>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_-10%,hsl(var(--primary)/0.16),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_85%_25%,hsl(var(--accent)/0.1),transparent_50%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--secondary)/0.5)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent to-background" />
        </div>
      )}

      <div className="hidden md:block absolute inset-0 bg-secondary/40" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.1),transparent_60%)]" />
      </div>
    </>
  );
}

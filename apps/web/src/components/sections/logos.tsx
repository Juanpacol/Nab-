/** Marquee de empresas donde han sido contratados los usuarios (prueba social). */
const COMPANIES = ['Airbnb', 'Stripe', 'Figma', 'Netflix', 'Plaid', 'Notion', 'Vercel', 'Linear'];

export function Logos() {
  return (
    <section className="border-y border-border/60 bg-surface/40 py-10">
      <p className="text-center font-mono text-xs uppercase tracking-widest text-muted">
        Nuestros usuarios fueron contratados en
      </p>
      <div className="relative mt-6 overflow-hidden">
        <div className="flex w-max animate-marquee gap-16 pr-16">
          {[...COMPANIES, ...COMPANIES].map((c, i) => (
            <span
              key={i}
              className="font-display text-2xl font-semibold text-muted/70"
              aria-hidden={i >= COMPANIES.length}
            >
              {c}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

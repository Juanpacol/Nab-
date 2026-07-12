import Link from 'next/link';
import { Button } from '@nab/ui';
import { Reveal } from '../reveal';

export function Cta() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-24">
      <Reveal>
        <div className="relative overflow-hidden rounded-xl border border-primary/30 bg-primary-soft px-6 py-16 text-center">
          <h2 className="mx-auto max-w-2xl text-balance font-display text-4xl text-foreground">
            Tu próximo empleo no va a buscarse solo. Ah, espera —{' '}
            <span className="italic text-primary">con Nab, sí.</span>
          </h2>
          <div className="mt-8 flex justify-center">
            <Link href="/register">
              <Button size="lg">Empezar gratis</Button>
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

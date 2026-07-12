'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { Button, Card } from '@nab/ui';

/** Tarjeta demo del feed swipe, la interacción más característica del producto. */
function SwipeDemoCard() {
  const reduce = useReducedMotion();
  return (
    <div className="relative mx-auto h-[360px] w-full max-w-sm">
      {/* Cartas de fondo apiladas */}
      <div className="absolute inset-x-6 top-6 h-full rounded-lg border border-border bg-surface-2 opacity-60" />
      <div className="absolute inset-x-3 top-3 h-full rounded-lg border border-border bg-surface opacity-80" />
      <motion.div
        className="absolute inset-0"
        animate={reduce ? undefined : { rotate: [-1.5, 1.5, -1.5], y: [0, -4, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Card className="flex h-full flex-col p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-sm bg-primary-soft font-display text-lg text-primary">
              S
            </div>
            <div>
              <p className="font-medium text-foreground">Ingeniero Full Stack</p>
              <p className="text-sm text-muted">Stripe · Remoto</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {['TypeScript', 'React', 'Node.js'].map((s) => (
              <span key={s} className="rounded-sm bg-surface-2 px-2 py-1 font-mono text-xs text-muted">
                {s}
              </span>
            ))}
          </div>
          <p className="mt-4 flex-1 text-sm leading-relaxed text-muted">
            Buscamos alguien que construya productos usados por millones. Salario US$90k–130k.
          </p>
          <div className="mt-4 flex items-center justify-between">
            <span className="font-mono text-xs text-success">● 92% de match</span>
            <div className="flex gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-danger">
                ✕
              </span>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-fg">
                ✓
              </span>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Halo de fondo */}
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
        style={{ background: 'radial-gradient(circle, var(--nab-primary-soft), transparent 70%)' }}
      />
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 md:grid-cols-2 md:py-28">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 font-mono text-xs text-muted">
            <span className="text-success">●</span> +750.000 personas buscando mejor
          </span>
          <h1 className="mt-6 text-balance font-display text-5xl leading-[1.05] text-foreground md:text-6xl">
            Deja de aplicar.{' '}
            <span className="italic text-primary">Empieza a conseguir entrevistas.</span>
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
            Nab encuentra las vacantes ideales, genera tu CV y carta con IA para cada una, y las
            envía por ti. Tú solo decides a cuáles.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register">
              <Button size="lg">Empezar gratis</Button>
            </Link>
            <a href="#features">
              <Button size="lg" variant="outline">
                Ver cómo funciona
              </Button>
            </a>
          </div>
          <p className="mt-4 font-mono text-xs text-muted">
            Sin tarjeta · 5 aplicaciones gratis para probar
          </p>
        </div>
        <SwipeDemoCard />
      </div>
    </section>
  );
}

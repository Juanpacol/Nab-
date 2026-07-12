'use client';

import { useState } from 'react';
import { motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import { Card } from '@nab/ui';

interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  skills: string[];
  salary: string;
  match: number;
}

// Datos demo; en Fase 2/3 vienen de la API con match real por embeddings.
const DEMO_JOBS: Job[] = [
  { id: '1', title: 'Ingeniero Full Stack', company: 'Stripe', location: 'Remoto', skills: ['TypeScript', 'React', 'Node'], salary: 'US$90k–130k', match: 92 },
  { id: '2', title: 'Frontend Engineer', company: 'Figma', location: 'Ciudad de México', skills: ['React', 'CSS', 'Design Systems'], salary: 'US$80k–120k', match: 88 },
  { id: '3', title: 'Ingeniero de Datos', company: 'Netflix', location: 'Remoto (LATAM)', skills: ['Python', 'SQL', 'Spark'], salary: 'US$100k–150k', match: 79 },
  { id: '4', title: 'Product Engineer', company: 'Linear', location: 'Remoto', skills: ['TypeScript', 'GraphQL'], salary: 'US$95k–140k', match: 85 },
];

function SwipeCard({
  job,
  onSwipe,
  isTop,
}: {
  job: Job;
  onSwipe: (dir: 'left' | 'right') => void;
  isTop: boolean;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-12, 12]);
  const likeOpacity = useTransform(x, [20, 120], [0, 1]);
  const nopeOpacity = useTransform(x, [-120, -20], [1, 0]);

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x > 120) onSwipe('right');
    else if (info.offset.x < -120) onSwipe('left');
  }

  return (
    <motion.div
      className="absolute inset-0"
      style={{ x, rotate }}
      drag={isTop ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      whileTap={{ cursor: 'grabbing' }}
    >
      <Card className="flex h-full cursor-grab flex-col p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-primary-soft font-display text-lg text-primary">
              {job.company[0]}
            </div>
            <div>
              <p className="font-display text-lg text-foreground">{job.title}</p>
              <p className="text-sm text-muted">
                {job.company} · {job.location}
              </p>
            </div>
          </div>
          <span className="font-mono text-xs text-success">{job.match}%</span>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {job.skills.map((s) => (
            <span key={s} className="rounded-sm bg-surface-2 px-2 py-1 font-mono text-xs text-muted">
              {s}
            </span>
          ))}
        </div>

        <p className="mt-5 flex-1 text-sm leading-relaxed text-muted">
          {job.company} busca un {job.title.toLowerCase()} para construir productos usados por
          millones. Genera tu CV y carta con IA y aplica con un toque.
        </p>

        <p className="font-mono text-sm text-foreground">{job.salary}</p>

        {/* Overlays de decisión */}
        <motion.span
          style={{ opacity: likeOpacity }}
          className="pointer-events-none absolute left-6 top-6 rounded border-2 border-success px-3 py-1 font-mono text-sm font-bold text-success"
        >
          APLICAR
        </motion.span>
        <motion.span
          style={{ opacity: nopeOpacity }}
          className="pointer-events-none absolute right-6 top-6 rounded border-2 border-danger px-3 py-1 font-mono text-sm font-bold text-danger"
        >
          PASAR
        </motion.span>
      </Card>
    </motion.div>
  );
}

export default function FeedPage() {
  const [index, setIndex] = useState(0);
  const remaining = DEMO_JOBS.slice(index);

  function handleSwipe(dir: 'left' | 'right') {
    // Fase 4: 'right' crea una Application y descuenta crédito.
    setIndex((i) => i + 1);
    void dir;
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="text-center">
        <h1 className="font-display text-3xl text-foreground">Descubrir</h1>
        <p className="mt-1 text-muted">Desliza a la derecha para aplicar, a la izquierda para pasar.</p>
      </div>

      <div className="relative mx-auto mt-8 h-[420px] w-full">
        {remaining.length === 0 ? (
          <Card className="flex h-full flex-col items-center justify-center p-8 text-center">
            <p className="text-4xl">🎉</p>
            <p className="mt-3 font-display text-xl text-foreground">¡Por hoy es todo!</p>
            <p className="mt-1 text-sm text-muted">Vuelve mañana por más vacantes con match.</p>
          </Card>
        ) : (
          remaining
            .slice(0, 3)
            .reverse()
            .map((job, i, arr) => (
              <SwipeCard
                key={job.id}
                job={job}
                isTop={i === arr.length - 1}
                onSwipe={handleSwipe}
              />
            ))
        )}
      </div>

      {/* Botones de acción (accesibilidad + escritorio) */}
      {remaining.length > 0 && (
        <div className="mt-6 flex items-center justify-center gap-6">
          <button
            onClick={() => handleSwipe('left')}
            aria-label="Pasar"
            className="flex h-14 w-14 items-center justify-center rounded-full border border-border text-xl text-danger transition-transform active:scale-90"
          >
            ✕
          </button>
          <button
            onClick={() => handleSwipe('right')}
            aria-label="Aplicar"
            className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl text-primary-fg shadow-lifted transition-transform active:scale-90"
          >
            ✓
          </button>
        </div>
      )}
    </div>
  );
}

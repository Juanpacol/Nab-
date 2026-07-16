'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import { Button, Card } from '@nab/ui';
import { formatSalary, type JobCard } from '@/lib/jobs';
import { applyAction } from '@/app/actions/applications';
import { saveJobAction } from '@/app/actions/jobs';

type Decision = 'left' | 'right' | 'up';

function SwipeCard({
  job,
  onSwipe,
  isTop,
}: {
  job: JobCard;
  onSwipe: (d: Decision) => void;
  isTop: boolean;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-12, 12]);
  const likeOpacity = useTransform(x, [20, 120], [0, 1]);
  const nopeOpacity = useTransform(x, [-120, -20], [1, 0]);
  const saveOpacity = useTransform(y, [-120, -20], [1, 0]);
  const salary = formatSalary(job);

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x > 120) onSwipe('right');
    else if (info.offset.x < -120) onSwipe('left');
    else if (info.offset.y < -120) onSwipe('up');
  }

  return (
    <motion.div
      className="absolute inset-0"
      style={{ x, y, rotate }}
      drag={isTop}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
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
                {job.company}
                {job.location ? ` · ${job.location}` : ''}
              </p>
            </div>
          </div>
          {typeof job.score === 'number' && (
            <span className="font-mono text-xs text-success">{Math.round(job.score * 100)}%</span>
          )}
        </div>

        <p className="mt-6 flex-1 text-sm leading-relaxed text-muted">
          {job.company} busca {job.title.toLowerCase()}. Desliza a la derecha para aplicar (asistido),
          arriba para guardar, izquierda para pasar.
        </p>

        {salary && <p className="font-mono text-sm text-foreground">{salary}</p>}
        {job.techTestId && (
          <p className="mt-1 font-mono text-xs text-primary">🧪 Incluye prueba técnica</p>
        )}

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
        <motion.span
          style={{ opacity: saveOpacity }}
          className="pointer-events-none absolute left-1/2 top-6 -translate-x-1/2 rounded border-2 border-primary px-3 py-1 font-mono text-sm font-bold text-primary"
        >
          GUARDAR
        </motion.span>
      </Card>
    </motion.div>
  );
}

/**
 * Deck de vacantes con física de swipe (Fase 4). Derecha aplica (asistido:
 * descuenta crédito + abre el sitio), arriba guarda, izquierda descarta; con undo.
 */
export function SwipeDeck({ jobs, loadError = false }: { jobs: JobCard[]; loadError?: boolean }) {
  const [index, setIndex] = useState(0);
  const [toast, setToast] = useState<{ text: string; testApplicationId?: string } | null>(null);
  const [, startAction] = useTransition();
  // "Deshacer" solo retrocede el índice visual — para 'right' ya se disparó
  // applyAction (cobra crédito y marca la aplicación como enviada) contra el
  // backend, así que deshacerlo ahí sería engañoso: el usuario creería que
  // canceló algo que en realidad ya se envió. Solo permitimos deshacer un
  // swipe reversible (pasar/guardar), nunca uno que ya aplicó.
  const [lastReversible, setLastReversible] = useState(false);
  const remaining = jobs.slice(index);

  function decide(dir: Decision) {
    const job = jobs[index];
    if (!job) return;
    setIndex((i) => i + 1);
    setLastReversible(dir !== 'right');

    if (dir === 'right') {
      startAction(async () => {
        const res = await applyAction(job.id);
        if (res.error) {
          setToast({ text: res.error });
        } else if (res.requiresTest && res.applicationId && !res.alreadyApplied) {
          setToast({ text: `Aplicaste a ${job.company} — incluye una prueba técnica`, testApplicationId: res.applicationId });
        } else {
          setToast({ text: res.alreadyApplied ? 'Ya habías aplicado' : `Aplicaste a ${job.company}` });
          if (res.applyUrl) window.open(res.applyUrl, '_blank', 'noopener');
        }
      });
    } else if (dir === 'up') {
      startAction(async () => {
        await saveJobAction(job.id);
        setToast({ text: `Guardada: ${job.title}` });
      });
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="text-center">
        <h1 className="font-display text-3xl text-foreground">Descubrir</h1>
        <p className="mt-1 text-muted">Derecha aplica · Arriba guarda · Izquierda pasa</p>
      </div>

      <div className="relative mx-auto mt-8 h-[420px] w-full">
        {remaining.length === 0 && loadError ? (
          <Card className="flex h-full flex-col items-center justify-center p-8 text-center">
            <p className="text-4xl">⚠️</p>
            <p className="mt-3 font-display text-xl text-foreground">No pudimos conectar</p>
            <p className="mt-1 text-sm text-muted">
              El servidor puede estar despertando. Recarga la página en un momento.
            </p>
          </Card>
        ) : remaining.length === 0 ? (
          <Card className="flex h-full flex-col items-center justify-center p-8 text-center">
            <p className="text-4xl">🎉</p>
            <p className="mt-3 font-display text-xl text-foreground">¡Por hoy es todo!</p>
            <p className="mt-1 text-sm text-muted">Vuelve pronto por más vacantes con match.</p>
          </Card>
        ) : (
          remaining
            .slice(0, 3)
            .reverse()
            .map((job, i, arr) => (
              <SwipeCard key={job.id} job={job} isTop={i === arr.length - 1} onSwipe={decide} />
            ))
        )}
      </div>

      {toast && (
        <div className="mt-4 text-center text-sm text-primary">
          <p>{toast.text}</p>
          {toast.testApplicationId && (
            <Link
              href={`/applications/${toast.testApplicationId}/prueba`}
              className="mt-1 inline-block font-medium underline"
            >
              Realizar prueba ahora →
            </Link>
          )}
        </div>
      )}

      {remaining.length > 0 && (
        <div className="mt-6 flex items-center justify-center gap-5">
          <Button
            onClick={() => decide('left')}
            aria-label="Pasar"
            variant="outline"
            size="icon"
            className="h-14 w-14 rounded-full text-xl text-danger"
          >
            ✕
          </Button>
          <Button
            onClick={() => decide('up')}
            aria-label="Guardar"
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-full text-lg text-primary"
          >
            ★
          </Button>
          <Button
            onClick={() => decide('right')}
            aria-label="Aplicar"
            variant="primary"
            size="icon"
            className="h-16 w-16 rounded-full text-2xl shadow-lifted"
          >
            ✓
          </Button>
          <Button
            onClick={() => {
              setIndex((i) => Math.max(0, i - 1));
              setLastReversible(false);
            }}
            aria-label="Deshacer"
            disabled={index === 0 || !lastReversible}
            title={!lastReversible && index > 0 ? 'Ya aplicaste a esta vacante, no se puede deshacer' : undefined}
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-full text-lg text-muted"
          >
            ↺
          </Button>
        </div>
      )}
    </div>
  );
}

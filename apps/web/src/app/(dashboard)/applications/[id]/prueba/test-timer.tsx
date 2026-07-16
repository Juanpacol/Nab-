'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@nab/ui';

interface TestTimerProps {
  /** Fuente de verdad: startedAt + timeLimitMinutes del servidor, nunca un contador local desde cero. */
  startedAt: string;
  timeLimitMinutes: number;
  onExpire: () => void;
}

export function TestTimer({ startedAt, timeLimitMinutes, onExpire }: TestTimerProps) {
  const deadline = new Date(startedAt).getTime() + timeLimitMinutes * 60_000;
  const [remaining, setRemaining] = useState(() => Math.max(0, deadline - Date.now()));

  useEffect(() => {
    const interval = setInterval(() => {
      const next = Math.max(0, deadline - Date.now());
      setRemaining(next);
      if (next === 0) {
        clearInterval(interval);
        onExpire();
      }
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline]);

  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  const low = remaining < 5 * 60_000;

  return (
    <Badge variant={low ? 'danger' : 'neutral'} className="font-mono">
      {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
    </Badge>
  );
}

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

const deltaVariants = cva('font-mono text-xs font-medium', {
  variants: {
    tone: {
      success: 'text-success',
      danger: 'text-danger',
      neutral: 'text-muted',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export interface StatProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof deltaVariants> {
  label: string;
  value: React.ReactNode;
  /** Texto de variación, p.ej. "+12% esta semana" — el color lo da `tone`. */
  delta?: string;
}

export function Stat({ className, label, value, delta, tone, ...props }: StatProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)} {...props}>
      <span className="font-mono text-xs uppercase tracking-wide text-muted">{label}</span>
      <span className="font-display text-3xl text-foreground">{value}</span>
      {delta && <span className={deltaVariants({ tone })}>{delta}</span>}
    </div>
  );
}

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

const progressIndicatorVariants = cva('h-full rounded-[inherit] transition-all', {
  variants: {
    variant: {
      primary: 'bg-primary',
      success: 'bg-success',
      warning: 'bg-warning',
      danger: 'bg-danger',
    },
  },
  defaultVariants: { variant: 'primary' },
});

export interface ProgressProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof progressIndicatorVariants> {
  /** 0-100. Se acota al rango antes de pintarse. */
  value: number;
}

export function Progress({ className, variant, value, ...props }: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('h-2 w-full overflow-hidden rounded-sm bg-surface-2', className)}
      {...props}
    >
      <div className={progressIndicatorVariants({ variant })} style={{ width: `${clamped}%` }} />
    </div>
  );
}

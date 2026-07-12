import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-sm px-2 py-0.5 font-mono text-xs font-medium',
  {
    variants: {
      variant: {
        neutral: 'bg-surface-2 text-muted',
        primary: 'bg-primary-soft text-primary',
        success: 'bg-primary-soft text-success',
        warning: 'bg-amber-100 text-warning dark:bg-amber-950/40',
        danger: 'bg-red-100 text-danger dark:bg-red-950/40',
        info: 'bg-blue-100 text-info dark:bg-blue-950/40',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

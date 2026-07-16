'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

const avatarVariants = cva(
  'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-soft font-sans font-medium text-primary',
  {
    variants: {
      size: {
        sm: 'h-8 w-8 text-xs',
        md: 'h-10 w-10 text-sm',
        lg: 'h-14 w-14 text-base',
      },
    },
    defaultVariants: { size: 'md' },
  },
);

export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof avatarVariants> {
  src?: string | null;
  /** Nombre completo (o correo) del que derivar las iniciales de respaldo. */
  name?: string | null;
  alt?: string;
}

function initialsFrom(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

export function Avatar({ className, size, src, name, alt, ...props }: AvatarProps) {
  const [errored, setErrored] = React.useState(false);
  const showImage = src && !errored;
  return (
    <span className={cn(avatarVariants({ size }), className)} {...props}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- componente compartido, no siempre corre bajo Next
        <img
          src={src}
          alt={alt ?? name ?? ''}
          className="h-full w-full object-cover"
          onError={() => setErrored(true)}
        />
      ) : (
        <span aria-hidden={!!alt}>{initialsFrom(name)}</span>
      )}
    </span>
  );
}

/** Logotipo de Nab: una hoja/brote estilizada + wordmark. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ''}`}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 21C12 21 4 17 4 10C4 6 7 3 12 3C17 3 20 6 20 10C20 17 12 21 12 21Z"
          fill="var(--nab-primary)"
        />
        <path d="M12 21V9" stroke="var(--nab-primary-fg)" strokeWidth="1.6" strokeLinecap="round" />
        <path
          d="M12 13C10 12 9 10 9 10M12 13C14 12 15 10 15 10"
          stroke="var(--nab-primary-fg)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
      <span className="font-display text-xl font-semibold tracking-tight text-foreground">Nab</span>
    </span>
  );
}

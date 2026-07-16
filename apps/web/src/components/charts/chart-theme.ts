/**
 * Roles de color para los charts del dashboard de empresa — referencian las
 * CSS custom properties de packages/ui (tokens.css) directamente, así el
 * SVG de Recharts se repinta solo al cambiar [data-theme], sin JS.
 *
 * Reglas de la skill `dataviz` aplicadas aquí:
 * - Una sola serie por chart → un solo hue (primary), sin leyenda.
 * - Pass/fail es un estado (no una serie categórica) → tokens success/danger,
 *   siempre acompañados de ícono + texto, nunca solo color.
 * - Texto (ejes, tooltip, leyendas) usa tokens de texto, nunca el color de
 *   la serie — ver marks-and-anatomy.md "Text never wears the data color".
 */
export const chartColors = {
  primary: 'var(--nab-primary)',
  primarySoft: 'var(--nab-primary-soft)',
  success: 'var(--nab-success)',
  danger: 'var(--nab-danger)',
  border: 'var(--nab-border)',
  surface: 'var(--nab-surface)',
  textMuted: 'var(--nab-fg-muted)',
  textPrimary: 'var(--nab-fg)',
} as const;

export const chartAxisTick = {
  fill: chartColors.textMuted,
  fontSize: 12,
  fontFamily: 'var(--font-sans)',
};

export const chartGrid = {
  stroke: chartColors.border,
  strokeDasharray: '0',
};

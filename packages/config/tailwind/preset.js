/**
 * Preset Tailwind del "Nab Design System".
 * Los colores apuntan a CSS custom properties (definidas en packages/ui/styles/tokens.css),
 * de modo que el tema claro/oscuro se resuelve en runtime sin recompilar.
 */

/** @type {import('tailwindcss').Config} */
const preset = {
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Superficies y texto (tokens semánticos)
        bg: 'var(--nab-bg)',
        surface: 'var(--nab-surface)',
        'surface-2': 'var(--nab-surface-2)',
        border: 'var(--nab-border)',
        foreground: 'var(--nab-fg)',
        muted: 'var(--nab-fg-muted)',

        // Marca — verde crecimiento (emerald)
        primary: {
          DEFAULT: 'var(--nab-primary)',
          hover: 'var(--nab-primary-hover)',
          fg: 'var(--nab-primary-fg)',
          soft: 'var(--nab-primary-soft)',
        },

        // Estados semánticos (independientes del acento)
        success: 'var(--nab-success)',
        warning: 'var(--nab-warning)',
        danger: 'var(--nab-danger)',
        info: 'var(--nab-info)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        sm: '8px',
        DEFAULT: '12px',
        lg: '16px',
        xl: '24px',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(16, 24, 20, 0.04), 0 4px 16px rgba(16, 24, 20, 0.06)',
        lifted: '0 8px 32px rgba(16, 24, 20, 0.12)',
      },
      keyframes: {
        'fade-rise': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-rise': 'fade-rise 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
};

export default preset;

import { useColorScheme } from 'react-native';

/**
 * Tokens de color de Nab, espejo de `packages/ui/src/styles/tokens.css`.
 * React Native no puede consumir CSS custom properties, así que estos valores
 * viven aquí como objetos planos — misma paleta, misma identidad de marca.
 */
export interface Theme {
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  fg: string;
  fgMuted: string;
  primary: string;
  primaryHover: string;
  primaryFg: string;
  primarySoft: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
}

export const lightTheme: Theme = {
  bg: '#fafaf7',
  surface: '#ffffff',
  surface2: '#f2f4f0',
  border: '#e3e6de',
  fg: '#14201a',
  fgMuted: '#5c6b62',
  primary: '#16a34a',
  primaryHover: '#128040',
  primaryFg: '#ffffff',
  primarySoft: '#e6f5ec',
  success: '#16a34a',
  warning: '#d97706',
  danger: '#dc2626',
  info: '#2563eb',
};

export const darkTheme: Theme = {
  bg: '#0f1512',
  surface: '#161d19',
  surface2: '#1e2823',
  border: '#2a352e',
  fg: '#eaf0ec',
  fgMuted: '#9aa89f',
  primary: '#2fbd63',
  primaryHover: '#34cf6c',
  primaryFg: '#06130b',
  primarySoft: '#14261c',
  success: '#2fbd63',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
};

/** Tema activo según el esquema de color del sistema. */
export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkTheme : lightTheme;
}

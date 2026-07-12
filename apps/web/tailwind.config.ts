import type { Config } from 'tailwindcss';
import preset from '@nab/config/tailwind/preset';

const config: Config = {
  presets: [preset],
  content: [
    './src/**/*.{ts,tsx}',
    // Incluir el design system compartido para que Tailwind detecte sus clases.
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
};

export default config;

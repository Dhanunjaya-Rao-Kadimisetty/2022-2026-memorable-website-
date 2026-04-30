import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cinematic: {
          50: '#f5f5f6',
          100: '#e4e4e7',
          200: '#d4d4d8',
          300: '#a1a1aa',
          400: '#71717a',
          500: '#52525b',
          600: '#3f3f46',
          700: '#27272a',
          800: '#18181b',
          900: '#111113',
          950: '#09090b',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(255,255,255,0.06), 0 20px 80px rgba(0,0,0,0.35)',
      },
      backgroundImage: {
        'cinematic-glow':
          'radial-gradient(circle at top, rgba(250,250,250,0.14), transparent 34%), radial-gradient(circle at bottom right, rgba(161,161,170,0.12), transparent 30%)',
      },
    },
  },
  plugins: [],
};

export default config;


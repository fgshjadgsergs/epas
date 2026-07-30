import type { Config } from 'tailwindcss';

/**
 * Дизайн-токены ссылаются на CSS-переменные (см. src/app/globals.css).
 * Цвета заданы как RGB-каналы «R G B», что позволяет Tailwind управлять
 * прозрачностью через <alpha-value> (напр. bg-surface/50).
 * Темы переключаются атрибутом data-theme на <html> (next-themes).
 */
const withAlpha = (variable: string) => `rgb(var(${variable}) / <alpha-value>)`;

const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        bg: withAlpha('--bg'),
        'bg-2': withAlpha('--bg-2'),
        surface: withAlpha('--surface'),
        'surface-2': withAlpha('--surface-2'),
        border: withAlpha('--border'),
        fg: withAlpha('--fg'),
        muted: withAlpha('--muted'),
        subtle: withAlpha('--subtle'),
        primary: withAlpha('--primary'),
        'primary-hover': withAlpha('--primary-hover'),
        'primary-fg': withAlpha('--primary-fg'),
        accent: withAlpha('--accent'),
        success: withAlpha('--success'),
        warning: withAlpha('--warning'),
        danger: withAlpha('--danger'),
        ring: withAlpha('--ring'),
      },
      borderColor: { DEFAULT: withAlpha('--border') },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: '0.875rem',
        xl: '1.125rem',
        '2xl': '1.5rem',
      },
      maxWidth: { container: '1400px' },
      boxShadow: {
        card: '0 1px 2px rgb(0 0 0 / 0.06), 0 8px 24px -12px rgb(0 0 0 / 0.25)',
        pop: '0 12px 40px -8px rgb(0 0 0 / 0.45)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-down': {
          from: { opacity: '0', transform: 'translateY(-8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-down': 'slide-down 0.18s ease-out',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;

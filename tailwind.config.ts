import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      /* Design system: consistent font sizes with mobile-first approach */
      fontSize: {
        /* Body text: min 16px on mobile, min 14px on desktop */
        'body-mobile': ['1rem', { lineHeight: '1.5' }], // 16px
        'body-desktop': ['0.875rem', { lineHeight: '1.5' }], // 14px
        /* Responsive body text utility */
        body: ['1rem', { lineHeight: '1.5' }],
      },
      /* Line height: 1.5 base as per design system */
      lineHeight: {
        base: '1.5',
      },
      /* Spacing scale: uniform 4px increments */
      spacing: {
        'tap-target': '44px', // Minimum tap target size (WCAG)
        'nav-height': '56px', // Mobile bottom nav height
        'safe-bottom': 'env(safe-area-inset-bottom, 8px)',
      },
      /* Responsive max-widths for content containment */
      maxWidth: {
        content: '1280px',
        'content-wide': '1536px',
      },
      /* Minimum heights for touch targets */
      minHeight: {
        'tap-target': '44px',
      },
      minWidth: {
        'tap-target': '44px',
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      /* Responsive screens */
      screens: {
        xs: '320px',
        '3xl': '2560px',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
export default config;

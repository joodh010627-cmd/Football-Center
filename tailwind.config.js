/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Pretendard', 'Inter', '-apple-system', 'system-ui', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#5645d4',
          pressed: '#4534b3',
          deep: '#3a2a99',
        },
        navy: {
          DEFAULT: '#0a1530',
          deep: '#070f24',
          mid: '#1a2a52',
        },
        /** Pitch greens — the hero band reads as a floodlit field from above. */
        pitch: {
          DEFAULT: '#0a3d2f',
          deep: '#052a1f',
          mid: '#0f5240',
          stripe: '#0c4636',
        },
        /** High-contrast accents for figures sitting on the dark pitch. */
        accent: {
          lime: '#c8f169',
          amber: '#ffd84d',
          alert: '#ff8272',
        },
        link: {
          DEFAULT: '#0075de',
          pressed: '#005bab',
        },
        brand: {
          orange: '#dd5b00',
          'orange-deep': '#793400',
          pink: '#ff64c8',
          'pink-deep': '#a02e6d',
          purple: '#7b3ff2',
          'purple-300': '#d6b6f6',
          'purple-800': '#391c57',
          teal: '#2a9d99',
          green: '#1aae39',
          yellow: '#f5d75e',
          brown: '#523410',
        },
        tint: {
          peach: '#ffe8d4',
          rose: '#fde0ec',
          mint: '#d9f3e1',
          lavender: '#e6e0f5',
          sky: '#dcecfa',
          yellow: '#fef7d6',
          'yellow-bold': '#f9e79f',
          cream: '#f8f5e8',
          gray: '#f0eeec',
        },
        canvas: '#ffffff',
        surface: {
          DEFAULT: '#f6f5f4',
          soft: '#fafaf9',
        },
        hairline: {
          DEFAULT: '#e5e3df',
          soft: '#ede9e4',
          strong: '#c8c4be',
        },
        ink: {
          DEFAULT: '#1a1a1a',
          deep: '#000000',
        },
        charcoal: '#37352f',
        slate: '#5d5b54',
        steel: '#787671',
        stone: '#a4a097',
        muted: '#bbb8b1',
        'on-dark': '#ffffff',
        'on-dark-muted': '#a4a097',
        success: '#1aae39',
        warning: '#dd5b00',
        error: '#e03131',
      },
      borderRadius: {
        xs: '4px',
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
        '3xl': '24px',
      },
      boxShadow: {
        subtle: 'rgba(15, 15, 15, 0.04) 0px 1px 2px 0px',
        card: 'rgba(15, 15, 15, 0.08) 0px 4px 12px 0px',
        mockup: 'rgba(15, 15, 15, 0.20) 0px 24px 48px -8px',
        modal: 'rgba(15, 15, 15, 0.16) 0px 16px 48px -8px',
      },
      fontSize: {
        micro: ['12px', { lineHeight: '1.4', fontWeight: '500' }],
        caption: ['13px', { lineHeight: '1.4' }],
        'display-lg': ['56px', { lineHeight: '1.10', letterSpacing: '-1px' }],
        hero: ['80px', { lineHeight: '1.05', letterSpacing: '-2px' }],
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out',
        'slide-up': 'slide-up 200ms ease-out',
        'pop-in': 'pop-in 180ms ease-out',
      },
    },
  },
  plugins: [],
};

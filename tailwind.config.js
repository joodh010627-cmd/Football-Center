/** @type {import('tailwindcss').Config} */

/**
 * Palette is inherited from the FC GROWTH public site so the operations app and
 * the homepage read as one brand: deep pitch green as the only dark surface,
 * muted gold as the single accent, warm paper as the page.
 *
 * Token *names* are the app's own (primary / tint / hairline …) — only their
 * values were re-pointed at the brand ramp, so components didn't have to change.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Pretendard Variable',
          'Pretendard',
          '-apple-system',
          'system-ui',
          'Segoe UI',
          'sans-serif',
        ],
      },
      colors: {
        /** Brand green. Every dark surface in the app is one of these. */
        primary: {
          DEFAULT: '#006039',
          pressed: '#004429',
          deep: '#00301C',
          soft: '#12A06A',
          wash: '#EEF3F0',
        },
        /** Muted gold — eyebrows, rules, hero figures. Never a large fill. */
        gold: {
          DEFAULT: '#C6A664',
          soft: '#E4D3AC',
          deep: '#8A7134',
        },
        /** Hero band: a floodlit pitch seen from above, in brand green. */
        pitch: {
          DEFAULT: '#00301C',
          deep: '#001B10',
          mid: '#00563A',
          stripe: '#00351F',
        },
        /** High-contrast figures sitting on the dark pitch. */
        accent: {
          lime: '#5FD6A0',
          amber: '#E4D3AC',
          alert: '#F0A38C',
        },
        link: {
          DEFAULT: '#006039',
          pressed: '#004429',
        },
        /* Legacy semantic names, re-pointed into the green/gold ramp. */
        brand: {
          orange: '#B8863B',
          'orange-deep': '#7A5A22',
          pink: '#C6A664',
          'pink-deep': '#8A7134',
          purple: '#006039',
          'purple-300': '#9BC3AF',
          'purple-800': '#00301C',
          teal: '#00794A',
          green: '#0F8E5E',
          yellow: '#C6A664',
          brown: '#6B5730',
        },
        /** Washes. All are desaturated toward paper so cards stay quiet. */
        tint: {
          peach: '#F4EDDD',
          rose: '#F8EBE6',
          mint: '#E3EEE8',
          lavender: '#EAF1EC',
          sky: '#E6EEEA',
          yellow: '#F6F1E4',
          'yellow-bold': '#EEE2C3',
          cream: '#F5F2E9',
          gray: '#F0EEE7',
          alert: '#F6E4DE',
          'alert-soft': '#FCF4F1',
        },
        canvas: '#ffffff',
        surface: {
          DEFAULT: '#F2F0E9',
          soft: '#FAF9F5',
        },
        hairline: {
          DEFAULT: '#DFDCD3',
          soft: '#EAE7DE',
          strong: '#C7C2B5',
        },
        ink: {
          DEFAULT: '#0E1310',
          deep: '#00301C',
        },
        charcoal: '#2C3532',
        slate: '#3D4642',
        steel: '#6A736E',
        stone: '#98A19B',
        muted: '#B7BEB9',
        'on-dark': '#ffffff',
        'on-dark-muted': '#9BAAA1',
        success: '#0F8E5E',
        warning: '#B8863B',
        error: '#BE4F39',
      },
      /* Softer geometry across the board — the homepage's main luxury signal. */
      borderRadius: {
        xs: '5px',
        sm: '8px',
        md: '11px',
        lg: '16px',
        xl: '20px',
        '2xl': '26px',
        '3xl': '32px',
      },
      boxShadow: {
        subtle: 'rgba(14, 19, 16, 0.04) 0px 1px 2px 0px',
        card: 'rgba(14, 19, 16, 0.07) 0px 6px 20px -6px',
        mockup: 'rgba(0, 48, 28, 0.22) 0px 24px 48px -8px',
        modal: 'rgba(14, 19, 16, 0.18) 0px 20px 56px -12px',
      },
      letterSpacing: {
        label: '0.22em',
        wide: '0.08em',
        tightest: '-0.045em',
      },
      fontSize: {
        micro: ['12px', { lineHeight: '1.4', fontWeight: '500' }],
        caption: ['13px', { lineHeight: '1.4' }],
        label: ['11px', { lineHeight: '1.2', letterSpacing: '0.22em', fontWeight: '600' }],
        'display-lg': ['56px', { lineHeight: '1.08', letterSpacing: '-2px' }],
        hero: ['80px', { lineHeight: '1.04', letterSpacing: '-3px' }],
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.22, 1, 0.36, 1)',
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
        /* --- Boot sequence ------------------------------------------- */
        'crest-in': {
          '0%': { opacity: '0', transform: 'scale(0.84)' },
          '60%': { opacity: '1', transform: 'scale(1.015)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'boot-rise': {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'boot-progress': {
          from: { transform: 'scaleX(0)' },
          to: { transform: 'scaleX(1)' },
        },
        'boot-out': {
          from: { opacity: '1' },
          to: { opacity: '0', visibility: 'hidden' },
        },
      },
      animation: {
        'fade-in': 'fade-in 220ms ease-out',
        'slide-up': 'slide-up 260ms cubic-bezier(0.22, 1, 0.36, 1)',
        'pop-in': 'pop-in 200ms cubic-bezier(0.22, 1, 0.36, 1)',
        'crest-in': 'crest-in 900ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'boot-rise': 'boot-rise 700ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'boot-progress': 'boot-progress 1500ms cubic-bezier(0.5, 0, 0.2, 1) both',
        'boot-out': 'boot-out 520ms ease-in forwards',
      },
    },
  },
  plugins: [],
};

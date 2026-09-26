/** @type {import('tailwindcss').Config} */

/**
 * Palette: white paper, pitch green as the only dark surface, nothing else
 * loud. Inherited from the FC GROWTH public site, minus the gold.
 *
 * The gold ramp is gone on purpose. It was doing two incompatible jobs — a
 * bright accent on the dark auth/boot surfaces *and* readable body text on
 * light washes — so every site had to pick one and lose the other. On dark
 * surfaces the accent is now plain white; on light ones it is `charcoal`. That
 * leaves green as the single colour that means "act on this", which is the only
 * thing an accent was ever for here.
 *
 * Neutrals were also cooled off the old warm-paper ramp (#FAF9F5 …): with white
 * as the page, a beige hairline read as a stain rather than a rule.
 *
 * Token *names* are the app's own (primary / tint / hairline …) — only their
 * values were re-pointed, so components didn't have to change.
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
          amber: '#FFFFFF',
          alert: '#F0A38C',
        },
        link: {
          DEFAULT: '#006039',
          pressed: '#004429',
        },
        /* Legacy semantic names. Hues are kept only where they carry meaning —
           the curriculum tracks and the block categories need to stay tellable
           apart — and everything that was gold is now neutral. */
        brand: {
          orange: '#BE7C35',
          'orange-deep': '#805121',
          pink: '#C08497',
          'pink-deep': '#8A5566',
          purple: '#006039',
          'purple-300': '#9BC3AF',
          'purple-800': '#00301C',
          teal: '#00794A',
          green: '#0F8E5E',
          yellow: '#9AA3A0',
          brown: '#4A5350',
        },
        /** Washes. All are desaturated toward white so cards stay quiet. */
        tint: {
          peach: '#FAEEE3',
          rose: '#F9ECEF',
          mint: '#E6F0EA',
          lavender: '#EDF1EE',
          sky: '#E9EEF1',
          yellow: '#F4F6F5',
          'yellow-bold': '#E7EBEA',
          cream: '#F6F7F7',
          gray: '#F1F3F2',
          alert: '#F8E6E1',
          'alert-soft': '#FDF5F3',
        },
        canvas: '#ffffff',
        /**
         * The page, and the step a card rises off it.
         *
         * `soft` used to be #F8F9F9 — seven units off white — so a white card on
         * the page was a border and nothing else, and on a phone in daylight the
         * border is the first thing to go. Dropping the page to #EBEFEE gives
         * every white surface in the app an edge without touching any of them,
         * and gives the frosted bars something to actually frost.
         */
        surface: {
          DEFAULT: '#E4E9E7',
          soft: '#EBEFEE',
        },
        hairline: {
          DEFAULT: '#DCE2E0',
          soft: '#E6EAE9',
          strong: '#C0C7C4',
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
        warning: '#BE7C35',
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
        'fade-out': {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
        'slide-down': {
          from: { opacity: '1', transform: 'translateY(0)' },
          to: { opacity: '0', transform: 'translateY(24px)' },
        },
        'pop-out': {
          from: { opacity: '1', transform: 'scale(1)' },
          to: { opacity: '0', transform: 'scale(0.97)' },
        },
        /* --- Navigation -----------------------------------------------
           Three verbs, three motions. A drill-down comes in from the right
           (deeper), 뒤로 comes back from the left (shallower), and a tab tap
           rises in place (sideways move, no depth). The distance is short on
           purpose: this is orientation, not spectacle, and a coach tapping
           through five screens before a session must never wait on it. */
        'screen-push': {
          from: { opacity: '0', transform: 'translateX(32px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'screen-pop': {
          from: { opacity: '0', transform: 'translateX(-24px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'tab-in': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        /** Content swapped inside a screen — a filter, a segment. */
        'swap-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'tab-pop': {
          '0%': { transform: 'scale(0.82)' },
          '55%': { transform: 'scale(1.08)' },
          '100%': { transform: 'scale(1)' },
        },
        'check-pop': {
          '0%': { transform: 'scale(0.4)', opacity: '0' },
          '60%': { transform: 'scale(1.15)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'dot-fill': {
          from: { transform: 'scaleX(0)' },
          to: { transform: 'scaleX(1)' },
        },
        'slow-zoom': {
          from: { transform: 'scale(1.06)' },
          to: { transform: 'scale(1)' },
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
        'fade-out': 'fade-out 180ms ease-in forwards',
        'slide-down': 'slide-down 200ms cubic-bezier(0.4, 0, 1, 1) forwards',
        'pop-out': 'pop-out 160ms ease-in forwards',
        /* `backwards`, never `both`: a transform left on the screen wrapper
           after the animation would become the containing block for every
           `position: fixed` modal inside it. */
        'screen-push': 'screen-push 340ms cubic-bezier(0.22, 1, 0.36, 1) backwards',
        'screen-pop': 'screen-pop 300ms cubic-bezier(0.22, 1, 0.36, 1) backwards',
        'tab-in': 'tab-in 280ms cubic-bezier(0.22, 1, 0.36, 1) backwards',
        'swap-in': 'swap-in 240ms cubic-bezier(0.22, 1, 0.36, 1) backwards',
        'tab-pop': 'tab-pop 360ms cubic-bezier(0.22, 1, 0.36, 1)',
        'check-pop': 'check-pop 260ms cubic-bezier(0.22, 1, 0.36, 1)',
        'dot-fill': 'dot-fill 5000ms linear forwards',
        'slow-zoom': 'slow-zoom 1200ms cubic-bezier(0.22, 1, 0.36, 1) backwards',
        'crest-in': 'crest-in 900ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'boot-rise': 'boot-rise 700ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'boot-progress': 'boot-progress 1500ms cubic-bezier(0.5, 0, 0.2, 1) both',
        'boot-out': 'boot-out 520ms ease-in forwards',
      },
    },
  },
  plugins: [],
};

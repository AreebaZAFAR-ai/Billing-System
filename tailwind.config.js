/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#effaf8',
          100: '#d6f1ec',
          200: '#ade2d9',
          300: '#7dcdc1',
          400: '#48b0a3',
          500: '#279488',
          600: '#1b776e',
          700: '#185f59',
          800: '#174d49',
          900: '#16403d',
          950: '#082624',
        },
        ink: {
          50: '#f7f8f9',
          100: '#eef0f2',
          200: '#dfe3e7',
          300: '#c5ccd3',
          400: '#98a2ad',
          500: '#6b7580',
          600: '#525b66',
          700: '#3e4650',
          800: '#272d35',
          900: '#171b21',
          950: '#0c0f13',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)',
        pop: '0 12px 32px -8px rgba(16,24,40,0.18), 0 4px 8px -4px rgba(16,24,40,0.08)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        'slide-in-right': { from: { transform: 'translateX(24px)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'slide-up': 'slide-up 180ms ease-out',
        'slide-in-right': 'slide-in-right 200ms ease-out',
      },
    },
  },
  plugins: [],
};

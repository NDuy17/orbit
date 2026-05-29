/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        surface: '#f8fafc',
        ink: '#111827',
        muted: '#64748b',
        line: '#e2e8f0',
        ocean: '#0891b2',
        leaf: '#16a34a',
        amber: '#d97706',
        berry: '#dc2626',
      },
      boxShadow: {
        soft: '0 16px 40px rgba(15, 23, 42, 0.08)',
      },
    },
  },
  plugins: [],
};

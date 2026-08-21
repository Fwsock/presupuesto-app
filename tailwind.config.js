module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // FinanFlow palette (see lib/theme.ts for the same values used outside
      // className strings — Ionicons `color` props, inline styles, etc).
      colors: {
        brand: '#2563EB',
        income: '#10B981',
        danger: '#EF4444',
        background: '#F8FAFC',
        surface: '#FFFFFF',
        ink: '#0F172A',
        secondary: '#64748B',
        border: '#F1F5F9',
      },
    },
  },
  plugins: [],
};

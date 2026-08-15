/**
 * FinanFlow palette — same hex values as tailwind.config.js's `theme.extend.colors`.
 * Use this for anything that can't take a NativeWind className (Ionicons'
 * `color` prop, inline styles, chart colors); use the Tailwind classes
 * (`bg-brand`, `text-income`, `text-danger`, `bg-background`, `bg-surface`,
 * `text-ink`) everywhere else.
 */
export const theme = {
  brand: '#2563EB',
  income: '#10B981',
  danger: '#EF4444',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  ink: '#0F172A',
} as const;

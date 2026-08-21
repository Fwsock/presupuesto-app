import { Platform, type TextStyle } from 'react-native';

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
  // Neobanco-style secondary/muted text (labels, timestamps, helper copy) --
  // deliberately NOT Tailwind's default gray-400/500 (#9CA3AF/#6B7280),
  // which read slightly warm next to this palette's cool slate-leaning
  // brand/background/surface tones.
  secondary: '#64748B',
  // Subtle card border -- a near-invisible hairline, not a real divider.
  border: '#F1F5F9',
} as const;

/**
 * Semibold weight for screen/section headers (native nav header title,
 * FullScreenFormModal's title bar) that actually reads as semibold on
 * Android. Plain `fontWeight: '600'` renders correctly on iOS (the system
 * font has real intermediate weights), but stock Android "Roboto" only
 * reliably maps `fontWeight` to regular (400) or bold (700) -- '600' quietly
 * falls back to regular there, which is why headers read visibly thinner on
 * Android than the identical style on iOS.
 *
 * `sans-serif-medium` (not the raw PostScript name `'Roboto-Medium'`) is
 * Android's own built-in family alias -- the OS resolves it to whatever
 * medium-weight system font it actually ships, which is what keeps this
 * correct on OEM skins (HyperOS included) that rename or swap the system
 * typeface. A literal `'Roboto-Medium'` string only works when a font file
 * with that exact PostScript name exists on-device, which isn't guaranteed
 * off stock/Pixel Android. `letterSpacing` is a small additional nudge (not
 * a substitute for the weight fix) -- a touch of tracking reads as more
 * "designed"/deliberate at this size, reinforcing the medium weight rather
 * than faking it.
 */
export const headerTitleFont: TextStyle =
  Platform.OS === 'android'
    ? { fontFamily: 'sans-serif-medium', letterSpacing: 0.3 }
    : { fontWeight: '600' };

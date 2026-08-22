import { memo, useEffect, useMemo, useState } from 'react';
import { Image, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { matchBrand } from '../lib/brands/brandCatalog';
import { BRAND_LOGOS, PLACEHOLDER_BRAND_IDS } from '../lib/brands/brandLogos';
import { AVAILABLE_MOVEMENT_ICONS, DEFAULT_MOVEMENT_ICON } from '../features/movements/iconSuggestion';

// Every name MovementIconBadge will ever actually pass to <Ionicons name=…>
// for the generic fallback -- both DEFAULT_MOVEMENT_ICON and the full
// category-rule list, so any real category icon renders as itself, and
// only a genuinely unrecognized value (empty string, null coerced to a
// string, a stale/removed icon name from old data) gets redirected.
const VALID_ICON_NAMES = new Set<string>(AVAILABLE_MOVEMENT_ICONS);

/**
 * `iconName` is expected to be a known Ionicons glyph, but this is DB-backed
 * data with no runtime guarantee behind the `string` type (a legacy row, a
 * blank value from before this column was always populated, anything
 * outside this app's own control) -- rendering an unrecognized name straight
 * through <Ionicons> paints nothing at all. Never returns anything but a
 * real, renderable glyph name.
 */
function resolveSafeIconName(iconName: string): string {
  return iconName && VALID_ICON_NAMES.has(iconName) ? iconName : DEFAULT_MOVEMENT_ICON;
}

interface MovementIconBadgeProps {
  /** Comercio/concepto text, checked against the brand catalog -- pass the live form value where available (see PendingNotificationConfirmModal/MovementFormModal) so editing it updates the badge immediately. */
  label: string | null | undefined;
  /** Generic Ionicons glyph to fall back to when no brand matches -- movement.icono / suggestMovementIcon's result. Untouched either way: this component only changes what's RENDERED, never the stored/suggested icon itself. */
  iconName: string;
  /** Circle diameter in px. */
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Shared icon badge for a movement -- a brand logo image, a brand color +
 * mark/icon, or the generic category icon.
 *
 * On a real device, switching the comercio text away from a matched brand
 * (e.g. "Aguas Andinas" -> "Agu") used to render a BLANK circle instead of
 * the generic icon -- confirmed NOT a data problem (the same icon name
 * shows correctly selected in IconPickerModal at that exact moment) and NOT
 * a first-mount-only glitch (still happened after making the generic layer
 * permanently mounted underneath the brand layers, only toggling opacity).
 * What both broken attempts had in common, and what IconPickerModal (which
 * never fails) does NOT have: a single outer View instance getting REUSED
 * by React across renders that show completely different content in it --
 * IconPickerModal's icons are always freshly mounted and never asked to
 * later show something else at that same position at all.
 *
 * Fixed by giving the outer View a `key` that changes with exactly what's
 * being displayed (which brand + whether its logo/mark/icon-fallback is
 * showing, or the generic icon name) -- React treats a key change as a
 * completely different element and fully unmounts the old native view
 * before mounting a new one, the same "always a fresh view" shape
 * IconPickerModal already relies on successfully.
 */
export const MovementIconBadge = memo(function MovementIconBadge({
  label,
  iconName,
  size = 36,
  style,
}: MovementIconBadgeProps) {
  // matchBrand does fuzzy (Levenshtein-based) matching across ~60 brand
  // keyword sets -- real cost when it reruns on every render of a list of
  // dozens of rows, not just on the rare renders where `label` itself
  // actually changed.
  const brand = useMemo(() => matchBrand(label), [label]);
  const [imageFailed, setImageFailed] = useState(false);

  // Re-arms the "show the logo image" attempt whenever the matched brand
  // itself changes (including from one brand straight to another, or to no
  // brand at all) -- without this, a single earlier failed image load would
  // permanently lock this component instance into the mark fallback even
  // after the comercio text changes to a brand whose logo loads fine.
  useEffect(() => {
    setImageFailed(false);
  }, [brand?.id]);

  const iconSize = Math.round(size * 0.5);
  const circleStyle: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  };

  if (brand) {
    const hasRealLogo = !PLACEHOLDER_BRAND_IDS.has(brand.id);
    const logoSource = hasRealLogo ? BRAND_LOGOS[brand.id] : undefined;

    if (logoSource != null && !imageFailed) {
      return (
        <View
          key={`logo-${brand.id}`}
          style={[circleStyle, { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#E5E7EB' }, style]}
        >
          <Image
            source={logoSource}
            resizeMode="contain"
            onError={() => setImageFailed(true)}
            style={{ width: size * 0.86, height: size * 0.86 }}
          />
        </View>
      );
    }

    return (
      <View key={`mark-${brand.id}`} style={[circleStyle, { backgroundColor: brand.color }, style]}>
        {brand.icon ? (
          <Ionicons name={brand.icon as keyof typeof Ionicons.glyphMap} size={iconSize} color="#fff" />
        ) : (
          <Text className="font-jakarta" style={{ fontSize: Math.round(size * 0.36), fontWeight: '700', color: '#fff' }}>{brand.mark}</Text>
        )}
      </View>
    );
  }

  const safeIconName = resolveSafeIconName(iconName);
  return (
    <View key={`generic-${safeIconName}`} className="bg-gray-100" style={[circleStyle, style]}>
      <Ionicons name={safeIconName as keyof typeof Ionicons.glyphMap} size={iconSize} color="#374151" />
    </View>
  );
});

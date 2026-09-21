import { memo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CategoryIconBadgeProps {
  icono: string;
  color: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/** Circular avatar for a category: its own icon on a wash of its own color -- same "wash" treatment as ConfirmDialog's icon circle, not a solid fill, so the glyph stays legible regardless of the chosen color. */
export const CategoryIconBadge = memo(function CategoryIconBadge({ icono, color, size = 40, style }: CategoryIconBadgeProps) {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: `${color}1F`,
        },
        style,
      ]}
    >
      <Ionicons name={icono as keyof typeof Ionicons.glyphMap} size={Math.round(size * 0.52)} color={color} />
    </View>
  );
});

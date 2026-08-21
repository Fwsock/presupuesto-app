import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { theme } from '../lib/theme';

const ACTIVE_COLOR = theme.brand;
const INACTIVE_COLOR = '#6b7280';

/**
 * Custom bottom tab bar so the active tab gets a sliding pill indicator
 * (Mercado Pago/Tenpo-style) instead of react-navigation's default
 * static bar. Renders each route from `descriptors` itself — routes whose
 * `options.tabBarButton` is set (just "crear", the elevated center create
 * button — see app/(app)/_layout.tsx) are rendered via that function
 * unchanged, everything else gets a standard icon+label tab plus its share
 * of the sliding indicator.
 */
export function AnimatedTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const [barWidth, setBarWidth] = useState(0);
  const columnWidth = barWidth / state.routes.length;
  const indicatorX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (columnWidth <= 0) return;
    Animated.spring(indicatorX, {
      toValue: state.index * columnWidth,
      useNativeDriver: true,
      friction: 8,
      tension: 70,
    }).start();
  }, [state.index, columnWidth, indicatorX]);

  const handleLayout = (e: LayoutChangeEvent) => setBarWidth(e.nativeEvent.layout.width);

  return (
    <View
      onLayout={handleLayout}
      style={{
        flexDirection: 'row',
        height: 60 + insets.bottom,
        paddingTop: 8,
        paddingBottom: 8 + insets.bottom,
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
        backgroundColor: '#ffffff',
      }}
    >
      {columnWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: columnWidth * 0.3,
            width: columnWidth * 0.4,
            height: 3,
            borderRadius: 2,
            backgroundColor: ACTIVE_COLOR,
            transform: [{ translateX: indicatorX }],
          }}
        />
      )}

      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];

        // The "crear" route: its own tabBarButton fully owns rendering and
        // press handling (see _layout.tsx) — not part of the sliding
        // indicator, since it's never actually "focused".
        if (options.tabBarButton) {
          return <View key={route.key} style={{ flex: 1 }}>{options.tabBarButton({} as never)}</View>;
        }

        const focused = state.index === index;
        const color = focused ? ACTIVE_COLOR : INACTIVE_COLOR;
        // The "Cuenta" tab's title is the user's full name once a profile
        // exists (see app/(app)/_layout.tsx) -- fine for the screen's own
        // header, which has plenty of width, but a two-word name wrapped
        // to a second line here and broke this column's height/alignment
        // against the other tabs. Only the first word is shown in the tab
        // itself; numberOfLines/ellipsizeMode below are a second line of
        // defense for a single word that's still too long on its own.
        const label = typeof options.title === 'string' ? options.title.split(' ')[0] : options.title;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={typeof options.title === 'string' ? options.title : route.name}
          >
            {options.tabBarIcon?.({ focused, color, size: 24 })}
            <Text
              style={{ fontSize: 11, color, marginTop: 2, maxWidth: '100%' }}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

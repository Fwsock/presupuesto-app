import { useLayoutEffect, useRef, useState } from 'react';
import { ScrollView, View, Text, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { PressableScale } from './PressableScale';
import type { Category } from '../features/categories/types';

interface CategoryFilterChipsProps {
  categories: Category[];
  selectedCategoryId: string | undefined;
  onSelect: (categoryId: string | undefined) => void;
  /** Toggle this (e.g. the parent modal's own `visible`) to reset the row back to its left edge every time it's shown -- otherwise it keeps whatever scroll position it was left at from a previous open. */
  resetScrollOn?: boolean;
}

const EDGE_HINT_WIDTH = 28;
// How close to the end (px) counts as "basically there" -- avoids the hint
// flickering back on from float rounding on the very last pixel of scroll.
const END_THRESHOLD = 4;

/** Horizontal scrollable "Todas" + one chip per category, replacing the old text banner. */
export function CategoryFilterChips({ categories, selectedCategoryId, onSelect, resetScrollOn }: CategoryFilterChipsProps) {
  const categoryScrollViewRef = useRef<ScrollView>(null);
  const containerWidthRef = useRef(0);
  const contentWidthRef = useRef(0);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // useLayoutEffect (not useEffect): fires synchronously before the browser
  // paints this commit, so the reset lands before the modal's opening
  // animation ever makes the row visible -- useEffect's post-paint timing
  // left a one-frame window where a stale scroll position from a previous
  // open could flash before snapping back to the left edge.
  useLayoutEffect(() => {
    if (resetScrollOn) categoryScrollViewRef.current?.scrollTo({ x: 0, animated: false });
  }, [resetScrollOn]);

  const recomputeCanScrollRight = () => {
    setCanScrollRight(contentWidthRef.current > containerWidthRef.current + END_THRESHOLD);
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distanceFromEnd = contentSize.width - layoutMeasurement.width - contentOffset.x;
    setCanScrollRight(distanceFromEnd > END_THRESHOLD);
  };

  return (
    <View>
      <ScrollView
        ref={categoryScrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        className="flex-none grow-0"
        contentContainerClassName="px-4 py-2"
        onLayout={(e) => {
          containerWidthRef.current = e.nativeEvent.layout.width;
          recomputeCanScrollRight();
          // Also reset here, not just in the effect above: a scrollTo call
          // fired from useLayoutEffect on first mount can race ahead of the
          // native ScrollView actually being ready to accept it, especially
          // on Android -- onLayout only fires once the native view has a
          // real, measured layout, so a reset here is guaranteed to land.
          if (resetScrollOn) categoryScrollViewRef.current?.scrollTo({ x: 0, animated: false });
        }}
        onContentSizeChange={(w) => {
          contentWidthRef.current = w;
          recomputeCanScrollRight();
        }}
        onScroll={handleScroll}
        scrollEventThrottle={32}
      >
        <PressableScale
          onPress={() => onSelect(undefined)}
          scaleTo={0.965}
          activeOpacity={0.7}
          spring
          className={`px-3 py-2 mr-2 rounded-full border ${
            !selectedCategoryId ? 'bg-brand border-brand' : 'border-gray-200'
          }`}
        >
          <Text className={!selectedCategoryId ? 'text-white' : 'text-black'}>Todas</Text>
        </PressableScale>

        {categories.map((c) => {
          const selected = c.id === selectedCategoryId;
          return (
            <PressableScale
              key={c.id}
              onPress={() => onSelect(c.id)}
              scaleTo={0.965}
              activeOpacity={0.7}
              spring
              className={`px-3 py-2 mr-2 rounded-full border ${selected ? 'bg-brand border-brand' : 'border-gray-200'}`}
            >
              <Text className={selected ? 'text-white' : 'text-black'}>{c.nombre}</Text>
            </PressableScale>
          );
        })}
      </ScrollView>

      {/* Subtle fade hinting there's more to scroll -- only shown while
          there's actually unscrolled content to the right, and hidden once
          the user reaches the end. */}
      {canScrollRight && (
        <View pointerEvents="none" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: EDGE_HINT_WIDTH }}>
          <Svg width={EDGE_HINT_WIDTH} height="100%">
            <Defs>
              <LinearGradient id="edgeFade" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.95} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#edgeFade)" />
          </Svg>
        </View>
      )}
    </View>
  );
}

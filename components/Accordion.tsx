import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

// Fast enough to feel instant (per the 150-200ms ask) while still reading as
// an animation rather than a snap. easeOutQuad: quick start, gentle finish.
const TRANSITION_DURATION = 180;
const TRANSITION_EASING = Easing.out(Easing.quad);

export interface AccordionItemData {
  question: string;
  answer: string;
}

interface AccordionRowProps extends AccordionItemData {
  isOpen: boolean;
  onToggle: () => void;
  isLast: boolean;
}

/**
 * One question/answer row.
 *
 * FIRST version animated a Reanimated `height` shared value directly
 * (useAnimatedStyle -> `{ height: height.value }`) -- correctly UI-thread
 * only (no bug there), but `height` is a LAYOUT property: even driven
 * natively, changing it forces a real Yoga re-layout pass every frame,
 * which is inherently costlier than a compositor-only property
 * (transform/opacity) and is what read as ~30fps "tirones" on device. It
 * also needed an awkward invisible-measuring-copy hack just to know the
 * target height up front (RN has no native "auto height").
 *
 * This version drops height animation entirely: the answer is
 * conditionally mounted, and the ROW's own `layout={LinearTransition}`
 * prop lets Reanimated's native Layout Animation API (the same mechanism
 * already used for row add/remove in movimientos.tsx/categorias.tsx)
 * animate the resulting height change as one native transition instead of
 * a manually-interpolated one -- smoother, and there's no height to
 * pre-measure at all anymore. `entering`/`exiting` fade the text itself
 * over the same duration.
 */
function AccordionRow({ question, answer, isOpen, onToggle, isLast }: AccordionRowProps) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withTiming(isOpen ? 180 : 0, { duration: TRANSITION_DURATION, easing: TRANSITION_EASING });
  }, [isOpen, rotation]);

  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  return (
    <Animated.View
      layout={LinearTransition.duration(TRANSITION_DURATION).easing(TRANSITION_EASING)}
      className={isLast ? '' : 'border-b border-border'}
    >
      {/* Plain Pressable, deliberately NOT PressableScale -- a press-down
          scale/opacity dip on the question row fought with the expand/
          collapse it triggers, reading as two competing animations. Only
          the chevron rotation + answer fade/collapse below should move. */}
      <Pressable
        onPress={onToggle}
        className="flex-row items-center justify-between py-3"
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        accessibilityLabel={question}
      >
        <Text className="flex-1 font-semibold pr-3">{question}</Text>
        <Animated.View style={chevronStyle}>
          <Ionicons name="chevron-down" size={18} color="#9ca3af" />
        </Animated.View>
      </Pressable>

      {isOpen && (
        <Animated.View
          entering={FadeIn.duration(TRANSITION_DURATION)}
          exiting={FadeOut.duration(TRANSITION_DURATION * 0.7)}
        >
          <Text className="text-gray-800 pb-3">{answer}</Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}

/**
 * FAQ-style accordion: one question open at a time (opening a new row
 * closes whichever was open), matching the conventional FAQ pattern and
 * keeping a long list scannable.
 */
export function Accordion({ items }: { items: AccordionItemData[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <View>
      {items.map((item, index) => (
        <AccordionRow
          key={item.question}
          question={item.question}
          answer={item.answer}
          isOpen={openIndex === index}
          onToggle={() => setOpenIndex((current) => (current === index ? null : index))}
          isLast={index === items.length - 1}
        />
      ))}
    </View>
  );
}

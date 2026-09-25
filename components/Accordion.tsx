import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

// Fast enough to feel instant (per the 150-200ms ask) while still reading as
// an animation rather than a snap. easeOutQuad: quick start, gentle finish.
const TRANSITION_DURATION = 180;
const TRANSITION_EASING = Easing.out(Easing.quad);

// Row add/remove when the list is FILTERED (see Accordion). Exit is
// deliberately quicker than the entrance and the entrance waits a beat: an
// exiting Reanimated view keeps occupying its slot while it fades, and the
// incoming rows appear at their final positions immediately -- staggering
// them keeps the outgoing and incoming rows from visibly overlapping.
const FILTER_EXIT_DURATION = 120;
const FILTER_ENTER_DURATION = 200;
const FILTER_ENTER_DELAY = 80;

export interface AccordionItemData {
  question: string;
  answer: string;
}

interface AccordionRowProps extends AccordionItemData {
  isOpen: boolean;
  onToggle: () => void;
  isLast: boolean;
  /** False for the rows present on first mount (no per-row fade-in while the surrounding sheet is itself sliding up); true for rows added afterwards by a filter change. */
  animateEntering: boolean;
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
 *
 * The row itself ALSO carries entering/exiting so that filtering the list
 * (FaqSection's category chips) animates rows in and out through the same
 * Reanimated pipeline, instead of a full remount. Do NOT mix in React
 * Native's core `LayoutAnimation.configureNext` here: on the New
 * Architecture (mandatory with Reanimated 4) it and Reanimated's layout
 * animations compete for the same mounting hook, and on Android the core
 * one never runs reliably -- `UIManager.setLayoutAnimationEnabledExperimental`
 * is a no-op under Fabric, so there's no flag that fixes it either.
 */
function AccordionRow({ question, answer, isOpen, onToggle, isLast, animateEntering }: AccordionRowProps) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withTiming(isOpen ? 180 : 0, { duration: TRANSITION_DURATION, easing: TRANSITION_EASING });
  }, [isOpen, rotation]);

  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  return (
    <Animated.View
      entering={animateEntering ? FadeIn.duration(FILTER_ENTER_DURATION).delay(FILTER_ENTER_DELAY) : undefined}
      exiting={FadeOut.duration(FILTER_EXIT_DURATION)}
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
        <Text className="flex-1 font-jakarta-semibold pr-3">{question}</Text>
        <Animated.View style={chevronStyle}>
          <Ionicons name="chevron-down" size={18} color="#9ca3af" />
        </Animated.View>
      </Pressable>

      {isOpen && (
        <Animated.View
          entering={FadeIn.duration(TRANSITION_DURATION)}
          exiting={FadeOut.duration(TRANSITION_DURATION * 0.7)}
        >
          <Text className="font-jakarta text-gray-800 pb-3">{answer}</Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}

/**
 * FAQ-style accordion: one question open at a time (opening a new row
 * closes whichever was open), matching the conventional FAQ pattern and
 * keeping a long list scannable.
 *
 * The open row is tracked by its QUESTION text, not its index in `items`.
 * Callers filter the list (FaqSection's category chips) without remounting
 * this component, so an index would silently point at a different question
 * after every filter change; the question text is stable. If the open
 * question is filtered out, the open state is cleared so it doesn't
 * reappear already expanded when its category comes back.
 */
export function Accordion({ items }: { items: AccordionItemData[] }) {
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);

  // Flips after the first commit, so rows created by the initial mount skip
  // their entering fade (the sheet is already animating in) while rows
  // created later by a filter change get one.
  const hasMounted = useRef(false);
  useEffect(() => {
    hasMounted.current = true;
  }, []);

  useEffect(() => {
    setOpenQuestion((current) => (current !== null && items.some((i) => i.question === current) ? current : null));
  }, [items]);

  return (
    <View>
      {items.map((item, index) => (
        <AccordionRow
          key={item.question}
          question={item.question}
          answer={item.answer}
          isOpen={openQuestion === item.question}
          onToggle={() => setOpenQuestion((current) => (current === item.question ? null : item.question))}
          isLast={index === items.length - 1}
          animateEntering={hasMounted.current}
        />
      ))}
    </View>
  );
}

import { useEffect, useState } from 'react';
import { Keyboard, Modal, Platform, Pressable, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

interface AnimatedBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Overrides the backdrop-tap handler (e.g. disabled while a save is in flight). Defaults to onClose. */
  onBackdropPress?: () => void;
  maxHeightPercent?: number;
  /** Springs the entrance slide instead of timing it -- see MovementFormModal. Takes priority over entranceDuration/entranceEasing when set. Exit is untouched by design (shared across every sheet). */
  entranceSpring?: { damping: number; stiffness: number };
  entranceDuration?: number;
  entranceEasing?: (value: number) => number;
  children: React.ReactNode;
}

const OFFSCREEN_Y = 700;
const KEYBOARD_SHOW_EVENT = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
const KEYBOARD_HIDE_EVENT = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

/**
 * Shared bottom-sheet chrome for every "slides up from the bottom" modal in
 * the app (FullScreenFormModal, MovementFormModal, IconPickerModal,
 * PhoneInput's country picker). Two things this fixes over a plain
 * `<Modal animationType="slide">`:
 *
 * 1. RN's built-in "slide" animates the WHOLE modal subtree -- backdrop
 *    included -- as one rigid transform, so the dim layer visibly slides up
 *    with the sheet instead of just fading in. Here the backdrop's opacity
 *    and the sheet's translateY are two independent Reanimated shared values
 *    (animationType="none" on the Modal itself, same convention as
 *    ConfirmDialog/MonthYearPickerModal/CalendarPickerModal).
 *
 * 2. No KeyboardAvoidingView. It resizes/pads a container that the backdrop
 *    depends on for its own full-screen bounds, and on Android that
 *    container's resize can fall out of sync with the OS's own keyboard
 *    animation (the Activity already declares windowSoftInputMode
 *    "adjustResize", so KeyboardAvoidingView's own compensation is a SECOND,
 *    independent resize stacked on top of the OS's) -- for a frame, usually
 *    right as the keyboard closes, the two disagree and the backdrop shrinks
 *    out of full coverage, exposing whatever screen sits behind the modal
 *    (this is the "se ve la tab bar" bug).
 *
 *    Instead, the outer backdrop container (`flex: 1`) never changes size or
 *    position for any keyboard reason -- it is structurally impossible for
 *    it to leak. Only the sheet's own white box grows via `paddingBottom`,
 *    driven by a plain `Keyboard` listener tracking the keyboard's height in
 *    state. Growing the box (which sits in a `justifyContent: 'flex-end'`
 *    parent) pushes its top edge up, same visual effect as before, but
 *    nothing outside the sheet's own solid white box ever moves.
 *
 * Built on react-native-reanimated (not core RN `Animated`) so a sheet can
 * opt into `entranceSpring` -- a `withTiming` value can't produce spring
 * physics, and mixing two different animation-value systems on one style
 * (a core Animated.Value here, a Reanimated shared value there) is the kind
 * of thing that only half-works. Every other sheet keeps the exact same
 * timing-based feel as before (entranceDuration/entranceEasing default to
 * the same 400ms ease-out-cubic), just re-expressed with Reanimated's
 * (worklet-compatible) `Easing`, not core RN's.
 */
export function AnimatedBottomSheet({
  visible,
  onClose,
  onBackdropPress,
  maxHeightPercent = 85,
  entranceSpring,
  entranceDuration = 400,
  entranceEasing = Easing.out(Easing.cubic),
  children,
}: AnimatedBottomSheetProps) {
  const backdropOpacity = useSharedValue(0);
  const translateY = useSharedValue(OFFSCREEN_Y);
  const [mounted, setMounted] = useState(visible);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener(KEYBOARD_SHOW_EVENT, (e) => setKeyboardHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(KEYBOARD_HIDE_EVENT, () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      backdropOpacity.value = withTiming(1, { duration: 220 });
      translateY.value = entranceSpring
        ? withSpring(0, { damping: entranceSpring.damping, stiffness: entranceSpring.stiffness })
        : withTiming(0, { duration: entranceDuration, easing: entranceEasing });
    } else if (mounted) {
      backdropOpacity.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(OFFSCREEN_Y, { duration: 220 }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    maxHeight: `${maxHeightPercent}%`,
    paddingBottom: keyboardHeight,
    transform: [{ translateY: translateY.value }],
  }));

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'transparent' }}>
        <Animated.View
          className="bg-black/40"
          style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, backdropStyle]}
        />
        <Pressable
          onPress={onBackdropPress ?? onClose}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
        />
        <Animated.View className="bg-surface rounded-t-3xl" style={sheetStyle}>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

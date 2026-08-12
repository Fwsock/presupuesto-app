import { useEffect, useRef, useState } from 'react';
import { Animated, Keyboard, Modal, Platform, Pressable, View } from 'react-native';

interface AnimatedBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Overrides the backdrop-tap handler (e.g. disabled while a save is in flight). Defaults to onClose. */
  onBackdropPress?: () => void;
  maxHeightPercent?: number;
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
 *    and the sheet's translateY are two independent Animated.Values
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
 */
export function AnimatedBottomSheet({
  visible,
  onClose,
  onBackdropPress,
  maxHeightPercent = 85,
  children,
}: AnimatedBottomSheetProps) {
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(OFFSCREEN_Y)).current;
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
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 9, tension: 65 }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: OFFSCREEN_Y, duration: 220, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'transparent' }}>
        <Animated.View
          className="bg-black/40"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: backdropOpacity }}
        />
        <Pressable
          onPress={onBackdropPress ?? onClose}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
        />
        <Animated.View
          className="bg-white rounded-t-2xl"
          style={{
            maxHeight: `${maxHeightPercent}%`,
            paddingBottom: keyboardHeight,
            transform: [{ translateY }],
          }}
        >
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

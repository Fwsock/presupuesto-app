import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from './PressableScale';
import { theme } from '../lib/theme';

export interface ConfirmDialogAction {
  label: string;
  onPress?: () => void;
  /** 'destructive' = solid red (primary action), 'cancel' = neutral outline, 'default' = solid blue. Defaults to 'default'. */
  variant?: 'destructive' | 'cancel' | 'default';
}

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  /** Rendered in order. Two actions where one is 'cancel' lay out side by side (cancel left, other right); anything else stacks full-width. */
  actions: ConfirmDialogAction[];
}

interface ConfirmDialogProps extends ConfirmDialogOptions {
  visible: boolean;
  onRequestClose: () => void;
  /** Fires once the exit (fade+scale-out) animation has actually finished — the right moment for a caller to discard the dialog's content, so nothing goes blank mid-animation. */
  onHidden?: () => void;
}

const VARIANT_CLASSES: Record<NonNullable<ConfirmDialogAction['variant']>, string> = {
  destructive: 'bg-danger',
  default: 'bg-brand',
  cancel: 'bg-transparent border border-gray-200',
};

const VARIANT_TEXT_CLASSES: Record<NonNullable<ConfirmDialogAction['variant']>, string> = {
  destructive: 'text-white',
  default: 'text-white',
  cancel: 'text-gray-700',
};

/**
 * Rounded, icon-led confirmation dialog with a fade+scale entrance/exit,
 * replacing native Alert.alert everywhere it's used for destructive actions
 * — Alert.alert renders the OS's own dialog and cannot be restyled at all
 * (no rounded corners, no colored buttons, no icon, no animation control),
 * which is what this component exists to fix.
 */
export function ConfirmDialog({ visible, title, message, icon, iconColor, actions, onRequestClose, onHidden }: ConfirmDialogProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  // Modal's `visible` prop can only mount/unmount instantly, but the exit
  // animation needs a moment to play before that happens — this keeps the
  // Modal mounted for the duration of the fade+scale-out, then unmounts it.
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 8, tension: 80 }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.9, duration: 120, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) {
          setMounted(false);
          onHidden?.();
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!mounted) return null;

  const isTwoWayWithCancel =
    actions.length === 2 && actions.some((a) => a.variant === 'cancel');

  return (
    <Modal visible transparent animationType="none" onRequestClose={onRequestClose}>
      <Animated.View className="flex-1 justify-center items-center bg-black/40 px-8" style={{ opacity }}>
        <Pressable
          onPress={onRequestClose}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
        />
        <Animated.View
          className="bg-surface rounded-3xl p-6 w-full"
          style={{ transform: [{ scale }], maxWidth: 360 }}
        >
          <View className="items-center mb-3">
            <View
              className="w-14 h-14 rounded-full items-center justify-center mb-3"
              style={{ backgroundColor: `${iconColor ?? theme.danger}1A` }}
            >
              <Ionicons name={icon ?? 'trash-outline'} size={28} color={iconColor ?? theme.danger} />
            </View>
            <Text className="text-lg font-bold text-center">{title}</Text>
          </View>
          <Text className="text-secondary text-center mb-5">{message}</Text>

          {isTwoWayWithCancel ? (
            <View className="flex-row" style={{ gap: 10 }}>
              {actions.map((action) => {
                const variant = action.variant ?? 'default';
                return (
                  <View key={action.label} style={{ flex: 1 }}>
                    <PressableScale
                      onPress={action.onPress}
                      className={`py-3 rounded-2xl items-center ${VARIANT_CLASSES[variant]}`}
                    >
                      <Text className={`font-semibold ${VARIANT_TEXT_CLASSES[variant]}`}>{action.label}</Text>
                    </PressableScale>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {actions.map((action) => {
                const variant = action.variant ?? 'default';
                return (
                  <PressableScale
                    key={action.label}
                    onPress={action.onPress}
                    className={`py-3 rounded-2xl items-center ${VARIANT_CLASSES[variant]}`}
                  >
                    <Text className={`font-semibold ${VARIANT_TEXT_CLASSES[variant]}`}>{action.label}</Text>
                  </PressableScale>
                );
              })}
            </View>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

/**
 * Local-state wrapper so a screen can call `confirm({...})` imperatively
 * instead of managing visible/options itself, mirroring how Alert.alert
 * used to be called.
 *
 * `visible` and `options` are deliberately two separate state values, not
 * one nullable `options`. Closing only flips `visible` to false — `options`
 * (the actual title/message/actions) stays exactly as it was until
 * ConfirmDialog's `onHidden` fires, i.e. after the fade+scale-out finishes.
 * Clearing `options` immediately on close used to make the dialog re-render
 * with `title=''`/`message=''`/`actions=[]` while it was still visually
 * mid-animation, which read as the box flickering to an empty gray shell
 * right before it actually disappeared.
 */
export function useConfirmDialog() {
  const [options, setOptions] = useState<ConfirmDialogOptions | null>(null);
  const [visible, setVisible] = useState(false);

  const requestClose = () => setVisible(false);
  const confirm = (opts: ConfirmDialogOptions) => {
    setOptions(opts);
    setVisible(true);
  };

  const element = (
    <ConfirmDialog
      visible={visible}
      title={options?.title ?? ''}
      message={options?.message ?? ''}
      icon={options?.icon}
      iconColor={options?.iconColor}
      actions={(options?.actions ?? []).map((action) => ({
        ...action,
        onPress: () => {
          requestClose();
          action.onPress?.();
        },
      }))}
      onRequestClose={requestClose}
      onHidden={() => setOptions(null)}
    />
  );

  return { confirm, element };
}

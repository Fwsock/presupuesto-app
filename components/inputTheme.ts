/** Shared across every TextInput -- visible placeholder/selection/cursor, matching the app's primary blue and text colors, instead of relying on OS/keyboard-theme defaults that render invisible on some Android devices. */
export const INPUT_PLACEHOLDER_COLOR = '#9CA3AF';
// Light, translucent highlight (blue-500 at ~20% opacity) so the black text
// underneath stays fully legible while selected -- a solid brand blue here
// made selected text hard to read. The blinking caret is a separate prop
// (cursorColor) and stays solid so it's still clearly visible.
export const INPUT_SELECTION_COLOR = '#3B82F633';
export const INPUT_CURSOR_COLOR = '#2563EB';
export const INPUT_TEXT_COLOR = '#1F2937';

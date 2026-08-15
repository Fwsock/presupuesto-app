/**
 * Pure color-matrix math for the receipt-scan preprocessing pass -- kept
 * separate from the actual Skia rendering (features/pendingNotifications/
 * imagePreprocessing.ts) specifically so this part, the part that decides
 * WHAT the filter does, is unit-testable without a device/native runtime.
 *
 * Skia's ColorFilter.MakeMatrix takes a 20-number, row-major 4x5 matrix in
 * normalized [0,1] color space:
 *   R' = m[0]*R + m[1]*G + m[2]*B + m[3]*A + m[4]
 *   G' = m[5]*R + m[6]*G + m[7]*B + m[8]*A + m[9]
 *   B' = m[10]*R + m[11]*G + m[12]*B + m[13]*A + m[14]
 *   A' = m[15]*R + m[16]*G + m[17]*B + m[18]*A + m[19]
 */
export type ColorMatrix20 = readonly [
  number, number, number, number, number,
  number, number, number, number, number,
  number, number, number, number, number,
  number, number, number, number, number,
];

// Rec. 601 luminance weights -- the traditional grayscale-conversion
// standard, well suited to printed/thermal receipt text (high-frequency
// black-on-white detail) rather than Rec. 709's weighting toward perceptual
// video color, which isn't relevant here.
const LUMA_R = 0.299;
const LUMA_G = 0.587;
const LUMA_B = 0.114;

/**
 * Builds a single combined grayscale + contrast + brightness color matrix.
 * `contrast` is a multiplier around the 0.5 (mid-gray) pivot -- 1 leaves
 * contrast unchanged, >1 stretches it (this is what cuts through a soft
 * table shadow or uneven lighting on a photographed boleta), <1 compresses
 * it. `brightness` is an additive offset in normalized [-1, 1] space, 0 by
 * default. Both R/G/B output channels get the identical grayscale+contrast
 * treatment; alpha passes through untouched.
 *
 * Folding contrast into the same matrix as the grayscale conversion (rather
 * than as two separate filters) is not just an optimization: chaining two
 * ColorFilters would clamp to [0,1] between passes, which can visibly clip
 * results a single combined pass does not.
 */
export function buildGrayscaleContrastMatrix(contrast: number, brightness = 0): ColorMatrix20 {
  const r = LUMA_R * contrast;
  const g = LUMA_G * contrast;
  const b = LUMA_B * contrast;
  // Keeps mid-gray (0.5 luminance) fixed at 0.5 before brightness is added,
  // so "contrast" alone never shifts the image darker/lighter overall.
  const offset = 0.5 * (1 - contrast) + brightness;

  return [
    r, g, b, 0, offset,
    r, g, b, 0, offset,
    r, g, b, 0, offset,
    0, 0, 0, 1, 0,
  ];
}

/** Applies a built matrix to one RGBA pixel (each channel normalized [0,1]) -- used by tests to verify the matrix's actual effect without needing Skia. */
export function applyColorMatrix(
  matrix: ColorMatrix20,
  r: number,
  g: number,
  b: number,
  a: number
): { r: number; g: number; b: number; a: number } {
  return {
    r: matrix[0] * r + matrix[1] * g + matrix[2] * b + matrix[3] * a + matrix[4],
    g: matrix[5] * r + matrix[6] * g + matrix[7] * b + matrix[8] * a + matrix[9],
    b: matrix[10] * r + matrix[11] * g + matrix[12] * b + matrix[13] * a + matrix[14],
    a: matrix[15] * r + matrix[16] * g + matrix[17] * b + matrix[18] * a + matrix[19],
  };
}

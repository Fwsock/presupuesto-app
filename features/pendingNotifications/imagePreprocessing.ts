import { Skia, ImageFormat } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';
import { buildGrayscaleContrastMatrix } from '../../lib/image/colorMatrix';

// Mild contrast boost -- was 1.35, which real-device testing on faded/
// low-ink thermal receipts (Unimarc, Strip La Florida Spa) showed pushing
// already-faint print (thermal ink is often barely 0.75-0.85 luminance to
// begin with, well before this filter runs, on paper that isn't freshly
// printed) close enough to white to visibly increase OCR misreads -- e.g.
// "STRIP LA FLORIDA SPA" coming back as "SIRP LA ELORNIOA SA", or a boleta's
// own "TOTAL" section becoming unreadable while a bolder nearby item price
// still OCR'd fine (see extractDocumentAmount's corroboration-based
// selection for the parser-side half of that same failure mode). 1.15 still
// helps cut through a soft table shadow or uneven ceiling-light glare on a
// well-lit photo, without pushing faint ink as close to the clipping point.
// This is a fixed constant rather than something tuned per-photo: there's
// no reliable signal available here (before OCR even runs) to measure how
// faded/shadowed a given image is.
const OCR_CONTRAST = 1.15;

export interface PreprocessedImage {
  uri: string;
  /** True when `uri` is a new file this module wrote to cache and the caller owns cleaning up (see deleteProcessedImage) -- false when it's just the original, untouched uri (nothing to delete). */
  isTemporary: boolean;
}

/**
 * Grayscale + contrast-stretch pass before OCR -- the same class of
 * preprocessing document-scanner apps (CamScanner, Expensify) run before
 * text recognition, aimed specifically at shadows/uneven lighting on a
 * photographed receipt (a clean bank-app screenshot is already high
 * contrast and passes through this close to unchanged).
 *
 * Defensive by design: ANY failure here (a corrupt/huge image, a Skia
 * surface allocation failure, a file-write error) falls back to the
 * original, unprocessed uri instead of throwing -- this is a pure
 * enhancement layered in front of OCR, and must never itself be the reason
 * a scan fails. Runs fully offscreen (Skia.Surface.MakeOffscreen) -- no
 * <Canvas> is mounted, this never touches the component tree.
 */
export async function preprocessReceiptImage(uri: string): Promise<PreprocessedImage> {
  try {
    const data = await Skia.Data.fromURI(uri);
    const image = Skia.Image.MakeImageFromEncoded(data);
    if (!image) return { uri, isTemporary: false };

    const width = image.width();
    const height = image.height();
    if (width <= 0 || height <= 0) return { uri, isTemporary: false };

    const surface = Skia.Surface.MakeOffscreen(width, height);
    if (!surface) return { uri, isTemporary: false };

    const paint = Skia.Paint();
    // buildGrayscaleContrastMatrix returns Skia's exact expected shape (a
    // flat 20-number, row-major 4x5 matrix in normalized [0,1] color space)
    // -- see lib/image/colorMatrix.ts for the actual math, kept separate
    // there specifically so it stays unit-testable without a device.
    paint.setColorFilter(Skia.ColorFilter.MakeMatrix([...buildGrayscaleContrastMatrix(OCR_CONTRAST)]));

    const canvas = surface.getCanvas();
    canvas.drawImage(image, 0, 0, paint);
    surface.flush();

    const snapshot = surface.makeImageSnapshot();
    const bytes = snapshot.encodeToBytes(ImageFormat.PNG);
    if (!bytes) return { uri, isTemporary: false };

    // expo-file-system's current (SDK 54+) API: File.write() takes the raw
    // Uint8Array directly -- no base64 round-trip needed at all.
    const file = new File(Paths.cache, `receipt-scan-${Date.now()}.png`);
    file.write(bytes);
    return { uri: file.uri, isTemporary: true };
  } catch {
    return { uri, isTemporary: false };
  }
}

/** Best-effort cleanup for the temp file preprocessReceiptImage wrote to cache -- never throws, since a leftover cache file is not worth surfacing an error for. Callers must only pass a uri where isTemporary was true (the original picked/captured image is never ours to delete). */
export async function deleteProcessedImage(uri: string): Promise<void> {
  try {
    new File(uri).delete();
  } catch {
    // Best-effort cleanup only -- see comment above.
  }
}

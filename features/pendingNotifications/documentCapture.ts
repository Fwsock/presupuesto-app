import { NativeModules, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import {
  cleanScannedText,
  extractDocumentAmount,
  extractDocumentComercio,
  extractDocumentDate,
  extractDocumentItems,
  extractDocumentType,
} from '../../lib/parsers/documentScanParser';
import { preprocessReceiptImage, deleteProcessedImage } from './imagePreprocessing';
import type { NotificationMovementType } from '../../lib/parsers/bankNotificationParser';

// @react-native-ml-kit/text-recognition is a classic (non-Expo-Modules)
// native module: importing it never throws, but calling .recognize() does
// if the native side isn't linked -- true inside Expo Go, which can't load
// custom native code. Checking NativeModules directly, same idea as
// isBankNotificationListenerAvailable() in modules/bank-notification-listener.
export function isTextRecognitionAvailable(): boolean {
  return Platform.OS === 'android' && NativeModules.TextRecognition != null;
}

export interface ScannedDocumentResult {
  monto: number;
  comercio: string | null;
  fecha: string | null;
  tipo: NotificationMovementType | null;
  items: string[];
  rawText: string;
}

/**
 * Runs the grayscale/contrast preprocessing pass (see imagePreprocessing.ts)
 * ahead of OCR, then always cleans up the temp file it wrote -- whether OCR
 * succeeds, returns unreadable text, or throws. Preprocessing itself never
 * throws (it falls back to the original uri on any failure), so this only
 * ever raises `notReadableMessage`, from OCR itself failing.
 */
async function recognizeText(uri: string, notReadableMessage: string): Promise<string> {
  const preprocessed = await preprocessReceiptImage(uri);
  try {
    const recognized = await TextRecognition.recognize(preprocessed.uri);
    return recognized.text.trim();
  } catch {
    throw new Error(notReadableMessage);
  } finally {
    if (preprocessed.isTemporary) await deleteProcessedImage(preprocessed.uri);
  }
}

/**
 * Shared validation once OCR text comes back, regardless of whether it came
 * from the camera or the gallery. There is deliberately NO structural/
 * keyword-based rejection here anymore (that used to live behind
 * looksLikeScannedDocument, still exported from documentScanParser for
 * other callers/tests) -- a real boleta with an administrative rubber stamp
 * ("CANCELADO"/"CEDIBLE") crossing the header, or one whose OCR text
 * happens to contain a word like "DESCUENTOS" that collides with the bank-
 * notification promotional-copy filter, was getting hard-rejected outright
 * even though its amount was perfectly readable. The only remaining gate is
 * whether an amount could be extracted at all: if the image had at least
 * some legible content, extraction (with its own largest-amount fallback,
 * see extractDocumentAmount) almost always finds one, and the user still
 * gets to review/correct every field on the confirm screen regardless.
 * Both camera and gallery funnel through this exact same flexible parser
 * (boletas/facturas, small-comercio vales, and bank transfer screenshots or
 * photos of a transfer confirmation screen all go through it identically) --
 * there is no longer a stricter "receipt-only" path for the camera.
 */
function parseAndValidate(rawText: string): ScannedDocumentResult {
  // Extraction runs against the noise-stripped copy (background clutter, a
  // finger holding the paper); rawText itself is kept verbatim for
  // "Notificación original" on the confirm screen.
  const text = cleanScannedText(rawText);

  const monto = extractDocumentAmount(text);
  if (monto === null || monto <= 0) {
    throw new Error('No se pudo detectar el monto. Por favor, toma la foto o elige una imagen con mejor luz o enfoque.');
  }

  return {
    monto,
    comercio: extractDocumentComercio(text),
    fecha: extractDocumentDate(text),
    tipo: extractDocumentType(text),
    items: extractDocumentItems(text),
    rawText,
  };
}

function assertTextRecognitionAvailable() {
  if (!isTextRecognitionAvailable()) {
    throw new Error('El escáner de documentos no está disponible en este dispositivo.');
  }
}

/**
 * Opens the device camera and runs the photo through the same flexible
 * document scan as the gallery path -- a physical boleta/factura, a small
 * vale, or a photo taken of a phone screen showing a transfer confirmation
 * all work here. Returns null only when the user cancels the camera.
 *
 * A version of this briefly used @infinitered/react-native-mlkit-document-
 * scanner (Google ML Kit's own edge-detection/perspective-crop/B&N-filter
 * scanning UI) instead of plain ImagePicker capture -- reverted after it
 * crashed the app on launch with `NoClassDefFoundError: Failed resolution
 * of: Lexpo/modules/kotlin/types/AnyTypeCache`. Root cause wasn't the
 * document-scanner module's own Kotlin code: it (transitively, via
 * @infinitered/react-native-mlkit-core) depends on `expo-image` with an
 * unpinned `"*"` version range, which resolved to expo-image@57.0.3 (built
 * for Expo SDK 57's expo-modules-core Kotlin API) inside this SDK 54
 * project -- a native ABI mismatch, not anything specific to camera
 * scanning. `npm uninstall` removed that whole transitive chain along with
 * it. ImagePicker.launchCameraAsync has none of that risk: it's already a
 * direct, SDK-54-pinned dependency (expo-image-picker), so this is back to
 * exactly what worked before that experiment. Edge detection/perspective
 * correction is not something ImagePicker itself offers; the grayscale +
 * contrast-boost pass in imagePreprocessing.ts (recognizeText below) is
 * still the enhancement actually running ahead of OCR, unaffected by any
 * of this.
 */
export async function scanDocumentFromCamera(): Promise<ScannedDocumentResult | null> {
  assertTextRecognitionAvailable();

  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Se necesita acceso a la cámara para escanear el documento.');
  }

  const result = await ImagePicker.launchCameraAsync({ quality: 1 });
  if (result.canceled || !result.assets?.[0]) return null;

  const text = await recognizeText(result.assets[0].uri, 'No se pudo leer el documento. Intenta tomar la foto de nuevo.');
  return parseAndValidate(text);
}

/**
 * Opens the photo gallery and runs the picked image through the same
 * flexible document scan as the camera path -- a saved bank-notification
 * screenshot, a transfer confirmation screenshot, or a photo of a physical
 * boleta all work here. Returns null only when the user cancels the picker.
 */
export async function scanDocumentFromGallery(): Promise<ScannedDocumentResult | null> {
  assertTextRecognitionAvailable();

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Se necesita acceso a tus fotos para elegir la imagen.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  if (result.canceled || !result.assets?.[0]) return null;

  const text = await recognizeText(result.assets[0].uri, 'No se pudo leer el texto de esa imagen. Intenta con otra.');
  return parseAndValidate(text);
}

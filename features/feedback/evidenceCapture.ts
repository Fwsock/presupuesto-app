import * as ImagePicker from 'expo-image-picker';

/** Same permission-then-launch pattern as documentCapture.ts's scan functions, without the OCR step -- this is just a plain evidence photo, not something to read text from. Returns null only if the user cancels. */
export async function pickEvidenceFromCamera(): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Se necesita acceso a la cámara para adjuntar una foto.');
  }
  const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
  if (result.canceled || !result.assets?.[0]) return null;
  return result.assets[0].uri;
}

export async function pickEvidenceFromGallery(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Se necesita acceso a tus fotos para adjuntar una imagen.');
  }
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
  if (result.canceled || !result.assets?.[0]) return null;
  return result.assets[0].uri;
}

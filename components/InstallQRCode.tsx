import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

// Points at the local dev Mac's temporary HTTP server (see AGENTS.md's
// install-Artifact protocol) -- only reachable while that Mac is on, on the
// same WiFi, and the server is running. There is no permanent hosting for
// the APK yet; update this string whenever the serving IP/port changes.
const INSTALL_APK_URL = 'http://192.168.1.18:8765/finanflow-preview.apk';

export function InstallQRCode({ size = 64 }: { size?: number }) {
  return (
    <View className="bg-white rounded-lg p-1.5 border border-border">
      <QRCode value={INSTALL_APK_URL} size={size} />
    </View>
  );
}

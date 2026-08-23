import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

// Permanent download link: the finanflow-preview.apk asset on the
// Fwsock/presupuesto-app GitHub Release "v1.0.0" (public repo, so this
// resolves for anyone, not just collaborators). Update this to a new
// tag/release URL whenever a newer APK is published there.
export const INSTALL_APK_URL = 'https://github.com/Fwsock/presupuesto-app/releases/download/v1.0.0/finanflow-preview.apk';

export function InstallQRCode({ size = 64 }: { size?: number }) {
  return (
    <View className="bg-white rounded-lg p-1.5 border border-border">
      <QRCode value={INSTALL_APK_URL} size={size} />
    </View>
  );
}

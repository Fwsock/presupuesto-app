import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

/** "Xiaomi 23129RN51Y, Android 15, FinanFlow 1.0.0" (or the closest equivalent per platform) -- attached to every feedback row so a bug report is reproducible without having to ask the user what they're on. */
export function getDeviceInfo(): string {
  const model = Device.modelName ?? `${Platform.OS} device`;
  const osVersion = `${Platform.OS === 'ios' ? 'iOS' : 'Android'} ${Device.osVersion ?? Platform.Version}`;
  const appVersion = Constants.expoConfig?.version ?? 'desconocida';
  return `${model}, ${osVersion}, FinanFlow ${appVersion}`;
}

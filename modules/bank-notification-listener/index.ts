import { requireOptionalNativeModule, type EventSubscription } from 'expo-modules-core';

export interface BankNotificationEvent {
  packageName: string;
  text: string;
}

interface BankNotificationListenerNativeModule {
  isPermissionGranted(): Promise<boolean>;
  openNotificationSettings(): void;
  addListener(eventName: 'onBankNotification', listener: (event: BankNotificationEvent) => void): EventSubscription;
}

// null on iOS (the module only declares "android" in expo-module.config.json,
// so it's never built there) and also null inside Expo Go on Android --
// Expo Go is a fixed binary that doesn't include this custom native code.
// Every export below is a safe no-op in both cases instead of throwing, so
// the rest of the app keeps working normally under Expo Go.
const NativeModule = requireOptionalNativeModule<BankNotificationListenerNativeModule>('BankNotificationListener');

export function isBankNotificationListenerAvailable(): boolean {
  return NativeModule !== null;
}

export async function isNotificationAccessGranted(): Promise<boolean> {
  if (!NativeModule) return false;
  return NativeModule.isPermissionGranted();
}

/** Opens Android's "Notification access" settings screen -- the only way this permission can be granted, there's no runtime dialog for it. */
export function openNotificationAccessSettings(): void {
  NativeModule?.openNotificationSettings();
}

export function addBankNotificationListener(
  callback: (event: BankNotificationEvent) => void
): EventSubscription | null {
  return NativeModule?.addListener('onBankNotification', callback) ?? null;
}

module.exports = {
  dependencies: {
    // Google ML Kit's iOS frameworks (a transitive dependency of this
    // package's pod) ship arm64-device + x86_64-simulator binaries only --
    // no arm64-simulator slice, so Xcode can't offer any Apple Silicon
    // simulator as a build destination once this pod is linked. The JS
    // side already gates OCR to Android only (see isTextRecognitionAvailable
    // in features/pendingNotifications/documentCapture.ts), so this was
    // never functional on iOS to begin with -- excluding it from iOS
    // autolinking entirely (device and simulator) removes a pod nothing
    // calls there, with no behavior change, and lets `expo run:ios` build.
    '@react-native-ml-kit/text-recognition': {
      platforms: {
        ios: null,
      },
    },
  },
};

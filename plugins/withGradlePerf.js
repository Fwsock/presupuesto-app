const { withGradleProperties, AndroidConfig } = require('@expo/config-plugins');

/**
 * This project is a managed Expo workflow with no `android/` committed to
 * git (see AGENTS.md's "Protocolo de conservación de recursos") -- every
 * `eas build --platform android --local` regenerates a brand-new
 * `android/gradle.properties` from scratch in a temp prebuild directory, so
 * hand-editing that file directly (as you would in a bare/ejected RN
 * project) has zero effect: the very next local build silently discards it.
 * This plugin is what makes these performance settings actually durable --
 * it's checked into git and re-applies them on every single prebuild,
 * local or EAS, regardless of the ephemeral temp directory.
 *
 * `updateAndroidBuildProperty` finds-and-replaces an existing key or
 * appends it if missing, so this is safe to run against whatever baseline
 * gradle.properties a future Expo SDK bump ships.
 */
const PERF_PROPERTIES = {
  // Gradle daemon heap -- 6g is deliberately sized for this project's dev
  // Mac (24GB RAM / 8 cores, see AGENTS.md); lower this if this file is
  // ever used on a machine with less RAM; a heap too close to total system
  // RAM causes swapping, which makes builds SLOWER, not faster.
  'org.gradle.jvmargs': '-Xmx6g -XX:+UseParallelGC -XX:MaxMetaspaceSize=1g',
  // Builds independent Gradle projects/modules (app, expo-modules-core,
  // react-native-reanimated, ...) in parallel instead of strictly
  // sequentially -- the single biggest lever here given this project's
  // native module count.
  'org.gradle.parallel': 'true',
  // Reuses cached task outputs (from ~/.gradle/caches, a location OUTSIDE
  // the ephemeral per-build temp directory) across separate local builds --
  // this is what actually lets a build benefit from a previous one despite
  // android/ itself being wiped and regenerated every time.
  'org.gradle.caching': 'true',
  'org.gradle.configureondemand': 'true',
  // Jetifier rewrites legacy `android.support.*` artifacts to AndroidX --
  // every dependency in this project's tree is already native AndroidX (RN
  // 0.81 / Expo SDK 54), so Jetifier has nothing to do here except spend
  // time scanning the full dependency graph for support-lib artifacts that
  // don't exist. `false` (not `"ignore"`, which isn't a real value --
  // android.enableJetifier is a plain boolean and an invalid value here
  // either gets coerced or ignored by Gradle's property parser) turns that
  // scan off outright.
  'android.enableJetifier': 'false',
};

/**
 * By far the biggest real lever, found by measuring an actual build's
 * Gradle task profile: every native C++ module (Skia, Reanimated,
 * Worklets, gesture-handler, screens, expo-modules-core) compiles once per
 * CPU architecture -- arm64-v8a, armeabi-v7a, x86, x86_64 -- by default.
 * That's 31.6% of ALL task time in a real measured build (577s of 1826s),
 * split ~evenly across the 4 architectures, even though the only thing
 * this project's `preview` profile is ever installed on is a real phone
 * (arm64-v8a). The other 3 only matter for x86/x86_64 emulators or 32-bit
 * ARM devices, neither of which this project tests against -- restricting
 * to arm64-v8a for `preview` cuts roughly three quarters of that native
 * compile time. Scoped to `preview` only (via EAS_BUILD_PROFILE, which EAS
 * sets for both `eas build` and `eas build --local`) -- `production` still
 * builds all 4 architectures, since THAT one ships to the Play Store and
 * has to run on whatever architecture a real customer's device has.
 */
const PREVIEW_ONLY_PROPERTIES = {
  reactNativeArchitectures: 'arm64-v8a',
};

module.exports = function withGradlePerf(config) {
  return withGradleProperties(config, (config) => {
    let properties = config.modResults;
    for (const [key, value] of Object.entries(PERF_PROPERTIES)) {
      properties = AndroidConfig.BuildProperties.updateAndroidBuildProperty(properties, key, value);
    }
    if (process.env.EAS_BUILD_PROFILE === 'preview') {
      for (const [key, value] of Object.entries(PREVIEW_ONLY_PROPERTIES)) {
        properties = AndroidConfig.BuildProperties.updateAndroidBuildProperty(properties, key, value);
      }
    }
    config.modResults = properties;
    return config;
  });
};

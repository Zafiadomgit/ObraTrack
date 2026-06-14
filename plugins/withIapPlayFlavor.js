const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * react-native-iap v12 ships two product flavors (`play` and `amazon`) under a
 * `store` dimension. The app module doesn't declare that dimension, so Gradle
 * cannot decide which variant to consume and the release build fails with
 * "Could not resolve project :react-native-iap ... cannot choose between
 * amazonReleaseRuntimeElements / playReleaseRuntimeElements".
 *
 * This config plugin injects `missingDimensionStrategy 'store', 'play'` into the
 * app's defaultConfig so the Google Play flavor is always selected.
 */
module.exports = function withIapPlayFlavor(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      return cfg;
    }
    const contents = cfg.modResults.contents;
    if (contents.includes("missingDimensionStrategy 'store'")) {
      return cfg;
    }
    cfg.modResults.contents = contents.replace(
      /defaultConfig\s*\{/,
      (match) => `${match}\n        missingDimensionStrategy 'store', 'play'`
    );
    return cfg;
  });
};

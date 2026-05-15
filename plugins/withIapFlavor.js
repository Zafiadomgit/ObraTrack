/**
 * Config plugin that adds missingDimensionStrategy for react-native-iap.
 * react-native-iap has 'amazon' and 'play' flavors — this tells Gradle
 * to always pick the 'play' variant when building for Google Play Store.
 */
const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withIapFlavor(config) {
    return withAppBuildGradle(config, (config) => {
        const contents = config.modResults.contents;

        // Avoid duplicating if already applied
        if (contents.includes("missingDimensionStrategy 'store'")) {
            return config;
        }

        // Insert inside defaultConfig { ... }
        config.modResults.contents = contents.replace(
            /defaultConfig\s*\{/,
            `defaultConfig {\n        missingDimensionStrategy 'store', 'play'`
        );

        return config;
    });
};

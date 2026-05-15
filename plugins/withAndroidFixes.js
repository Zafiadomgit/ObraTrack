/**
 * Combined Android config plugin:
 *
 * 1. withOldArch — sets newArchEnabled=false in gradle.properties so that
 *    react-native-iap v13 (which lacks New Architecture codegen specs) can
 *    compile against React Native 0.76+.
 *
 * 2. withIapFlavor — adds missingDimensionStrategy 'store','play' to the
 *    app's defaultConfig so Gradle selects the correct react-native-iap
 *    variant (play vs amazon) without ambiguity.
 */
const { withGradleProperties, withAppBuildGradle } = require('@expo/config-plugins');

function withOldArch(config) {
    return withGradleProperties(config, (config) => {
        const props = config.modResults;

        // Remove any existing newArchEnabled entry
        const filtered = props.filter(
            (p) => !(p.type === 'property' && p.key === 'newArchEnabled')
        );

        // Set to false
        filtered.push({ type: 'property', key: 'newArchEnabled', value: 'false' });

        config.modResults = filtered;
        return config;
    });
}

function withIapFlavor(config) {
    return withAppBuildGradle(config, (config) => {
        const contents = config.modResults.contents;

        if (contents.includes("missingDimensionStrategy 'store'")) {
            return config;
        }

        config.modResults.contents = contents.replace(
            /defaultConfig\s*\{/,
            `defaultConfig {\n        missingDimensionStrategy 'store', 'play'`
        );

        return config;
    });
}

module.exports = function withAndroidFixes(config) {
    config = withOldArch(config);
    config = withIapFlavor(config);
    return config;
};

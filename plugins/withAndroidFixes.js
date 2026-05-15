/**
 * Combined Android config plugin for react-native-iap v13 compatibility:
 *
 * 1. withOldArch — sets newArchEnabled=false so react-native-iap v13 (no
 *    codegen specs) compiles against RN 0.76+ New Architecture.
 *
 * 2. withIapFlavor — adds missingDimensionStrategy 'store','play' to the
 *    app's defaultConfig so Gradle picks the correct IAP variant.
 *
 * NOTE: The enablePendingPurchases() API fix for Billing SDK 7.0 is handled
 * via patch-package (patches/react-native-iap+13.0.4.patch).
 */
const { withGradleProperties, withAppBuildGradle } = require('@expo/config-plugins');

function withOldArch(config) {
    return withGradleProperties(config, (config) => {
        config.modResults = config.modResults.filter(
            (p) => !(p.type === 'property' && p.key === 'newArchEnabled')
        );
        config.modResults.push({ type: 'property', key: 'newArchEnabled', value: 'false' });
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

/**
 * Combined Android config plugin for react-native-iap v13 compatibility:
 *
 * 1. withOldArch — sets newArchEnabled=false so react-native-iap v13 (no
 *    codegen specs) compiles against RN 0.76+ New Architecture.
 *
 * 2. withBillingVersion — overrides RNIap_playBillingSdkVersion to 6.2.1.
 *    react-native-iap v13 defaults to billing:7.0.0 which removed the
 *    parameterless enablePendingPurchases() call that the library still uses.
 *    billing:6.2.1 is the last version with the compatible API.
 *
 * 3. withIapFlavor — adds missingDimensionStrategy 'store','play' to the
 *    app's defaultConfig so Gradle picks the correct IAP variant.
 */
const { withGradleProperties, withAppBuildGradle } = require('@expo/config-plugins');

function withOldArch(config) {
    return withGradleProperties(config, (config) => {
        // Remove any existing entries we're about to set
        config.modResults = config.modResults.filter(
            (p) => !(p.type === 'property' && (
                p.key === 'newArchEnabled' ||
                p.key === 'RNIap_playBillingSdkVersion'
            ))
        );

        // Disable New Architecture (IAP v13 has no codegen specs)
        config.modResults.push({ type: 'property', key: 'newArchEnabled', value: 'false' });

        // Pin Play Billing to 6.2.1 — last version with parameterless enablePendingPurchases()
        config.modResults.push({ type: 'property', key: 'RNIap_playBillingSdkVersion', value: '6.2.1' });

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

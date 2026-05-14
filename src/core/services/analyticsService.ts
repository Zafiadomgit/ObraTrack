/**
 * ObraTrack Analytics Service
 * Centralized Firebase Analytics event tracking.
 * Usage: analytics.logEvent('report_generated', { plan: 'pro', format: 'pdf' })
 *
 * Falls back gracefully on platforms where Firebase Analytics isn't available (Expo Go).
 */
import { Platform } from 'react-native';

// Firebase Analytics is only available in standalone builds (not Expo Go)
// We use a dynamic import with error handling
let analyticsInstance: any = null;

async function getAnalytics() {
    if (analyticsInstance) return analyticsInstance;
    try {
        if (Platform.OS === 'web') {
            const { getAnalytics, isSupported } = await import('firebase/analytics');
            const firebaseModule = await import('../../config/firebase');
            const supported = await isSupported();
            if (supported) {
                analyticsInstance = getAnalytics(firebaseModule.default);
            }
        }
        // On native, Firebase Analytics requires a standalone build — skip in Expo Go
    } catch (e) {
        console.log('[Analytics] Not available in this environment:', e);
    }
    return analyticsInstance;
}

async function logEvent(eventName: string, params?: Record<string, any>) {
    try {
        const instance = await getAnalytics();
        if (!instance) return;
        const { logEvent: fbLogEvent } = await import('firebase/analytics');
        fbLogEvent(instance, eventName, params);
    } catch (e) {
        // Silently fail — analytics should never break the app
    }
}

// ─── Typed Events ────────────────────────────────────────────────────────────

/** Called when a user successfully logs in */
export const trackLogin = (method = 'email') =>
    logEvent('login', { method });

/** Called on successful registration */
export const trackSignUp = (role: string) =>
    logEvent('sign_up', { role });

/** Called when a user attempts to generate a report */
export const trackReportGenerated = (plan: string, format: string) =>
    logEvent('report_generated', { plan, format });

/** Called when a user hits a paywall (Pro feature blocked) */
export const trackPaywallShown = (feature: string) =>
    logEvent('paywall_shown', { feature });

/** Called when a user upgrades/attempts to upgrade to Pro */
export const trackUpgradeIntent = () =>
    logEvent('upgrade_intent');

/** Called when a new project is created */
export const trackProjectCreated = () =>
    logEvent('project_created');

/** Called when materials are dispatched (logística) */
export const trackShipmentCreated = () =>
    logEvent('shipment_created');

/** Called when a daily log entry is saved */
export const trackDailyLogSaved = () =>
    logEvent('daily_log_saved');

/** Called when admin approves a user */
export const trackUserApproved = (role: string) =>
    logEvent('user_approved', { role });

export const analytics = {
    trackLogin,
    trackSignUp,
    trackReportGenerated,
    trackPaywallShown,
    trackUpgradeIntent,
    trackProjectCreated,
    trackShipmentCreated,
    trackDailyLogSaved,
    trackUserApproved,
};

export default analytics;

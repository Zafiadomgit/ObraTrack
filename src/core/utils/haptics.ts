import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Thin wrapper around expo-haptics. Safe to call on web (no-op) and never
 * throws, so screens can sprinkle tactile feedback without extra guards.
 */
const run = (fn: () => Promise<void>) => {
    if (Platform.OS === 'web') return;
    fn().catch(() => {});
};

export const haptic = {
    light: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
    medium: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
    heavy: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
    success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
    warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
    error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};

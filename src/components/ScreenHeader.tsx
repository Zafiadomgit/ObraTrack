import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from '@expo/vector-icons/Feather';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../core/theme';
import { haptic } from '../core/utils/haptics';

interface Props {
    title: string;
    subtitle?: string;
    /** Optional Feather icon shown in a badge on the right. */
    icon?: keyof typeof Icon.glyphMap;
    /** Custom node rendered on the right (overrides icon). */
    right?: React.ReactNode;
    onBack?: () => void;
    showBack?: boolean;
}

/**
 * Shared gradient header used across screens for a consistent, less-flat look.
 * Includes the safe-area top inset, an optional back button and right slot.
 */
export default function ScreenHeader({ title, subtitle, icon, right, onBack, showBack = true }: Props) {
    const insets = useSafeAreaInsets();
    const navigation = useNavigation<any>();

    return (
        <LinearGradient
            colors={[COLORS.primaryLight, COLORS.primary, COLORS.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}
        >
            <View style={styles.row}>
                {showBack && (
                    <Pressable
                        hitSlop={8}
                        style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
                        onPress={() => { haptic.light(); onBack ? onBack() : navigation.goBack(); }}
                    >
                        <Icon name="arrow-left" size={22} color={COLORS.white} />
                    </Pressable>
                )}
                <View style={{ flex: 1 }}>
                    <Text style={styles.title} numberOfLines={1}>{title}</Text>
                    {subtitle ? <Text style={styles.sub} numberOfLines={1}>{subtitle}</Text> : null}
                </View>
                {right ? right : icon ? (
                    <View style={styles.badge}>
                        <Icon name={icon} size={20} color={COLORS.white} />
                    </View>
                ) : null}
            </View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    header: {
        paddingHorizontal: SPACING.lg,
        paddingBottom: SPACING.md,
        borderBottomLeftRadius: RADIUS.xl,
        borderBottomRightRadius: RADIUS.xl,
        ...SHADOWS.md,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
    backBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.18)',
        alignItems: 'center', justifyContent: 'center',
    },
    title: { color: COLORS.white, fontSize: FONTS.sizes.lg, fontWeight: '800', letterSpacing: 0.2 },
    sub: { color: 'rgba(255,255,255,0.8)', fontSize: FONTS.sizes.xs, marginTop: 2, fontWeight: '600' },
    badge: {
        width: 44, height: 44, borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.18)',
        alignItems: 'center', justifyContent: 'center',
    },
});

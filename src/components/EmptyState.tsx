import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from '@expo/vector-icons/Feather';
import { COLORS, FONTS, SPACING, RADIUS } from '../core/theme';

interface EmptyStateProps {
    icon?: keyof typeof Icon.glyphMap;
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
}

export default function EmptyState({ icon = 'inbox', title, description, actionLabel, onAction }: EmptyStateProps) {
    return (
        <View style={styles.container}>
            <View style={styles.iconContainer}>
                <Icon name={icon} size={48} color={COLORS.primary} />
            </View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.description}>{description}</Text>
            
            {actionLabel && onAction && (
                <TouchableOpacity style={styles.actionBtn} onPress={onAction}>
                    <Text style={styles.actionText}>{actionLabel}</Text>
                    <Icon name="arrow-right" size={16} color={COLORS.primary} />
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACING.xxl,
        marginTop: 40,
    },
    iconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: COLORS.primary + '15',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.xl,
    },
    title: {
        color: COLORS.white,
        fontSize: FONTS.sizes.xl,
        fontWeight: 'bold',
        marginBottom: SPACING.sm,
        textAlign: 'center',
    },
    description: {
        color: COLORS.textMuted,
        fontSize: FONTS.sizes.md,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: SPACING.xl,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primary + '15',
        paddingHorizontal: SPACING.xl,
        paddingVertical: SPACING.md,
        borderRadius: RADIUS.round,
        gap: 8,
    },
    actionText: {
        color: COLORS.primary,
        fontWeight: 'bold',
        fontSize: FONTS.sizes.md,
    }
});

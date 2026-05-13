import React from 'react';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import Icon from '@expo/vector-icons/Feather';
import { COLORS, SHADOWS } from '../core/theme';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

interface GlobalFABProps {
    onPress?: () => void;
    icon?: keyof typeof Icon.glyphMap;
    color?: string;
    style?: any;           // kept for backward compat (applies to container)
    containerStyle?: any;  // preferred: applies to container
}

export default function GlobalFAB({ onPress, icon = 'plus', color = COLORS.primary, style, containerStyle }: GlobalFABProps) {
    const navigation = useNavigation<any>();

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (onPress) {
            onPress();
        } else {
            navigation.navigate('Proyectos');
        }
    };

    return (
        <View style={[styles.container, style, containerStyle]}>
            <TouchableOpacity
                style={[styles.fab, { backgroundColor: color }]}
                onPress={handlePress}
                activeOpacity={0.8}
            >
                <Icon name={icon} size={28} color={COLORS.white} />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        zIndex: 999,
    },
    fab: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        ...SHADOWS.lg,
    }
});

import React from 'react';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import Icon from '@expo/vector-icons/Feather';
import { SHADOWS } from '../core/theme';
import { useColors } from '../core/theme/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

interface GlobalFABProps {
    onPress?: () => void;
    icon?: keyof typeof Icon.glyphMap;
    color?: string;
    style?: any;           // kept for backward compat (applies to container)
    containerStyle?: any;  // preferred: applies to container
}

export default function GlobalFAB({ onPress, icon = 'plus', color, style, containerStyle }: GlobalFABProps) {
    const navigation = useNavigation<any>();
    const C = useColors();
    const resolvedColor = color ?? C.primary;

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
                style={[styles.fab, { backgroundColor: resolvedColor }]}
                onPress={handlePress}
                activeOpacity={0.8}
            >
                <Icon name={icon} size={28} color={C.white} />
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

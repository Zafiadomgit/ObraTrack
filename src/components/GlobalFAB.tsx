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
    style?: any;
}

export default function GlobalFAB({ onPress, icon = 'plus', color = COLORS.primary, style }: GlobalFABProps) {
    const navigation = useNavigation<any>();

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (onPress) {
            onPress();
        } else {
            // Default action: Open Project Creation Modal or Navigate
            navigation.navigate('Proyectos'); 
        }
    };

    return (
        <View style={styles.container}>
            <TouchableOpacity 
                style={[styles.fab, { backgroundColor: color }, style]} 
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

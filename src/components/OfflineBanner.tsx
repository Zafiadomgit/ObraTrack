import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { FONTS, SPACING } from '../core/theme';
import { useColors, ThemeColors } from '../core/theme/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function OfflineBanner() {
    const [isConnected, setIsConnected] = useState<boolean | null>(true);
    const insets = useSafeAreaInsets();
    const C = useColors();
    const styles = React.useMemo(() => makeStyles(C), [C]);

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            setIsConnected(state.isConnected);
        });
        return () => unsubscribe();
    }, []);

    if (isConnected || isConnected === null) return null;

    return (
        <View style={[styles.container, { paddingTop: Math.max(insets.top, 20) }]}>
            <View style={styles.banner}>
                <Text style={styles.text}>
                    Modo Offline – los cambios se sincronizarán cuando vuelva la conexión
                </Text>
            </View>
        </View>
    );
}

function makeStyles(C: ThemeColors) {
    return StyleSheet.create({
        container: {
            backgroundColor: C.warning,
            width: '100%',
            position: 'absolute',
            top: 0,
            zIndex: 9999,
            elevation: 10,
        },
        banner: {
            padding: SPACING.sm,
            paddingBottom: SPACING.sm,
            alignItems: 'center',
            justifyContent: 'center',
        },
        text: {
            color: C.background,
            fontSize: FONTS.sizes.sm,
            fontWeight: 'bold',
            textAlign: 'center',
        }
    });
}

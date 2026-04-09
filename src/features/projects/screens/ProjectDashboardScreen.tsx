import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@expo/vector-icons/Feather';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../../core/theme';
import { useAppStore } from '../../../store/appStore';

export default function ProjectDashboardScreen({ navigation: propNavigation, route: propRoute }: any) {
    const insets = useSafeAreaInsets();
    const hookNavigation = useNavigation<any>();
    const navigation = propNavigation?.navigate ? propNavigation : hookNavigation;
    
    // Fallback to hook if propRoute is empty
    const hookRoute = useRoute<any>();
    const route = propRoute?.params ? propRoute : hookRoute;
    const { projectId, projectName } = route.params || {};
    const user = useAppStore(state => state.user);

    const isCentral = projectId === 'central';

    const menuItems = [
        {
            id: 'Bitácora',
            icon: 'book-open' as const,
            title: 'Bitácora',
            description: 'Diario de obra y actividades',
            color: COLORS.primary,
            screen: 'Bitácora',
            roles: ['admin', 'coordinador', 'lider'],
            hideCentral: true
        },
        {
            id: 'Personal',
            icon: 'users' as const,
            title: 'Personal',
            description: 'Control de asistencia y cuadrillas',
            color: COLORS.success,
            screen: 'Personal',
            roles: ['admin', 'coordinador', 'lider'],
            hideCentral: true
        },
        {
            id: 'Materiales',
            icon: isCentral ? 'package' as const : 'box' as const,
            title: isCentral ? 'Bodega Central' : 'Materiales',
            description: 'Inventario y control de stock',
            color: COLORS.info,
            screen: 'Materiales',
            roles: ['admin', 'coordinador', 'lider', 'logistica'],
            hideCentral: false
        },
        {
            id: 'Equipos',
            icon: 'tool' as const,
            title: 'Equipos',
            description: 'Maquinaria y herramientas',
            color: '#E67E22',
            screen: 'Equipos',
            roles: ['admin', 'coordinador', 'lider'],
            hideCentral: false
        },
        {
            id: 'Envíos',
            icon: 'truck' as const,
            title: 'Envíos',
            description: 'Despachos y logística',
            color: '#9B59B6',
            screen: 'Envíos',
            roles: ['admin', 'coordinador', 'logistica'],
            hideCentral: true
        },
        {
            id: 'Reportes',
            icon: 'file-text' as const,
            title: 'Reportes',
            description: 'Generar PDF, Excel y CSV',
            color: COLORS.danger,
            screen: 'Reportes',
            roles: ['admin', 'coordinador'],
            hideCentral: true
        }
    ];

    const filteredMenu = menuItems.filter(item => {
        if (!user || !item.roles.includes(user.role)) return false;
        if (isCentral && item.hideCentral) return false;
        return true;
    });

    return (
        <View style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + SPACING.lg }]}>
                <View style={styles.header}>
                    <Text style={styles.projectName}>{projectName}</Text>
                    <Text style={styles.projectDesc}>
                        {isCentral ? 'Gestión de almacén principal' : 'Gestión de proyecto'}
                    </Text>
                </View>

                <View style={styles.grid}>
                    {filteredMenu.map(item => (
                        <TouchableOpacity
                            key={item.id}
                            style={styles.card}
                            onPress={() => navigation.navigate(item.screen, { projectId, projectName })}
                            activeOpacity={0.8}
                        >
                            <View style={[styles.iconBox, { backgroundColor: item.color + '22' }]}>
                                <Icon name={item.icon} size={28} color={item.color} />
                            </View>
                            <Text style={styles.cardTitle}>{item.title}</Text>
                            <Text style={styles.cardDesc}>{item.description}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollContent: {
        padding: SPACING.lg,
    },
    header: {
        marginBottom: SPACING.xl,
        alignItems: 'center',
        paddingVertical: SPACING.md,
    },
    projectName: {
        color: COLORS.white,
        fontSize: FONTS.sizes.xl,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 4,
    },
    projectDesc: {
        color: COLORS.textMuted,
        fontSize: FONTS.sizes.sm,
        textAlign: 'center',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: SPACING.md,
    },
    card: {
        width: '48%', // Approx half minus gap
        backgroundColor: COLORS.surface,
        borderRadius: RADIUS.lg,
        padding: SPACING.lg,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.sm,
    },
    iconBox: {
        width: 56,
        height: 56,
        borderRadius: RADIUS.round,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.md,
    },
    cardTitle: {
        color: COLORS.white,
        fontSize: FONTS.sizes.md,
        fontWeight: 'bold',
        marginBottom: 4,
        textAlign: 'center',
    },
    cardDesc: {
        color: COLORS.textMuted,
        fontSize: 10,
        textAlign: 'center',
        lineHeight: 14,
    }
});

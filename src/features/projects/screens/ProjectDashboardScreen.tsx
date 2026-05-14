import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@expo/vector-icons/Feather';
import { FONTS, SPACING, RADIUS, SHADOWS } from '../../../core/theme';
import { useAppStore } from '../../../store/appStore';
import { useColors, ThemeColors } from '../../../core/theme/ThemeContext';
import { useT } from '../../../core/i18n';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_SIZE = (SCREEN_WIDTH - SPACING.lg * 2 - SPACING.md) / 2;

export default function ProjectDashboardScreen({ navigation: propNavigation, route: propRoute }: any) {
    const insets = useSafeAreaInsets();
    const C = useColors();
    const styles = React.useMemo(() => makeStyles(C), [C]);
    const t = useT();
    const hookNavigation = useNavigation<any>();
    const navigation = propNavigation?.navigate ? propNavigation : hookNavigation;

    const hookRoute = useRoute<any>();
    const route = propRoute?.params ? propRoute : hookRoute;
    const { projectId, projectName } = route.params || {};
    const user = useAppStore(state => state.user);

    const isCentral = projectId === 'central';

    const menuItems = [
        {
            id: 'Bitácora',
            icon: 'book-open' as const,
            title: t.logbook,
            description: t.logbookDesc,
            color: '#3B82F6',
            screen: 'Bitácora',
            roles: ['admin', 'coordinador', 'lider'],
            hideCentral: true,
        },
        {
            id: 'Personal',
            icon: 'users' as const,
            title: t.personnel,
            description: t.personnelDesc,
            color: '#10B981',
            screen: 'Personal',
            roles: ['admin', 'coordinador', 'lider'],
            hideCentral: true,
        },
        {
            id: 'Materiales',
            icon: isCentral ? 'package' as const : 'box' as const,
            title: isCentral ? t.centralWarehouse : 'Materiales',
            description: t.materialsDesc,
            color: '#6366F1',
            screen: 'Materiales',
            roles: ['admin', 'coordinador', 'lider', 'logistica'],
            hideCentral: false,
        },
        {
            id: 'Equipos',
            icon: 'tool' as const,
            title: t.equipment,
            description: t.equipmentDesc,
            color: '#F59E0B',
            screen: 'Equipos',
            roles: ['admin', 'coordinador', 'lider'],
            hideCentral: false,
        },
        {
            id: 'Envíos',
            icon: 'truck' as const,
            title: t.shipments,
            description: t.shipmentsDesc,
            color: '#8B5CF6',
            screen: 'Envíos',
            roles: ['admin', 'coordinador', 'logistica'],
            hideCentral: true,
        },
        {
            id: 'Reportes',
            icon: 'file-text' as const,
            title: t.reports,
            description: t.reportsDesc,
            color: '#EF4444',
            screen: 'Reportes',
            roles: ['admin', 'coordinador'],
            hideCentral: true,
        },
    ];

    const filteredMenu = menuItems.filter(item => {
        if (!user || !item.roles.includes(user.role)) return false;
        if (isCentral && item.hideCentral) return false;
        return true;
    });

    // Pair items into rows of 2
    const rows: (typeof filteredMenu)[] = [];
    for (let i = 0; i < filteredMenu.length; i += 2) {
        rows.push(filteredMenu.slice(i, i + 2));
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Icon name="arrow-left" size={22} color={C.white} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.projectName} numberOfLines={1}>{projectName}</Text>
                    <Text style={styles.projectSub}>
                        {isCentral ? t.warehouseManagement : t.projectManagement}
                    </Text>
                </View>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
            >
                {rows.map((row, rowIdx) => (
                    <View key={rowIdx} style={styles.row}>
                        {row.map(item => (
                            <TouchableOpacity
                                key={item.id}
                                style={[styles.card, { width: CARD_SIZE }]}
                                onPress={() => navigation.navigate(item.screen, { projectId, projectName })}
                                activeOpacity={0.82}
                            >
                                <View style={[styles.iconCircle, { backgroundColor: item.color }]}>
                                    <Icon name={item.icon} size={26} color={C.white} />
                                </View>
                                <Text style={styles.cardTitle}>{item.title}</Text>
                                <Text style={styles.cardDesc}>{item.description}</Text>
                                <View style={[styles.cardArrow, { backgroundColor: item.color + '20' }]}>
                                    <Icon name="arrow-right" size={14} color={item.color} />
                                </View>
                            </TouchableOpacity>
                        ))}
                        {/* Spacer if odd row */}
                        {row.length === 1 && <View style={{ width: CARD_SIZE }} />}
                    </View>
                ))}
            </ScrollView>
        </View>
    );
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        backgroundColor: C.surface,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
        gap: SPACING.md,
    },
    backBtn: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: C.surfaceLight,
        alignItems: 'center', justifyContent: 'center',
    },
    projectName: { color: C.white, fontSize: FONTS.sizes.lg, fontWeight: 'bold' },
    projectSub: { color: C.textMuted, fontSize: FONTS.sizes.xs, marginTop: 2 },

    scrollContent: { padding: SPACING.lg, gap: SPACING.md },

    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: SPACING.md,
    },

    card: {
        backgroundColor: C.surface,
        borderRadius: RADIUS.xl,
        padding: SPACING.lg,
        borderWidth: 1,
        borderColor: C.border,
        alignItems: 'flex-start',
        ...SHADOWS.md,
    },
    iconCircle: {
        width: 52, height: 52, borderRadius: 26,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: SPACING.md,
    },
    cardTitle: {
        color: C.white,
        fontSize: FONTS.sizes.md,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    cardDesc: {
        color: C.textMuted,
        fontSize: FONTS.sizes.xs,
        lineHeight: 16,
        marginBottom: SPACING.md,
    },
    cardArrow: {
        width: 28, height: 28, borderRadius: 14,
        alignItems: 'center', justifyContent: 'center',
    },
});

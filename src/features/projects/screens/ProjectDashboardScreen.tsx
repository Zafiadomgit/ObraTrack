import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Dimensions } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from '@expo/vector-icons/Feather';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../../core/theme';
import { useAppStore } from '../../../store/appStore';
import { haptic } from '../../../core/utils/haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_SIZE = (SCREEN_WIDTH - SPACING.lg * 2 - SPACING.md) / 2;

export default function ProjectDashboardScreen({ navigation: propNavigation, route: propRoute }: any) {
    const insets = useSafeAreaInsets();
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
            title: 'Bitácora',
            description: 'Diario de obra',
            color: '#3B82F6',
            screen: 'Bitácora',
            roles: ['admin', 'coordinador', 'lider'],
            hideCentral: true,
        },
        {
            id: 'Personal',
            icon: 'users' as const,
            title: 'Personal',
            description: 'Asistencia y roles',
            color: '#10B981',
            screen: 'Personal',
            roles: ['admin', 'coordinador', 'lider'],
            hideCentral: true,
        },
        {
            id: 'Materiales',
            icon: isCentral ? 'package' as const : 'box' as const,
            title: isCentral ? 'Bodega' : 'Materiales',
            description: 'Inventario y stock',
            color: '#6366F1',
            screen: 'Materiales',
            roles: ['admin', 'coordinador', 'lider', 'logistica'],
            hideCentral: false,
        },
        {
            id: 'Equipos',
            icon: 'tool' as const,
            title: 'Equipos',
            description: 'Maquinaria',
            color: '#F59E0B',
            screen: 'Equipos',
            roles: ['admin', 'coordinador', 'lider'],
            hideCentral: false,
        },
        {
            id: 'Envíos',
            icon: 'truck' as const,
            title: 'Envíos',
            description: 'Despachos',
            color: '#8B5CF6',
            screen: 'Envíos',
            roles: ['admin', 'coordinador', 'logistica'],
            hideCentral: true,
        },
        {
            id: 'Reportes',
            icon: 'file-text' as const,
            title: 'Reportes',
            description: 'PDF y Excel',
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

    const goTo = (screen: string) => {
        haptic.light();
        navigation.navigate(screen, { projectId, projectName });
    };

    return (
        <View style={styles.container}>
            {/* Gradient hero header */}
            <LinearGradient
                colors={[COLORS.primaryLight, COLORS.primary, COLORS.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}
            >
                <View style={styles.headerTopRow}>
                    <Pressable
                        style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
                        onPress={() => { haptic.light(); navigation.goBack(); }}
                        hitSlop={8}
                    >
                        <Icon name="arrow-left" size={22} color={COLORS.white} />
                    </Pressable>
                    <View style={styles.headerBadge}>
                        <Icon name={isCentral ? 'package' : 'briefcase'} size={20} color={COLORS.white} />
                    </View>
                </View>

                <Text style={styles.projectName} numberOfLines={2}>{projectName}</Text>
                <View style={styles.subPill}>
                    <View style={styles.subDot} />
                    <Text style={styles.projectSub}>
                        {isCentral ? 'Almacén principal' : 'Panel de gestión'}
                    </Text>
                </View>
            </LinearGradient>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
            >
                <Text style={styles.sectionLabel}>MÓDULOS</Text>

                {rows.map((row, rowIdx) => (
                    <View key={rowIdx} style={styles.row}>
                        {row.map(item => (
                            <Pressable
                                key={item.id}
                                style={({ pressed }) => [
                                    styles.card,
                                    { width: CARD_SIZE },
                                    pressed && styles.cardPressed,
                                ]}
                                onPress={() => goTo(item.screen)}
                            >
                                <View style={[styles.iconCircle, { backgroundColor: item.color, shadowColor: item.color }]}>
                                    <Icon name={item.icon} size={24} color={COLORS.white} />
                                </View>
                                <Text style={styles.cardTitle}>{item.title}</Text>
                                <Text style={styles.cardDesc}>{item.description}</Text>
                                <View style={[styles.cardArrow, { backgroundColor: item.color + '20' }]}>
                                    <Icon name="arrow-right" size={14} color={item.color} />
                                </View>
                            </Pressable>
                        ))}
                        {/* Spacer if odd row */}
                        {row.length === 1 && <View style={{ width: CARD_SIZE }} />}
                    </View>
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },

    header: {
        paddingHorizontal: SPACING.lg,
        paddingBottom: SPACING.xl,
        borderBottomLeftRadius: RADIUS.xl,
        borderBottomRightRadius: RADIUS.xl,
        ...SHADOWS.lg,
    },
    headerTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: SPACING.lg,
    },
    backBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.18)',
        alignItems: 'center', justifyContent: 'center',
    },
    headerBadge: {
        width: 44, height: 44, borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.18)',
        alignItems: 'center', justifyContent: 'center',
    },
    projectName: {
        color: COLORS.white,
        fontSize: FONTS.sizes.xxl,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    subPill: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: RADIUS.round,
        marginTop: SPACING.sm,
        gap: 6,
    },
    subDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.success },
    projectSub: { color: 'rgba(255,255,255,0.92)', fontSize: FONTS.sizes.xs, fontWeight: '600' },

    scrollContent: { padding: SPACING.lg },

    sectionLabel: {
        color: COLORS.textMuted,
        fontSize: FONTS.sizes.xs,
        fontWeight: '700',
        letterSpacing: 1.5,
        marginBottom: SPACING.md,
    },

    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: SPACING.md,
    },

    card: {
        backgroundColor: COLORS.surface,
        borderRadius: RADIUS.xl,
        padding: SPACING.lg,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'flex-start',
        ...SHADOWS.md,
    },
    cardPressed: {
        transform: [{ scale: 0.96 }],
        opacity: 0.92,
        borderColor: COLORS.primaryLight,
    },
    iconCircle: {
        width: 52, height: 52, borderRadius: 16,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: SPACING.md,
        // Colored glow gives the flat cards depth/life
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 8,
        elevation: 6,
    },
    cardTitle: {
        color: COLORS.white,
        fontSize: FONTS.sizes.md,
        fontWeight: '700',
        marginBottom: 4,
    },
    cardDesc: {
        color: COLORS.textMuted,
        fontSize: FONTS.sizes.xs,
        lineHeight: 16,
        marginBottom: SPACING.md,
    },
    cardArrow: {
        width: 30, height: 30, borderRadius: 15,
        alignItems: 'center', justifyContent: 'center',
    },
});

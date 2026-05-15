import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    Alert, Linking, ActivityIndicator
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Icon from '@expo/vector-icons/Feather';
import { useAppStore } from '../../../store/appStore';
import { FONTS, SPACING, RADIUS, SHADOWS } from '../../../core/theme';
import { useColors, ThemeColors } from '../../../core/theme/ThemeContext';
import { PLAN_PRICES, ADDON_PRICES, PlanTier } from '../../../core/constants/plans';

// ─── Contenido por plan ──────────────────────────────────────────────────────
const PLAN_FEATURES: Record<PlanTier, { text: string; available: boolean }[]> = {
    free: [
        { text: '1 admin + 1 de cada rol', available: true },
        { text: '1 proyecto activo', available: true },
        { text: 'Bitácora y personal', available: true },
        { text: 'Reportes PDF', available: false },
        { text: 'Logística de envíos', available: false },
        { text: 'Agregar usuarios extra', available: false },
    ],
    premium: [
        { text: '5 usuarios por rol', available: true },
        { text: '5 proyectos activos', available: true },
        { text: 'Reportes PDF con firma', available: true },
        { text: 'Logística de envíos', available: true },
        { text: 'Exportar Excel y CSV', available: true },
        { text: 'Usuarios extra (add-on)', available: true },
    ],
    enterprise: [
        { text: 'Usuarios ilimitados', available: true },
        { text: 'Proyectos ilimitados', available: true },
        { text: 'Todo lo de Premium', available: true },
        { text: 'Prioridad en soporte', available: true },
        { text: 'Integración con ERP', available: true },
        { text: 'SLA garantizado', available: true },
    ],
};

const PLAN_ICONS: Record<PlanTier, keyof typeof Icon.glyphMap> = {
    free: 'user',
    premium: 'star',
    enterprise: 'zap',
};

// URL de la página de pagos — cambia esto a tu URL real cuando esté lista
const PAYMENT_URLS: Record<PlanTier, string> = {
    free: '',
    premium: 'mailto:soporte@zafiadom.com?subject=Activar%20Plan%20Premium%20ObraTrack',
    enterprise: 'mailto:soporte@zafiadom.com?subject=Activar%20Plan%20Enterprise%20ObraTrack',
};

// ─── Componente ──────────────────────────────────────────────────────────────
interface Props {
    paywallMessage?: string;
}

export default function SubscriptionScreen({ paywallMessage }: Props) {
    const insets = useSafeAreaInsets();
    const navigation = useNavigation<any>();
    const C = useColors();
    const styles = React.useMemo(() => makeStyles(C), [C]);
    const PLAN_ACCENT = React.useMemo<Record<PlanTier, string>>(() => ({
        free: C.textMuted,
        premium: C.primary,
        enterprise: '#F39C12',
    }), [C]);
    const { user } = useAppStore();
    const [loading, setLoading] = useState<string | null>(null);
    const currentPlan = (user?.plan as PlanTier) || 'free';

    // ─── Seleccionar plan ─────────────────────────────────────────────────────
    const handleSelectPlan = async (plan: PlanTier) => {
        if (plan === currentPlan) return;

        if (plan === 'free') {
            Alert.alert(
                'Cambio de plan',
                'Para bajar al plan gratuito, cancela tu suscripción activa y contacta soporte en soporte@zafiadom.com si necesitas ayuda.'
            );
            return;
        }

        const url = PAYMENT_URLS[plan];
        if (!url) return;

        setLoading(plan);
        try {
            const supported = await Linking.canOpenURL(url);
            if (supported) {
                await Linking.openURL(url);
            } else {
                Alert.alert(
                    'Contacta a soporte',
                    `Para activar el plan ${PLAN_PRICES[plan].label} escríbenos a:\nsoporte@zafiadom.com`
                );
            }
        } catch (e) {
            Alert.alert('Error', 'No se pudo abrir el enlace. Escríbenos a soporte@zafiadom.com');
        } finally {
            setLoading(null);
        }
    };

    // ─── Add-on ───────────────────────────────────────────────────────────────
    const handleBuyAddon = async (addonName: string) => {
        if (currentPlan === 'free') {
            Alert.alert('Plan requerido', 'Los add-ons están disponibles solo para planes Premium o Enterprise.');
            return;
        }
        const url = `mailto:soporte@zafiadom.com?subject=Add-on%20${encodeURIComponent(addonName)}%20ObraTrack`;
        try {
            await Linking.openURL(url);
        } catch {
            Alert.alert('Contacta soporte', `Para adquirir "${addonName}", escríbenos a: soporte@zafiadom.com`);
        }
    };

    // ─── Restaurar / verificar plan ───────────────────────────────────────────
    const handleRestorePurchases = async () => {
        Alert.alert(
            'Verificar suscripción',
            'Si ya tienes una suscripción activa y no se refleja en la app, contacta a soporte para que lo activemos manualmente.\n\nsoporte@zafiadom.com',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Contactar',
                    onPress: () => Linking.openURL('mailto:soporte@zafiadom.com?subject=Verificar%20suscripcion%20ObraTrack'),
                },
            ]
        );
    };

    // ─── Render plan card ─────────────────────────────────────────────────────
    const renderPlan = (tier: PlanTier) => {
        const price = PLAN_PRICES[tier];
        const features = PLAN_FEATURES[tier];
        const accent = PLAN_ACCENT[tier];
        const isActive = currentPlan === tier;
        const isPopular = tier === 'premium';
        const isLoading = loading === tier;

        return (
            <View key={tier} style={[styles.planCard, isActive && { borderColor: accent, borderWidth: 2 }]}>
                {isPopular && (
                    <View style={[styles.popularBadge, { backgroundColor: accent }]}>
                        <Text style={styles.popularText}>MÁS POPULAR</Text>
                    </View>
                )}
                {isActive && (
                    <View style={[styles.activeBadge, { backgroundColor: accent + '30', borderColor: accent }]}>
                        <Icon name="check-circle" size={12} color={accent} />
                        <Text style={[styles.activeText, { color: accent }]}> PLAN ACTUAL</Text>
                    </View>
                )}

                <View style={styles.planHeader}>
                    <View style={[styles.planIconCircle, { backgroundColor: accent + '20' }]}>
                        <Icon name={PLAN_ICONS[tier]} size={24} color={accent} />
                    </View>
                    <View style={{ marginLeft: SPACING.md, flex: 1 }}>
                        <Text style={styles.planName}>{price.label}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                            <Text style={[styles.planPrice, { color: accent }]}>{price.price}</Text>
                            {price.period ? (
                                <Text style={styles.planPeriod}>{price.period}</Text>
                            ) : null}
                        </View>
                    </View>
                </View>

                <View style={styles.featureList}>
                    {features.map((f, i) => (
                        <View key={i} style={styles.featureRow}>
                            <Icon
                                name={f.available ? 'check' : 'x'}
                                size={14}
                                color={f.available ? C.success : C.textMuted}
                            />
                            <Text style={[styles.featureText, !f.available && styles.featureUnavailable]}>
                                {f.text}
                            </Text>
                        </View>
                    ))}
                </View>

                <TouchableOpacity
                    style={[
                        styles.selectBtn,
                        { backgroundColor: isActive ? 'transparent' : accent },
                        isActive && { borderWidth: 1, borderColor: accent },
                    ]}
                    onPress={() => handleSelectPlan(tier)}
                    disabled={isActive || loading !== null}
                >
                    {isLoading ? (
                        <ActivityIndicator size="small" color={C.white} />
                    ) : (
                        <Text style={[styles.selectText, isActive && { color: accent }]}>
                            {isActive ? 'Plan Activo' : tier === 'free' ? 'Plan Gratis' : `Activar ${price.label}`}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top, backgroundColor: C.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
                <TouchableOpacity
                    onPress={() => navigation.canGoBack() ? navigation.goBack() : null}
                    style={styles.backBtn}
                >
                    <Icon name="arrow-left" size={24} color={C.white} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: C.white }]}>Planes ObraTrack</Text>
            </View>

            <ScrollView
                contentContainerStyle={{ padding: SPACING.md, paddingBottom: 60 }}
                showsVerticalScrollIndicator={false}
            >
                {paywallMessage && (
                    <View style={styles.paywallBanner}>
                        <Icon name="lock" size={18} color={C.warning} />
                        <Text style={styles.paywallText}>{paywallMessage}</Text>
                    </View>
                )}

                <Text style={styles.subtitle}>
                    Elige el plan que mejor se adapte a tu empresa.{'\n'}
                    Para activar tu plan escríbenos y lo configuramos de inmediato.
                </Text>

                {(['free', 'premium', 'enterprise'] as PlanTier[]).map(renderPlan)}

                {/* ── Add-ons ── */}
                <View style={{ marginTop: SPACING.md, marginBottom: SPACING.md }}>
                    <Text style={[styles.sectionTitle, { marginBottom: SPACING.xs }]}>Add-ons Disponibles</Text>
                    <Text style={[styles.subtitle, { textAlign: 'left', marginBottom: SPACING.md }]}>
                        Amplía los límites de tu plan comprando cupos adicionales.
                    </Text>

                    <TouchableOpacity
                        style={styles.addonCard}
                        onPress={() => handleBuyAddon(ADDON_PRICES.EXTRA_USER.label)}
                        disabled={loading !== null}
                    >
                        <View style={[styles.planIconCircle, { backgroundColor: C.primary + '20', width: 40, height: 40, marginRight: SPACING.md }]}>
                            <Icon name="user-plus" size={20} color={C.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.addonTitle}>{ADDON_PRICES.EXTRA_USER.label}</Text>
                            <Text style={styles.addonDesc}>Cupo para rol operativo o administrativo.</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={styles.addonPrice}>{ADDON_PRICES.EXTRA_USER.price}</Text>
                            <Text style={styles.addonPeriod}>/mes</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.addonCard}
                        onPress={() => handleBuyAddon(ADDON_PRICES.EXTRA_PROJECT.label)}
                        disabled={loading !== null}
                    >
                        <View style={[styles.planIconCircle, { backgroundColor: C.primary + '20', width: 40, height: 40, marginRight: SPACING.md }]}>
                            <Icon name="briefcase" size={20} color={C.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.addonTitle}>{ADDON_PRICES.EXTRA_PROJECT.label}</Text>
                            <Text style={styles.addonDesc}>Obra adicional con control separado.</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={styles.addonPrice}>{ADDON_PRICES.EXTRA_PROJECT.price}</Text>
                            <Text style={styles.addonPeriod}>/mes</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Restore / Legal */}
                <TouchableOpacity
                    style={styles.restoreBtn}
                    onPress={handleRestorePurchases}
                    disabled={loading !== null}
                >
                    <Text style={styles.restoreText}>¿Ya tienes una suscripción? Verificar</Text>
                </TouchableOpacity>

                <Text style={styles.legalText}>
                    Los precios están en COP e incluyen IVA. La activación es manual por nuestro equipo en
                    un plazo de 24 h. Para cancelar o cambiar tu plan escríbenos a soporte@zafiadom.com.
                </Text>
            </ScrollView>
        </View>
    );
}

function makeStyles(C: ThemeColors) {
    return StyleSheet.create({
        container: { flex: 1, backgroundColor: C.background },
        header: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
        backBtn: { marginRight: SPACING.md },
        headerTitle: { color: C.white, fontSize: FONTS.sizes.lg, fontWeight: 'bold' },
        sectionTitle: { color: C.white, fontSize: FONTS.sizes.lg, fontWeight: 'bold' },

        subtitle: { color: C.textSecondary, textAlign: 'center', fontSize: FONTS.sizes.sm, lineHeight: 22, marginBottom: SPACING.lg, marginTop: SPACING.sm },

        paywallBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.warning + '20', borderWidth: 1, borderColor: C.warning, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.lg, gap: SPACING.sm },
        paywallText: { color: C.warning, fontSize: FONTS.sizes.sm, flex: 1, fontWeight: '600' },

        planCard: {
            backgroundColor: C.surface, borderRadius: RADIUS.lg, padding: SPACING.lg,
            marginBottom: SPACING.md, borderWidth: 1, borderColor: C.border,
            ...SHADOWS.md, overflow: 'visible',
        },
        popularBadge: { position: 'absolute', top: -10, alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 3, borderRadius: 10 },
        popularText: { color: C.white, fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
        activeBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginBottom: SPACING.sm },
        activeText: { fontSize: 10, fontWeight: 'bold' },

        planHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.lg },
        planIconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
        planName: { color: C.white, fontSize: FONTS.sizes.lg, fontWeight: 'bold' },
        planPrice: { fontSize: 22, fontWeight: 'bold' },
        planPeriod: { color: C.textMuted, fontSize: 13, marginLeft: 4 },

        featureList: { marginBottom: SPACING.lg },
        featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm, gap: SPACING.sm },
        featureText: { color: C.textSecondary, fontSize: FONTS.sizes.sm, flex: 1 },
        featureUnavailable: { color: C.textMuted, textDecorationLine: 'line-through' },

        selectBtn: { paddingVertical: SPACING.md, borderRadius: RADIUS.md, alignItems: 'center' },
        selectText: { color: C.white, fontWeight: 'bold', fontSize: FONTS.sizes.md },

        restoreBtn: { alignItems: 'center', paddingVertical: SPACING.md },
        restoreText: { color: C.primary, fontSize: FONTS.sizes.sm, fontWeight: '600' },
        legalText: { color: C.textMuted, fontSize: 10, textAlign: 'center', lineHeight: 16, paddingHorizontal: SPACING.md },

        addonCard: {
            flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface,
            borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: C.border,
            marginBottom: SPACING.md
        },
        addonTitle: { color: C.white, fontSize: FONTS.sizes.md, fontWeight: 'bold' },
        addonDesc: { color: C.textSecondary, fontSize: FONTS.sizes.sm, marginTop: 4, paddingRight: 8 },
        addonPrice: { color: C.primary, fontSize: FONTS.sizes.md, fontWeight: 'bold' },
        addonPeriod: { color: C.textMuted, fontSize: FONTS.sizes.xs },
    });
}

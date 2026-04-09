import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    Alert, Platform, ActivityIndicator
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Icon from '@expo/vector-icons/Feather';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../../core/theme';
import { useAppStore } from '../../../store/appStore';
import { PLAN_PRICES, ADDON_PRICES, PlanTier } from '../../../core/constants/plans';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useStripe } from '@stripe/stripe-react-native';

// ─── Contenido por plan ─────────────────────────────────────────────────────
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

const PLAN_ACCENT: Record<PlanTier, string> = {
    free: COLORS.textMuted,
    premium: COLORS.primary,
    enterprise: '#F39C12',
};

const PLAN_ICONS: Record<PlanTier, keyof typeof Icon.glyphMap> = {
    free: 'user',
    premium: 'star',
    enterprise: 'zap',
};

// ─── Componente ──────────────────────────────────────────────────────────────
interface Props {
    /** Si viene del paywall (límite alcanzado) mostrar mensaje de bloqueo */
    paywallMessage?: string;
}

export default function SubscriptionScreen({ paywallMessage }: Props) {
    const insets = useSafeAreaInsets();
    const navigation = useNavigation<any>();
    const { user } = useAppStore();
    const [loading, setLoading] = useState<PlanTier | null>(null);
    const currentPlan = (user?.plan as PlanTier) || 'free';

    const { initPaymentSheet, presentPaymentSheet } = useStripe();

    /** 
     * Inicia la compra a través de Stripe PaymentSheet.
     */
    const handleSelectPlan = async (plan: PlanTier) => {
        if (plan === currentPlan) return;
        if (plan === 'free') {
            Alert.alert('Plan Gratis', 'Para bajar al plan gratuito contacta soporte en support@obratrack.co');
            return;
        }

        setLoading(plan);
        try {
            if (Platform.OS === 'android' || Platform.OS === 'ios') {
                // IMPORTANTE: Para este prototipo simulamos la creación del PaymentIntent
                // directamente desde el cliente con la secret key. ¡Esto NO debe ir a producción!
                // En producción, llamar a Firebase Cloud Functions aquí.
                
                // Mapeo básico de precios a centavos USD (o COP) para la prueba.
                const amountStr = PLAN_PRICES[plan].price.replace(/[^0-9]/g, '');
                const amountInt = parseInt(amountStr, 10);
                
                // Stripe requiere el amount en la unidad más pequeña. Usamos COP.
                const response = await fetch('https://api.stripe.com/v1/payment_intents', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${process.env.EXPO_PUBLIC_STRIPE_SECRET_KEY || 'sk_test_placeholder'}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: `amount=${amountInt}&currency=cop`
                });

                const data = await response.json();
                if (!data.client_secret) {
                    throw new Error('Error al crear PaymentIntent: ' + (data.error?.message || 'Error desconocido'));
                }

                // 2. Inicializar la hoja de pagos
                const { error: initError } = await initPaymentSheet({
                    merchantDisplayName: 'ObraTrack',
                    paymentIntentClientSecret: data.client_secret,
                });

                if (initError) throw new Error(initError.message);

                // 3. Presentar la hoja
                const { error: presentError } = await presentPaymentSheet();
                if (presentError) throw new Error(presentError.message);

                // 4. Éxito: actualiza en Firestore
                await updateDoc(doc(db, 'users', user!.id), { plan });
                useAppStore.getState().setUser({ ...user!, plan });
                Alert.alert('✅ ¡Pago Exitoso!', `Tu plan ${PLAN_PRICES[plan].label} ha sido activado correctamente mediante Stripe.`);
                navigation.goBack();
            } else {
                // Web
                Alert.alert(
                    'Suscripción Web',
                    `Para activar el plan ${PLAN_PRICES[plan].label} desde web, visita:\nhttps://obratrack.co/pricing\n\no contáctanos: support@obratrack.co`
                );
            }
        } catch (error: any) {
            Alert.alert('Error', 'No se pudo procesar el pago: ' + error.message);
        } finally {
            setLoading(null);
        }
    };

    const renderPlan = (tier: PlanTier) => {
        const price = PLAN_PRICES[tier];
        const features = PLAN_FEATURES[tier];
        const accent = PLAN_ACCENT[tier];
        const isActive = currentPlan === tier;
        const isPopular = tier === 'premium';

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
                                color={f.available ? COLORS.success : COLORS.textMuted}
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
                    {loading === tier ? (
                        <ActivityIndicator size="small" color={COLORS.white} />
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
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : null} style={styles.backBtn}>
                    <Icon name="arrow-left" size={24} color={COLORS.white} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Planes ObraTrack</Text>
            </View>

            <ScrollView contentContainerStyle={{ padding: SPACING.md, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
                {/* Paywall message */}
                {paywallMessage && (
                    <View style={styles.paywallBanner}>
                        <Icon name="lock" size={18} color={COLORS.warning} />
                        <Text style={styles.paywallText}>{paywallMessage}</Text>
                    </View>
                )}

                <Text style={styles.subtitle}>
                    Elige el plan que mejor se adapte a tu empresa.{'\n'}
                    Pagos seguros a través de Google Play Store.
                </Text>

                {(['free', 'premium', 'enterprise'] as PlanTier[]).map(renderPlan)}

                {/* ── Add-ons ── */}
                <View style={{ marginTop: SPACING.md, marginBottom: SPACING.md }}>
                    <Text style={[styles.headerTitle, { marginBottom: SPACING.xs }]}>Add-ons Disponibles</Text>
                    <Text style={[styles.subtitle, { textAlign: 'left', marginBottom: SPACING.md }]}>Amplía los límites de tu plan comprando cupos adicionales.</Text>
                    
                    <View style={styles.addonCard}>
                        <View style={[styles.planIconCircle, { backgroundColor: COLORS.primary + '20', width: 40, height: 40, marginRight: SPACING.md }]}>
                            <Icon name="user-plus" size={20} color={COLORS.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.addonTitle}>{ADDON_PRICES.EXTRA_USER.label}</Text>
                            <Text style={styles.addonDesc}>Cupo para rol operativo o administrativo.</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={styles.addonPrice}>{ADDON_PRICES.EXTRA_USER.price}</Text>
                            <Text style={styles.addonPeriod}>/mes</Text>
                        </View>
                    </View>

                    <View style={styles.addonCard}>
                        <View style={[styles.planIconCircle, { backgroundColor: COLORS.primary + '20', width: 40, height: 40, marginRight: SPACING.md }]}>
                            <Icon name="briefcase" size={20} color={COLORS.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.addonTitle}>{ADDON_PRICES.EXTRA_PROJECT.label}</Text>
                            <Text style={styles.addonDesc}>Obra adicional con control separado.</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={styles.addonPrice}>{ADDON_PRICES.EXTRA_PROJECT.price}</Text>
                            <Text style={styles.addonPeriod}>/mes</Text>
                        </View>
                    </View>
                </View>

                {/* Restore / Contact */}
                <TouchableOpacity style={styles.restoreBtn}>
                    <Text style={styles.restoreText}>Restaurar compra existente</Text>
                </TouchableOpacity>
                <Text style={styles.legalText}>
                    Los precios están en COP e incluyen IVA. La suscripción se renueva automáticamente
                    a través de Google Play. Puedes cancelar desde la app de Play Store en cualquier momento.
                </Text>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    backBtn: { marginRight: SPACING.md },
    headerTitle: { color: COLORS.white, fontSize: FONTS.sizes.lg, fontWeight: 'bold' },

    subtitle: { color: COLORS.textSecondary, textAlign: 'center', fontSize: FONTS.sizes.sm, lineHeight: 22, marginBottom: SPACING.lg, marginTop: SPACING.sm },

    paywallBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.warning + '20', borderWidth: 1, borderColor: COLORS.warning, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.lg, gap: SPACING.sm },
    paywallText: { color: COLORS.warning, fontSize: FONTS.sizes.sm, flex: 1, fontWeight: '600' },

    planCard: {
        backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.lg,
        marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
        ...SHADOWS.md, overflow: 'visible',
    },
    popularBadge: { position: 'absolute', top: -10, alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 3, borderRadius: 10 },
    popularText: { color: COLORS.white, fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
    activeBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginBottom: SPACING.sm },
    activeText: { fontSize: 10, fontWeight: 'bold' },

    planHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.lg },
    planIconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
    planName: { color: COLORS.white, fontSize: FONTS.sizes.lg, fontWeight: 'bold' },
    planPrice: { fontSize: 22, fontWeight: 'bold' },
    planPeriod: { color: COLORS.textMuted, fontSize: 13, marginLeft: 4 },

    featureList: { marginBottom: SPACING.lg },
    featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm, gap: SPACING.sm },
    featureText: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm, flex: 1 },
    featureUnavailable: { color: COLORS.textMuted, textDecorationLine: 'line-through' },

    selectBtn: { paddingVertical: SPACING.md, borderRadius: RADIUS.md, alignItems: 'center' },
    selectText: { color: COLORS.white, fontWeight: 'bold', fontSize: FONTS.sizes.md },

    restoreBtn: { alignItems: 'center', paddingVertical: SPACING.md },
    restoreText: { color: COLORS.primary, fontSize: FONTS.sizes.sm, fontWeight: '600' },
    legalText: { color: COLORS.textMuted, fontSize: 10, textAlign: 'center', lineHeight: 16, paddingHorizontal: SPACING.md },

    addonCard: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
        borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
        marginBottom: SPACING.md
    },
    addonTitle: { color: COLORS.white, fontSize: FONTS.sizes.md, fontWeight: 'bold' },
    addonDesc: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm, marginTop: 4, paddingRight: 8 },
    addonPrice: { color: COLORS.primary, fontSize: FONTS.sizes.md, fontWeight: 'bold' },
    addonPeriod: { color: COLORS.textMuted, fontSize: FONTS.sizes.xs },
});

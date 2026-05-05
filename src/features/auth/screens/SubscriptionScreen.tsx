import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    Alert, Platform, ActivityIndicator
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Icon from '@expo/vector-icons/Feather';
import RNIap, {
    initConnection,
    endConnection,
    getSubscriptions,
    requestSubscription,
    restorePurchases,
    purchaseUpdatedListener,
    purchaseErrorListener,
    finishTransaction,
    type SubscriptionPurchase,
    type PurchaseError,
} from 'react-native-iap';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAppStore } from '../../../store/appStore';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../../core/theme';
import { PLAN_PRICES, ADDON_PRICES, PLAY_STORE_PRODUCT_IDS, PlanTier } from '../../../core/constants/plans';

// ─── IDs de producto en Play Store ───────────────────────────────────────────
const SUBSCRIPTION_IDS = Object.values(PLAY_STORE_PRODUCT_IDS);

// Add-on one-time product IDs (configurar en Google Play Console)
const ADDON_PRODUCT_IDS = {
    EXTRA_USER: 'obratrack_addon_extra_user',
    EXTRA_PROJECT: 'obratrack_addon_extra_project',
};

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

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function activatePlanInFirestore(userId: string, plan: PlanTier) {
    await updateDoc(doc(db, 'users', userId), { plan });
    useAppStore.getState().setUser({ ...useAppStore.getState().user!, plan });
}

// ─── Componente ──────────────────────────────────────────────────────────────
interface Props {
    paywallMessage?: string;
}

export default function SubscriptionScreen({ paywallMessage }: Props) {
    const insets = useSafeAreaInsets();
    const navigation = useNavigation<any>();
    const { user } = useAppStore();
    const [loading, setLoading] = useState<string | null>(null);
    const currentPlan = (user?.plan as PlanTier) || 'free';

    // ─── Inicializar IAP y listeners al montar ────────────────────────────────
    useEffect(() => {
        if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;

        let purchaseUpdateSub: ReturnType<typeof purchaseUpdatedListener>;
        let purchaseErrorSub: ReturnType<typeof purchaseErrorListener>;

        const setup = async () => {
            try {
                await initConnection();

                purchaseUpdateSub = purchaseUpdatedListener(async (purchase: SubscriptionPurchase) => {
                    const receipt = purchase.transactionReceipt;
                    if (!receipt || !user) return;

                    // Determinar qué plan se compró según el productId
                    const boughtPlan = (Object.entries(PLAY_STORE_PRODUCT_IDS) as [PlanTier, string][])
                        .find(([, id]) => id === purchase.productId)?.[0];

                    if (boughtPlan) {
                        await activatePlanInFirestore(user.id, boughtPlan);
                        await finishTransaction({ purchase, isConsumable: false });
                        Alert.alert(
                            '¡Suscripción activada!',
                            `Tu plan ${PLAN_PRICES[boughtPlan].label} está activo. ¡Bienvenido!`
                        );
                        navigation.goBack();
                    }
                    setLoading(null);
                });

                purchaseErrorSub = purchaseErrorListener((error: PurchaseError) => {
                    if (error.code !== 'E_USER_CANCELLED') {
                        Alert.alert('Error de compra', error.message || 'No se pudo procesar la suscripción.');
                    }
                    setLoading(null);
                });
            } catch (e) {
                console.error('IAP init error:', e);
            }
        };

        setup();

        return () => {
            purchaseUpdateSub?.remove();
            purchaseErrorSub?.remove();
            endConnection();
        };
    }, [user]);

    // ─── Comprar suscripción ──────────────────────────────────────────────────
    const handleSelectPlan = async (plan: PlanTier) => {
        if (plan === currentPlan) return;

        if (plan === 'free') {
            Alert.alert(
                'Cambio de plan',
                'Para bajar al plan gratuito, cancela tu suscripción desde la app de Google Play Store y contacta soporte en soporte@zafiadom.com si necesitas ayuda.'
            );
            return;
        }

        if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
            Alert.alert(
                'Suscripción',
                `Para activar el plan ${PLAN_PRICES[plan].label} desde web, contacta:\nsoporte@zafiadom.com`
            );
            return;
        }

        const productId = PLAY_STORE_PRODUCT_IDS[plan];
        setLoading(productId);

        try {
            // Verificar que el producto existe en Play Console antes de comprar
            const products = await getSubscriptions({ skus: [productId] });
            if (!products.length) {
                throw new Error('Producto no disponible en este momento. Intenta más tarde.');
            }

            await requestSubscription({ sku: productId });
            // El resultado llega por purchaseUpdatedListener
        } catch (error: any) {
            if (error.code !== 'E_USER_CANCELLED') {
                Alert.alert('Error', error.message || 'No se pudo iniciar la suscripción.');
            }
            setLoading(null);
        }
    };

    // ─── Comprar add-on ───────────────────────────────────────────────────────
    const handleBuyAddon = async (addonId: string, addonName: string) => {
        if (currentPlan === 'free') {
            Alert.alert('Plan requerido', 'Los add-ons están disponibles solo para planes Premium o Enterprise.');
            return;
        }

        if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
            Alert.alert('Add-on', `Para adquirir "${addonName}", contacta: soporte@zafiadom.com`);
            return;
        }

        setLoading(addonId);
        try {
            await requestSubscription({ sku: addonId });
        } catch (error: any) {
            if (error.code !== 'E_USER_CANCELLED') {
                Alert.alert('Error', error.message || 'No se pudo procesar el add-on.');
            }
            setLoading(null);
        }
    };

    // ─── Restaurar compras ────────────────────────────────────────────────────
    const handleRestorePurchases = async () => {
        if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;

        setLoading('restore');
        try {
            const purchases = await restorePurchases();
            if (!purchases.length || !user) {
                Alert.alert('Restaurar compra', 'No se encontraron compras anteriores para esta cuenta.');
                setLoading(null);
                return;
            }

            // Buscar la compra activa más reciente que corresponda a un plan
            let restoredPlan: PlanTier | null = null;
            for (const purchase of purchases) {
                const match = (Object.entries(PLAY_STORE_PRODUCT_IDS) as [PlanTier, string][])
                    .find(([, id]) => id === purchase.productId);
                if (match) {
                    restoredPlan = match[0];
                    await finishTransaction({ purchase, isConsumable: false });
                    break;
                }
            }

            if (restoredPlan) {
                await activatePlanInFirestore(user.id, restoredPlan);
                Alert.alert('¡Compra restaurada!', `Tu plan ${PLAN_PRICES[restoredPlan].label} ha sido restaurado.`);
            } else {
                Alert.alert('Restaurar compra', 'No se encontraron suscripciones activas para restaurar.');
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'No se pudo restaurar la compra.');
        } finally {
            setLoading(null);
        }
    };

    // ─── Render plan card ─────────────────────────────────────────────────────
    const renderPlan = (tier: PlanTier) => {
        const price = PLAN_PRICES[tier];
        const features = PLAN_FEATURES[tier];
        const accent = PLAN_ACCENT[tier];
        const isActive = currentPlan === tier;
        const isPopular = tier === 'premium';
        const productId = tier !== 'free' ? PLAY_STORE_PRODUCT_IDS[tier] : null;
        const isLoading = productId ? loading === productId : false;

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
                    {isLoading ? (
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
                <TouchableOpacity
                    onPress={() => navigation.canGoBack() ? navigation.goBack() : null}
                    style={styles.backBtn}
                >
                    <Icon name="arrow-left" size={24} color={COLORS.white} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Planes ObraTrack</Text>
            </View>

            <ScrollView
                contentContainerStyle={{ padding: SPACING.md, paddingBottom: 60 }}
                showsVerticalScrollIndicator={false}
            >
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
                    <Text style={[styles.subtitle, { textAlign: 'left', marginBottom: SPACING.md }]}>
                        Amplía los límites de tu plan comprando cupos adicionales.
                    </Text>

                    <TouchableOpacity
                        style={styles.addonCard}
                        onPress={() => handleBuyAddon(ADDON_PRODUCT_IDS.EXTRA_USER, ADDON_PRICES.EXTRA_USER.label)}
                        disabled={loading !== null}
                    >
                        <View style={[styles.planIconCircle, { backgroundColor: COLORS.primary + '20', width: 40, height: 40, marginRight: SPACING.md }]}>
                            <Icon name="user-plus" size={20} color={COLORS.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.addonTitle}>{ADDON_PRICES.EXTRA_USER.label}</Text>
                            <Text style={styles.addonDesc}>Cupo para rol operativo o administrativo.</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            {loading === ADDON_PRODUCT_IDS.EXTRA_USER ? (
                                <ActivityIndicator size="small" color={COLORS.primary} />
                            ) : (
                                <>
                                    <Text style={styles.addonPrice}>{ADDON_PRICES.EXTRA_USER.price}</Text>
                                    <Text style={styles.addonPeriod}>/mes</Text>
                                </>
                            )}
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.addonCard}
                        onPress={() => handleBuyAddon(ADDON_PRODUCT_IDS.EXTRA_PROJECT, ADDON_PRICES.EXTRA_PROJECT.label)}
                        disabled={loading !== null}
                    >
                        <View style={[styles.planIconCircle, { backgroundColor: COLORS.primary + '20', width: 40, height: 40, marginRight: SPACING.md }]}>
                            <Icon name="briefcase" size={20} color={COLORS.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.addonTitle}>{ADDON_PRICES.EXTRA_PROJECT.label}</Text>
                            <Text style={styles.addonDesc}>Obra adicional con control separado.</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            {loading === ADDON_PRODUCT_IDS.EXTRA_PROJECT ? (
                                <ActivityIndicator size="small" color={COLORS.primary} />
                            ) : (
                                <>
                                    <Text style={styles.addonPrice}>{ADDON_PRICES.EXTRA_PROJECT.price}</Text>
                                    <Text style={styles.addonPeriod}>/mes</Text>
                                </>
                            )}
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Restore / Legal */}
                <TouchableOpacity
                    style={styles.restoreBtn}
                    onPress={handleRestorePurchases}
                    disabled={loading !== null}
                >
                    {loading === 'restore' ? (
                        <ActivityIndicator size="small" color={COLORS.primary} />
                    ) : (
                        <Text style={styles.restoreText}>Restaurar compra existente</Text>
                    )}
                </TouchableOpacity>

                <Text style={styles.legalText}>
                    Los precios están en COP e incluyen IVA. La suscripción se renueva automáticamente
                    a través de Google Play. Puedes cancelar desde la app de Play Store en cualquier momento.
                    Soporte: soporte@zafiadom.com
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

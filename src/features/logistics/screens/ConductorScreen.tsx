import React, { useState } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, Modal,
    ScrollView, Alert, Platform, Image
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useLogisticsStore, Shipment, ConductorStatus } from '../../logistics/store/logisticsStore';
import { useAppStore } from '../../../store/appStore';
import Icon from '@expo/vector-icons/Feather';
import { FONTS, SPACING, RADIUS, SHADOWS } from '../../../core/theme';
import { useColors, ThemeColors } from '../../../core/theme/ThemeContext';
import { useT } from '../../../core/i18n';
import WelcomeGuide from '../../../components/WelcomeGuide';

function showAlert(title: string, msg: string) {
    if (Platform.OS === 'web') window.alert(`${title}: ${msg}`);
    else Alert.alert(title, msg);
}

export default function ConductorScreen() {
    const insets = useSafeAreaInsets();
    const C = useColors();
    const t = useT();
    const styles = React.useMemo(() => makeStyles(C), [C]);

    const STATUS_META = React.useMemo<Record<ConductorStatus, { label: string; color: string; icon: string }>>(() => ({
        pendiente: { label: t.tripStatusPendingAccept, color: '#f59e0b', icon: 'clock' },
        aceptado: { label: t.tripStatusAccepted, color: C.primary, icon: 'check-circle' },
        en_camino: { label: t.tripStatusOnWay, color: '#8b5cf6', icon: 'navigation' },
        finalizado: { label: t.tripStatusFinished, color: C.success, icon: 'flag' },
    }), [C, t]);

    const navigation = useNavigation<any>();
    const user = useAppStore(s => s.user);
    const logout = useAppStore(s => s.logout);
    const [avatarUri, setAvatarUri] = useState<string | null>(null);

    useFocusEffect(
        React.useCallback(() => {
            if (!user) return;
            AsyncStorage.getItem(`obratrack_avatar_${user.id}`).then(uri => {
                setAvatarUri(uri ?? null);
            });
        }, [user?.id])
    );
    const shipments = useLogisticsStore(s => s.shipments);
    const { acceptShipment, completeShipment } = useLogisticsStore();

    const [activeTrip, setActiveTrip] = useState<Shipment | null>(null);
    const [photos, setPhotos] = useState<string[]>([]);
    const [completing, setCompleting] = useState(false);
    const [showCompletionModal, setShowCompletionModal] = useState(false);
    const [activeTab, setActiveTab] = useState<'pending' | 'active' | 'finished'>('pending');

    const myTrips = shipments; // already filtered by conductorId in the store

    const pending = myTrips.filter(s => s.conductorStatus === 'pendiente');
    const active = myTrips.filter(s => s.conductorStatus === 'aceptado' || s.conductorStatus === 'en_camino');
    const finished = myTrips.filter(s => s.conductorStatus === 'finalizado');

    const pickPhoto = async () => {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { showAlert(t.permissionDenied, t.galleryPermission); return; }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true, quality: 0.6,
        });
        if (!result.canceled && result.assets?.[0]) {
            setPhotos(prev => [...prev, result.assets[0].uri]);
        }
    };

    const takePhoto = async () => {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { showAlert(t.permissionDenied, t.cameraPermission); return; }
        const result = await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: true });
        if (!result.canceled && result.assets?.[0]) {
            setPhotos(prev => [...prev, result.assets[0].uri]);
        }
    };

    const handleAccept = (trip: Shipment) => {
        const doAccept = async () => {
            await acceptShipment(trip.id, user?.companyId || 'default-company');
            showAlert(t.success, t.tripAcceptedSuccess);
        };
        if (Platform.OS === 'web') {
            if (window.confirm(t.acceptTripConfirm(trip.origen, trip.destino))) doAccept();
        } else {
            Alert.alert(t.acceptTripTitle, t.acceptTripConfirm(trip.origen, trip.destino), [
                { text: t.cancel, style: 'cancel' },
                { text: t.accept, onPress: doAccept },
            ]);
        }
    };

    const openCompletion = (trip: Shipment) => {
        setActiveTrip(trip);
        setPhotos([]);
        setShowCompletionModal(true);
    };

    const handleComplete = async () => {
        if (!activeTrip) return;
        setCompleting(true);
        try {
            let locationData = undefined;
            try {
                let { status: permStatus } = await Location.requestForegroundPermissionsAsync();
                if (permStatus === 'granted') {
                    let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                    locationData = { lat: location.coords.latitude, lng: location.coords.longitude };
                }
            } catch (e) {
                console.log('Location error during completion:', e);
            }

            await completeShipment(activeTrip.id, user?.companyId || 'default-company', photos, locationData);
            setShowCompletionModal(false);
            setActiveTrip(null);
            setPhotos([]);
            showAlert(t.tripCompletedSuccess, t.tripCompletedMsg);
        } catch (e) {
            showAlert(t.error, t.tripCompleteError);
        } finally {
            setCompleting(false);
        }
    };

    const handleLogout = () => {
        if (Platform.OS === 'web') {
            if (window.confirm(t.signOutConfirmTitle)) logout();
        } else {
            Alert.alert(t.signOutConfirmTitle, t.signOutConfirmMsg, [
                { text: t.cancel, style: 'cancel' },
                { text: t.exitLabel, style: 'destructive', onPress: () => logout() },
            ]);
        }
    };

    const renderTripCard = ({ item }: { item: Shipment }, showActions = false) => {
        const meta = STATUS_META[item.conductorStatus];
        return (
            <TouchableOpacity
                style={styles.card}
                onPress={() => showActions ? openCompletion(item) : setActiveTrip(item)}
                activeOpacity={0.85}
            >
                <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.cardRoute} numberOfLines={1}>
                            {item.origen} → {item.destino}
                        </Text>
                        <Text style={styles.cardPlate}>🚛 {item.placaCamion}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: meta.color + '22', borderColor: meta.color + '44' }]}>
                        <Icon name={meta.icon as any} size={12} color={meta.color} />
                        <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                </View>

                <View style={styles.cardBody}>
                    <View style={styles.infoRow}>
                        <Icon name="calendar" size={14} color={C.textMuted} />
                        <Text style={styles.infoText}>
                            Salida: {new Date(item.fechaSalida).toLocaleDateString('es-CO')}
                        </Text>
                        <Text style={styles.infoText}> · Est.: {new Date(item.fechaEstimada).toLocaleDateString('es-CO')}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Icon name="package" size={14} color={C.textMuted} />
                        <Text style={styles.infoText}>{item.materiales.length} ítem(s)</Text>
                    </View>
                    {item.observaciones ? (
                        <Text style={styles.obs} numberOfLines={2}>📝 {item.observaciones}</Text>
                    ) : null}
                </View>

                {item.conductorStatus === 'pendiente' && (
                    <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(item)}>
                        <Icon name="check" size={18} color={C.white} />
                        <Text style={styles.acceptBtnText}>{t.acceptTrip}</Text>
                    </TouchableOpacity>
                )}

                {(item.conductorStatus === 'aceptado' || item.conductorStatus === 'en_camino') && (
                    <TouchableOpacity style={styles.completeBtn} onPress={() => openCompletion(item)}>
                        <Icon name="flag" size={18} color={C.white} />
                        <Text style={styles.completeBtnText}>{t.completeWithPhotos}</Text>
                    </TouchableOpacity>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <WelcomeGuide userId={user?.id || ''} role={user?.role || 'conductor'} />
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.navigate('Profile')} activeOpacity={0.85} style={{ marginRight: SPACING.md }}>
                    {avatarUri ? (
                        <Image source={{ uri: avatarUri }} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: C.primary }} />
                    ) : (
                        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ color: C.white, fontWeight: 'bold', fontSize: 16 }}>
                                {(user?.nombre ?? 'U').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{t.myTrips}</Text>
                    <Text style={styles.subtitle}>{t.helloDriver(user?.nombre?.split(' ')[0] ?? '')}</Text>
                </View>
                <View style={styles.statRow}>
                    <View style={styles.stat}>
                        <Text style={styles.statNum}>{pending.length}</Text>
                        <Text style={styles.statLabel}>{t.pending}</Text>
                    </View>
                    <View style={styles.stat}>
                        <Text style={[styles.statNum, { color: C.primary }]}>{active.length}</Text>
                        <Text style={styles.statLabel}>{t.active}</Text>
                    </View>
                    <View style={styles.stat}>
                        <Text style={[styles.statNum, { color: C.success }]}>{finished.length}</Text>
                        <Text style={styles.statLabel}>{t.finished}</Text>
                    </View>
                </View>
            </View>

            {/* TABS */}
            <View style={styles.tabsContainer}>
                <TouchableOpacity
                    style={[styles.tabBtn, activeTab === 'pending' && styles.tabBtnActive]}
                    onPress={() => setActiveTab('pending')}
                >
                    <Icon name="clock" size={16} color={activeTab === 'pending' ? C.white : C.textMuted} style={{ marginRight: 6 }} />
                    <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>{t.pending}</Text>
                    {pending.length > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{pending.length}</Text>
                        </View>
                    )}
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tabBtn, activeTab === 'active' && styles.tabBtnActive]}
                    onPress={() => setActiveTab('active')}
                >
                    <Icon name="truck" size={16} color={activeTab === 'active' ? C.white : C.textMuted} style={{ marginRight: 6 }} />
                    <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>{t.active}</Text>
                    {active.length > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{active.length}</Text>
                        </View>
                    )}
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tabBtn, activeTab === 'finished' && styles.tabBtnActive]}
                    onPress={() => setActiveTab('finished')}
                >
                    <Icon name="check-circle" size={16} color={activeTab === 'finished' ? C.white : C.textMuted} style={{ marginRight: 6 }} />
                    <Text style={[styles.tabText, activeTab === 'finished' && styles.tabTextActive]}>{t.finished}</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: SPACING.md, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                {/* Pending Trips */}
                {activeTab === 'pending' && pending.length > 0 && (
                    <View>
                        {pending.map(t => <View key={t.id}>{renderTripCard({ item: t })}</View>)}
                    </View>
                )}
                {activeTab === 'pending' && pending.length === 0 && (
                    <View style={styles.empty}>
                        <Icon name="inbox" size={48} color={C.textMuted} />
                        <Text style={styles.emptyTitle}>{t.noPendingTrips}</Text>
                        <Text style={styles.emptyHint}>{t.noPendingTripsDesc}</Text>
                    </View>
                )}

                {/* Active Trips */}
                {activeTab === 'active' && active.length > 0 && (
                    <View>
                        {active.map(t => <View key={t.id}>{renderTripCard({ item: t }, true)}</View>)}
                    </View>
                )}
                {activeTab === 'active' && active.length === 0 && (
                    <View style={styles.empty}>
                        <Icon name="truck" size={48} color={C.textMuted} />
                        <Text style={styles.emptyTitle}>{t.noActiveTrips}</Text>
                        <Text style={styles.emptyHint}>{t.noActiveTripsDesc}</Text>
                    </View>
                )}

                {/* Finished */}
                {activeTab === 'finished' && finished.length > 0 && (
                    <View>
                        {finished.map(t => <View key={t.id}>{renderTripCard({ item: t })}</View>)}
                    </View>
                )}
                {activeTab === 'finished' && finished.length === 0 && (
                    <View style={styles.empty}>
                        <Icon name="check-square" size={48} color={C.textMuted} />
                        <Text style={styles.emptyTitle}>{t.noFinishedTrips}</Text>
                        <Text style={styles.emptyHint}>{t.noFinishedTripsDesc}</Text>
                    </View>
                )}
            </ScrollView>

            {/* Floating logout button — bottom right, above system nav */}
            <TouchableOpacity style={[styles.logoutFab, { bottom: insets.bottom + 20 }]} onPress={handleLogout}>
                <Icon name="log-out" size={18} color={C.danger} />
                <Text style={styles.logoutFabText}>{t.exitLabel}</Text>
            </TouchableOpacity>

            {/* ── Completion Modal ─────────────────────────────────────────────── */}
            <Modal visible={showCompletionModal} animationType="slide" transparent onRequestClose={() => setShowCompletionModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalSheet}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{t.finalizeTrip}</Text>
                            <TouchableOpacity onPress={() => setShowCompletionModal(false)}>
                                <Icon name="x" size={24} color={C.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        {activeTrip && (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View style={styles.tripSummary}>
                                    <Text style={styles.summaryRoute}>{activeTrip.origen} → {activeTrip.destino}</Text>
                                    <Text style={styles.summaryPlate}>Placa: {activeTrip.placaCamion}</Text>
                                    <View style={{ marginTop: SPACING.md }}>
                                        {activeTrip.materiales.map((m, i) => (
                                            <Text key={i} style={styles.materialRow}>
                                                • {m.nombre} — {m.cantidad} {m.unidad}
                                            </Text>
                                        ))}
                                    </View>
                                </View>

                                {/* Photo Section */}
                                <Text style={styles.inputLabel}>{t.deliveryPhotosLabel}</Text>
                                <View style={styles.photoActions}>
                                    <TouchableOpacity style={styles.photoBtn} onPress={takePhoto}>
                                        <Icon name="camera" size={20} color={C.primary} />
                                        <Text style={styles.photoBtnText}>{t.camera}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.photoBtn} onPress={pickPhoto}>
                                        <Icon name="image" size={20} color={C.primary} />
                                        <Text style={styles.photoBtnText}>{t.gallery}</Text>
                                    </TouchableOpacity>
                                </View>

                                {photos.length > 0 && (
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.lg }}>
                                        {photos.map((uri, i) => (
                                            <View key={i} style={{ marginRight: 8, position: 'relative' }}>
                                                <Image source={{ uri }} style={styles.thumbPhoto} />
                                                <TouchableOpacity
                                                    style={styles.removePhoto}
                                                    onPress={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}
                                                >
                                                    <Icon name="x" size={12} color={C.white} />
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                    </ScrollView>
                                )}

                                <TouchableOpacity
                                    style={[styles.finishBtn, completing && { opacity: 0.6 }]}
                                    onPress={handleComplete}
                                    disabled={completing}
                                >
                                    <Icon name="flag" size={20} color={C.white} />
                                    <Text style={styles.finishBtnText}>
                                        {completing ? t.finalizing : t.confirmDelivery}
                                    </Text>
                                </TouchableOpacity>
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

function makeStyles(C: ThemeColors) {
    return StyleSheet.create({
        container: { flex: 1, backgroundColor: C.background },

        header: { padding: SPACING.lg, paddingBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.surface, flexDirection: 'row', alignItems: 'center' },
        logoutFab: { position: 'absolute', bottom: 24, right: 20, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.surface, borderWidth: 1, borderColor: C.danger + '55', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, ...SHADOWS.md },
        logoutFabText: { color: C.danger, fontWeight: 'bold', fontSize: 13 },
        title: { color: C.white, fontSize: FONTS.sizes.xl, fontWeight: '900' },
        subtitle: { color: C.textMuted, fontSize: FONTS.sizes.sm, marginBottom: SPACING.md },
        statRow: { flexDirection: 'row', gap: SPACING.lg },
        stat: { alignItems: 'center' },
        statNum: { color: '#f59e0b', fontSize: 22, fontWeight: '900' },
        statLabel: { color: C.textMuted, fontSize: 11 },

        sectionTitle: { color: C.textSecondary, fontSize: FONTS.sizes.sm, fontWeight: '700', marginBottom: SPACING.sm, marginTop: SPACING.md, textTransform: 'uppercase', letterSpacing: 1 },

        tabsContainer: { flexDirection: 'row', backgroundColor: C.surface, padding: SPACING.xs, marginHorizontal: SPACING.md, borderRadius: RADIUS.md },
        tabBtn: { flex: 1, flexDirection: 'row', paddingVertical: SPACING.sm, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.sm },
        tabBtnActive: { backgroundColor: C.primary },
        tabText: { color: C.textMuted, fontSize: 12, fontWeight: 'bold' },
        tabTextActive: { color: C.white },
        badge: { backgroundColor: C.danger, borderRadius: 10, paddingHorizontal: 5, paddingVertical: 1, marginLeft: 6, justifyContent: 'center', alignItems: 'center' },
        badgeText: { color: C.white, fontSize: 9, fontWeight: 'bold' },

        card: { backgroundColor: C.surface, borderRadius: RADIUS.md, marginBottom: SPACING.md, overflow: 'hidden', ...SHADOWS.sm },
        cardHeader: { flexDirection: 'row', alignItems: 'flex-start', padding: SPACING.md, paddingBottom: SPACING.sm },
        cardRoute: { color: C.white, fontSize: FONTS.sizes.md, fontWeight: 'bold' },
        cardPlate: { color: C.textSecondary, fontSize: FONTS.sizes.sm, marginTop: 2 },
        statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1, gap: 4 },
        statusText: { fontSize: 11, fontWeight: '700' },

        cardBody: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.md },
        infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
        infoText: { color: C.textMuted, fontSize: 12 },
        obs: { color: C.textSecondary, fontSize: 12, marginTop: 4, fontStyle: 'italic' },

        acceptBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.success, padding: SPACING.md, gap: 8 },
        acceptBtnText: { color: C.white, fontWeight: 'bold', fontSize: 15 },
        completeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.primary, padding: SPACING.md, gap: 8 },
        completeBtnText: { color: C.white, fontWeight: 'bold', fontSize: 15 },

        empty: { alignItems: 'center', paddingVertical: 80 },
        emptyTitle: { color: C.textSecondary, fontSize: FONTS.sizes.lg, fontWeight: 'bold', marginTop: SPACING.md },
        emptyHint: { color: C.textMuted, fontSize: FONTS.sizes.sm, marginTop: SPACING.sm, textAlign: 'center' },

        // Modal
        modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
        modalSheet: { backgroundColor: C.surface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.lg, maxHeight: '90%' },
        modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
        modalTitle: { color: C.white, fontSize: FONTS.sizes.lg, fontWeight: 'bold' },

        tripSummary: { backgroundColor: C.surfaceLight, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.lg },
        summaryRoute: { color: C.white, fontWeight: 'bold', fontSize: FONTS.sizes.md },
        summaryPlate: { color: C.textSecondary, fontSize: FONTS.sizes.sm, marginTop: 4 },
        materialRow: { color: C.textSecondary, fontSize: FONTS.sizes.sm, marginTop: 4 },

        inputLabel: { color: C.textSecondary, fontSize: FONTS.sizes.sm, fontWeight: '600', marginBottom: SPACING.sm },
        photoActions: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.md },
        photoBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: C.primary, borderRadius: RADIUS.md, paddingVertical: 12 },
        photoBtnText: { color: C.primary, fontWeight: 'bold' },
        thumbPhoto: { width: 90, height: 90, borderRadius: RADIUS.sm, resizeMode: 'cover' },
        removePhoto: { position: 'absolute', top: 4, right: 4, backgroundColor: C.danger, borderRadius: 10, width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },

        finishBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.primary, padding: SPACING.md, borderRadius: RADIUS.md, gap: 8, marginTop: SPACING.md, marginBottom: SPACING.xxl, ...SHADOWS.md },
        finishBtnText: { color: C.white, fontWeight: 'bold', fontSize: FONTS.sizes.md },
    });
}

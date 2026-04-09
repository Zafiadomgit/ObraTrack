import React, { useState } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, Modal,
    ScrollView, Alert, Platform, Image
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useLogisticsStore, Shipment, ConductorStatus } from '../../logistics/store/logisticsStore';
import { useAppStore } from '../../../store/appStore';
import Icon from '@expo/vector-icons/Feather';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../../core/theme';

const STATUS_META: Record<ConductorStatus, { label: string; color: string; icon: string }> = {
    pendiente: { label: 'Pendiente aceptar', color: '#f59e0b', icon: 'clock' },
    aceptado: { label: 'Aceptado', color: COLORS.primary, icon: 'check-circle' },
    en_camino: { label: 'En camino', color: '#8b5cf6', icon: 'navigation' },
    finalizado: { label: 'Finalizado', color: COLORS.success, icon: 'flag' },
};

function showAlert(title: string, msg: string) {
    if (Platform.OS === 'web') window.alert(`${title}: ${msg}`);
    else Alert.alert(title, msg);
}

export default function ConductorScreen() {
    const insets = useSafeAreaInsets();
    const user = useAppStore(s => s.user);
    const logout = useAppStore(s => s.logout);
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
        if (!perm.granted) { showAlert('Permiso denegado', 'Se necesita acceso a la galería.'); return; }
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
        if (!perm.granted) { showAlert('Permiso denegado', 'Se necesita acceso a la cámara.'); return; }
        const result = await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: true });
        if (!result.canceled && result.assets?.[0]) {
            setPhotos(prev => [...prev, result.assets[0].uri]);
        }
    };

    const handleAccept = (trip: Shipment) => {
        const doAccept = async () => {
            await acceptShipment(trip.id, user?.companyId || 'default-company');
            showAlert('Viaje aceptado', 'El viaje fue marcado como aceptado.');
        };
        if (Platform.OS === 'web') {
            if (window.confirm(`¿Aceptar el viaje de ${trip.origen} → ${trip.destino}?`)) doAccept();
        } else {
            Alert.alert('Aceptar viaje', `¿Confirmar viaje de ${trip.origen} → ${trip.destino}?`, [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Aceptar', onPress: doAccept },
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
            showAlert('¡Viaje finalizado!', 'El viaje fue marcado como entregado.');
        } catch (e) {
            showAlert('Error', 'No se pudo finalizar el viaje.');
        } finally {
            setCompleting(false);
        }
    };

    const handleLogout = () => {
        if (Platform.OS === 'web') {
            if (window.confirm('¿Cerrar sesión?')) logout();
        } else {
            Alert.alert('Cerrar sesión', '¿Deseas salir de tu cuenta?', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Salir', style: 'destructive', onPress: () => logout() },
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
                        <Icon name="calendar" size={14} color={COLORS.textMuted} />
                        <Text style={styles.infoText}>
                            Salida: {new Date(item.fechaSalida).toLocaleDateString('es-CO')}
                        </Text>
                        <Text style={styles.infoText}> · Est.: {new Date(item.fechaEstimada).toLocaleDateString('es-CO')}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Icon name="package" size={14} color={COLORS.textMuted} />
                        <Text style={styles.infoText}>{item.materiales.length} ítem(s)</Text>
                    </View>
                    {item.observaciones ? (
                        <Text style={styles.obs} numberOfLines={2}>📝 {item.observaciones}</Text>
                    ) : null}
                </View>

                {item.conductorStatus === 'pendiente' && (
                    <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(item)}>
                        <Icon name="check" size={18} color={COLORS.white} />
                        <Text style={styles.acceptBtnText}>Aceptar viaje</Text>
                    </TouchableOpacity>
                )}

                {(item.conductorStatus === 'aceptado' || item.conductorStatus === 'en_camino') && (
                    <TouchableOpacity style={styles.completeBtn} onPress={() => openCompletion(item)}>
                        <Icon name="flag" size={18} color={COLORS.white} />
                        <Text style={styles.completeBtnText}>Finalizar viaje + Fotos</Text>
                    </TouchableOpacity>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>Mis Viajes</Text>
                    <Text style={styles.subtitle}>Hola, {user?.nombre?.split(' ')[0]} 👋</Text>
                </View>
                <View style={styles.statRow}>
                    <View style={styles.stat}>
                        <Text style={styles.statNum}>{pending.length}</Text>
                        <Text style={styles.statLabel}>Pendientes</Text>
                    </View>
                    <View style={styles.stat}>
                        <Text style={[styles.statNum, { color: COLORS.primary }]}>{active.length}</Text>
                        <Text style={styles.statLabel}>Activos</Text>
                    </View>
                    <View style={styles.stat}>
                        <Text style={[styles.statNum, { color: COLORS.success }]}>{finished.length}</Text>
                        <Text style={styles.statLabel}>Finalizados</Text>
                    </View>
                </View>
            </View>

            {/* TABS */}
            <View style={styles.tabsContainer}>
                <TouchableOpacity
                    style={[styles.tabBtn, activeTab === 'pending' && styles.tabBtnActive]}
                    onPress={() => setActiveTab('pending')}
                >
                    <Icon name="clock" size={16} color={activeTab === 'pending' ? COLORS.white : COLORS.textMuted} style={{ marginRight: 6 }} />
                    <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>Pendientes</Text>
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
                    <Icon name="truck" size={16} color={activeTab === 'active' ? COLORS.white : COLORS.textMuted} style={{ marginRight: 6 }} />
                    <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>Activos</Text>
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
                    <Icon name="check-circle" size={16} color={activeTab === 'finished' ? COLORS.white : COLORS.textMuted} style={{ marginRight: 6 }} />
                    <Text style={[styles.tabText, activeTab === 'finished' && styles.tabTextActive]}>Finalizados</Text>
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
                        <Icon name="inbox" size={48} color={COLORS.textMuted} />
                        <Text style={styles.emptyTitle}>Sin viajes pendientes</Text>
                        <Text style={styles.emptyHint}>No tienes viajes por aceptar en este momento.</Text>
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
                        <Icon name="truck" size={48} color={COLORS.textMuted} />
                        <Text style={styles.emptyTitle}>Ningún viaje en curso</Text>
                        <Text style={styles.emptyHint}>Acepta un viaje pendiente para comenzar.</Text>
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
                        <Icon name="check-square" size={48} color={COLORS.textMuted} />
                        <Text style={styles.emptyTitle}>Aún no hay finalizados</Text>
                        <Text style={styles.emptyHint}>Tus viajes entregados aparecerán aquí.</Text>
                    </View>
                )}
            </ScrollView>

            {/* Floating logout button — bottom right, above system nav */}
            <TouchableOpacity style={[styles.logoutFab, { bottom: insets.bottom + 20 }]} onPress={handleLogout}>
                <Icon name="log-out" size={18} color={COLORS.danger} />
                <Text style={styles.logoutFabText}>Salir</Text>
            </TouchableOpacity>

            {/* ── Completion Modal ─────────────────────────────────────────────── */}
            <Modal visible={showCompletionModal} animationType="slide" transparent onRequestClose={() => setShowCompletionModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalSheet}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Finalizar Viaje</Text>
                            <TouchableOpacity onPress={() => setShowCompletionModal(false)}>
                                <Icon name="x" size={24} color={COLORS.textSecondary} />
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
                                <Text style={styles.inputLabel}>📸 Fotos de entrega (equipos y materiales recibidos)</Text>
                                <View style={styles.photoActions}>
                                    <TouchableOpacity style={styles.photoBtn} onPress={takePhoto}>
                                        <Icon name="camera" size={20} color={COLORS.primary} />
                                        <Text style={styles.photoBtnText}>Cámara</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.photoBtn} onPress={pickPhoto}>
                                        <Icon name="image" size={20} color={COLORS.primary} />
                                        <Text style={styles.photoBtnText}>Galería</Text>
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
                                                    <Icon name="x" size={12} color={COLORS.white} />
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
                                    <Icon name="flag" size={20} color={COLORS.white} />
                                    <Text style={styles.finishBtnText}>
                                        {completing ? 'Finalizando...' : 'Confirmar entrega'}
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

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },

    header: { padding: SPACING.lg, paddingBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.surface, flexDirection: 'row', alignItems: 'center' },
    logoutFab: { position: 'absolute', bottom: 24, right: 20, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.danger + '55', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, ...SHADOWS.md },
    logoutFabText: { color: COLORS.danger, fontWeight: 'bold', fontSize: 13 },
    title: { color: COLORS.white, fontSize: FONTS.sizes.xl, fontWeight: '900' },
    subtitle: { color: COLORS.textMuted, fontSize: FONTS.sizes.sm, marginBottom: SPACING.md },
    statRow: { flexDirection: 'row', gap: SPACING.lg },
    stat: { alignItems: 'center' },
    statNum: { color: '#f59e0b', fontSize: 22, fontWeight: '900' },
    statLabel: { color: COLORS.textMuted, fontSize: 11 },

    sectionTitle: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm, fontWeight: '700', marginBottom: SPACING.sm, marginTop: SPACING.md, textTransform: 'uppercase', letterSpacing: 1 },

    tabsContainer: { flexDirection: 'row', backgroundColor: COLORS.surface, padding: SPACING.xs, marginHorizontal: SPACING.md, borderRadius: RADIUS.md },
    tabBtn: { flex: 1, flexDirection: 'row', paddingVertical: SPACING.sm, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.sm },
    tabBtnActive: { backgroundColor: COLORS.primary },
    tabText: { color: COLORS.textMuted, fontSize: 12, fontWeight: 'bold' },
    tabTextActive: { color: COLORS.white },
    badge: { backgroundColor: COLORS.danger, borderRadius: 10, paddingHorizontal: 5, paddingVertical: 1, marginLeft: 6, justifyContent: 'center', alignItems: 'center' },
    badgeText: { color: COLORS.white, fontSize: 9, fontWeight: 'bold' },

    card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, marginBottom: SPACING.md, overflow: 'hidden', ...SHADOWS.sm },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', padding: SPACING.md, paddingBottom: SPACING.sm },
    cardRoute: { color: COLORS.white, fontSize: FONTS.sizes.md, fontWeight: 'bold' },
    cardPlate: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm, marginTop: 2 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1, gap: 4 },
    statusText: { fontSize: 11, fontWeight: '700' },

    cardBody: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.md },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    infoText: { color: COLORS.textMuted, fontSize: 12 },
    obs: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4, fontStyle: 'italic' },

    acceptBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.success, padding: SPACING.md, gap: 8 },
    acceptBtnText: { color: COLORS.white, fontWeight: 'bold', fontSize: 15 },
    completeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, padding: SPACING.md, gap: 8 },
    completeBtnText: { color: COLORS.white, fontWeight: 'bold', fontSize: 15 },

    empty: { alignItems: 'center', paddingVertical: 80 },
    emptyTitle: { color: COLORS.textSecondary, fontSize: FONTS.sizes.lg, fontWeight: 'bold', marginTop: SPACING.md },
    emptyHint: { color: COLORS.textMuted, fontSize: FONTS.sizes.sm, marginTop: SPACING.sm, textAlign: 'center' },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
    modalSheet: { backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.lg, maxHeight: '90%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
    modalTitle: { color: COLORS.white, fontSize: FONTS.sizes.lg, fontWeight: 'bold' },

    tripSummary: { backgroundColor: COLORS.surfaceLight, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.lg },
    summaryRoute: { color: COLORS.white, fontWeight: 'bold', fontSize: FONTS.sizes.md },
    summaryPlate: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm, marginTop: 4 },
    materialRow: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm, marginTop: 4 },

    inputLabel: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm, fontWeight: '600', marginBottom: SPACING.sm },
    photoActions: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.md },
    photoBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 12 },
    photoBtnText: { color: COLORS.primary, fontWeight: 'bold' },
    thumbPhoto: { width: 90, height: 90, borderRadius: RADIUS.sm, resizeMode: 'cover' },
    removePhoto: { position: 'absolute', top: 4, right: 4, backgroundColor: COLORS.danger, borderRadius: 10, width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },

    finishBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, padding: SPACING.md, borderRadius: RADIUS.md, gap: 8, marginTop: SPACING.md, marginBottom: SPACING.xxl, ...SHADOWS.md },
    finishBtnText: { color: COLORS.white, fontWeight: 'bold', fontSize: FONTS.sizes.md },
});

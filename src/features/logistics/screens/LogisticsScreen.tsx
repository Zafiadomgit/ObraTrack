import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, ScrollView, Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from '@expo/vector-icons/Feather';
import * as Location from 'expo-location';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { FONTS, SPACING, RADIUS, SHADOWS } from '../../../core/theme';
import { useColors, ThemeColors } from '../../../core/theme/ThemeContext';
import { useT } from '../../../core/i18n';
import { useLogisticsStore, Shipment, ShipmentMaterial } from '../store/logisticsStore';
import { useAppStore } from '../../../store/appStore';
import { useProjectStore } from '../../projects/store/projectStore';
import { useMaterialStore } from '../../materials/store/materialStore';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../config/firebase';

interface ConductorOption { id: string; nombre: string; telefono: string; }

export default function LogisticsScreen() {
    const insets = useSafeAreaInsets();
    const navigation = useNavigation();
    const route = useRoute<any>();
    const C = useColors();
    const t = useT();
    const styles = React.useMemo(() => makeStyles(C), [C]);

    const contextProjectId = route.params?.projectId; // If accessed from ProjectTabs
    const isTab = !!contextProjectId;

    const currentUser = useAppStore(state => state.user);
    const shipments = useLogisticsStore(state => state.shipments);
    const addShipment = useLogisticsStore(state => state.addShipment);
    const updateShipmentStatus = useLogisticsStore(state => state.updateShipmentStatus);
    const updateShipmentLocation = useLogisticsStore(state => state.updateShipmentLocation);

    const projects = useProjectStore(state => state.projects).filter(p =>
        currentUser && (p.companyId === currentUser.companyId || p.userId === currentUser.id)
    );
    const addProject = useProjectStore(state => state.addProject);
    const allMaterials = useMaterialStore(state => state.materials).filter(m => currentUser && m.userId === currentUser.id);

    // Filter shipments for the current user and context project
    const userShipments = shipments.filter(s => {
        // Admin gets to see everything
        if (currentUser?.role === 'admin') {
            if (contextProjectId && s.projectId !== contextProjectId) return false;
            return true;
        }

        if (!currentUser || s.userId !== currentUser.id) return false;
        if (contextProjectId && s.projectId !== contextProjectId) return false;
        return true;
    }).sort((a, b) => b.createdAt - a.createdAt);

    const [modalVisible, setModalVisible] = useState(false);
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
    const [activeTab, setActiveTab] = useState<'pending' | 'active' | 'finished'>('active');

    const pendingShipments = userShipments.filter(s => s.conductorStatus === 'pendiente');
    const activeShipments = userShipments.filter(s => s.conductorStatus === 'aceptado' || s.conductorStatus === 'en_camino');
    const finishedShipments = userShipments.filter(s => s.conductorStatus === 'finalizado');

    const displayedShipments = activeTab === 'pending'
        ? pendingShipments
        : activeTab === 'active'
            ? activeShipments
            : finishedShipments;

    // Conductors loaded from Firestore
    const [conductorOptions, setConductorOptions] = useState<ConductorOption[]>([]);
    const [conductorPickerVisible, setConductorPickerVisible] = useState(false);
    const [selectedConductorId, setSelectedConductorId] = useState('');

    useEffect(() => {
        // Load all registered conductors
        getDocs(query(collection(db, 'users'), where('role', '==', 'conductor'), where('status', '==', 'approved')))
            .then(snap => {
                const list: ConductorOption[] = snap.docs.map(d => ({
                    id: d.id,
                    nombre: (d.data() as any).nombre || '',
                    telefono: (d.data() as any).telefono || (d.data() as any).telefonoConductor || '',
                }));
                setConductorOptions(list);
            })
            .catch(() => { });
    }, []);

    // Form State
    const [selectedProject, setSelectedProject] = useState('');
    const [customDestination, setCustomDestination] = useState('');
    const [origen, setOrigen] = useState('Bodega Central');
    const [placa, setPlaca] = useState('');
    const [conductor, setConductor] = useState('');
    const [telefonoConductor, setTelefonoConductor] = useState('');
    const [fechaEstimada, setFechaEstimada] = useState('');   // YYYY-MM-DD
    const [materialesEnvio, setMaterialesEnvio] = useState<ShipmentMaterial[]>([]);

    const [matSelectVisible, setMatSelectVisible] = useState(false);
    const [qtyInput, setQtyInput] = useState('');
    const [activeMat, setActiveMat] = useState<any>(null);

    const handleCreateShipment = async () => {
        let finalDestino = customDestination.trim();
        let finalProjectId = selectedProject || undefined;

        if (finalProjectId) {
            finalDestino = projects.find(p => p.id === finalProjectId)?.nombreProyecto || finalDestino;
        }

        if (!finalDestino || !placa || !conductor || materialesEnvio.length === 0) {
            Alert.alert(t.incompleteShipment, t.incompleteShipmentMessage);
            return;
        }

        const estimated = fechaEstimada
            ? new Date(fechaEstimada).toISOString()
            : new Date(Date.now() + 86400000).toISOString();

        if (currentUser) {
            try {
                await addShipment({
                    userId: currentUser.id,
                    conductorId: selectedConductorId || undefined,
                    projectId: finalProjectId,
                    destino: finalDestino,
                    origen,
                    placaCamion: placa,
                    conductor,
                    telefonoConductor,
                    fechaSalida: new Date().toISOString(),
                    fechaEstimada: estimated,
                    materiales: materialesEnvio,
                }, currentUser.companyId || 'default-company');
                setModalVisible(false);
                resetForm();
            } catch (error) {
                console.error("Error dispatching shipment:", error);
                Alert.alert(t.error, t.shipmentError);
            }
        }
    };

    const resetForm = () => {
        setSelectedProject('');
        setCustomDestination('');
        setPlaca('');
        setConductor('');
        setTelefonoConductor('');
        setSelectedConductorId('');
        setFechaEstimada('');
        setMaterialesEnvio([]);
    };

    const handleAddMatToShipment = () => {
        const qty = parseFloat(qtyInput);
        if (!activeMat || isNaN(qty) || qty <= 0) {
            Alert.alert(t.error, t.invalidQuantity);
            return;
        }

        setMaterialesEnvio([...materialesEnvio, {
            materialId: activeMat.id,
            nombre: activeMat.nombre,
            cantidad: qty,
            unidad: activeMat.unidad
        }]);
        setMatSelectVisible(false);
        setQtyInput('');
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'en_transito': return C.info;
            case 'entregado': return C.success;
            case 'retrasado': return C.warning;
            default: return C.textMuted;
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'en_transito': return t.statusInTransit;
            case 'entregado': return t.statusDelivered;
            case 'retrasado': return t.statusDelayed;
            default: return status;
        }
    };

    const handleUpdateStatus = async (shipmentId: string, status: any) => {
        let locationData;
        if (status === 'entregado') {
            try {
                let { status: permStatus } = await Location.requestForegroundPermissionsAsync();
                if (permStatus === 'granted') {
                    let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                    locationData = { lat: location.coords.latitude, lng: location.coords.longitude };
                }
            } catch (e) {
                console.log('Location error:', e);
            }
        }

        try {
            await updateShipmentStatus(shipmentId, status, currentUser?.companyId || 'default-company', locationData);
        } catch (error) {
            console.error("Error updating shipment status:", error);
            Alert.alert(t.error, t.statusUpdateError);
        }
    };

    const handleSendLocation = async (shipmentId: string) => {
        try {
            let { status: permStatus } = await Location.requestForegroundPermissionsAsync();
            if (permStatus !== 'granted') {
                Alert.alert(t.locationDenied, t.locationDeniedMessage);
                return;
            }

            let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            const locationData = { lat: location.coords.latitude, lng: location.coords.longitude };

            await updateShipmentLocation(shipmentId, currentUser?.companyId || 'default-company', locationData);
            Alert.alert(t.success, t.locationShared);
        } catch (error) {
            console.error("Error sharing location:", error);
            Alert.alert(t.error, t.locationError);
        }
    };

    const renderShipment = ({ item }: { item: Shipment }) => {
        const dateStr = format(new Date(item.fechaSalida), "dd MMM, HH:mm", { locale: es });

        return (
            <TouchableOpacity style={styles.card} onPress={() => { setSelectedShipment(item); setDetailModalVisible(true); }}>
                <View style={styles.cardHeader}>
                    <View style={styles.headerLeft}>
                        <Icon name="truck" size={18} color={C.primary} style={{ marginRight: 8 }} />
                        <Text style={styles.placaText}>{item.placaCamion}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.estado) + '20' }]}>
                        <Text style={[styles.statusText, { color: getStatusColor(item.estado) }]}>
                            {getStatusText(item.estado)}
                        </Text>
                    </View>
                </View>

                <View style={styles.cardBody}>
                    <Text style={styles.infoLabel}>Destino: <Text style={styles.infoValue} numberOfLines={1}>{item.destino}</Text></Text>
                    <Text style={styles.infoLabel}>Conductor: <Text style={styles.infoValue}>{item.conductor} ({item.telefonoConductor})</Text></Text>
                    <Text style={styles.infoLabel}>Salida: <Text style={styles.infoValue}>{dateStr}</Text></Text>

                    <View style={styles.materialsList}>
                        <Text style={styles.matHeader}>Cargamento ({item.materiales.length} items):</Text>
                        {item.materiales.slice(0, 3).map((m, idx) => (
                            <Text key={idx} style={styles.matItem}>• {m.cantidad} {m.unidad} de {m.nombre}</Text>
                        ))}
                        {item.materiales.length > 3 && (
                            <Text style={styles.matItem}>y {item.materiales.length - 3} más...</Text>
                        )}
                    </View>
                </View>

                {item.estado === 'en_transito' && (
                    <View style={styles.cardActions}>
                        <TouchableOpacity style={styles.actionBtnBtn} onPress={() => handleUpdateStatus(item.id, 'entregado')}>
                            <Icon name="check-circle" size={16} color={C.success} />
                            <Text style={[styles.actionBtnText, { color: C.success }]}>{t.markDelivered}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtnBtn} onPress={() => handleUpdateStatus(item.id, 'retrasado')}>
                            <Icon name="alert-circle" size={16} color={C.warning} />
                            <Text style={[styles.actionBtnText, { color: C.warning }]}>{t.delay}</Text>
                        </TouchableOpacity>
                        {item.conductorId === currentUser?.id && (
                            <TouchableOpacity style={styles.actionBtnBtn} onPress={() => handleSendLocation(item.id)}>
                                <Icon name="navigation" size={16} color={C.info} />
                                <Text style={[styles.actionBtnText, { color: C.info }]}>{t.shareLocation}</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {item.ubicacionGPS && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, padding: 8, backgroundColor: C.surfaceLight, borderRadius: RADIUS.sm }}>
                        <Icon name="map-pin" size={14} color={C.primary} />
                        <Text style={{ color: C.textSecondary, fontSize: 11, marginLeft: 6 }}>
                            {t.gpsVerified}
                        </Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { paddingTop: isTab ? 0 : insets.top, backgroundColor: C.background }]}>
            {!isTab && (
                <View style={[styles.header, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
                    <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : null} style={styles.backBtn}>
                        <Icon name="arrow-left" size={24} color={C.white} />
                    </TouchableOpacity>
                    <Text style={[styles.title, { color: C.white }]}>{t.logisticsTitle}</Text>
                </View>
            )}

            {/* TABS */}
            <View style={styles.tabsContainer}>
                <TouchableOpacity
                    style={[styles.tabBtn, activeTab === 'pending' && styles.tabBtnActive]}
                    onPress={() => setActiveTab('pending')}
                >
                    <Icon name="clock" size={16} color={activeTab === 'pending' ? C.white : C.textMuted} style={{ marginRight: 6 }} />
                    <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>{t.pending}</Text>
                    {pendingShipments.length > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{pendingShipments.length}</Text>
                        </View>
                    )}
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tabBtn, activeTab === 'active' && styles.tabBtnActive]}
                    onPress={() => setActiveTab('active')}
                >
                    <Icon name="truck" size={16} color={activeTab === 'active' ? C.white : C.textMuted} style={{ marginRight: 6 }} />
                    <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>{t.active}</Text>
                    {activeShipments.length > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{activeShipments.length}</Text>
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

            <FlatList
                data={displayedShipments}
                keyExtractor={item => item.id}
                renderItem={renderShipment}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Icon name="map" size={48} color={C.textMuted} />
                        <Text style={styles.emptyText}>{t.noShipmentsInCategory}</Text>
                    </View>
                }
            />

            {(!isTab || contextProjectId) && ['admin', 'logistica', 'coordinador'].includes(currentUser?.role || '') && (
                <TouchableOpacity style={[styles.fab, { bottom: isTab ? 20 : insets.bottom + 20 }]} onPress={() => { setModalVisible(true); if (contextProjectId) setSelectedProject(contextProjectId); }}>
                    <Icon name="plus" size={24} color={C.white} />
                    <Text style={styles.fabText}>{t.newShipment}</Text>
                </TouchableOpacity>
            )}

            {/* NEW SHIPMENT MODAL */}
            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{t.registerShipment}</Text>
                            <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }}>
                                <Icon name="x" size={24} color={C.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView>
                            <Text style={styles.inputLabel}>{t.destinationProject}</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                                {projects.map(p => (
                                    <TouchableOpacity
                                        key={p.id}
                                        style={[styles.chip, selectedProject === p.id && styles.chipActive]}
                                        onPress={() => { setSelectedProject(p.id); setCustomDestination(''); }}
                                    >
                                        <Text style={[styles.chipText, selectedProject === p.id && styles.chipTextActive]}>{p.nombreProyecto}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                            <TextInput
                                style={styles.input}
                                placeholder={t.writeDestination}
                                placeholderTextColor={C.textMuted}
                                value={customDestination}
                                onChangeText={(text) => { setCustomDestination(text); setSelectedProject(''); }}
                            />

                            <Text style={styles.inputLabel}>{t.truckPlate}</Text>
                            <TextInput style={styles.input} placeholder="ABC-123" placeholderTextColor={C.textMuted} value={placa} onChangeText={setPlaca} autoCapitalize="characters" />

                            <Text style={styles.inputLabel}>{t.driverLabel}</Text>
                            <TouchableOpacity
                                style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                                onPress={() => setConductorPickerVisible(true)}
                            >
                                <Text style={{ color: conductor ? C.white : C.textMuted, flex: 1 }}>
                                    {conductor || t.selectDriver}
                                </Text>
                                <Icon name="chevron-down" size={18} color={C.textMuted} />
                            </TouchableOpacity>
                            {telefonoConductor ? (
                                <Text style={{ color: C.textMuted, fontSize: 12, marginTop: -8, marginBottom: 12 }}>
                                    📞 {telefonoConductor}
                                </Text>
                            ) : null}

                            <Text style={styles.inputLabel}>{t.estimatedDelivery}</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="YYYY-MM-DD (Ej: 2026-03-10)"
                                placeholderTextColor={C.textMuted}
                                value={fechaEstimada}
                                onChangeText={setFechaEstimada}
                                keyboardType="numbers-and-punctuation"
                            />

                            <View style={styles.sectionHeaderLine}>
                                <Text style={styles.inputLabel}>{t.materialsToSend}</Text>
                                <TouchableOpacity onPress={() => setMatSelectVisible(true)}>
                                    <Text style={{ color: C.primary, fontWeight: 'bold' }}>{t.addMaterialBtn}</Text>
                                </TouchableOpacity>
                            </View>

                            {materialesEnvio.map((m, i) => (
                                <View key={i} style={styles.matEnvioRow}>
                                    <Text style={styles.matEnvioText}>{m.cantidad} {m.unidad} de {m.nombre}</Text>
                                    <TouchableOpacity onPress={() => setMaterialesEnvio(materialesEnvio.filter((_, idx) => idx !== i))}>
                                        <Icon name="trash-2" size={16} color={C.danger} />
                                    </TouchableOpacity>
                                </View>
                            ))}
                            {materialesEnvio.length === 0 && <Text style={{ color: C.textMuted, fontSize: 12, marginBottom: SPACING.xl, fontStyle: 'italic' }}>{t.noMaterialsAdded}</Text>}

                            <TouchableOpacity style={styles.confirmBtn} onPress={handleCreateShipment}>
                                <Text style={styles.confirmText}>{t.dispatchTruck}</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* CONDUCTOR PICKER MODAL */}
            <Modal visible={conductorPickerVisible} animationType="fade" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxHeight: '60%' }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{t.selectConductor}</Text>
                            <TouchableOpacity onPress={() => setConductorPickerVisible(false)}>
                                <Icon name="x" size={22} color={C.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        {conductorOptions.length === 0 ? (
                            <View style={{ padding: SPACING.xl, alignItems: 'center' }}>
                                <Icon name="user-x" size={36} color={C.textMuted} />
                                <Text style={{ color: C.textMuted, marginTop: SPACING.md, textAlign: 'center' }}>
                                    {t.noConductors}
                                </Text>
                            </View>
                        ) : (
                            <ScrollView>
                                {conductorOptions.map(c => (
                                    <TouchableOpacity
                                        key={c.id}
                                        style={[styles.matSelectItem, selectedConductorId === c.id && { backgroundColor: C.primary + '22', borderLeftWidth: 3, borderLeftColor: C.primary }]}
                                        onPress={() => {
                                            setSelectedConductorId(c.id);
                                            setConductor(c.nombre);
                                            setTelefonoConductor(c.telefono);
                                            setConductorPickerVisible(false);
                                        }}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.primary + '30', alignItems: 'center', justifyContent: 'center', marginRight: SPACING.md }}>
                                                <Text style={{ color: C.primary, fontWeight: 'bold', fontSize: 16 }}>
                                                    {c.nombre.charAt(0).toUpperCase()}
                                                </Text>
                                            </View>
                                            <View>
                                                <Text style={{ color: C.white, fontWeight: 'bold', fontSize: 15 }}>{c.nombre}</Text>
                                                {c.telefono ? <Text style={{ color: C.textMuted, fontSize: 12 }}>📞 {c.telefono}</Text> : null}
                                            </View>
                                            {selectedConductorId === c.id && (
                                                <Icon name="check" size={18} color={C.primary} style={{ marginLeft: 'auto' }} />
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

            {/* MATERIAL SELECTION SUB-MODAL */}
            <Modal visible={matSelectVisible} animationType="fade" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxHeight: '60%' }]}>
                        <Text style={styles.modalTitle}>{t.selectMaterial}</Text>

                        {!activeMat ? (
                            <ScrollView style={{ maxHeight: 300 }}>
                                {allMaterials.filter(m => m.projectId === 'central').map(m => (
                                    <TouchableOpacity
                                        key={m.id}
                                        style={styles.matSelectItem}
                                        onPress={() => setActiveMat(m)}
                                    >
                                        <Text style={{ color: C.white, fontWeight: 'bold' }}>{m.nombre}</Text>
                                        <Text style={{ color: C.textMuted, fontSize: 12 }}>Bodega: {m.stock} {m.unidad}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        ) : (
                            <View>
                                <Text style={{ color: C.info, marginBottom: 8 }}>Material: {activeMat.nombre}</Text>
                                <Text style={styles.inputLabel}>{t.quantityToSend} ({activeMat.unidad})</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="0"
                                    keyboardType="numeric"
                                    placeholderTextColor={C.textMuted}
                                    value={qtyInput}
                                    onChangeText={setQtyInput}
                                    autoFocus
                                />
                                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
                                    <TouchableOpacity onPress={() => { setActiveMat(null); setMatSelectVisible(false); }} style={{ padding: 12 }}>
                                        <Text style={{ color: C.textSecondary }}>{t.cancel}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={handleAddMatToShipment} style={{ backgroundColor: C.primary, padding: 12, borderRadius: 8 }}>
                                        <Text style={{ color: C.white, fontWeight: 'bold' }}>{t.accept}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                        {!activeMat && (
                            <TouchableOpacity style={{ marginTop: 16, alignItems: 'center' }} onPress={() => setMatSelectVisible(false)}>
                                <Text style={{ color: C.textSecondary }}>{t.close}</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Modal>
            {/* SHIPMENT DETAIL MODAL */}
            <Modal visible={detailModalVisible} animationType="slide" transparent>
                <View style={[styles.modalOverlay, { paddingTop: insets.top }]}>
                    <View style={styles.modalContent}>
                        {selectedShipment && (
                            <View style={{ flex: 1 }}>
                                <View style={[styles.modalHeader, { paddingBottom: SPACING.md, marginBottom: 0 }]}>
                                    <Text style={styles.modalTitle}>{t.shipmentDetail}</Text>
                                    <TouchableOpacity
                                        style={{ padding: SPACING.md, margin: -SPACING.md }}
                                        onPress={() => {
                                            setDetailModalVisible(false);
                                            setSelectedShipment(null);
                                        }}>
                                        <Icon name="x" size={24} color={C.textSecondary} />
                                    </TouchableOpacity>
                                </View>
                                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: SPACING.md }}>

                                    {/* Badges */}
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg }}>
                                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedShipment.estado) + '20' }]}>
                                            <Text style={[styles.statusText, { color: getStatusColor(selectedShipment.estado) }]}>
                                                {getStatusText(selectedShipment.estado)}
                                            </Text>
                                        </View>
                                        <Text style={{ color: C.textMuted, fontSize: 12 }}>
                                            {format(new Date(selectedShipment.fechaSalida), "dd MMM, yyyy HH:mm", { locale: es })}
                                        </Text>
                                    </View>

                                    {/* Route Info */}
                                    <View style={{ backgroundColor: C.surface, padding: 16, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.border, marginBottom: SPACING.lg }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                                            <Icon name="home" size={16} color={C.textSecondary} style={{ width: 20 }} />
                                            <View>
                                                <Text style={{ color: C.textMuted, fontSize: 11 }}>{t.origin}</Text>
                                                <Text style={{ color: C.white, fontWeight: 'bold' }}>{selectedShipment.origen}</Text>
                                            </View>
                                        </View>
                                        <View style={{ height: 20, borderLeftWidth: 1, borderLeftColor: C.border, marginLeft: 9, marginBottom: 12, borderStyle: 'dashed' }} />
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Icon name="map-pin" size={16} color={C.primary} style={{ width: 20 }} />
                                            <View>
                                                <Text style={{ color: C.textMuted, fontSize: 11 }}>{t.destination}</Text>
                                                <Text style={{ color: C.white, fontWeight: 'bold' }}>{selectedShipment.destino}</Text>
                                            </View>
                                        </View>
                                    </View>

                                    {/* Driver Info */}
                                    <Text style={styles.inputLabel}>{t.transportInfo}</Text>
                                    <View style={{ backgroundColor: C.surface, padding: 16, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.border, marginBottom: SPACING.lg }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                                            <Text style={{ color: C.textMuted }}>{t.conductor}</Text>
                                            <Text style={{ color: C.white, fontWeight: 'bold' }}>{selectedShipment.conductor}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                                            <Text style={{ color: C.textMuted }}>{t.phone}</Text>
                                            <Text style={{ color: C.info, fontWeight: 'bold' }}>{selectedShipment.telefonoConductor}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <Text style={{ color: C.textMuted }}>{t.truckPlateLabel}</Text>
                                            <Text style={{ color: C.white, fontWeight: 'bold' }}>{selectedShipment.placaCamion}</Text>
                                        </View>
                                    </View>

                                    {/* Materials */}
                                    <Text style={styles.inputLabel}>{t.manifest(selectedShipment.materiales.length)}</Text>
                                    <View style={{ backgroundColor: C.surfaceLight, padding: 16, borderRadius: RADIUS.md, marginBottom: SPACING.lg }}>
                                        {selectedShipment.materiales.map((m, idx) => (
                                            <View key={idx} style={{ flexDirection: 'row', paddingVertical: 8, borderBottomWidth: idx === selectedShipment.materiales.length - 1 ? 0 : 1, borderBottomColor: C.border }}>
                                                <Text style={{ color: C.white, flex: 1 }}>{m.nombre}</Text>
                                                <Text style={{ color: C.textSecondary, fontWeight: 'bold' }}>{m.cantidad} {m.unidad}</Text>
                                            </View>
                                        ))}
                                    </View>

                                    {/* GPS Verification Status */}
                                    <Text style={styles.inputLabel}>{t.deliveryValidation}</Text>
                                    {selectedShipment.ubicacionGPS ? (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.success + '20', padding: 16, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.success }}>
                                            <Icon name="check-circle" size={24} color={C.success} />
                                            <View style={{ marginLeft: 12, flex: 1 }}>
                                                <Text style={{ color: C.success, fontWeight: 'bold', marginBottom: 4 }}>{t.deliveredAndVerified}</Text>
                                                <Text style={{ color: C.success, fontSize: 12, opacity: 0.8 }}>GPS: {selectedShipment.ubicacionGPS.lat.toFixed(5)}, {selectedShipment.ubicacionGPS.lng.toFixed(5)}</Text>
                                            </View>
                                        </View>
                                    ) : selectedShipment.estado === 'entregado' ? (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.warning + '20', padding: 16, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.warning }}>
                                            <Icon name="info" size={24} color={C.warning} />
                                            <View style={{ marginLeft: 12, flex: 1 }}>
                                                <Text style={{ color: C.warning, fontWeight: 'bold', marginBottom: 4 }}>{t.deliveredNoGps}</Text>
                                                <Text style={{ color: C.warning, fontSize: 12, opacity: 0.8 }}>{t.deliveredNoGpsDesc}</Text>
                                            </View>
                                        </View>
                                    ) : (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, padding: 16, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.border }}>
                                            <Icon name="clock" size={24} color={C.textMuted} />
                                            <View style={{ marginLeft: 12, flex: 1 }}>
                                                <Text style={{ color: C.textSecondary, fontWeight: 'bold', marginBottom: 4 }}>{t.pendingVerification}</Text>
                                                <Text style={{ color: C.textMuted, fontSize: 12 }}>{t.pendingVerificationDesc}</Text>
                                            </View>
                                        </View>
                                    )}

                                    <View style={{ height: 40 }} />
                                </ScrollView>
                            </View>
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
        header: { flexDirection: 'row', alignItems: 'center', padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: C.border },
        backBtn: { marginRight: SPACING.md },
        title: { color: C.white, fontSize: FONTS.sizes.xl, fontWeight: 'bold' },

        tabsContainer: { flexDirection: 'row', backgroundColor: C.surface, padding: SPACING.xs, marginHorizontal: SPACING.md, borderRadius: RADIUS.md, marginBottom: SPACING.md },
        tabBtn: { flex: 1, flexDirection: 'row', paddingVertical: SPACING.sm, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.sm },
        tabBtnActive: { backgroundColor: C.primary },
        tabText: { color: C.textMuted, fontSize: 12, fontWeight: 'bold' },
        tabTextActive: { color: C.white },
        badge: { backgroundColor: C.danger, borderRadius: 10, paddingHorizontal: 5, paddingVertical: 1, marginLeft: 6, justifyContent: 'center', alignItems: 'center' },
        badgeText: { color: C.white, fontSize: 9, fontWeight: 'bold' },

        listContent: { padding: SPACING.md, paddingBottom: 100 },
        card: { backgroundColor: C.surface, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: C.border },
        cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm, borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 8 },
        headerLeft: { flexDirection: 'row', alignItems: 'center' },
        placaText: { color: C.white, fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
        statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
        statusText: { fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' },

        cardBody: {},
        infoLabel: { color: C.textMuted, fontSize: 12, marginBottom: 4 },
        infoValue: { color: C.white, fontWeight: '600' },
        materialsList: { marginTop: 8, backgroundColor: C.surfaceLight, padding: 8, borderRadius: 6 },
        matHeader: { color: C.textSecondary, fontSize: 11, fontWeight: 'bold', marginBottom: 4 },
        matItem: { color: C.white, fontSize: 12, marginLeft: 4, marginBottom: 2 },

        cardActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border },
        actionBtnBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surfaceLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
        actionBtnText: { fontSize: 12, fontWeight: 'bold', marginLeft: 6 },

        emptyState: { alignItems: 'center', marginTop: 100 },
        emptyText: { color: C.textMuted, marginTop: 16 },

        fab: { position: 'absolute', right: SPACING.lg, backgroundColor: C.primary, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 30, ...SHADOWS.lg },
        fabText: { color: C.white, fontWeight: 'bold', marginLeft: 8 },

        modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
        modalContent: { backgroundColor: C.surface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.lg, maxHeight: '90%' },
        modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg, zIndex: 10 },
        modalTitle: { color: C.white, fontSize: FONTS.sizes.lg, fontWeight: 'bold' },
        inputLabel: { color: C.textSecondary, fontSize: FONTS.sizes.sm, marginBottom: 6, fontWeight: 'bold' },
        input: { backgroundColor: C.surface, color: C.white, padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.border, marginBottom: SPACING.lg },

        chip: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: C.surface, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: C.border },
        chipActive: { backgroundColor: C.primary, borderColor: C.primary },
        chipText: { color: C.textMuted, fontSize: 12, fontWeight: 'bold' },
        chipTextActive: { color: C.white },

        sectionHeaderLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
        matEnvioRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: C.surface, padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: C.border },
        matEnvioText: { color: C.white, fontSize: 13 },

        confirmBtn: { backgroundColor: C.primary, padding: 16, borderRadius: RADIUS.md, alignItems: 'center', marginTop: SPACING.xl, marginBottom: 40 },
        confirmText: { color: C.white, fontWeight: 'bold', fontSize: 16 },

        matSelectItem: { padding: 16, borderBottomWidth: 1, borderBottomColor: C.border },
    });
}

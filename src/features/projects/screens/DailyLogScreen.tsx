import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, ScrollView, Image, useWindowDimensions, ActivityIndicator } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useReportStore, DailyLog } from '../../reports/store/reportStore';
import { usePersonnelStore } from '../../personnel/store/personnelStore';
import { useAppStore } from '../../../store/appStore';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../../core/theme';
import { collection, query, where, orderBy, limit, getDocs, startAfter, QueryDocumentSnapshot, DocumentData, onSnapshot } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Icon from '@expo/vector-icons/Feather';
import GlobalFAB from '../../../components/GlobalFAB';
import EmptyState from '../../../components/EmptyState';
import { ExportService } from '../../../core/services/exportService';
import { StorageService } from '../../../core/services/storageService';
import { Alert } from 'react-native';

export default function DailyLogScreen() {
    const route = useRoute<any>();
    const { projectId } = route.params;
    const currentUser = useAppStore(state => state.user);
    
    // We combine local offline entries from reportStore with fetched Firestore entries
    const localLogs = useReportStore(state => state.dailyLogs).filter(l => l.projectId === projectId && l.userId === currentUser?.id);
    const workers = usePersonnelStore(state => state.workers).filter(w => w.projectId === projectId && w.userId === currentUser?.id);
    
    const addLog = useReportStore(state => state.addLog);
    const updateLog = useReportStore(state => state.updateLog);

    const [firestoreLogs, setFirestoreLogs] = useState<DailyLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);

    React.useEffect(() => {
        loadLogs();
    }, [projectId, currentUser?.companyId]);

    const loadLogs = async (isLoadMore = false) => {
        if (!currentUser?.companyId) return;
        if (isLoadMore && !lastDoc) return;
        
        if (isLoadMore) setLoadingMore(true);
        else setLoading(true);

        try {
            let q = query(
                collection(db, `companies/${currentUser.companyId}/dailyLogs`),
                where('projectId', '==', projectId),
                orderBy('fecha', 'desc'),
                limit(10)
            );

            if (isLoadMore && lastDoc) {
                q = query(
                    collection(db, `companies/${currentUser.companyId}/dailyLogs`),
                    where('projectId', '==', projectId),
                    orderBy('fecha', 'desc'),
                    startAfter(lastDoc),
                    limit(10)
                );
            }

            const snapshot = await getDocs(q);
            const fetched = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as DailyLog));

            if (snapshot.docs.length > 0) {
                setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
            } else {
                setLastDoc(null);
            }

            if (isLoadMore) {
                setFirestoreLogs(prev => {
                    const existingIds = new Set(prev.map(l => l.id));
                    const newLogs = fetched.filter(l => !existingIds.has(l.id));
                    return [...prev, ...newLogs];
                });
            } else {
                setFirestoreLogs(fetched);
            }
        } catch (error) {
            console.error('Error fetching logs:', error);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    // Combine local and firestore logs taking the freshest by ID
    const logsMap = new Map<string, DailyLog>();
    firestoreLogs.forEach(l => logsMap.set(l.id, l));
    localLogs.forEach(l => logsMap.set(l.id, l)); // Local overrides if same ID (pending sync)
    const logs = Array.from(logsMap.values()).sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

    const [modalVisible, setModalVisible] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingVersion, setEditingVersion] = useState<number>(1);
    const [actividades, setActividades] = useState('');
    const [observaciones, setObservaciones] = useState('');
    const [clima, setClima] = useState<'soleado' | 'nublado' | 'lluvia'>('soleado');
    const [imagenes, setImagenes] = useState<string[]>([]);
    const [horaInicio, setHoraInicio] = useState<string | undefined>();
    const [horaFin, setHoraFin] = useState<string | undefined>();

    // Full-screen image viewer
    const [viewerUri, setViewerUri] = useState<string>('');
    const [viewerVisible, setViewerVisible] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();

    const handleCreateOrUpdateLog = async () => {
        if (!actividades.trim()) return;
        const companyId = currentUser?.companyId || 'default-company';

        setIsUploading(true);
        try {
            // Upload new images to Storage
            const uploadedImages = await Promise.all(
                imagenes.map(async (uri) => {
                    if (uri.startsWith('http')) return uri; // Already uploaded
                    const filename = uri.split('/').pop() || `img_${Date.now()}.jpg`;
                    const path = `companies/${companyId}/projects/${projectId}/dailyLogs/${filename}`;
                    return await StorageService.uploadImage(uri, path);
                })
            );

            if (editingId) {
                updateLog(editingId, editingVersion, { actividades, observaciones, clima, listaFotos: uploadedImages });
            } else {
                addLog({
                    projectId,
                    companyId,
                    userId: currentUser?.id || 'unknown',
                    fecha: new Date().toISOString(),
                    actividades,
                    observaciones,
                    clima,
                    listaFotos: uploadedImages,
                    trabajadoresPresentes: workers.map(w => w.id),
                    horaInicio,
                    horaFin
                }, companyId);
            }
            closeModal();
        } catch (error) {
            Alert.alert('Error', 'No se pudieron subir las imágenes. Verifica tu conexión o el tamaño.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleExport = async () => {
        if (!currentUser) return;
        const exportData = logs.map(l => ({
            'Fecha': format(new Date(l.fecha), 'yyyy-MM-dd'),
            'Clima': l.clima,
            'Actividades': l.actividades,
            'Observaciones': l.observaciones || 'N/A',
            'Inicio Jornada': l.horaInicio ? format(new Date(l.horaInicio), 'HH:mm') : 'N/A',
            'Fin Jornada': l.horaFin ? format(new Date(l.horaFin), 'HH:mm') : 'N/A',
            'Personal Presente': l.trabajadoresPresentes.length,
            'Fotos': l.listaFotos?.length || 0
        }));
        await ExportService.exportToExcel(
            currentUser.companyId || 'default-company',
            currentUser.id,
            exportData,
            `Bitacora_${projectId}_${format(new Date(), 'yyyyMMdd')}`,
            'Bitacora'
        );
    };

    const openNewModal = () => {
        setAddLogToToday();
        setModalVisible(true);
    };

    const setAddLogToToday = () => {
        setEditingId(null);
        setEditingVersion(1);
        setActividades('');
        setObservaciones('');
        setClima('soleado');
        setImagenes([]);
        setHoraInicio(undefined);
        setHoraFin(undefined);
    };

    const openEditModal = (log: DailyLog) => {
        setEditingId(log.id);
        setEditingVersion(log.version || 1);
        setActividades(log.actividades);
        setObservaciones(log.observaciones || '');
        setClima(log.clima);
        setImagenes(log.listaFotos || []);
        setHoraInicio(log.horaInicio);
        setHoraFin(log.horaFin);
        setModalVisible(true);
    };

    const closeModal = () => {
        setModalVisible(false);
        setEditingId(null);
        setActividades('');
        setObservaciones('');
        setClima('soleado');
        setImagenes([]);
    };

    const handleImageCompression = async (uri: string) => {
        try {
            const result = await ImageManipulator.manipulateAsync(
                uri,
                [{ resize: { width: 1280 } }],
                { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
            );
            return result.uri;
        } catch (error) {
            console.error('Error compressing image:', error);
            return uri; // Return original on error 
        }
    };

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { alert('Se necesita permiso para acceder a la galería.'); return; }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'] as any,
            allowsEditing: false,
        });
        if (!result.canceled && result.assets[0].uri) {
            const compressedUri = await handleImageCompression(result.assets[0].uri);
            setImagenes(prev => [...prev, compressedUri]);
        }
    };

    const takePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') { alert('Se necesita permiso para usar la cámara.'); return; }
        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'] as any,
            allowsEditing: false,
        });
        if (!result.canceled && result.assets[0].uri) {
            const compressedUri = await handleImageCompression(result.assets[0].uri);
            setImagenes(prev => [...prev, compressedUri]);
        }
    };

    const openViewer = (uri: string) => {
        setViewerUri(uri);
        setViewerVisible(true);
    };

    const getWeatherIcon = (clima: string): { name: keyof typeof Icon.glyphMap; color: string } => {
        switch (clima) {
            case 'soleado': return { name: 'sun', color: '#F1C40F' };
            case 'nublado': return { name: 'cloud', color: '#BDC3C7' };
            case 'lluvia': return { name: 'cloud-rain', color: '#3498DB' };
            default: return { name: 'sun', color: '#F1C40F' };
        }
    };

    const renderLog = ({ item }: { item: DailyLog }) => {
        const weather = getWeatherIcon(item.clima);
        const dateStr = format(new Date(item.fecha), 'EEEE, d MMM yyyy', { locale: es });

        return (
            <TouchableOpacity style={styles.logCard} onPress={() => openEditModal(item)}>
                <View style={styles.logHeader}>
                    <View style={styles.dateLabel}>
                        <Icon name="calendar" size={14} color={COLORS.primary} />
                        <Text style={styles.dateText}>{dateStr}</Text>
                    </View>
                    <View style={styles.weatherBadge}>
                        <Icon name={weather.name} size={14} color={weather.color} />
                        <Text style={[styles.weatherText, { color: weather.color }]}>
                            {item.clima.toUpperCase()}
                        </Text>
                    </View>
                </View>

                {/* Performance Monitoring Section */}
                <View style={styles.performanceRow}>
                    {!item.horaInicio ? (
                        <TouchableOpacity
                            style={[styles.perfBtn, { backgroundColor: COLORS.success + '20' }]}
                            onPress={() => updateLog(item.id, item.version || 1, { horaInicio: new Date().toISOString() })}
                        >
                            <Icon name="play" size={14} color={COLORS.success} />
                            <Text style={[styles.perfBtnText, { color: COLORS.success }]}>Iniciar Jornada</Text>
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.perfTimeBox}>
                            <Text style={styles.perfTimeLabel}>Inicio: </Text>
                            <Text style={styles.perfTimeValue}>{format(new Date(item.horaInicio), 'HH:mm')}</Text>
                        </View>
                    )}

                    {item.horaInicio && !item.horaFin && (
                        <TouchableOpacity
                            style={[styles.perfBtn, { backgroundColor: COLORS.danger + '20', marginLeft: 8 }]}
                            onPress={() => updateLog(item.id, item.version || 1, { horaFin: new Date().toISOString() })}
                        >
                            <Icon name="square" size={14} color={COLORS.danger} />
                            <Text style={[styles.perfBtnText, { color: COLORS.danger }]}>Finalizar Jornada</Text>
                        </TouchableOpacity>
                    )}

                    {item.horaFin && (
                        <View style={[styles.perfTimeBox, { marginLeft: 12 }]}>
                            <Text style={styles.perfTimeLabel}>Fin: </Text>
                            <Text style={styles.perfTimeValue}>{format(new Date(item.horaFin), 'HH:mm')}</Text>
                        </View>
                    )}

                    {item.horaInicio && item.horaFin && (
                        <View style={styles.durationBadge}>
                            <Text style={styles.durationText}>
                                {Math.round((new Date(item.horaFin).getTime() - new Date(item.horaInicio).getTime()) / (1000 * 60 * 60))} hrs
                            </Text>
                        </View>
                    )}
                </View>

                <Text style={styles.activitiesTitle}>Actividades del día:</Text>
                <Text style={styles.activitiesText}>{item.actividades}</Text>

                {item.observaciones && (
                    <View style={styles.obsContainer}>
                        <Icon name="alert-circle" size={14} color={COLORS.warning} />
                        <Text style={styles.obsText}>{item.observaciones}</Text>
                    </View>
                )}

                {/* Photo strip - tap to view full screen */}
                {item.listaFotos && item.listaFotos.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.sm }}>
                        {item.listaFotos.map((uri, idx) => (
                            <TouchableOpacity key={`${item.id}-p-${idx}`} onPress={() => openViewer(uri)}>
                                <Image source={{ uri }} style={styles.thumbnailCard} />
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}

                <View style={styles.footerInfo}>
                    <View style={styles.footerItem}>
                        <Icon name="users" size={14} color={COLORS.textSecondary} />
                        <Text style={styles.footerText}>{item.trabajadoresPresentes.length} presentes</Text>
                    </View>
                    <View style={styles.footerItem}>
                        <Icon name="camera" size={14} color={COLORS.textSecondary} />
                        <Text style={styles.footerText}>{item.listaFotos.length} fotos</Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <FlatList
                data={logs}
                renderItem={renderLog}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContainer}
                onEndReached={() => {
                    if (!loadingMore && lastDoc) {
                        loadLogs(true);
                    }
                }}
                onEndReachedThreshold={0.5}
                ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color={COLORS.primary} style={{ margin: 20 }} /> : null}
                ListEmptyComponent={
                    <EmptyState 
                        icon="book" 
                        title="No hay reportes registrados" 
                        description="Registra el primer reporte de trabajo para este proyecto."
                        actionLabel="Crear Reporte"
                        onAction={openNewModal}
                    />
                }
            />

            <View style={{ position: 'absolute', bottom: 16, right: SPACING.lg, gap: 12 }}>
                {logs.length > 0 && (
                    <GlobalFAB 
                        icon="download" 
                        color={COLORS.success} 
                        style={{ position: 'relative', bottom: 0, right: 0 }} 
                        onPress={handleExport} 
                    />
                )}
                
                <GlobalFAB 
                    icon="edit-3" 
                    style={{ position: 'relative', bottom: 0, right: 0 }} 
                    onPress={openNewModal} 
                />
            </View>

            {/* New / Edit Modal */}
            <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={closeModal}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{editingId ? 'Editar Bitácora' : 'Nueva Bitácora'}</Text>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Clima</Text>
                            <View style={styles.climaRow}>
                                {(['soleado', 'nublado', 'lluvia'] as const).map(c => (
                                    <TouchableOpacity
                                        key={c}
                                        style={[styles.climaBtn, clima === c && styles.climaBtnActive]}
                                        onPress={() => setClima(c)}
                                    >
                                        <Text style={[styles.climaBtnText, clima === c && styles.climaBtnTextActive]}>
                                            {c.charAt(0).toUpperCase() + c.slice(1)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Actividades del Día</Text>
                            <TextInput
                                style={[styles.input, { height: 100 }]}
                                value={actividades}
                                onChangeText={setActividades}
                                placeholder="Describa el trabajo realizado..."
                                placeholderTextColor={COLORS.textMuted}
                                multiline
                                textAlignVertical="top"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Observaciones (Opcional)</Text>
                            <TextInput
                                style={[styles.input, { height: 80 }]}
                                value={observaciones}
                                onChangeText={setObservaciones}
                                placeholder="Retrasos, accidentes, novedades..."
                                placeholderTextColor={COLORS.textMuted}
                                multiline
                                textAlignVertical="top"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Fotos ({imagenes.length})</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {imagenes.map((uri, index) => (
                                    <View key={`modal-img-${index}`} style={styles.thumbnailContainer}>
                                        <Image source={{ uri }} style={{ width: 60, height: 60, borderRadius: RADIUS.sm }} />
                                        <TouchableOpacity
                                            style={styles.deleteImageBtn}
                                            onPress={() => setImagenes(prev => prev.filter((_, i) => i !== index))}
                                        >
                                            <Icon name="x" size={12} color={COLORS.white} />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                                <TouchableOpacity style={styles.addPhotoBtn} onPress={pickImage}>
                                    <Icon name="image" size={22} color={COLORS.textMuted} />
                                    <Text style={{ color: COLORS.textMuted, fontSize: 9, marginTop: 2 }}>Galería</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.addPhotoBtn, { marginLeft: 6 }]} onPress={takePhoto}>
                                    <Icon name="camera" size={22} color={COLORS.textMuted} />
                                    <Text style={{ color: COLORS.textMuted, fontSize: 9, marginTop: 2 }}>Cámara</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={closeModal} disabled={isUploading}>
                                <Text style={styles.cancelText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: isUploading ? COLORS.textMuted : COLORS.primary }]} onPress={handleCreateOrUpdateLog} disabled={isUploading}>
                                <Text style={styles.confirmText}>{isUploading ? 'Subiendo...' : 'Guardar'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Full-screen image viewer */}
            <Modal visible={viewerVisible} transparent animationType="fade">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.96)', justifyContent: 'center', alignItems: 'center' }}>
                    <TouchableOpacity
                        style={{ position: 'absolute', top: 44, right: 20, zIndex: 10, padding: 8, backgroundColor: '#ffffff22', borderRadius: 20 }}
                        onPress={() => setViewerVisible(false)}
                    >
                        <Icon name="x" size={26} color={COLORS.white} />
                    </TouchableOpacity>
                    <Image
                        source={{ uri: viewerUri }}
                        style={{ width: screenWidth, height: screenHeight * 0.8 }}
                        resizeMode="contain"
                    />
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    listContainer: { padding: SPACING.md, paddingBottom: 100 },
    logCard: {
        backgroundColor: COLORS.surface, padding: SPACING.md, borderRadius: RADIUS.md,
        marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm,
    },
    logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border, marginBottom: SPACING.md },
    dateLabel: { flexDirection: 'row', alignItems: 'center' },
    dateText: { color: COLORS.white, fontWeight: 'bold', fontSize: FONTS.sizes.md, marginLeft: SPACING.sm, textTransform: 'capitalize' },
    weatherBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surfaceLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.round },
    weatherText: { fontSize: 10, fontWeight: 'bold', marginLeft: 4 },
    activitiesTitle: { color: COLORS.textSecondary, fontSize: FONTS.sizes.xs, textTransform: 'uppercase', marginBottom: 4 },
    activitiesText: { color: COLORS.white, fontSize: FONTS.sizes.md, lineHeight: 22, marginBottom: SPACING.md },
    obsContainer: { flexDirection: 'row', backgroundColor: COLORS.warning + '20', padding: SPACING.sm, borderRadius: RADIUS.sm, marginBottom: SPACING.md },
    obsText: { color: COLORS.warning, fontSize: FONTS.sizes.sm, marginLeft: SPACING.sm, flex: 1 },
    thumbnailCard: { width: 72, height: 72, borderRadius: RADIUS.sm, marginRight: 8 },
    footerInfo: { flexDirection: 'row', justifyContent: 'flex-start', paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border },
    footerItem: { flexDirection: 'row', alignItems: 'center', marginRight: SPACING.lg },
    footerText: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm, marginLeft: 6 },

    // Performance Monitoring
    performanceRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md, flexWrap: 'wrap' },
    perfBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.sm },
    perfBtnText: { fontSize: 11, fontWeight: 'bold', marginLeft: 6 },
    perfTimeBox: { flexDirection: 'row', alignItems: 'center' },
    perfTimeLabel: { color: COLORS.textMuted, fontSize: 11 },
    perfTimeValue: { color: COLORS.white, fontSize: 12, fontWeight: 'bold' },
    durationBadge: { backgroundColor: COLORS.primary + '30', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginLeft: 'auto' },
    durationText: { color: COLORS.info, fontSize: 11, fontWeight: 'bold' },


    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: SPACING.xl },
    modalContent: { backgroundColor: COLORS.surface, padding: SPACING.xl, borderRadius: RADIUS.lg },
    modalTitle: { color: COLORS.white, fontSize: FONTS.sizes.xl, fontWeight: 'bold', marginBottom: SPACING.lg },
    inputGroup: { marginBottom: SPACING.md },
    inputLabel: { color: COLORS.textSecondary, marginBottom: 8 },
    input: { backgroundColor: COLORS.surfaceLight, color: COLORS.white, padding: SPACING.md, borderRadius: RADIUS.md },
    climaRow: { flexDirection: 'row', justifyContent: 'space-between' },
    climaBtn: { flex: 1, padding: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.surfaceLight, alignItems: 'center', marginHorizontal: 4 },
    climaBtnActive: { backgroundColor: COLORS.primary },
    climaBtnText: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm },
    climaBtnTextActive: { color: COLORS.white, fontWeight: 'bold' },
    addPhotoBtn: { width: 60, height: 60, borderRadius: RADIUS.sm, backgroundColor: COLORS.surfaceLight, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderStyle: 'dashed', marginLeft: 8 },
    thumbnailContainer: { marginRight: 8, position: 'relative' },
    deleteImageBtn: { position: 'absolute', top: -5, right: -5, backgroundColor: COLORS.danger, width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: SPACING.lg },
    cancelBtn: { padding: SPACING.md, marginRight: SPACING.sm },
    cancelText: { color: COLORS.textSecondary, fontWeight: 'bold' },
    confirmBtn: { paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderRadius: RADIUS.md },
    confirmText: { color: COLORS.white, fontWeight: 'bold' },
});

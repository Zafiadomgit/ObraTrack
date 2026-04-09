import React, { useState, useMemo } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, Modal,
    TextInput, ScrollView, Alert, SectionList
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePersonnelStore, Worker, MemberRole } from '../store/personnelStore';
import { useAppStore } from '../../../store/appStore';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../../core/theme';
import Icon from '@expo/vector-icons/Feather';
import { es } from 'date-fns/locale';
import { ExportService } from '../../../core/services/exportService';

const ROLE_LABELS: Record<MemberRole, string> = {
    lider: '👷 Líder',
    tecnico: '🔧 Técnico',
    ayudante: '🪛 Ayudante',
};

const ROLE_COLORS: Record<MemberRole, string> = {
    lider: COLORS.primary,
    tecnico: COLORS.info,
    ayudante: COLORS.success,
};

const CUADRILLA_NAMES = ['Cuadrilla A', 'Cuadrilla B', 'Cuadrilla C', 'Cuadrilla D', 'Cuadrilla E'];

export default function PersonnelScreen() {
    const insets = useSafeAreaInsets();
    const route = useRoute<any>();
    const { projectId } = route.params;
    const isGlobal = projectId === 'all';
    const currentUser = useAppStore(state => state.user);
    const { addWorker, updateWorker, deleteWorker, registrarDia, quitarDia, addCrewToProject, subscribeToPersonnel, unsubscribeFromPersonnel } = usePersonnelStore();
    const allWorkers = usePersonnelStore(state => state.workers).filter(w => w.userId === currentUser?.id || currentUser?.role === 'admin');
    const crews = usePersonnelStore(state => state.crews).filter(c => !c.userId || c.userId === currentUser?.id || currentUser?.role === 'admin');

    React.useEffect(() => {
        if (currentUser) {
            const companyId = currentUser.companyId || 'default-company';
            subscribeToPersonnel(currentUser.id, companyId, currentUser.role);
        }
        return () => unsubscribeFromPersonnel();
    }, [currentUser]);

    const workers = isGlobal ? allWorkers : allWorkers.filter(w => w.projectId === projectId);

    // Group workers by cuadrilla
    const cuadrillas = useMemo(() => {
        const groups: Record<string, Worker[]> = {};
        workers.forEach(w => {
            const key = w.cuadrilla || 'Sin Asignar';
            if (!groups[key]) groups[key] = [];
            groups[key].push(w);
        });
        return Object.entries(groups).map(([title, data]) => ({ title, data }));
    }, [workers]);

    // ─── Add/Edit modal state ──────────────────────────────────────
    const [modalVisible, setModalVisible] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingVersion, setEditingVersion] = useState<number>(1);
    const [nombre, setNombre] = useState('');
    const [rol, setRol] = useState<MemberRole>('tecnico');
    const [cargo, setCargo] = useState('Técnico');
    const [cuadrilla, setCuadrilla] = useState('Cuadrilla A');
    const [costoDia, setCostoDia] = useState('');

    // ─── Crew import state ────────────────────────────────────────
    const [crewModalVisible, setCrewModalVisible] = useState(false);

    // ─── Attendance modal state ────────────────────────────────────
    const [attendanceWorker, setAttendanceWorker] = useState<Worker | null>(null);
    const [attendanceModal, setAttendanceModal] = useState(false);

    const openAdd = () => {
        setEditingId(null);
        setEditingVersion(1);
        setNombre(''); setRol('tecnico'); setCargo('Técnico'); setCuadrilla('Cuadrilla A'); setCostoDia('');
        setModalVisible(true);
    };

    const openEdit = (w: Worker) => {
        setEditingId(w.id);
        setEditingVersion(w.version || 1);
        setNombre(w.nombre); setRol(w.rol); setCargo(w.cargo || ''); setCuadrilla(w.cuadrilla); setCostoDia(w.costoDia.toString());
        setModalVisible(true);
    };

    const handleSave = async () => {
        if (!nombre.trim() || !cuadrilla.trim() || isNaN(Number(costoDia))) {
            Alert.alert('Error', 'Por favor completa los campos correctamente');
            return;
        }

        // Validate: each cuadrilla can only have 1 lider
        if (rol === 'lider') {
            const existingLider = workers.find(
                w => w.cuadrilla === cuadrilla && w.rol === 'lider' && w.id !== editingId
            );
            if (existingLider) {
                Alert.alert('Un solo líder por cuadrilla', `"${cuadrilla}" ya tiene a ${existingLider.nombre} como líder.`);
                return;
            }
        }

        const companyId = currentUser?.companyId || 'default-company';
        const data = { nombre, rol, cargo, cuadrilla, costoDia: Number(costoDia), projectId, userId: currentUser?.id || 'unknown', companyId };

        try {
            if (editingId) {
                await updateWorker(editingId, editingVersion, data, companyId);
            } else {
                await addWorker(data, companyId);
            }
            setModalVisible(false);
        } catch (e) {
            Alert.alert('Error', 'No se pudo guardar la información.');
        }
    };

    const handleDelete = (w: Worker) => {
        const companyId = currentUser?.companyId || 'default-company';
        Alert.alert('Eliminar miembro', `¿Eliminar a "${w.nombre}" de la cuadrilla?`, [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Eliminar', style: 'destructive', onPress: async () => await deleteWorker(w.id, companyId) },
        ]);
    };

    const toggleDia = async (worker: Worker, fechaStr: string) => {
        try {
            const companyId = currentUser?.companyId || 'default-company';
            if (worker.diasTrabajados.includes(fechaStr)) {
                await quitarDia(worker.id, worker.version || 1, fechaStr, companyId);
            } else {
                await registrarDia(worker.id, worker.version || 1, fechaStr, companyId);
            }
        } catch (e) {
            console.error('Error toggling day', e);
        }
    };

    const openAttendance = (w: Worker) => {
        setAttendanceWorker(w);
        setAttendanceModal(true);
    };

    const handleImportCrew = async (crewId: string) => {
        try {
            const companyId = currentUser?.companyId || 'default-company';
            await addCrewToProject(crewId, projectId, currentUser?.id || 'unknown', companyId);
            setCrewModalVisible(false);
            Alert.alert('Éxito', 'Cuadrilla importada correctamente');
        } catch (e) {
            Alert.alert('Error', 'No se pudo importar la cuadrilla');
        }
    };

    // Last 14 days for attendance picker
    const last14Days = Array.from({ length: 14 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d;
    });

    const handleExport = async () => {
        if (!currentUser) return;
        const exportData = workers.map(w => ({
            'Nombre': w.nombre,
            'Rol': ROLE_LABELS[w.rol],
            'Cargo': w.cargo || 'N/A',
            'Cuadrilla': w.cuadrilla,
            'Costo por Día': w.costoDia,
            'Días Trabajados': w.diasTrabajados.length,
            'Costo Total': w.costoDia * w.diasTrabajados.length
        }));
        await ExportService.exportToExcel(
            currentUser.companyId || 'default-company',
            currentUser.id,
            exportData,
            `Personal_${projectId}_${format(new Date(), 'yyyyMMdd')}`,
            'Personal'
        );
    };

    // ─── Render a single worker card ─────────────────────────────
    const renderWorker = ({ item }: { item: Worker }) => (
        <View style={styles.workerCard}>
            <View style={styles.workerLeft}>
                <View style={[styles.roleCircle, { backgroundColor: ROLE_COLORS[item.rol] + '25' }]}>
                    <Text style={{ fontSize: 18 }}>{item.rol === 'lider' ? '👷' : item.rol === 'tecnico' ? '🔧' : '🪛'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.workerName}>
                        {item.nombre} {isGlobal ? ` - ${item.cuadrilla}` : ''}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={[styles.roleBadge, { backgroundColor: ROLE_COLORS[item.rol] + '22' }]}>
                            <Text style={[styles.roleText, { color: ROLE_COLORS[item.rol] }]}>
                                {item.cargo || ROLE_LABELS[item.rol]}
                            </Text>
                        </View>
                        {isGlobal && (
                            <View style={[styles.roleBadge, { backgroundColor: COLORS.primary + '22' }]}>
                                <Text style={[styles.roleText, { color: COLORS.info }]}>💰 ${item.costoDia.toLocaleString()}/día</Text>
                            </View>
                        )}
                    </View>
                    {!isGlobal && (
                        <Text style={styles.costText}>${item.costoDia.toLocaleString()}/día · {item.diasTrabajados.length} días trabajados</Text>
                    )}
                </View>
            </View>
            {!isGlobal && (
                <View style={styles.workerActions}>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => openAttendance(item)}>
                        <Icon name="calendar" size={16} color={COLORS.info} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => openEdit(item)}>
                        <Icon name="edit-2" size={16} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => handleDelete(item)}>
                        <Icon name="trash-2" size={16} color={COLORS.danger} />
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );

    // ─── Render a cuadrilla section header ───────────────────────
    const renderSectionHeader = ({ section }: { section: { title: string; data: Worker[] } }) => {
        const lidera = section.data.find(w => w.rol === 'lider');
        const totalDias = section.data.reduce((sum, w) => sum + w.diasTrabajados.length, 0);
        const costoDiario = section.data.reduce((sum, w) => sum + w.costoDia, 0);
        return (
            <View style={styles.sectionHeader}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.sectionTitle}>{section.title}</Text>
                    <Text style={styles.sectionSub}>
                        {section.data.length} miembro{section.data.length !== 1 ? 's' : ''}
                        {lidera ? ` · Líder: ${lidera.nombre}` : ' · Sin líder'}
                    </Text>
                </View>
                <View style={styles.sectionStats}>
                    <Text style={styles.sectionStatLabel}>{totalDias} días</Text>
                    <Text style={styles.sectionStatLabel}>${costoDiario.toLocaleString()}/día</Text>
                </View>
            </View>
        );
    };

    const totalWorkers = workers.length;
    const totalDias = workers.reduce((s, w) => s + w.diasTrabajados.length, 0);
    const costoTotal = workers.reduce((s, w) => s + w.costoDia * w.diasTrabajados.length, 0);

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
            {/* Totals Banner */}
            <View style={styles.banner}>
                <View style={styles.bannerItem}>
                    <Text style={styles.bannerValue}>{totalWorkers}</Text>
                    <Text style={styles.bannerLabel}>Total miembros</Text>
                </View>
                <View style={styles.bannerDivider} />
                <View style={styles.bannerItem}>
                    <Text style={styles.bannerValue}>{cuadrillas.length}</Text>
                    <Text style={styles.bannerLabel}>Cuadrillas</Text>
                </View>
                <View style={styles.bannerDivider} />
                <View style={styles.bannerItem}>
                    <Text style={styles.bannerValue}>{totalDias}</Text>
                    <Text style={styles.bannerLabel}>Días registrados</Text>
                </View>
                <View style={styles.bannerDivider} />
                <View style={styles.bannerItem}>
                    <Text style={[styles.bannerValue, { color: COLORS.success }]}>${(costoTotal / 1000).toFixed(0)}K</Text>
                    <Text style={styles.bannerLabel}>Costo acum.</Text>
                </View>
            </View>

            <SectionList
                sections={cuadrillas}
                renderItem={renderWorker}
                renderSectionHeader={renderSectionHeader}
                keyExtractor={item => item.id}
                contentContainerStyle={{ padding: SPACING.md, paddingBottom: 100 }}
                stickySectionHeadersEnabled={false}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Icon name="users" size={48} color={COLORS.textMuted} />
                        <Text style={styles.emptyText}>No hay cuadrillas registradas</Text>
                        <Text style={styles.emptySub}>Agrega el primer miembro con el botón +</Text>
                    </View>
                }
            />

            <View style={{ position: 'absolute', bottom: 20 + insets.bottom, right: SPACING.lg, gap: 12 }}>
                {workers.length > 0 && (
                    <TouchableOpacity
                        style={[styles.fab, { position: 'relative', bottom: 0, right: 0, backgroundColor: COLORS.success }]}
                        onPress={handleExport}
                    >
                        <Icon name="download" size={22} color={COLORS.white} />
                    </TouchableOpacity>
                )}
                {!isGlobal && (
                    <>
                        <TouchableOpacity
                            style={[styles.fab, { position: 'relative', bottom: 0, right: 0, backgroundColor: COLORS.info }]}
                            onPress={() => setCrewModalVisible(true)}
                        >
                            <Icon name="users" size={22} color={COLORS.white} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.fab, { position: 'relative', bottom: 0, right: 0 }]}
                            onPress={openAdd}
                        >
                            <Icon name="user-plus" size={22} color={COLORS.white} />
                        </TouchableOpacity>
                    </>
                )}
            </View>

            {/* ── Crew Import Modal ── */}
            <Modal visible={crewModalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Importar Cuadrilla</Text>
                            <TouchableOpacity onPress={() => setCrewModalVisible(false)}>
                                <Icon name="x" size={22} color={COLORS.textMuted} />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.inputLabel}>Selecciona una plantilla guardada:</Text>
                        <ScrollView style={{ maxHeight: 300 }}>
                            {crews.map(c => (
                                <TouchableOpacity
                                    key={c.id}
                                    style={styles.crewSelectItem}
                                    onPress={() => handleImportCrew(c.id)}
                                >
                                    <View>
                                        <Text style={styles.crewSelectName}>{c.nombre}</Text>
                                        <Text style={styles.crewSelectSub}>{c.miembros.length} Miembros</Text>
                                    </View>
                                    <Icon name="chevron-right" size={18} color={COLORS.textMuted} />
                                </TouchableOpacity>
                            ))}
                            {crews.length === 0 && (
                                <Text style={{ color: COLORS.textMuted, textAlign: 'center', padding: 20 }}>
                                    No hay plantillas de cuadrillas guardadas.
                                </Text>
                            )}
                        </ScrollView>
                        <TouchableOpacity
                            style={[styles.cancelBtn, { marginTop: 12, borderStyle: 'dashed' }]}
                            onPress={() => setCrewModalVisible(false)}
                        >
                            <Text style={[styles.cancelText, { textAlign: 'center' }]}>Cerrar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ── Add / Edit Member Modal ── */}
            <Modal visible={modalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{editingId ? 'Editar Miembro' : 'Nuevo Miembro'}</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Icon name="x" size={22} color={COLORS.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={styles.inputLabel}>Nombre completo</Text>
                            <TextInput style={styles.input} value={nombre} onChangeText={setNombre}
                                placeholder="Ej. Pedro Ramírez" placeholderTextColor={COLORS.textMuted} />

                            <Text style={styles.inputLabel}>Cargo / Puesto (Rol específico)</Text>
                            <TextInput style={styles.input} value={cargo} onChangeText={setCargo}
                                placeholder="Ej. Plomero, Electricista..." placeholderTextColor={COLORS.textMuted} />

                            <Text style={styles.inputLabel}>Cuadrilla</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.md }}>
                                {CUADRILLA_NAMES.map(q => (
                                    <TouchableOpacity key={q} style={[styles.chipBtn, cuadrilla === q && styles.chipBtnActive]}
                                        onPress={() => setCuadrilla(q)}>
                                        <Text style={[styles.chipText, cuadrilla === q && styles.chipTextActive]}>{q}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            <Text style={styles.inputLabel}>Rol en la cuadrilla</Text>
                            <View style={styles.roleRow}>
                                {(['lider', 'tecnico', 'ayudante'] as MemberRole[]).map(r => (
                                    <TouchableOpacity key={r} style={[styles.roleBtn, rol === r && { backgroundColor: ROLE_COLORS[r] + '30', borderColor: ROLE_COLORS[r] }]}
                                        onPress={() => setRol(r)}>
                                        <Text style={[styles.roleBtnText, rol === r && { color: ROLE_COLORS[r], fontWeight: 'bold' }]}>
                                            {ROLE_LABELS[r]}
                                        </Text>
                                        {r === 'lider' && <Text style={styles.roleBtnHint}>max 1 por cuadrilla</Text>}
                                    </TouchableOpacity>
                                ))}
                            </View>
                            {rol === 'lider' && <Text style={{ color: COLORS.warning, fontSize: 11, marginBottom: SPACING.sm }}>⚠ Solo puede haber un líder por cuadrilla</Text>}

                            <Text style={styles.inputLabel}>Costo por día ($)</Text>
                            <TextInput style={styles.input} value={costoDia} onChangeText={setCostoDia}
                                keyboardType="numeric" placeholder="Ej. 120000" placeholderTextColor={COLORS.textMuted} />
                        </ScrollView>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                                <Text style={styles.cancelText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.confirmBtn} onPress={handleSave}>
                                <Icon name="check" size={16} color={COLORS.white} />
                                <Text style={styles.confirmText}>Guardar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ── Attendance / Days Worked Modal ── */}
            <Modal visible={attendanceModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>Asistencia</Text>
                                <Text style={{ color: COLORS.info, fontSize: FONTS.sizes.sm }}>
                                    {attendanceWorker?.nombre}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setAttendanceModal(false)}>
                                <Icon name="x" size={22} color={COLORS.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.inputLabel}>
                            Días trabajados: {attendanceWorker?.diasTrabajados.length || 0}
                        </Text>
                        <Text style={{ color: COLORS.textMuted, fontSize: FONTS.sizes.xs, marginBottom: SPACING.sm }}>
                            Toca un día para marcar/desmarcar asistencia (últimos 14 días)
                        </Text>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {last14Days.map(date => {
                                const fechaStr = format(date, 'yyyy-MM-dd');
                                const dayLabel = format(date, "EEEE d MMM", { locale: es });
                                const worked = attendanceWorker?.diasTrabajados.includes(fechaStr);
                                // Re-read from store for live updates
                                const liveWorker = allWorkers.find(w => w.id === attendanceWorker?.id);
                                const liveWorked = liveWorker?.diasTrabajados.includes(fechaStr);
                                return (
                                    <TouchableOpacity key={fechaStr}
                                        style={[styles.dayRow, liveWorked && styles.dayRowActive]}
                                        onPress={() => attendanceWorker && toggleDia(attendanceWorker, fechaStr)}>
                                        <View style={[styles.dayCheckbox, liveWorked && styles.dayCheckboxChecked]}>
                                            {liveWorked && <Icon name="check" size={13} color={COLORS.white} />}
                                        </View>
                                        <Text style={[styles.dayLabel, liveWorked && { color: COLORS.white }]} numberOfLines={1}>
                                            {dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1)}
                                        </Text>
                                        {liveWorked && (
                                            <Text style={{ color: COLORS.success, fontSize: 11, marginLeft: 'auto' }}>
                                                ✓ Trabajó
                                            </Text>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        {attendanceWorker && (
                            <View style={[styles.previewBox, { marginTop: SPACING.md }]}>
                                <Icon name="dollar-sign" size={14} color={COLORS.success} />
                                <Text style={[styles.previewText, { color: COLORS.success }]}>
                                    Costo acumulado: $
                                    {((allWorkers.find(w => w.id === attendanceWorker.id)?.diasTrabajados.length || 0) * attendanceWorker.costoDia).toLocaleString()}
                                </Text>
                            </View>
                        )}

                        <TouchableOpacity style={[styles.confirmBtn, { marginTop: SPACING.md, alignSelf: 'flex-end' }]}
                            onPress={() => setAttendanceModal(false)}>
                            <Text style={styles.confirmText}>Listo</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    banner: { flexDirection: 'row', backgroundColor: COLORS.surface, padding: SPACING.md, justifyContent: 'space-around', borderBottomWidth: 1, borderBottomColor: COLORS.border },
    bannerItem: { alignItems: 'center' },
    bannerValue: { color: COLORS.info, fontSize: FONTS.sizes.xl, fontWeight: 'bold' },
    bannerLabel: { color: COLORS.textMuted, fontSize: 10, marginTop: 2, textAlign: 'center' },
    bannerDivider: { width: 1, backgroundColor: COLORS.border },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surfaceLight, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, marginTop: SPACING.sm },
    sectionTitle: { color: COLORS.white, fontWeight: 'bold', fontSize: FONTS.sizes.md },
    sectionSub: { color: COLORS.textMuted, fontSize: FONTS.sizes.xs, marginTop: 2 },
    sectionStats: { alignItems: 'flex-end' },
    sectionStatLabel: { color: COLORS.textSecondary, fontSize: FONTS.sizes.xs },
    workerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm },
    workerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    roleCircle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginRight: SPACING.sm },
    workerName: { color: COLORS.white, fontWeight: 'bold', fontSize: FONTS.sizes.md },
    roleBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 2 },
    roleText: { fontSize: 10, fontWeight: 'bold' },
    costText: { color: COLORS.textMuted, fontSize: FONTS.sizes.xs, marginTop: 3 },
    workerActions: { flexDirection: 'row', gap: 4 },
    iconBtn: { padding: 8, backgroundColor: COLORS.surfaceLight, borderRadius: RADIUS.sm },
    fab: { position: 'absolute', bottom: 16, right: SPACING.lg, backgroundColor: COLORS.primary, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', ...SHADOWS.lg },
    emptyState: { alignItems: 'center', padding: SPACING.xxl, marginTop: 40 },
    emptyText: { color: COLORS.white, fontWeight: 'bold', fontSize: FONTS.sizes.md, marginTop: SPACING.md },
    emptySub: { color: COLORS.textMuted, fontSize: FONTS.sizes.sm, marginTop: 4 },
    // Modals
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.xl, maxHeight: '90%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.lg },
    modalTitle: { color: COLORS.white, fontSize: FONTS.sizes.xl, fontWeight: 'bold' },
    inputLabel: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm, marginBottom: 6, fontWeight: '600' },
    input: { backgroundColor: COLORS.surfaceLight, color: COLORS.white, padding: SPACING.md, borderRadius: RADIUS.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
    chipBtn: { paddingHorizontal: SPACING.md, paddingVertical: 8, borderRadius: RADIUS.round, backgroundColor: COLORS.surfaceLight, borderWidth: 1, borderColor: COLORS.border, marginRight: SPACING.sm, marginBottom: SPACING.md },
    chipBtnActive: { backgroundColor: COLORS.primary + '30', borderColor: COLORS.primary },
    chipText: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm },
    chipTextActive: { color: COLORS.info, fontWeight: 'bold' },
    roleRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
    roleBtn: { flex: 1, padding: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.surfaceLight, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
    roleBtnText: { color: COLORS.textSecondary, fontSize: FONTS.sizes.xs },
    roleBtnHint: { color: COLORS.textMuted, fontSize: 9, marginTop: 2 },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.sm, marginTop: SPACING.md },
    cancelBtn: { padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
    cancelText: { color: COLORS.textSecondary, fontWeight: 'bold' },
    confirmBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderRadius: RADIUS.md, gap: 4 },
    confirmText: { color: COLORS.white, fontWeight: 'bold' },
    previewBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.success + '15', borderRadius: RADIUS.md, padding: SPACING.sm, gap: SPACING.sm },
    previewText: { fontSize: FONTS.sizes.sm, flex: 1 },
    // Attendance
    dayRow: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, borderRadius: RADIUS.md, marginBottom: 6, backgroundColor: COLORS.surfaceLight, borderWidth: 1, borderColor: COLORS.border },
    dayRowActive: { backgroundColor: COLORS.primary + '20', borderColor: COLORS.primary },
    dayCheckbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', marginRight: SPACING.sm },
    dayCheckboxChecked: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    dayLabel: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm, textTransform: 'capitalize' },
    crewSelectItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md, backgroundColor: COLORS.surfaceLight, borderRadius: RADIUS.md, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border },
    crewSelectName: { color: COLORS.white, fontWeight: 'bold', fontSize: FONTS.sizes.md },
    crewSelectSub: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
});

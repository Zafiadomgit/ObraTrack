import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '../../../store/appStore';
import { useProjectStore, Project } from '../store/projectStore';
import { useMaterialStore } from '../../materials/store/materialStore';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../../core/theme';
import Icon from '@expo/vector-icons/Feather';
import GlobalFAB from '../../../components/GlobalFAB';
import EmptyState from '../../../components/EmptyState';
import { useSubscription } from '../../auth/hooks/useSubscription';
import { PLAN_PRICES, ADDON_PRICES, PlanTier } from '../../../core/constants/plans';
import {
    ProjectType,
    PROJECT_TYPE_LABELS,
    PROJECT_TYPE_ICONS,
    getStandardMaterials,
} from '../../materials/data/standardMaterials';
import { differenceInDays, parseISO, format } from 'date-fns';
import { ExportService } from '../../../core/services/exportService';
import EditProjectModal from '../components/EditProjectModal';

const PROJECT_TYPES: ProjectType[] = [
    'obras_civiles',
    'edificios_casas',
    'torres_telecomunicaciones',
    'otro',
];

const PROJECT_TYPE_DESCRIPTIONS: Record<ProjectType, string> = {
    obras_civiles: 'Puentes, vías, represas, infraestructura vial',
    edificios_casas: 'Estructuras en altura, residencias y acabados',
    torres_telecomunicaciones: 'Antenas, torres y cimentación especializada',
    otro: 'Proyecto con materiales personalizados',
};

function getTypeIcon(tipo: ProjectType): keyof typeof Icon.glyphMap {
    const icons: Record<ProjectType, keyof typeof Icon.glyphMap> = {
        obras_civiles: 'anchor',
        edificios_casas: 'home',
        torres_telecomunicaciones: 'radio',
        otro: 'tool',
    };
    return icons[tipo];
}

function getDeadlineStatus(fechaFin?: string): { label: string; color: string; urgent: boolean } | null {
    if (!fechaFin) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let fin: Date;
    try { fin = parseISO(fechaFin); } catch { return null; }
    const days = differenceInDays(fin, today);
    if (days < 0) return { label: `Venció hace ${Math.abs(days)} día${Math.abs(days) !== 1 ? 's' : ''}`, color: COLORS.danger, urgent: true };
    if (days === 0) return { label: '⚠ Vence HOY', color: COLORS.danger, urgent: true };
    if (days <= 7) return { label: `⚠ Vence en ${days} día${days !== 1 ? 's' : ''}`, color: COLORS.warning, urgent: true };
    if (days <= 30) return { label: `📅 ${days} días restantes`, color: COLORS.info, urgent: false };
    return null;
}

export default function HomeScreen({ navigation: propNavigation }: any) {
    const insets = useSafeAreaInsets();
    const { user } = useAppStore();
    const companyId = user?.companyId || 'default-company';
    const allProjects = useProjectStore(state => state.projects);
    const isAdminOrCoord = user?.role === 'admin' || user?.role === 'coordinador';
    const projects = isAdminOrCoord ? allProjects : allProjects.filter(p => p.userId === user?.id || p.collaborators?.includes(user?.id!));
    const addProject = useProjectStore(state => state.addProject);
    const deleteProject = useProjectStore(state => state.deleteProject);
    const addMaterial = useMaterialStore(state => state.addMaterial);
    
    const hookNavigation = useNavigation<any>();
    const navigation = propNavigation?.navigate ? propNavigation : hookNavigation;
    const { canCreateProject, projectsLimit, planName } = useSubscription();

    const [modalVisible, setModalVisible] = useState(false);

    const handleOpenCreate = () => {
        if (!canCreateProject) {
            const limit = projectsLimit === Infinity ? '∞' : projectsLimit;
            const planLabel = PLAN_PRICES[planName as PlanTier]?.label ?? planName;
            Alert.alert(
                '🔒 Límite de proyectos',
                `Tu plan ${planLabel} permite máximo ${limit} proyecto(s).\n\nPuedes habilitar obras extra por ${ADDON_PRICES.EXTRA_PROJECT.price}/mes c/u, o actualizar tu plan a Ilimitado.`,
                [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Ver Planes', onPress: () => navigation.navigate('Subscription') },
                ]
            );
            return;
        }
        setModalVisible(true);
    };
    const [newNombre, setNewNombre] = useState('');
    const [newUbicacion, setNewUbicacion] = useState('');
    const [newFechaFin, setNewFechaFin] = useState('');
    const [tipoProyecto, setTipoProyecto] = useState<ProjectType>('edificios_casas');

    const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);

    const handleCreateProject = async () => {
        if (!newNombre.trim() || !newUbicacion.trim() || !user) {
            Alert.alert('Campos requeridos', 'Por favor completa nombre y ubicación del proyecto.');
            return;
        }
        // Validate date format
        if (newFechaFin && !/^\d{4}-\d{2}-\d{2}$/.test(newFechaFin)) {
            Alert.alert('Formato de fecha', 'La fecha de fin debe tener formato AAAA-MM-DD');
            return;
        }

        try {
            const id = await addProject({
                nombreProyecto: newNombre.trim(),
                ubicacion: newUbicacion.trim(),
                fechaInicio: new Date().toISOString().split('T')[0],
                fechaFin: newFechaFin.trim() || undefined,
                userId: user.id,
                companyId,
                tipoProyecto,
            });

            const standardMats = getStandardMaterials(tipoProyecto, id, user.id, companyId);
            standardMats.forEach(m => addMaterial(m, companyId));

            setModalVisible(false);
            setNewNombre(''); setNewUbicacion(''); setNewFechaFin('');
            setTipoProyecto('edificios_casas');

            Alert.alert(
                '✅ Proyecto creado',
                `Se cargaron ${standardMats.length} materiales estándar. Puedes editarlos en la pestaña Materiales.`,
                [{ text: 'Entendido' }]
            );
        } catch (error) {
            console.error('Error creating project:', error);
            Alert.alert('Error', 'No se pudo crear el proyecto.');
        }
    };

    const handleExport = async () => {
        if (!user) return;
        const exportData = projects.map(p => ({
            'Nombre del Proyecto': p.nombreProyecto,
            'Ubicación': p.ubicacion,
            'Estado': p.estado.toUpperCase(),
            'Tipo': p.tipoProyecto ? PROJECT_TYPE_LABELS[p.tipoProyecto] : 'N/A',
            'Fecha Inicio': p.fechaInicio,
            'Fecha Fin': p.fechaFin || 'N/A',
        }));
        
        await ExportService.exportToExcel(
            companyId,
            user.id,
            exportData,
            `Proyectos_${format(new Date(), 'yyyyMMdd')}`,
            'Proyectos'
        );
    };

    const renderProject = ({ item }: { item: Project }) => {
        const deadlineStatus = getDeadlineStatus(item.fechaFin);
        return (
            <TouchableOpacity
                style={styles.projectCard}
                onPress={() => navigation.navigate('ProjectDashboard', {
                    projectId: item.id,
                    projectName: item.nombreProyecto
                })}
            >
                <View style={styles.cardHeader}>
                    <View style={styles.iconBox}>
                        <Icon name={getTypeIcon(item.tipoProyecto || 'otro')} size={22} color={COLORS.primary} />
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {['superAdmin', 'coordinador', 'lider'].includes(user?.role || '') && (
                            <TouchableOpacity
                                onPress={() => setProjectToEdit(item)}
                                style={styles.editBtn}
                            >
                                <Icon name="edit-2" size={18} color={COLORS.primary} />
                            </TouchableOpacity>
                        )}

                        {['superAdmin', 'coordinador'].includes(user?.role || '') && (
                            <TouchableOpacity
                                onPress={(e) => {
                                    Alert.alert(
                                        'Eliminar Proyecto',
                                        `¿Estás seguro de eliminar "${item.nombreProyecto}"? Esta acción no se puede deshacer.`,
                                        [
                                            { text: 'Cancelar', style: 'cancel' },
                                            { text: 'Eliminar', style: 'destructive', onPress: () => deleteProject(item.id, companyId) },
                                        ]
                                    );
                                }}
                                style={styles.deleteBtn}
                            >
                                <Icon name="trash-2" size={18} color={COLORS.danger} />
                            </TouchableOpacity>
                        )}
                        <View style={styles.statusBadge}>
                            <Text style={styles.statusText}>{item.estado.toUpperCase()}</Text>
                        </View>
                    </View>
                </View>

                <Text style={styles.projectName} numberOfLines={1}>{item.nombreProyecto}</Text>

                {item.tipoProyecto && (
                    <View style={styles.typeBadge}>
                        <Text style={styles.typeText}>
                            {PROJECT_TYPE_ICONS[item.tipoProyecto]} {PROJECT_TYPE_LABELS[item.tipoProyecto]}
                        </Text>
                    </View>
                )}

                <View style={[styles.infoRow, { marginTop: SPACING.xs }]}>
                    <Icon name="map-pin" size={14} color={COLORS.textMuted} />
                    <Text style={styles.infoText} numberOfLines={1}>{item.ubicacion}</Text>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.topBar}>
                <Text style={styles.sectionTitle}>
                    Tus Obras ({projects.length}{projectsLimit !== Infinity ? `/${projectsLimit}` : ''})
                </Text>
                {!canCreateProject && (
                    <TouchableOpacity onPress={() => navigation.navigate('Subscription')} style={styles.upgradeBtn}>
                        <Icon name="zap" size={12} color={COLORS.warning} />
                        <Text style={styles.upgradeBtnText}>Actualizar Plan</Text>
                    </TouchableOpacity>
                )}
            </View>

            <FlatList
                data={projects}
                renderItem={renderProject}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContainer}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <EmptyState 
                        icon="folder-plus" 
                        title="No tienes proyectos activos" 
                        description="Crea tu primer proyecto para comenzar a registrar trabajos y reportes."
                        actionLabel="Crear Proyecto"
                        onAction={handleOpenCreate}
                    />
                }
            />

            {['superAdmin', 'coordinador', 'lider'].includes(user?.role || '') && (
                <GlobalFAB 
                    style={{ bottom: 20 + insets.bottom }}
                    onPress={handleOpenCreate} 
                />
            )}

            {/* ── New Project Modal ── */}
            <Modal visible={modalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Nuevo Proyecto</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Icon name="x" size={24} color={COLORS.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={styles.inputLabel}>Nombre del Proyecto *</Text>
                            <TextInput style={styles.input} value={newNombre} onChangeText={setNewNombre}
                                placeholder="Ej. Torre Central Norte" placeholderTextColor={COLORS.textMuted} />

                            <Text style={styles.inputLabel}>Ubicación *</Text>
                            <TextInput style={styles.input} value={newUbicacion} onChangeText={setNewUbicacion}
                                placeholder="Ej. Bogotá, Calle 80" placeholderTextColor={COLORS.textMuted} />

                            <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Fecha inicio</Text>
                                    <View style={[styles.input, { justifyContent: 'center' }]}>
                                        <Text style={{ color: COLORS.textPrimary }}>{new Date().toISOString().split('T')[0]}</Text>
                                    </View>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Fecha fin (opcional)</Text>
                                    <TextInput style={styles.input} value={newFechaFin} onChangeText={setNewFechaFin}
                                        placeholder="2026-12-31" placeholderTextColor={COLORS.textMuted}
                                        keyboardType="numbers-and-punctuation" maxLength={10} />
                                </View>
                            </View>

                            {newFechaFin.length >= 8 && (() => {
                                const status = getDeadlineStatus(newFechaFin);
                                return status ? (
                                    <View style={[styles.deadlineBadge, { backgroundColor: status.color + '22', borderColor: status.color, marginBottom: SPACING.sm }]}>
                                        <Text style={[styles.deadlineText, { color: status.color }]}>{status.label}</Text>
                                    </View>
                                ) : null;
                            })()}

                            <Text style={[styles.inputLabel, { marginTop: SPACING.sm }]}>Tipo de Proyecto *</Text>
                            <Text style={styles.typeHint}>Se cargará lista de materiales estándar según el tipo</Text>

                            {PROJECT_TYPES.map(tipo => (
                                <TouchableOpacity key={tipo}
                                    style={[styles.typeOption, tipoProyecto === tipo && styles.typeOptionSelected]}
                                    onPress={() => setTipoProyecto(tipo)} activeOpacity={0.7}>
                                    <View style={styles.typeOptionLeft}>
                                        <View style={[styles.typeIconBox, tipoProyecto === tipo && { backgroundColor: COLORS.primary + '30' }]}>
                                            <Icon name={getTypeIcon(tipo)} size={20} color={tipoProyecto === tipo ? COLORS.primary : COLORS.textSecondary} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.typeOptionTitle, tipoProyecto === tipo && { color: COLORS.info }]}>
                                                {PROJECT_TYPE_ICONS[tipo]} {PROJECT_TYPE_LABELS[tipo]}
                                            </Text>
                                            <Text style={styles.typeOptionDesc}>{PROJECT_TYPE_DESCRIPTIONS[tipo]}</Text>
                                        </View>
                                    </View>
                                    <View style={[styles.radioOuter, tipoProyecto === tipo && { borderColor: COLORS.primary }]}>
                                        {tipoProyecto === tipo && <View style={styles.radioInner} />}
                                    </View>
                                </TouchableOpacity>
                            ))}

                            <View style={styles.previewBox}>
                                <Icon name="package" size={16} color={COLORS.info} />
                                <Text style={styles.previewText}>
                                    Se cargarán{' '}
                                    <Text style={{ color: COLORS.info, fontWeight: 'bold' }}>
                                        {getStandardMaterials(tipoProyecto, '', '', companyId).length} materiales
                                    </Text>
                                    {' '}estándar. Editables y eliminables.
                                </Text>
                            </View>
                        </ScrollView>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                                <Text style={styles.cancelText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.confirmBtn} onPress={handleCreateProject}>
                                <Icon name="check" size={16} color={COLORS.white} />
                                <Text style={styles.confirmText}>Crear Proyecto</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {projectToEdit && (
                <EditProjectModal
                    visible={!!projectToEdit}
                    onClose={() => setProjectToEdit(null)}
                    project={projectToEdit}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.sm },
    sectionTitle: { color: COLORS.white, fontSize: FONTS.sizes.lg, fontWeight: 'bold' },
    upgradeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.warning + '20', paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.warning + '50' },
    upgradeBtnText: { color: COLORS.warning, fontSize: 11, fontWeight: 'bold' },
    listContainer: { padding: SPACING.md, paddingBottom: 110 },
    projectCard: {
        backgroundColor: COLORS.surface, padding: SPACING.md, borderRadius: RADIUS.lg,
        marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm,
        borderLeftWidth: 4, borderLeftColor: COLORS.primary,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
    iconBox: { width: 40, height: 40, borderRadius: RADIUS.md, backgroundColor: COLORS.primary + '20', alignItems: 'center', justifyContent: 'center' },
    statusBadge: { backgroundColor: COLORS.success + '25', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    statusText: { color: COLORS.success, fontSize: 10, fontWeight: 'bold' },
    editBtn: { padding: 6, backgroundColor: COLORS.primary + '15', borderRadius: RADIUS.sm },
    deleteBtn: { padding: 6, backgroundColor: COLORS.danger + '15', borderRadius: RADIUS.sm },
    projectName: { color: COLORS.white, fontSize: FONTS.sizes.lg, fontWeight: 'bold', marginBottom: 4 },
    typeBadge: { backgroundColor: COLORS.surfaceLight, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginBottom: SPACING.sm },
    typeText: { color: COLORS.textSecondary, fontSize: FONTS.sizes.xs },
    infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    infoText: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm, marginLeft: 6, flex: 1 },
    deadlineBadge: { marginTop: SPACING.sm, paddingHorizontal: SPACING.sm, paddingVertical: 5, borderRadius: RADIUS.sm, borderWidth: 1 },
    deadlineText: { fontSize: FONTS.sizes.xs, fontWeight: 'bold' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.xl, maxHeight: '93%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
    modalTitle: { color: COLORS.white, fontSize: FONTS.sizes.xl, fontWeight: 'bold' },
    inputLabel: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm, marginBottom: 6, fontWeight: '600' },
    input: { backgroundColor: COLORS.surfaceLight, color: COLORS.white, padding: SPACING.md, borderRadius: RADIUS.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
    typeHint: { color: COLORS.textMuted, fontSize: FONTS.sizes.xs, marginBottom: SPACING.sm, lineHeight: 18 },
    typeOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.surfaceLight, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
    typeOptionSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '12' },
    typeOptionLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    typeIconBox: { width: 36, height: 36, borderRadius: RADIUS.sm, backgroundColor: COLORS.surfaceLight, alignItems: 'center', justifyContent: 'center', marginRight: SPACING.sm },
    typeOptionTitle: { color: COLORS.white, fontWeight: 'bold', fontSize: FONTS.sizes.sm },
    typeOptionDesc: { color: COLORS.textMuted, fontSize: FONTS.sizes.xs, marginTop: 2 },
    radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
    radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
    previewBox: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: COLORS.info + '18', borderRadius: RADIUS.md, padding: SPACING.sm, marginTop: SPACING.sm, marginBottom: SPACING.md },
    previewText: { color: COLORS.textSecondary, fontSize: FONTS.sizes.xs, flex: 1, marginLeft: SPACING.sm, lineHeight: 18 },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: SPACING.md, gap: SPACING.sm },
    cancelBtn: { padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
    cancelText: { color: COLORS.textSecondary, fontWeight: 'bold' },
    confirmBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderRadius: RADIUS.md, gap: 6 },
    confirmText: { color: COLORS.white, fontWeight: 'bold' },
});

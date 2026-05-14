import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '../../../store/appStore';
import { useProjectStore, Project } from '../store/projectStore';
import { useMaterialStore } from '../../materials/store/materialStore';
import { FONTS, SPACING, RADIUS, SHADOWS } from '../../../core/theme';
import { useColors, ThemeColors } from '../../../core/theme/ThemeContext';
import { useT } from '../../../core/i18n';
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

function getDeadlineStatus(fechaFin: string | undefined, t: any, C: any): { label: string; color: string; urgent: boolean } | null {
    if (!fechaFin) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let fin: Date;
    try { fin = parseISO(fechaFin); } catch { return null; }
    const days = differenceInDays(fin, today);
    if (days < 0) return { label: t.expiredDaysAgo(Math.abs(days)), color: C.danger, urgent: true };
    if (days === 0) return { label: t.expiresToday, color: C.danger, urgent: true };
    if (days <= 7) return { label: t.expiresInDays(days), color: C.warning, urgent: true };
    if (days <= 30) return { label: t.expiresInDays(days), color: C.info, urgent: false };
    return null;
}

export default function HomeScreen({ navigation: propNavigation }: any) {
    const insets = useSafeAreaInsets();
    const C = useColors();
    const styles = useMemo(() => makeStyles(C), [C]);
    const t = useT();
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
            const limit = projectsLimit === Infinity ? '∞' : String(projectsLimit);
            const planLabel = PLAN_PRICES[planName as PlanTier]?.label ?? planName;
            Alert.alert(
                t.projectLimitTitle,
                t.projectLimitMessage(planLabel, limit, ADDON_PRICES.EXTRA_PROJECT.price),
                [
                    { text: t.cancel, style: 'cancel' },
                    { text: t.viewPlans, onPress: () => navigation.navigate('Subscription') },
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
            Alert.alert(t.requiredFields, t.fillNameAndLocation);
            return;
        }
        // Validate date format
        if (newFechaFin && !/^\d{4}-\d{2}-\d{2}$/.test(newFechaFin)) {
            Alert.alert(t.dateFormatError, t.dateFormatMessage);
            return;
        }

        try {
            const projectData: any = {
                nombreProyecto: newNombre.trim(),
                ubicacion: newUbicacion.trim(),
                fechaInicio: new Date().toISOString().split('T')[0],
                userId: user.id,
                companyId,
                tipoProyecto,
            };
            if (newFechaFin.trim()) projectData.fechaFin = newFechaFin.trim();

            const id = await addProject(projectData);

            const standardMats = getStandardMaterials(tipoProyecto, id, user.id, companyId);
            standardMats.forEach(m => addMaterial(m, companyId));

            setModalVisible(false);
            setNewNombre(''); setNewUbicacion(''); setNewFechaFin('');
            setTipoProyecto('edificios_casas');

            Alert.alert(
                t.projectCreated,
                t.projectCreatedMessage(standardMats.length),
                [{ text: t.understood }]
            );
        } catch (error: any) {
            console.error('Error creating project:', error);
            Alert.alert('Error', error?.message || 'No se pudo crear el proyecto.');
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

    const TYPE_COLORS: Record<string, string> = {
        obras_civiles: '#E67E22',
        edificios_casas: C.primary,
        torres_telecomunicaciones: '#9B59B6',
        otro: C.info,
    };

    const renderProject = ({ item }: { item: Project }) => {
        const deadlineStatus = getDeadlineStatus(item.fechaFin, t, C);
        const typeColor = TYPE_COLORS[item.tipoProyecto || 'otro'] || C.primary;
        return (
            <TouchableOpacity
                style={[styles.projectCard, { borderLeftColor: typeColor }]}
                onPress={() => navigation.navigate('ProjectDashboard', {
                    projectId: item.id,
                    projectName: item.nombreProyecto
                })}
                activeOpacity={0.85}
            >
                {/* Top row: icon + name + status */}
                <View style={styles.cardHeader}>
                    <View style={[styles.iconBox, { backgroundColor: typeColor + '25' }]}>
                        <Icon name={getTypeIcon(item.tipoProyecto || 'otro')} size={20} color={typeColor} />
                    </View>
                    <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                        <Text style={styles.projectName} numberOfLines={1}>{item.nombreProyecto}</Text>
                        {item.tipoProyecto && (
                            <Text style={[styles.typeText, { color: typeColor }]}>
                                {PROJECT_TYPE_ICONS[item.tipoProyecto]} {PROJECT_TYPE_LABELS[item.tipoProyecto]}
                            </Text>
                        )}
                    </View>
                    <View style={[styles.statusBadge, item.estado === 'activo' ? styles.statusActive : styles.statusInactive]}>
                        <View style={[styles.statusDot, { backgroundColor: item.estado === 'activo' ? C.success : C.textMuted }]} />
                        <Text style={[styles.statusText, { color: item.estado === 'activo' ? C.success : C.textMuted }]}>
                            {item.estado === 'activo' ? t.active : item.estado}
                        </Text>
                    </View>
                </View>

                {/* Location */}
                <View style={styles.infoRow}>
                    <Icon name="map-pin" size={13} color={C.textMuted} />
                    <Text style={styles.infoText} numberOfLines={1}>{item.ubicacion}</Text>
                </View>

                {/* Footer: deadline + actions */}
                <View style={styles.cardFooter}>
                    {deadlineStatus ? (
                        <View style={[styles.deadlineBadge, { backgroundColor: deadlineStatus.color + '18', borderColor: deadlineStatus.color + '60' }]}>
                            <Icon name="clock" size={11} color={deadlineStatus.color} />
                            <Text style={[styles.deadlineText, { color: deadlineStatus.color }]}>{deadlineStatus.label}</Text>
                        </View>
                    ) : item.fechaFin ? (
                        <View style={styles.deadlineBadge}>
                            <Icon name="calendar" size={11} color={C.textMuted} />
                            <Text style={[styles.deadlineText, { color: C.textMuted }]}>{item.fechaFin}</Text>
                        </View>
                    ) : <View />}

                    <View style={{ flexDirection: 'row', gap: 6 }}>
                        {['superAdmin', 'coordinador', 'lider'].includes(user?.role || '') && (
                            <TouchableOpacity onPress={() => setProjectToEdit(item)} style={styles.editBtn}>
                                <Icon name="edit-2" size={15} color={C.primary} />
                            </TouchableOpacity>
                        )}
                        {['superAdmin', 'coordinador'].includes(user?.role || '') && (
                            <TouchableOpacity
                                onPress={() => Alert.alert(
                                    t.deleteProject,
                                    t.deleteProjectConfirm(item.nombreProyecto),
                                    [
                                        { text: t.cancel, style: 'cancel' },
                                        { text: t.delete, style: 'destructive', onPress: () => deleteProject(item.id, companyId) },
                                    ]
                                )}
                                style={styles.deleteBtn}
                            >
                                <Icon name="trash-2" size={15} color={C.danger} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.topBar}>
                <Text style={styles.sectionTitle}>
                    {t.myProjectsTitle(projects.length, projectsLimit === Infinity ? '∞' : String(projectsLimit))}
                </Text>
                {!canCreateProject && (
                    <TouchableOpacity onPress={() => navigation.navigate('Subscription')} style={styles.upgradeBtn}>
                        <Icon name="zap" size={12} color={C.warning} />
                        <Text style={styles.upgradeBtnText}>{t.upgrade}</Text>
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
                        title={t.noActiveProjects}
                        description={t.noProjectsDescription}
                        actionLabel={t.createProject}
                        onAction={handleOpenCreate}
                    />
                }
            />

            {['admin', 'superAdmin', 'coordinador', 'lider'].includes(user?.role || '') && (
                <GlobalFAB
                    containerStyle={{ bottom: 20 + insets.bottom }}
                    onPress={handleOpenCreate}
                />
            )}

            {/* ── New Project Modal ── */}
            <Modal visible={modalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{t.newProject}</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Icon name="x" size={24} color={C.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={styles.inputLabel}>{t.projectName}</Text>
                            <TextInput style={styles.input} value={newNombre} onChangeText={setNewNombre}
                                placeholder="Ej. Torre Central Norte" placeholderTextColor={C.textMuted} />

                            <Text style={styles.inputLabel}>{t.location}</Text>
                            <TextInput style={styles.input} value={newUbicacion} onChangeText={setNewUbicacion}
                                placeholder="Ej. Bogotá, Calle 80" placeholderTextColor={C.textMuted} />

                            <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>{t.startDate}</Text>
                                    <View style={[styles.input, { justifyContent: 'center' }]}>
                                        <Text style={{ color: C.white }}>{new Date().toISOString().split('T')[0]}</Text>
                                    </View>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>{t.endDate}</Text>
                                    <TextInput style={styles.input} value={newFechaFin} onChangeText={setNewFechaFin}
                                        placeholder="2026-12-31" placeholderTextColor={C.textMuted}
                                        keyboardType="numbers-and-punctuation" maxLength={10} />
                                </View>
                            </View>

                            {newFechaFin.length >= 8 && (() => {
                                const status = getDeadlineStatus(newFechaFin, t, C);
                                return status ? (
                                    <View style={[styles.deadlineBadge, { backgroundColor: status.color + '22', borderColor: status.color, marginBottom: SPACING.sm }]}>
                                        <Text style={[styles.deadlineText, { color: status.color }]}>{status.label}</Text>
                                    </View>
                                ) : null;
                            })()}

                            <Text style={[styles.inputLabel, { marginTop: SPACING.sm }]}>{t.projectType}</Text>
                            <Text style={styles.typeHint}>{t.projectTypeHint}</Text>

                            {PROJECT_TYPES.map(tipo => (
                                <TouchableOpacity key={tipo}
                                    style={[styles.typeOption, tipoProyecto === tipo && styles.typeOptionSelected]}
                                    onPress={() => setTipoProyecto(tipo)} activeOpacity={0.7}>
                                    <View style={styles.typeOptionLeft}>
                                        <View style={[styles.typeIconBox, tipoProyecto === tipo && { backgroundColor: C.primary + '30' }]}>
                                            <Icon name={getTypeIcon(tipo)} size={20} color={tipoProyecto === tipo ? C.primary : C.textSecondary} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.typeOptionTitle, tipoProyecto === tipo && { color: C.info }]}>
                                                {PROJECT_TYPE_ICONS[tipo]} {PROJECT_TYPE_LABELS[tipo]}
                                            </Text>
                                            <Text style={styles.typeOptionDesc}>{PROJECT_TYPE_DESCRIPTIONS[tipo]}</Text>
                                        </View>
                                    </View>
                                    <View style={[styles.radioOuter, tipoProyecto === tipo && { borderColor: C.primary }]}>
                                        {tipoProyecto === tipo && <View style={styles.radioInner} />}
                                    </View>
                                </TouchableOpacity>
                            ))}

                            <View style={styles.previewBox}>
                                <Icon name="package" size={16} color={C.info} />
                                <Text style={styles.previewText}>
                                    {t.willLoad(getStandardMaterials(tipoProyecto, '', '', companyId).length)}
                                    <Text style={{ color: C.info, fontWeight: 'bold' }}>
                                        {t.standardMaterials(getStandardMaterials(tipoProyecto, '', '', companyId).length)}
                                    </Text>
                                    {t.editableAndDeletable}
                                </Text>
                            </View>
                        </ScrollView>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                                <Text style={styles.cancelText}>{t.cancel}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.confirmBtn} onPress={handleCreateProject}>
                                <Icon name="check" size={16} color="#FFFFFF" />
                                <Text style={styles.confirmText}>{t.createProject}</Text>
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

const makeStyles = (C: ThemeColors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.sm },
    sectionTitle: { color: C.white, fontSize: FONTS.sizes.lg, fontWeight: 'bold' },
    upgradeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.warning + '20', paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.warning + '50' },
    upgradeBtnText: { color: C.warning, fontSize: 11, fontWeight: 'bold' },
    listContainer: { padding: SPACING.md, paddingBottom: 110 },
    projectCard: {
        backgroundColor: C.surface, padding: SPACING.md, borderRadius: RADIUS.lg,
        marginBottom: SPACING.md, borderWidth: 1, borderColor: C.border, ...SHADOWS.sm,
        borderLeftWidth: 4, borderLeftColor: C.primary,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
    iconBox: { width: 42, height: 42, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
    statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, gap: 4 },
    statusActive: { backgroundColor: C.success + '18' },
    statusInactive: { backgroundColor: C.textMuted + '18' },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontSize: 10, fontWeight: '700' },
    editBtn: { padding: 7, backgroundColor: C.primary + '18', borderRadius: RADIUS.sm },
    deleteBtn: { padding: 7, backgroundColor: C.danger + '18', borderRadius: RADIUS.sm },
    projectName: { color: C.white, fontSize: FONTS.sizes.md, fontWeight: 'bold', marginBottom: 1 },
    typeText: { fontSize: FONTS.sizes.xs, fontWeight: '600' },
    infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm, marginTop: 2 },
    infoText: { color: C.textMuted, fontSize: FONTS.sizes.xs, marginLeft: 5, flex: 1 },
    cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
    deadlineBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: C.border, gap: 4 },
    deadlineText: { fontSize: 10, fontWeight: '600' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: C.surface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.xl, maxHeight: '93%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
    modalTitle: { color: C.white, fontSize: FONTS.sizes.xl, fontWeight: 'bold' },
    inputLabel: { color: C.textSecondary, fontSize: FONTS.sizes.sm, marginBottom: 6, fontWeight: '600' },
    input: { backgroundColor: C.surfaceLight, color: C.white, padding: SPACING.md, borderRadius: RADIUS.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: C.border },
    typeHint: { color: C.textMuted, fontSize: FONTS.sizes.xs, marginBottom: SPACING.sm, lineHeight: 18 },
    typeOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.surfaceLight, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: C.border },
    typeOptionSelected: { borderColor: C.primary, backgroundColor: C.primary + '12' },
    typeOptionLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    typeIconBox: { width: 36, height: 36, borderRadius: RADIUS.sm, backgroundColor: C.surfaceLight, alignItems: 'center', justifyContent: 'center', marginRight: SPACING.sm },
    typeOptionTitle: { color: C.white, fontWeight: 'bold', fontSize: FONTS.sizes.sm },
    typeOptionDesc: { color: C.textMuted, fontSize: FONTS.sizes.xs, marginTop: 2 },
    radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.primary },
    previewBox: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.info + '18', borderRadius: RADIUS.md, padding: SPACING.sm, marginTop: SPACING.sm, marginBottom: SPACING.md },
    previewText: { color: C.textSecondary, fontSize: FONTS.sizes.xs, flex: 1, marginLeft: SPACING.sm, lineHeight: 18 },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: SPACING.md, gap: SPACING.sm },
    cancelBtn: { padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.border },
    cancelText: { color: C.textSecondary, fontWeight: 'bold' },
    confirmBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.primary, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderRadius: RADIUS.md, gap: 6 },
    confirmText: { color: '#FFFFFF', fontWeight: 'bold' },
});


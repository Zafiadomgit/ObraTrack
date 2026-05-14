import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TextInput, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '../../../store/appStore';
import { useProjectStore } from '../../projects/store/projectStore';
import { useMaterialStore } from '../../materials/store/materialStore';
import { usePersonnelStore, CrewMemberTemplate } from '../../personnel/store/personnelStore';
import { useReportStore } from '../../reports/store/reportStore';
import { FONTS, SPACING, RADIUS, SHADOWS } from '../../../core/theme';
import Icon from '@expo/vector-icons/Feather';
import { differenceInDays, parseISO, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { PROJECT_TYPE_LABELS, PROJECT_TYPE_ICONS } from '../../materials/data/standardMaterials';
import { useNotificationStore } from '../../notifications/store/notificationStore';
import WelcomeGuide from '../../../components/WelcomeGuide';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColors, ThemeColors } from '../../../core/theme/ThemeContext';
import { useT } from '../../../core/i18n';

export default function DashboardScreen({ navigation: propNavigation }: any) {
    const hookNavigation = useNavigation<any>();
    const navigation = propNavigation?.navigate ? propNavigation : hookNavigation;
    const insets = useSafeAreaInsets();
    const user = useAppStore(state => state.user);
    const { logout, deleteOwnAccount } = useAppStore();
    const allProjects = useProjectStore(state => state.projects);
    const projects = allProjects.filter(p => p.userId === user?.id);
    const allMaterials = useMaterialStore(state => state.materials);
    const materials = allMaterials.filter(m => m.userId === user?.id);
    const { crews, addCrew } = usePersonnelStore();
    // Filter crews by userId if we add that field later, for now we will assume crews are global per company/device or we can filter them if they have userId:
    const userCrews = crews.filter(c => !c.userId || c.userId === user?.id || user?.role === 'admin');

    const allWorkers = usePersonnelStore(state => state.workers);
    const workers = allWorkers.filter(w => w.userId === user?.id || user?.role === 'admin');
    const allDailyLogs = useReportStore(state => state.dailyLogs);
    const dailyLogs = allDailyLogs.filter(l => l.userId === user?.id);
    const unreadNotificationsCount = useNotificationStore(state => state.unreadCount);

    const C = useColors();
    const styles = React.useMemo(() => makeStyles(C), [C]);
    const t = useT();

    const [avatarUri, setAvatarUri] = useState<string | null>(null);

    // Reload avatar every time the screen comes into focus (e.g. returning from Profile)
    useFocusEffect(
        React.useCallback(() => {
            if (!user) return;
            AsyncStorage.getItem(`obratrack_avatar_${user.id}`).then(uri => {
                setAvatarUri(uri ?? null);
            });
        }, [user?.id])
    );

    const [crewModalVisible, setCrewModalVisible] = useState(false);
    const [newCrewName, setNewCrewName] = useState('');
    const [newCrewMembers, setNewCrewMembers] = useState<CrewMemberTemplate[]>([
        { nombre: 'Líder', rol: 'lider', cargo: 'Líder de Obra', costoDia: 120000 },
        { nombre: 'Técnico', rol: 'tecnico', cargo: 'Técnico de Obra', costoDia: 90000 },
    ]);

    const handleCreateCrew = () => {
        if (!newCrewName.trim()) {
            Alert.alert(t.error, t.enterCrewName);
            return;
        }
        if (newCrewMembers.length === 0) {
            Alert.alert(t.error, t.crewNeedsMembers);
            return;
        }
        if (user) {
            addCrew(newCrewName, newCrewMembers, user.id, user.companyId || 'default-company');
        }
        setCrewModalVisible(false);
        setNewCrewName('');
        setNewCrewMembers([
            { nombre: 'Líder', rol: 'lider', cargo: 'Líder de Obra', costoDia: 120000 },
            { nombre: 'Técnico', rol: 'tecnico', cargo: 'Técnico de Obra', costoDia: 90000 },
        ]);
        Alert.alert(t.success, t.crewTemplateSaved);
    };

    const addMemberRow = () => {
        setNewCrewMembers([...newCrewMembers, { nombre: '', rol: 'tecnico', cargo: 'Técnico', costoDia: 90000 }]);
    };

    const updateMemberRow = (index: number, updates: Partial<CrewMemberTemplate>) => {
        const updated = [...newCrewMembers];
        updated[index] = { ...updated[index], ...updates };
        setNewCrewMembers(updated);
    };

    const removeMemberRow = (index: number) => {
        setNewCrewMembers(newCrewMembers.filter((_, i) => i !== index));
    };

    // ── Global aggregated KPIs ──────────────────────────────────────
    const stats = useMemo(() => {
        const activeProjects = projects.filter(p => p.estado === 'activo');

        // Materials aggregation (Across all projects)
        const totalStock = materials.reduce((s, m) => s + m.stock, 0);
        const totalInTransit = materials.reduce((s, m) => s + m.enviado, 0);
        const totalOnSite = materials.reduce((s, m) => s + m.cantidadActual, 0);
        const totalUsed = materials.reduce((s, m) => s + (m.totalUsado || 0), 0);
        const stockAlerts = materials.filter(m => m.stock <= m.minimoAlerta).length;

        // Personnel aggregation (Global totals not used in the new UI, kept for quick-access stats)
        const totalWorkers = workers.length;

        // Daily activity
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const bitacorasHoy = dailyLogs.filter(l => l.fecha.startsWith(todayStr)).length;

        // Project Deadline Alerts
        const projectsWithAlerts = activeProjects.filter(p => {
            if (!p.fechaFin) return false;
            try {
                const days = differenceInDays(parseISO(p.fechaFin), new Date());
                return days <= 14;
            } catch { return false; }
        });

        // Unique active crews across all projects for the new Personnel panel
        // Get unique combinations of projectId + cuadrilla
        const activeCrewsData = workers.reduce((acc, worker) => {
            if (worker.projectId === 'all' || !worker.cuadrilla) return acc;

            const project = projects.find(p => p.id === worker.projectId);
            if (!project || project.estado !== 'activo') return acc;

            const crewKey = `${worker.projectId}-${worker.cuadrilla}`;

            if (!acc[crewKey]) {
                acc[crewKey] = {
                    crewName: worker.cuadrilla,
                    projectName: project.nombreProyecto,
                    memberCount: 0,
                    maxDaysWorked: 0,
                    projectDuration: 0, // Days between start and end
                    daysExceeded: false
                };

                // Calculate project duration
                if (project.fechaInicio && project.fechaFin) {
                    try {
                        const start = parseISO(project.fechaInicio);
                        const end = parseISO(project.fechaFin);
                        const duration = differenceInDays(end, start);
                        acc[crewKey].projectDuration = duration > 0 ? duration : 0;
                    } catch { /* Ignore date error */ }
                }
            }

            acc[crewKey].memberCount += 1;
            const worked = worker.diasTrabajados ? worker.diasTrabajados.length : 0;
            if (worked > acc[crewKey].maxDaysWorked) {
                acc[crewKey].maxDaysWorked = worked;
            }

            return acc;
        }, {} as Record<string, any>);

        const activeCrewsArray = Object.values(activeCrewsData).map((crew: any) => {
            if (crew.projectDuration > 0 && crew.maxDaysWorked > crew.projectDuration) {
                crew.daysExceeded = true;
            }
            return crew;
        });

        return {
            activeProjects: activeProjects.length,
            totalProjects: projects.length,
            totalStock,
            stockAlerts,
            bitacorasHoy,
            totalWorkers,
            projectsWithAlerts,
            activeCrews: activeCrewsArray,
        };
    }, [projects, materials, workers, dailyLogs, crews]);

    const [selectedCrewIndex, setSelectedCrewIndex] = useState(0);


    const todayFormatted = format(new Date(), "EEEE d 'de' MMMM", { locale: es });
    const hourNow = new Date().getHours();
    const greeting = hourNow < 12 ? t.greetingMorning : hourNow < 18 ? t.greetingAfternoon : t.greetingEvening;
    const firstName = user?.nombre?.split(' ')[0] ?? 'Usuario';

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <WelcomeGuide userId={user?.id || ''} role={user?.role || ''} />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

                {/* ── Header ── */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.navigate('Profile' as never)} activeOpacity={0.85}>
                        {avatarUri ? (
                            <Image source={{ uri: avatarUri }} style={[styles.avatarCircle, { borderWidth: 2, borderColor: C.primary }]} />
                        ) : (
                            <View style={styles.avatarCircle}>
                                <Text style={styles.avatarText}>{firstName.slice(0, 2).toUpperCase()}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                    <View style={{ flex: 1, marginLeft: SPACING.md }}>
                        <Text style={styles.greetingText}>{greeting},</Text>
                        <Text style={styles.nameText}>{user?.nombre ?? 'Usuario'}</Text>
                        <Text style={[styles.dateText, { marginTop: 2 }]}>{todayFormatted.charAt(0).toUpperCase() + todayFormatted.slice(1)}</Text>
                        {user?.role === 'admin' && user?.plan !== 'enterprise' && (
                            <TouchableOpacity
                                onPress={() => navigation.navigate('Subscription' as never)}
                                style={{ alignSelf: 'flex-start', backgroundColor: C.warning + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: C.warning + '50', flexDirection: 'row', alignItems: 'center', marginTop: 4 }}
                            >
                                <Icon name="star" size={10} color={C.warning} style={{ marginRight: 4 }} />
                                <Text style={{ color: C.warning, fontSize: 10, fontWeight: 'bold' }}>{t.improvePlan}</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    <TouchableOpacity onPress={() => navigation.navigate('Notifications' as never)} style={[styles.logoutBtn, { marginRight: SPACING.sm }]}>
                        <Icon name="bell" size={18} color={C.textSecondary} />
                        {unreadNotificationsCount > 0 && (
                            <View style={styles.notificationBadge}>
                                <Text style={styles.notificationBadgeText}>{unreadNotificationsCount}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
                        <Icon name="log-out" size={18} color={C.textSecondary} />
                    </TouchableOpacity>
                </View>

                {/* ── Deadline Alerts ── */}
                {['admin', 'coordinador', 'lider'].includes(user?.role || '') && stats.projectsWithAlerts.length > 0 && (
                    <View style={styles.alertBanner}>
                        <Icon name="alert-triangle" size={16} color={C.warning} />
                        <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                            <Text style={styles.alertTitle}>{t.projectsNearDeadline}</Text>
                            {stats.projectsWithAlerts.map(p => {
                                if (!p.fechaFin) return null;
                                try {
                                    const days = differenceInDays(parseISO(p.fechaFin), new Date());
                                    const label = days < 0 ? t.expiredDaysAgo(Math.abs(days)) : days === 0 ? t.expiresToday : t.expiresInDays(days);
                                    const color = days <= 0 ? C.danger : C.warning;
                                    return (
                                        <TouchableOpacity key={p.id} onPress={() => navigation.navigate('Proyectos', { screen: 'Projects' })}>
                                            <Text style={[styles.alertItem, { color }]}>• {p.nombreProyecto}: {label}</Text>
                                        </TouchableOpacity>
                                    );
                                } catch { return null; }
                            })}
                        </View>
                    </View>
                )}

                {/* ── Global KPI Stats Row ── */}
                <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                        <Icon name="briefcase" size={20} color={C.primary} />
                        <Text style={styles.statValue}>{stats.activeProjects}</Text>
                        <Text style={styles.statLabel}>{t.activeProjects}</Text>
                    </View>
                    {user?.role !== 'logistica' && (
                        <View style={styles.statCard}>
                            <Icon name="users" size={20} color={C.info} />
                            <Text style={styles.statValue}>{stats.totalWorkers}</Text>
                            <Text style={styles.statLabel}>{t.personnel}</Text>
                        </View>
                    )}
                    <View style={styles.statCard}>
                        <Icon name="package" size={20} color={stats.stockAlerts > 0 ? C.warning : C.success} />
                        <Text style={[styles.statValue, stats.stockAlerts > 0 && { color: C.warning }]}>
                            {stats.stockAlerts > 0 ? stats.stockAlerts : stats.totalStock}
                        </Text>
                        <Text style={styles.statLabel}>{stats.stockAlerts > 0 ? t.stockAlerts : t.totalStock}</Text>
                    </View>
                    {user?.role !== 'logistica' && (
                        <View style={styles.statCard}>
                            <Icon name="book-open" size={20} color={C.textSecondary} />
                            <Text style={styles.statValue}>{stats.bitacorasHoy}</Text>
                            <Text style={styles.statLabel}>{t.logsToday}</Text>
                        </View>
                    )}
                </View>

                {/* ── Crew Templates ── */}
                {['admin', 'coordinador', 'lider'].includes(user?.role || '') && (
                    <>
                        <View style={styles.sectionHeader}>
                            <Text style={[styles.sectionTitle, { paddingHorizontal: 0, marginTop: 0, marginBottom: 0 }]}>{t.quickCrews}</Text>
                            <TouchableOpacity style={styles.headerBtn} onPress={() => setCrewModalVisible(true)}>
                                <Icon name="plus" size={16} color={C.primary} />
                                <Text style={styles.headerBtnText}>{t.newTemplate}</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.crewsList}>
                            {userCrews.length === 0 ? (
                                <View style={[styles.crewTemplateCard, { borderStyle: 'dashed', backgroundColor: 'transparent', width: 200 }]}>
                                    <Icon name="users" size={24} color={C.textMuted} />
                                    <Text style={[styles.crewName, { color: C.textMuted, marginTop: SPACING.sm }]}>{t.noCrewTemplates}</Text>
                                    <Text style={[styles.crewMembers, { color: C.textMuted }]}>{t.createFirstTemplate}</Text>
                                </View>
                            ) : (
                                userCrews.map(c => (
                                    <View key={c.id} style={styles.crewTemplateCard}>
                                        <View style={[styles.crewIcon, { backgroundColor: C.info + '22' }]}>
                                            <Icon name="users" size={16} color={C.info} />
                                        </View>
                                        <Text style={styles.crewName}>{c.nombre}</Text>
                                        <Text style={styles.crewMembers}>{c.miembros.length} {t.members}</Text>
                                    </View>
                                ))
                            )}
                        </ScrollView>
                    </>
                )}

                {/* ── Labor Summary (Crew breakdown) ── */}
                {user?.role !== 'logistica' && (
                    <>
                        <Text style={styles.sectionTitle}>{t.personnelSummary}</Text>
                        <View style={styles.stockCard}>
                            {stats.activeCrews.length === 0 ? (
                                <View style={{ padding: SPACING.lg, alignItems: 'center' }}>
                                    <Icon name="users" size={32} color={C.textMuted} />
                                    <Text style={{ color: C.textMuted, marginTop: SPACING.md }}>{t.noActiveCrews}</Text>
                                </View>
                            ) : (
                                <>
                                    {/* Crew Selector */}
                                    <Text style={[styles.inputLabel, { marginBottom: 8 }]}>{t.selectActiveTeam}</Text>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: SPACING.lg }}>
                                        {stats.activeCrews.map((crew: any, idx: number) => (
                                            <TouchableOpacity
                                                key={idx}
                                                style={[
                                                    styles.crewFilterChip,
                                                    selectedCrewIndex === idx && styles.crewFilterChipActive,
                                                    crew.daysExceeded && { borderColor: C.danger, borderWidth: 1 }
                                                ]}
                                                onPress={() => setSelectedCrewIndex(idx)}
                                            >
                                                <Text style={[styles.crewFilterText, selectedCrewIndex === idx && { color: C.white }]}>
                                                    {crew.crewName}
                                                </Text>
                                                <Text style={[styles.crewFilterSub, selectedCrewIndex === idx && { color: C.surfaceLight }]}>
                                                    ({crew.projectName})
                                                </Text>
                                                {crew.daysExceeded && <Icon name="alert-triangle" size={12} color={selectedCrewIndex === idx ? C.white : C.danger} style={{ marginTop: 2 }} />}
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    {/* Selected Crew Details */}
                                    {stats.activeCrews[selectedCrewIndex] && (() => {
                                        const selected = stats.activeCrews[selectedCrewIndex] as any;
                                        return (
                                            <View>
                                                <Text style={{ color: C.primary, fontWeight: 'bold', fontSize: 16, marginBottom: SPACING.sm }}>
                                                    {t.performance}: {selected.crewName}
                                                </Text>
                                                <View style={styles.stockRow}>
                                                    <View style={styles.stockItem}>
                                                        <Text style={[styles.stockValue, { color: C.info }]}>{selected.memberCount}</Text>
                                                        <Text style={styles.stockLabel}>{t.members}</Text>
                                                    </View>
                                                    <View style={styles.stockDivider} />
                                                    <View style={styles.stockItem}>
                                                        <Text style={[styles.stockValue, selected.daysExceeded && { color: C.danger }]}>
                                                            {selected.maxDaysWorked}
                                                        </Text>
                                                        <Text style={styles.stockLabel}>{t.daysWorked}</Text>
                                                    </View>
                                                    <View style={styles.stockDivider} />
                                                    <View style={styles.stockItem}>
                                                        <Text style={[styles.stockValue, { color: C.textSecondary }]}>
                                                            {selected.projectDuration > 0 ? selected.projectDuration : 'N/A'}
                                                        </Text>
                                                        <Text style={styles.stockLabel}>{t.projectDuration}</Text>
                                                    </View>
                                                </View>

                                                {selected.daysExceeded && (
                                                    <View style={{ backgroundColor: C.danger + '20', padding: 12, borderRadius: RADIUS.md, marginTop: SPACING.md, flexDirection: 'row', alignItems: 'center' }}>
                                                        <Icon name="alert-circle" size={16} color={C.danger} style={{ marginRight: 8 }} />
                                                        <Text style={{ color: C.danger, flex: 1, fontSize: 13, fontWeight: 'bold' }}>
                                                            {t.crewOverDays(selected.maxDaysWorked, selected.projectDuration)}
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                        );
                                    })()}
                                </>
                            )}
                        </View>
                    </>
                )}

                {/* ── Quick Access ── */}
                <Text style={styles.sectionTitle}>{t.quickAccess}</Text>
                <View style={styles.quickGrid}>
                    {[
                        { id: 'proyectos', icon: 'briefcase' as const, label: t.quickAccessProjects, sub: t.activeItems(stats.activeProjects), color: C.primary, screen: 'Proyectos', roles: ['admin', 'coordinador', 'lider'] },
                        { id: 'materiales', icon: 'package' as const, label: t.quickAccessWarehouse, sub: t.totalItems(materials.length), color: C.info, action: () => navigation.navigate('Materiales', { projectId: 'central', projectName: 'Bodega Central' }), roles: ['admin', 'coordinador', 'logistica'] },
                        { id: 'logistica', icon: 'truck' as const, label: t.quickAccessLogistics, sub: t.shipmentTracking, color: '#9B59B6', action: () => navigation.navigate('Envíos', { projectId: 'all' }), roles: ['coordinador', 'lider', 'conductor', 'logistica'] },
                        { id: 'personal', icon: 'users' as const, label: t.quickAccessPersonnel, sub: t.totalItems(stats.totalWorkers), color: C.success, action: () => navigation.navigate('Personal', { projectId: 'all', projectName: 'Personal Global' }), roles: ['admin', 'coordinador', 'lider'] },
                        { id: 'proveedores', icon: 'shopping-cart' as const, label: t.quickAccessSuppliers, sub: t.globalManagement, color: '#8E44AD', action: () => navigation.navigate('Proveedores'), roles: ['admin', 'coordinador'] },
                        { id: 'reportes', icon: 'file-text' as const, label: t.quickAccessReports, sub: t.pdfExcel, color: '#E67E22', screen: 'Reportes', roles: ['admin', 'coordinador'] },
                        { id: 'usuarios', icon: 'user-check' as const, label: t.quickAccessUsers, sub: t.adminPersonnel, color: C.danger, action: () => navigation.navigate('UserManagement' as never), roles: ['admin', 'coordinador'] },
                        { id: 'actividad', icon: 'activity' as const, label: t.quickAccessActivity, sub: t.activityHistory, color: C.info, action: () => navigation.navigate('ActivityHistory' as never), roles: ['admin', 'coordinador'] },
                    ].filter(item => user?.role && item.roles.includes(user.role)).map(item => (
                        <TouchableOpacity key={item.id} style={styles.quickCard}
                            onPress={() => item.action ? item.action() : navigation.navigate(item.screen)}>
                            <View style={[styles.quickIconBox, { backgroundColor: item.color + '22' }]}>
                                <Icon name={item.icon} size={22} color={item.color} />
                            </View>
                            <Text style={styles.quickLabel}>{item.label}</Text>
                            <Text style={styles.quickSub}>{item.sub}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* ── Active Projects List ── */}
                {['admin', 'coordinador', 'lider'].includes(user?.role || '') && (
                    <>
                        <View style={styles.sectionRow}>
                            <Text style={styles.sectionTitle}>{t.myProjects}</Text>
                            <TouchableOpacity onPress={() => navigation.navigate('Proyectos')}>
                                <Text style={styles.seeAll}>{t.seeAll}</Text>
                            </TouchableOpacity>
                        </View>

                        {projects.slice(0, 4).map(p => {
                            const deadlineStatus = (() => {
                                if (!p.fechaFin) return null;
                                try {
                                    const days = differenceInDays(parseISO(p.fechaFin), new Date());
                                    if (days <= 0) return { label: days === 0 ? t.expiresToday : t.expiredDaysAgo(Math.abs(days)), color: C.danger };
                                    if (days <= 14) return { label: t.expiresInDays(days), color: C.warning };
                                    return null;
                                } catch { return null; }
                            })();
                            return (
                                <TouchableOpacity key={p.id} style={styles.projectCard}
                                    onPress={() => navigation.navigate('ProjectDashboard', { projectId: p.id, projectName: p.nombreProyecto })}>
                                    <View style={[styles.projectIconBox, { backgroundColor: C.primary + '22' }]}>
                                        <Icon name="briefcase" size={18} color={C.primary} />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                                        <Text style={styles.projectName} numberOfLines={1}>{p.nombreProyecto}</Text>
                                        <Text style={styles.projectSub}>
                                            {p.tipoProyecto ? `${PROJECT_TYPE_ICONS[p.tipoProyecto]} ${PROJECT_TYPE_LABELS[p.tipoProyecto]} · ` : ''}
                                            📍 {p.ubicacion}
                                        </Text>
                                    </View>
                                    {deadlineStatus && (
                                        <View style={[styles.deadlinePill, { backgroundColor: deadlineStatus.color + '22' }]}>
                                            <Text style={[styles.deadlinePillText, { color: deadlineStatus.color }]}>{deadlineStatus.label}</Text>
                                        </View>
                                    )}
                                    <Icon name="chevron-right" size={16} color={C.textMuted} />
                                </TouchableOpacity>
                            );
                        })}
                    </>
                )}

                {/* ── Eliminar cuenta ── */}
                <TouchableOpacity
                    style={{ marginHorizontal: SPACING.lg, marginTop: SPACING.xl, marginBottom: SPACING.lg, padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.danger + '50', alignItems: 'center' }}
                    onPress={() => {
                        Alert.alert(
                            t.deleteAccount,
                            t.deleteAccountConfirm,
                            [
                                { text: t.cancel, style: 'cancel' },
                                {
                                    text: t.deletePermanently,
                                    style: 'destructive',
                                    onPress: async () => {
                                        const result = await deleteOwnAccount();
                                        if (!result.success) {
                                            Alert.alert(t.error, result.reason || t.deleteAccountError);
                                        }
                                    },
                                },
                            ]
                        );
                    }}
                >
                    <Text style={{ color: C.danger, fontSize: FONTS.sizes.sm, fontWeight: 'bold' }}>{t.deleteAccount}</Text>
                </TouchableOpacity>

                {/* ── Create Crew Modal ── */}
                <Modal visible={crewModalVisible} transparent animationType="slide">
                    <KeyboardAvoidingView
                        style={{ flex: 1 }}
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    >
                        <View style={styles.modalOverlay}>
                            <View style={styles.modalContent}>
                                <Text style={styles.modalTitle}>{t.newCrewTemplate}</Text>
                                <Text style={styles.inputLabel}>{t.crewNameLabel}</Text>
                                <TextInput
                                    style={styles.input}
                                    value={newCrewName}
                                    onChangeText={setNewCrewName}
                                    placeholder="Nombre..."
                                    placeholderTextColor={C.textMuted}
                                />

                                <Text style={styles.inputLabel}>{t.crewMembers}</Text>
                                <ScrollView
                                    style={styles.membersScroll}
                                    showsVerticalScrollIndicator={true}
                                    keyboardShouldPersistTaps="handled"
                                >
                                    {newCrewMembers.map((member, index) => (
                                        <View key={index} style={styles.memberRowContainer}>
                                            <View style={styles.memberRowHeader}>
                                                <Text style={styles.memberRowText}>{t.member(index + 1)}</Text>
                                                <TouchableOpacity onPress={() => removeMemberRow(index)} style={styles.removeBtn}>
                                                    <Icon name="trash-2" size={18} color={C.danger} />
                                                </TouchableOpacity>
                                            </View>

                                            <Text style={styles.inputMiniLabel}>{t.memberFullName}</Text>
                                            <TextInput
                                                style={[styles.input, { marginBottom: SPACING.sm }]}
                                                value={member.nombre}
                                                onChangeText={(text) => updateMemberRow(index, { nombre: text })}
                                                placeholder="Nombre de la persona"
                                                placeholderTextColor={C.textMuted}
                                            />

                                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.inputMiniLabel}>{t.memberRole}</Text>
                                                    <TextInput
                                                        style={styles.input}
                                                        value={member.cargo}
                                                        onChangeText={(text) => updateMemberRow(index, { cargo: text })}
                                                        placeholder="Ej: Plomero"
                                                        placeholderTextColor={C.textMuted}
                                                    />
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.inputMiniLabel}>{t.dailyCost}</Text>
                                                    <TextInput
                                                        style={styles.input}
                                                        value={member.costoDia.toString()}
                                                        onChangeText={(text) => updateMemberRow(index, { costoDia: parseInt(text) || 0 })}
                                                        placeholder="Costo"
                                                        keyboardType="numeric"
                                                        placeholderTextColor={C.textMuted}
                                                    />
                                                </View>
                                            </View>
                                        </View>
                                    ))}
                                    <TouchableOpacity onPress={addMemberRow} style={styles.addMemberBtn}>
                                        <Icon name="plus-circle" size={16} color={C.primary} />
                                        <Text style={styles.addMemberText}>{t.addMember}</Text>
                                    </TouchableOpacity>
                                </ScrollView>

                                <View style={styles.modalActions}>
                                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setCrewModalVisible(false)}>
                                        <Text style={styles.cancelText}>{t.cancel}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.confirmBtn} onPress={handleCreateCrew}>
                                        <Text style={styles.confirmText}>{t.saveTemplate}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </Modal>
            </ScrollView>
        </View>
    );
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    header: { flexDirection: 'row', alignItems: 'center', padding: SPACING.lg, paddingBottom: SPACING.md },
    avatarCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: FONTS.sizes.lg },
    greetingText: { color: C.textSecondary, fontSize: FONTS.sizes.sm },
    nameText: { color: C.white, fontWeight: 'bold', fontSize: FONTS.sizes.xl },
    dateText: { color: C.textMuted, fontSize: FONTS.sizes.xs, textTransform: 'capitalize' },
    logoutBtn: { padding: SPACING.sm, backgroundColor: C.surfaceLight, borderRadius: RADIUS.round },
    alertBanner: { flexDirection: 'row', backgroundColor: C.warning + '18', borderRadius: RADIUS.md, padding: SPACING.md, marginHorizontal: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: C.warning + '60' },
    alertTitle: { color: C.warning, fontWeight: 'bold', fontSize: FONTS.sizes.sm, marginBottom: 4 },
    alertItem: { fontSize: FONTS.sizes.xs, marginTop: 2 },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: SPACING.md, gap: SPACING.sm, marginBottom: SPACING.md },
    statCard: { flex: 1, minWidth: '44%', backgroundColor: C.surface, borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center', borderWidth: 1, borderColor: C.border, ...SHADOWS.sm },
    statValue: { color: C.white, fontSize: FONTS.sizes.xxl, fontWeight: 'bold', marginTop: 4 },
    statLabel: { color: C.textMuted, fontSize: 10, marginTop: 2, textAlign: 'center' },
    sectionTitle: { color: C.white, fontSize: FONTS.sizes.lg, fontWeight: 'bold', paddingHorizontal: SPACING.lg, marginBottom: SPACING.sm, marginTop: SPACING.md },
    sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.lg, marginBottom: SPACING.sm, marginTop: SPACING.md },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.lg, marginBottom: SPACING.sm, marginTop: SPACING.md },
    headerBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.primary + '15', paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.md },
    headerBtnText: { color: C.primary, fontSize: 12, fontWeight: 'bold', marginLeft: 4 },
    seeAll: { color: C.info, fontSize: FONTS.sizes.sm },
    stockCard: { backgroundColor: C.surface, borderRadius: RADIUS.md, padding: SPACING.md, marginHorizontal: SPACING.md, borderWidth: 1, borderColor: C.border, ...SHADOWS.sm },
    stockRow: { flexDirection: 'row', justifyContent: 'space-around' },
    stockItem: { alignItems: 'center', flex: 1 },
    stockValue: { color: C.white, fontSize: 24, fontWeight: 'bold' },
    stockLabel: { color: C.textMuted, fontSize: 10, marginTop: 2, textAlign: 'center' },
    stockDivider: { width: 1, backgroundColor: C.border },
    stockBar: { height: 6, backgroundColor: C.surfaceLight, borderRadius: 3, marginTop: SPACING.md },
    stockBarFill: { height: 6, borderRadius: 3, backgroundColor: C.primary },
    stockBarLabel: { color: C.textMuted, fontSize: 11, marginTop: 6, textAlign: 'center' },

    crewFilterChip: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: C.surfaceLight, borderRadius: RADIUS.md, marginRight: 8, alignItems: 'center' },
    crewFilterChipActive: { backgroundColor: C.primary },
    crewFilterText: { color: C.textSecondary, fontSize: 14, fontWeight: 'bold' },
    crewFilterSub: { color: C.textMuted, fontSize: 10, marginTop: 2 },

    quickGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: SPACING.md, gap: SPACING.sm },
    quickCard: { width: '48%', backgroundColor: C.surface, padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.border, ...SHADOWS.sm, marginBottom: SPACING.xs },
    quickIconBox: { width: 40, height: 40, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.sm },
    quickLabel: { color: C.white, fontWeight: 'bold', fontSize: FONTS.sizes.md },
    quickSub: { color: C.textMuted, fontSize: FONTS.sizes.xs, marginTop: 2 },
    projectCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: RADIUS.md, padding: SPACING.md, marginHorizontal: SPACING.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: C.border, ...SHADOWS.sm },
    projectIconBox: { width: 36, height: 36, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
    projectName: { color: C.white, fontWeight: 'bold', fontSize: FONTS.sizes.md },
    projectSub: { color: C.textMuted, fontSize: FONTS.sizes.xs, marginTop: 2 },
    deadlinePill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 4 },
    deadlinePillText: { fontSize: 10, fontWeight: 'bold' },
    crewTemplateCard: { backgroundColor: C.surface, width: 140, padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.border, ...SHADOWS.sm, alignItems: 'center' },
    crewIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    crewName: { color: C.white, fontSize: 13, fontWeight: 'bold', textAlign: 'center' },
    crewMembers: { color: C.textMuted, fontSize: 10, marginTop: 2 },
    crewsList: { paddingHorizontal: SPACING.md, gap: SPACING.sm, marginBottom: SPACING.md },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: SPACING.xl },
    modalContent: { backgroundColor: C.surface, borderRadius: RADIUS.lg, padding: SPACING.xl, maxHeight: '88%', ...SHADOWS.lg },
    membersScroll: { flexGrow: 0, maxHeight: 340, marginBottom: SPACING.md },
    modalTitle: { color: C.white, fontSize: FONTS.sizes.xl, fontWeight: 'bold', marginBottom: SPACING.lg },
    inputLabel: { color: C.textSecondary, fontSize: FONTS.sizes.sm, marginBottom: 8 },
    input: { backgroundColor: C.surfaceLight, color: C.white, padding: SPACING.md, borderRadius: RADIUS.md, marginBottom: SPACING.lg },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.sm },
    cancelBtn: { padding: SPACING.md },
    cancelText: { color: C.textSecondary, fontWeight: 'bold' },
    confirmBtn: { backgroundColor: C.primary, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderRadius: RADIUS.md },
    confirmText: { color: '#FFFFFF', fontWeight: 'bold' },
    addMemberBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: SPACING.md, backgroundColor: C.primary + '15', borderRadius: RADIUS.md, borderStyle: 'dashed', borderWidth: 1, borderColor: C.primary, marginTop: SPACING.sm },
    addMemberText: { color: C.info, fontWeight: 'bold', marginLeft: 8 },
    memberRowContainer: { backgroundColor: C.surfaceLight, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: C.border },
    memberRowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm, borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 4 },
    memberRowText: { color: C.info, fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
    inputMiniLabel: { color: C.textMuted, fontSize: 10, marginBottom: 4, fontWeight: '600' },
    removeBtn: { padding: 4 },
    notificationBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: C.danger, minWidth: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
    notificationBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: 'bold' },
});

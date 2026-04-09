import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '../../../store/appStore';
import { useProjectStore } from '../../projects/store/projectStore';
import { useMaterialStore } from '../../materials/store/materialStore';
import { usePersonnelStore, CrewMemberTemplate } from '../../personnel/store/personnelStore';
import { useReportStore } from '../../reports/store/reportStore';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../../core/theme';
import Icon from '@expo/vector-icons/Feather';
import { differenceInDays, parseISO, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { PROJECT_TYPE_LABELS, PROJECT_TYPE_ICONS } from '../../materials/data/standardMaterials';
import { useNotificationStore } from '../../notifications/store/notificationStore';

export default function DashboardScreen({ navigation: propNavigation }: any) {
    const hookNavigation = useNavigation<any>();
    const navigation = propNavigation?.navigate ? propNavigation : hookNavigation;
    const insets = useSafeAreaInsets();
    const user = useAppStore(state => state.user);
    const { logout } = useAppStore();
    const allProjects = useProjectStore(state => state.projects);
    const projects = allProjects.filter(p => p.userId === user?.id);
    const allMaterials = useMaterialStore(state => state.materials);
    const materials = allMaterials.filter(m => m.userId === user?.id);
    const { crews, addCrew } = usePersonnelStore();
    // Filter crews by userId if we add that field later, for now we will assume crews are global per company/device or we can filter them if they have userId:
    const userCrews = crews.filter(c => !c.userId || c.userId === user?.id);

    const allWorkers = usePersonnelStore(state => state.workers);
    const workers = allWorkers.filter(w => w.userId === user?.id);
    const allDailyLogs = useReportStore(state => state.dailyLogs);
    const dailyLogs = allDailyLogs.filter(l => l.userId === user?.id);
    const unreadNotificationsCount = useNotificationStore(state => state.unreadCount);

    const [crewModalVisible, setCrewModalVisible] = useState(false);
    const [newCrewName, setNewCrewName] = useState('');
    const [newCrewMembers, setNewCrewMembers] = useState<CrewMemberTemplate[]>([
        { nombre: 'Líder', rol: 'lider', cargo: 'Líder de Obra', costoDia: 120000 },
        { nombre: 'Técnico', rol: 'tecnico', cargo: 'Técnico de Obra', costoDia: 90000 },
    ]);

    const handleCreateCrew = () => {
        if (!newCrewName.trim()) {
            Alert.alert('Error', 'Ingresa un nombre para la cuadrilla');
            return;
        }
        if (newCrewMembers.length === 0) {
            Alert.alert('Error', 'La cuadrilla debe tener al menos un integrante');
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
        Alert.alert('Éxito', 'Plantilla de cuadrilla guardada');
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
    const greeting = hourNow < 12 ? 'Buenos días' : hourNow < 18 ? 'Buenas tardes' : 'Buenas noches';
    const firstName = user?.nombre?.split(' ')[0] ?? 'Usuario';

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

                {/* ── Header ── */}
                <View style={styles.header}>
                    <View style={styles.avatarCircle}>
                        <Text style={styles.avatarText}>{firstName.slice(0, 2).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: SPACING.md }}>
                        <Text style={styles.greetingText}>{greeting},</Text>
                        <Text style={styles.nameText}>{user?.nombre ?? 'Usuario'}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                            <Text style={[styles.dateText, { marginRight: 8 }]}>{todayFormatted.charAt(0).toUpperCase() + todayFormatted.slice(1)}</Text>
                            {user?.role === 'admin' && user?.plan !== 'enterprise' && (
                                <TouchableOpacity 
                                    onPress={() => navigation.navigate('Subscription' as never)}
                                    style={{ backgroundColor: COLORS.warning + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: COLORS.warning + '50', flexDirection: 'row', alignItems: 'center' }}
                                >
                                    <Icon name="star" size={10} color={COLORS.warning} style={{ marginRight: 4 }} />
                                    <Text style={{ color: COLORS.warning, fontSize: 10, fontWeight: 'bold' }}>Mejorar Plan</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                    <TouchableOpacity onPress={() => navigation.navigate('Notifications' as never)} style={[styles.logoutBtn, { marginRight: SPACING.sm }]}>
                        <Icon name="bell" size={18} color={COLORS.textSecondary} />
                        {unreadNotificationsCount > 0 && (
                            <View style={styles.notificationBadge}>
                                <Text style={styles.notificationBadgeText}>{unreadNotificationsCount}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
                        <Icon name="log-out" size={18} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                </View>

                {/* ── Deadline Alerts ── */}
                {['coordinador', 'lider'].includes(user?.role || '') && stats.projectsWithAlerts.length > 0 && (
                    <View style={styles.alertBanner}>
                        <Icon name="alert-triangle" size={16} color={COLORS.warning} />
                        <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                            <Text style={styles.alertTitle}>¡Proyectos próximos a vencer!</Text>
                            {stats.projectsWithAlerts.map(p => {
                                if (!p.fechaFin) return null;
                                try {
                                    const days = differenceInDays(parseISO(p.fechaFin), new Date());
                                    const label = days < 0 ? `Venció hace ${Math.abs(days)} días` : days === 0 ? 'Vence HOY' : `Vence en ${days} días`;
                                    const color = days <= 0 ? COLORS.danger : COLORS.warning;
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
                        <Icon name="briefcase" size={20} color={COLORS.primary} />
                        <Text style={styles.statValue}>{stats.activeProjects}</Text>
                        <Text style={styles.statLabel}>Obras activas</Text>
                    </View>
                    {user?.role !== 'logistica' && (
                        <View style={styles.statCard}>
                            <Icon name="users" size={20} color={COLORS.info} />
                            <Text style={styles.statValue}>{stats.totalWorkers}</Text>
                            <Text style={styles.statLabel}>Personal</Text>
                        </View>
                    )}
                    <View style={styles.statCard}>
                        <Icon name="package" size={20} color={stats.stockAlerts > 0 ? COLORS.warning : COLORS.success} />
                        <Text style={[styles.statValue, stats.stockAlerts > 0 && { color: COLORS.warning }]}>
                            {stats.stockAlerts > 0 ? stats.stockAlerts : stats.totalStock}
                        </Text>
                        <Text style={styles.statLabel}>{stats.stockAlerts > 0 ? 'Alertas stock' : 'Total stock'}</Text>
                    </View>
                    {user?.role !== 'logistica' && (
                        <View style={styles.statCard}>
                            <Icon name="book-open" size={20} color={COLORS.textSecondary} />
                            <Text style={styles.statValue}>{stats.bitacorasHoy}</Text>
                            <Text style={styles.statLabel}>Bitácoras hoy</Text>
                        </View>
                    )}
                </View>

                {/* ── Crew Templates ── */}
                {['coordinador', 'lider'].includes(user?.role || '') && (
                    <>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Tus Cuadrillas Rápidas</Text>
                            <TouchableOpacity style={styles.headerBtn} onPress={() => setCrewModalVisible(true)}>
                                <Icon name="plus" size={16} color={COLORS.primary} />
                                <Text style={styles.headerBtnText}>Nueva Plantilla</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.crewsList}>
                            {userCrews.length === 0 ? (
                                <View style={[styles.crewTemplateCard, { borderStyle: 'dashed', backgroundColor: 'transparent', width: 200 }]}>
                                    <Icon name="users" size={24} color={COLORS.textMuted} />
                                    <Text style={[styles.crewName, { color: COLORS.textMuted, marginTop: SPACING.sm }]}>No tienes plantillas guardadas</Text>
                                    <Text style={[styles.crewMembers, { color: COLORS.textMuted }]}>Crea una para empezar</Text>
                                </View>
                            ) : (
                                userCrews.map(c => (
                                    <View key={c.id} style={styles.crewTemplateCard}>
                                        <View style={[styles.crewIcon, { backgroundColor: COLORS.info + '22' }]}>
                                            <Icon name="users" size={16} color={COLORS.info} />
                                        </View>
                                        <Text style={styles.crewName}>{c.nombre}</Text>
                                        <Text style={styles.crewMembers}>{c.miembros.length} Integrantes</Text>
                                    </View>
                                ))
                            )}
                        </ScrollView>
                    </>
                )}

                {/* ── Labor Summary (Crew breakdown) ── */}
                {user?.role !== 'logistica' && (
                    <>
                        <Text style={styles.sectionTitle}>Resumen de Personal</Text>
                        <View style={styles.stockCard}>
                            {stats.activeCrews.length === 0 ? (
                                <View style={{ padding: SPACING.lg, alignItems: 'center' }}>
                                    <Icon name="users" size={32} color={COLORS.textMuted} />
                                    <Text style={{ color: COLORS.textMuted, marginTop: SPACING.md }}>No hay cuadrillas activas asignadas a proyectos</Text>
                                </View>
                            ) : (
                                <>
                                    {/* Crew Selector */}
                                    <Text style={[styles.inputLabel, { marginBottom: 8 }]}>Seleccionar Cuadrilla Activa:</Text>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: SPACING.lg }}>
                                        {stats.activeCrews.map((crew: any, idx: number) => (
                                            <TouchableOpacity
                                                key={idx}
                                                style={[
                                                    styles.crewFilterChip,
                                                    selectedCrewIndex === idx && styles.crewFilterChipActive,
                                                    crew.daysExceeded && { borderColor: COLORS.danger, borderWidth: 1 }
                                                ]}
                                                onPress={() => setSelectedCrewIndex(idx)}
                                            >
                                                <Text style={[styles.crewFilterText, selectedCrewIndex === idx && { color: COLORS.white }]}>
                                                    {crew.crewName}
                                                </Text>
                                                <Text style={[styles.crewFilterSub, selectedCrewIndex === idx && { color: COLORS.surfaceLight }]}>
                                                    ({crew.projectName})
                                                </Text>
                                                {crew.daysExceeded && <Icon name="alert-triangle" size={12} color={selectedCrewIndex === idx ? COLORS.white : COLORS.danger} style={{ marginTop: 2 }} />}
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    {/* Selected Crew Details */}
                                    {stats.activeCrews[selectedCrewIndex] && (() => {
                                        const selected = stats.activeCrews[selectedCrewIndex] as any;
                                        return (
                                            <View>
                                                <Text style={{ color: COLORS.primary, fontWeight: 'bold', fontSize: 16, marginBottom: SPACING.sm }}>
                                                    Rendimiento: {selected.crewName}
                                                </Text>
                                                <View style={styles.stockRow}>
                                                    <View style={styles.stockItem}>
                                                        <Text style={[styles.stockValue, { color: COLORS.info }]}>{selected.memberCount}</Text>
                                                        <Text style={styles.stockLabel}>Integrantes</Text>
                                                    </View>
                                                    <View style={styles.stockDivider} />
                                                    <View style={styles.stockItem}>
                                                        <Text style={[styles.stockValue, selected.daysExceeded && { color: COLORS.danger }]}>
                                                            {selected.maxDaysWorked}
                                                        </Text>
                                                        <Text style={styles.stockLabel}>Días Trabajados</Text>
                                                    </View>
                                                    <View style={styles.stockDivider} />
                                                    <View style={styles.stockItem}>
                                                        <Text style={[styles.stockValue, { color: COLORS.textSecondary }]}>
                                                            {selected.projectDuration > 0 ? selected.projectDuration : 'N/A'}
                                                        </Text>
                                                        <Text style={styles.stockLabel}>Duración Obra</Text>
                                                    </View>
                                                </View>

                                                {selected.daysExceeded && (
                                                    <View style={{ backgroundColor: COLORS.danger + '20', padding: 12, borderRadius: RADIUS.md, marginTop: SPACING.md, flexDirection: 'row', alignItems: 'center' }}>
                                                        <Icon name="alert-circle" size={16} color={COLORS.danger} style={{ marginRight: 8 }} />
                                                        <Text style={{ color: COLORS.danger, flex: 1, fontSize: 13, fontWeight: 'bold' }}>
                                                            Alerta: La cuadrilla ha trabajado más días ({selected.maxDaysWorked}) de los presupuestados para la duración del proyecto ({selected.projectDuration}).
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
                <Text style={styles.sectionTitle}>Acceso Rápido</Text>
                <View style={styles.quickGrid}>
                    {[
                        { id: 'proyectos', icon: 'briefcase' as const, label: 'Proyectos', sub: `${stats.activeProjects} activos`, color: COLORS.primary, screen: 'Proyectos', roles: ['coordinador', 'lider'] },
                        { id: 'materiales', icon: 'package' as const, label: 'Bodega Central', sub: `${materials.length} items`, color: COLORS.info, action: () => navigation.navigate('Materiales', { projectId: 'central', projectName: 'Bodega Central' }), roles: ['coordinador', 'logistica'] },
                        { id: 'logistica', icon: 'truck' as const, label: 'Logística', sub: 'Rastreo envíos', color: '#9B59B6', action: () => navigation.navigate('Envíos', { projectId: 'all' }), roles: ['coordinador', 'lider', 'conductor', 'logistica'] },
                        { id: 'personal', icon: 'users' as const, label: 'Personal', sub: `${stats.totalWorkers} total`, color: COLORS.success, action: () => navigation.navigate('Personal', { projectId: 'all', projectName: 'Personal Global' }), roles: ['coordinador', 'lider'] },
                        { id: 'proveedores', icon: 'shopping-cart' as const, label: 'Proveedores', sub: 'Gestión global', color: '#8E44AD', action: () => navigation.navigate('Proveedores'), roles: ['coordinador'] },
                        { id: 'reportes', icon: 'file-text' as const, label: 'Reportes', sub: 'PDF / Excel', color: '#E67E22', screen: 'Reportes', roles: ['coordinador'] },
                        { id: 'usuarios', icon: 'user-check' as const, label: 'Usuarios', sub: 'Admin & Personal', color: COLORS.danger, action: () => navigation.navigate('UserManagement' as never), roles: ['admin', 'coordinador'] },
                        { id: 'actividad', icon: 'activity' as const, label: 'Actividad', sub: 'Historial', color: COLORS.info, action: () => navigation.navigate('ActivityHistory' as never), roles: ['admin', 'coordinador'] },
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
                {['coordinador', 'lider'].includes(user?.role || '') && (
                    <>
                        <View style={styles.sectionRow}>
                            <Text style={styles.sectionTitle}>Mis Obras</Text>
                            <TouchableOpacity onPress={() => navigation.navigate('Proyectos')}>
                                <Text style={styles.seeAll}>Ver todas</Text>
                            </TouchableOpacity>
                        </View>

                        {projects.slice(0, 4).map(p => {
                            const deadlineStatus = (() => {
                                if (!p.fechaFin) return null;
                                try {
                                    const days = differenceInDays(parseISO(p.fechaFin), new Date());
                                    if (days <= 0) return { label: days === 0 ? 'Vence HOY' : `Venció hace ${Math.abs(days)}d`, color: COLORS.danger };
                                    if (days <= 14) return { label: `${days}d restantes`, color: COLORS.warning };
                                    return null;
                                } catch { return null; }
                            })();
                            return (
                                <TouchableOpacity key={p.id} style={styles.projectCard}
                                    onPress={() => navigation.navigate('ProjectDashboard', { projectId: p.id, projectName: p.nombreProyecto })}>
                                    <View style={[styles.projectIconBox, { backgroundColor: COLORS.primary + '22' }]}>
                                        <Icon name="briefcase" size={18} color={COLORS.primary} />
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
                                    <Icon name="chevron-right" size={16} color={COLORS.textMuted} />
                                </TouchableOpacity>
                            );
                        })}
                    </>
                )}

                {/* ── Create Crew Modal ── */}
                <Modal visible={crewModalVisible} transparent animationType="slide">
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>Nueva Plantilla</Text>
                            <Text style={styles.inputLabel}>Nombre de la Cuadrilla (Ej: Cuadrilla B)</Text>
                            <TextInput
                                style={styles.input}
                                value={newCrewName}
                                onChangeText={setNewCrewName}
                                placeholder="Nombre..."
                                placeholderTextColor={COLORS.textMuted}
                            />

                            <Text style={styles.inputLabel}>Integrantes de la Cuadrilla:</Text>
                            <ScrollView style={{ maxHeight: 250, marginBottom: 20 }}>
                                {newCrewMembers.map((member, index) => (
                                    <View key={index} style={styles.memberRowContainer}>
                                        <View style={styles.memberRowHeader}>
                                            <Text style={styles.memberRowText}>Integrante #{index + 1}</Text>
                                            <TouchableOpacity onPress={() => removeMemberRow(index)} style={styles.removeBtn}>
                                                <Icon name="trash-2" size={18} color={COLORS.danger} />
                                            </TouchableOpacity>
                                        </View>

                                        <Text style={styles.inputMiniLabel}>Nombre Completo</Text>
                                        <TextInput
                                            style={[styles.input, { marginBottom: SPACING.sm }]}
                                            value={member.nombre}
                                            onChangeText={(text) => updateMemberRow(index, { nombre: text })}
                                            placeholder="Nombre de la persona"
                                            placeholderTextColor={COLORS.textMuted}
                                        />

                                        <View style={{ flexDirection: 'row', gap: 10 }}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.inputMiniLabel}>Cargo / Rol</Text>
                                                <TextInput
                                                    style={styles.input}
                                                    value={member.cargo}
                                                    onChangeText={(text) => updateMemberRow(index, { cargo: text })}
                                                    placeholder="Ej: Plomero"
                                                    placeholderTextColor={COLORS.textMuted}
                                                />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.inputMiniLabel}>Costo Diario</Text>
                                                <TextInput
                                                    style={styles.input}
                                                    value={member.costoDia.toString()}
                                                    onChangeText={(text) => updateMemberRow(index, { costoDia: parseInt(text) || 0 })}
                                                    placeholder="Costo"
                                                    keyboardType="numeric"
                                                    placeholderTextColor={COLORS.textMuted}
                                                />
                                            </View>
                                        </View>
                                    </View>
                                ))}
                                <TouchableOpacity onPress={addMemberRow} style={styles.addMemberBtn}>
                                    <Icon name="plus-circle" size={16} color={COLORS.primary} />
                                    <Text style={styles.addMemberText}>Agregar integrante</Text>
                                </TouchableOpacity>
                            </ScrollView>

                            <View style={styles.modalActions}>
                                <TouchableOpacity style={styles.cancelBtn} onPress={() => setCrewModalVisible(false)}>
                                    <Text style={styles.cancelText}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.confirmBtn} onPress={handleCreateCrew}>
                                    <Text style={styles.confirmText}>Guardar Plantilla</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: { flexDirection: 'row', alignItems: 'center', padding: SPACING.lg, paddingBottom: SPACING.md },
    avatarCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: COLORS.white, fontWeight: 'bold', fontSize: FONTS.sizes.lg },
    greetingText: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm },
    nameText: { color: COLORS.white, fontWeight: 'bold', fontSize: FONTS.sizes.xl },
    dateText: { color: COLORS.textMuted, fontSize: FONTS.sizes.xs, textTransform: 'capitalize' },
    logoutBtn: { padding: SPACING.sm, backgroundColor: COLORS.surfaceLight, borderRadius: RADIUS.round },
    alertBanner: { flexDirection: 'row', backgroundColor: COLORS.warning + '18', borderRadius: RADIUS.md, padding: SPACING.md, marginHorizontal: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.warning + '60' },
    alertTitle: { color: COLORS.warning, fontWeight: 'bold', fontSize: FONTS.sizes.sm, marginBottom: 4 },
    alertItem: { fontSize: FONTS.sizes.xs, marginTop: 2 },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: SPACING.md, gap: SPACING.sm, marginBottom: SPACING.md },
    statCard: { flex: 1, minWidth: '44%', backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm },
    statValue: { color: COLORS.white, fontSize: FONTS.sizes.xxl, fontWeight: 'bold', marginTop: 4 },
    statLabel: { color: COLORS.textMuted, fontSize: 10, marginTop: 2, textAlign: 'center' },
    sectionTitle: { color: COLORS.white, fontSize: FONTS.sizes.lg, fontWeight: 'bold', paddingHorizontal: SPACING.lg, marginBottom: SPACING.sm, marginTop: SPACING.md },
    sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.lg, marginBottom: SPACING.sm, marginTop: SPACING.md },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.lg, marginBottom: SPACING.sm, marginTop: SPACING.md },
    headerBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary + '15', paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.md },
    headerBtnText: { color: COLORS.primary, fontSize: 12, fontWeight: 'bold', marginLeft: 4 },
    seeAll: { color: COLORS.info, fontSize: FONTS.sizes.sm },
    stockCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md, marginHorizontal: SPACING.md, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm },
    stockRow: { flexDirection: 'row', justifyContent: 'space-around' },
    stockItem: { alignItems: 'center', flex: 1 },
    stockValue: { color: COLORS.white, fontSize: 24, fontWeight: 'bold' },
    stockLabel: { color: COLORS.textMuted, fontSize: 10, marginTop: 2, textAlign: 'center' },
    stockDivider: { width: 1, backgroundColor: COLORS.border },
    stockBar: { height: 6, backgroundColor: COLORS.surfaceLight, borderRadius: 3, marginTop: SPACING.md },
    stockBarFill: { height: 6, borderRadius: 3, backgroundColor: COLORS.primary },
    stockBarLabel: { color: COLORS.textMuted, fontSize: 11, marginTop: 6, textAlign: 'center' },

    crewFilterChip: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: COLORS.surfaceLight, borderRadius: RADIUS.md, marginRight: 8, alignItems: 'center' },
    crewFilterChipActive: { backgroundColor: COLORS.primary },
    crewFilterText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: 'bold' },
    crewFilterSub: { color: COLORS.textMuted, fontSize: 10, marginTop: 2 },

    quickGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: SPACING.md, gap: SPACING.sm },
    quickCard: { width: '48%', backgroundColor: COLORS.surface, padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm, marginBottom: SPACING.xs },
    quickIconBox: { width: 40, height: 40, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.sm },
    quickLabel: { color: COLORS.white, fontWeight: 'bold', fontSize: FONTS.sizes.md },
    quickSub: { color: COLORS.textMuted, fontSize: FONTS.sizes.xs, marginTop: 2 },
    projectCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md, marginHorizontal: SPACING.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm },
    projectIconBox: { width: 36, height: 36, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
    projectName: { color: COLORS.white, fontWeight: 'bold', fontSize: FONTS.sizes.md },
    projectSub: { color: COLORS.textMuted, fontSize: FONTS.sizes.xs, marginTop: 2 },
    deadlinePill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 4 },
    deadlinePillText: { fontSize: 10, fontWeight: 'bold' },
    crewTemplateCard: { backgroundColor: COLORS.surface, width: 140, padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm, alignItems: 'center' },
    crewIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    crewName: { color: COLORS.white, fontSize: 13, fontWeight: 'bold', textAlign: 'center' },
    crewMembers: { color: COLORS.textMuted, fontSize: 10, marginTop: 2 },
    crewsList: { paddingHorizontal: SPACING.md, gap: SPACING.sm, marginBottom: SPACING.md },

    // Modals
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: SPACING.xl },
    modalContent: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.xl, ...SHADOWS.lg },
    modalTitle: { color: COLORS.white, fontSize: FONTS.sizes.xl, fontWeight: 'bold', marginBottom: SPACING.lg },
    inputLabel: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm, marginBottom: 8 },
    input: { backgroundColor: COLORS.surfaceLight, color: COLORS.white, padding: SPACING.md, borderRadius: RADIUS.md, marginBottom: SPACING.lg },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.sm },
    cancelBtn: { padding: SPACING.md },
    cancelText: { color: COLORS.textSecondary, fontWeight: 'bold' },
    confirmBtn: { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderRadius: RADIUS.md },
    confirmText: { color: COLORS.white, fontWeight: 'bold' },
    addMemberBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: SPACING.md, backgroundColor: COLORS.primary + '15', borderRadius: RADIUS.md, borderStyle: 'dashed', borderWidth: 1, borderColor: COLORS.primary, marginTop: SPACING.sm },
    addMemberText: { color: COLORS.info, fontWeight: 'bold', marginLeft: 8 },
    memberRowContainer: { backgroundColor: COLORS.surfaceLight, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
    memberRowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingBottom: 4 },
    memberRowText: { color: COLORS.info, fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
    inputMiniLabel: { color: COLORS.textMuted, fontSize: 10, marginBottom: 4, fontWeight: '600' },
    removeBtn: { padding: 4 },
    notificationBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: COLORS.danger, minWidth: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
    notificationBadgeText: { color: COLORS.white, fontSize: 9, fontWeight: 'bold' }
});

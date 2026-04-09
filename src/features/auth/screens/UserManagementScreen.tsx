import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, ScrollView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Icon from '@expo/vector-icons/Feather';
import { collection, onSnapshot, query, doc, updateDoc, deleteDoc, where } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAppStore, User, UserRole } from '../../../store/appStore';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../../core/theme';
import { exportUsersCSV, exportUsersExcel, exportUsersPDF } from '../services/userExportService';
import { useSubscription } from '../hooks/useSubscription';
import { getPlanLimits, PLAN_PRICES, ADDON_PRICES, PlanTier } from '../../../core/constants/plans';

export default function UserManagementScreen({ navigation: propNavigation }: any) {
    const insets = useSafeAreaInsets();
    const hookNavigation = useNavigation<any>();
    const navigation = propNavigation?.navigate ? propNavigation : hookNavigation;
    const { user, registerUser } = useAppStore();
    const { canAddUserOfRole, getLimitForRole, planName } = useSubscription();
    const [registeredUsers, setRegisteredUsers] = useState<User[]>([]);

    const [nombre, setNombre] = useState('');
    const [cedula, setCedula] = useState('');
    const [telefono, setTelefono] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<UserRole>('lider');

    const [searchQuery, setSearchQuery] = useState('');
    const [filterRole, setFilterRole] = useState<UserRole | 'all'>('all');
    const [exporting, setExporting] = useState<'pdf' | 'xlsx' | 'csv' | null>(null);

    const handleExport = async (format: 'pdf' | 'xlsx' | 'csv') => {
        setExporting(format);
        try {
            if (format === 'pdf') await exportUsersPDF(registeredUsers);
            else if (format === 'xlsx') await exportUsersExcel(registeredUsers);
            else await exportUsersCSV(registeredUsers);
        } catch (e) {
            if (Platform.OS === 'web') window.alert('Error al exportar.');
            else Alert.alert('Error', 'No se pudo exportar la lista.');
        } finally {
            setExporting(null);
        }
    };

    const isAdmin = user?.role === 'admin';
    const isCoordinador = user?.role === 'coordinador';

    useEffect(() => {
        if (!isAdmin || !user?.companyId) return;
        const q = query(collection(db, 'users'), where('companyId', '==', user.companyId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const usersList = snapshot.docs.map(d => d.data() as User);
            setRegisteredUsers(usersList);
        });
        return () => unsubscribe();
    }, [isAdmin, user?.companyId]);

    const approveUser = async (id: string, currentRole: string) => {
        const compId = user?.companyId || 'default-company';
        const canAdd = await canAddUserOfRole(currentRole as UserRole, compId);
        if (!canAdd) {
            const limit = getLimitForRole(currentRole as UserRole);
            const planLabel = PLAN_PRICES[planName as PlanTier]?.label ?? planName;
            Alert.alert(
                '🔒 Límite alcanzado',
                `Tu plan ${planLabel} permite máximo ${limit} usuario(s) con rol "${currentRole}".\n\nPuedes habilitar usuarios extra por ${ADDON_PRICES.EXTRA_USER.price}/mes c/u, o actualizar tu plan.`,
                [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Ver Planes', onPress: () => navigation.navigate('Subscription') },
                ]
            );
            return;
        }

        try {
            await updateDoc(doc(db, 'users', id), { status: 'approved' });
            if (Platform.OS === 'web') {
                window.alert(`Usuario aprobado como ${currentRole}`);
            } else {
                Alert.alert('Aprobado', `El usuario ahora tiene acceso como ${currentRole}`);
            }
        } catch (error: any) {
            console.error("Error approving user", error);
            if (Platform.OS === 'web') {
                window.alert(`Error de permisos en Firebase:\n\nTu base de datos de Firebase no permite a los administradores modificar otros usuarios. Por favor, actualiza tus 'Firestore Rules'.\n\nDetalle: ${error.message}`);
            } else {
                Alert.alert('Error de Permisos', 'Firestore bloqueó la operación. Falta configurar las reglas.');
            }
        }
    };

    const updateUserRole = async (id: string, newRole: UserRole) => {
        try {
            await updateDoc(doc(db, 'users', id), { role: newRole });
        } catch (error) {
            console.error("Error updating role", error);
        }
    };

    const removeUser = async (id: string) => {
        try {
            await deleteDoc(doc(db, 'users', id));
        } catch (error) {
            console.error("Error deleting user", error);
        }
    };

    const handleCreateSubUser = async () => {
        if (!nombre || !email || !password || !cedula || !telefono) {
            Alert.alert('Incompleto', 'Llena todos los campos, incluyendo el teléfono.');
            return;
        }
        if (password.length < 6) { return Alert.alert('Error', 'Contraseña muy corta'); }

        // ── Plan limit check ────────────────────────────────────────────────
        const compId = user?.companyId || 'default-company';
        const canAdd = await canAddUserOfRole(role, compId);
        if (!canAdd) {
            const limit = getLimitForRole(role);
            const planLabel = PLAN_PRICES[planName as PlanTier]?.label ?? planName;
            Alert.alert(
                '🔒 Límite alcanzado',
                `Tu plan ${planLabel} permite máximo ${limit} usuario(s) con rol "${role}".\n\nPuedes habilitar usuarios extra por ${ADDON_PRICES.EXTRA_USER.price}/mes c/u, o actualizar tu plan.`,
                [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Ver Planes', onPress: () => navigation.navigate('Subscription') },
                ]
            );
            return;
        }

        const result = await registerUser(nombre, email, password, cedula, role, true, telefono, compId);
        if (result.success) {
            Alert.alert('Usuario Creado', `${nombre} ahora tiene acceso como ${role}.`);
            setNombre(''); setCedula(''); setTelefono(''); setEmail(''); setPassword('');
        } else {
            if (Platform.OS === 'web') {
                window.alert('Error: Ese correo ya está registrado.');
            } else {
                Alert.alert('Error', 'Ese correo ya está registrado.');
            }
        }
    };

    const renderUserCard = ({ item }: { item: User }) => (
        <View style={styles.userCard}>
            <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={styles.userName}>{item.nombre} <Text style={{ fontSize: 12, color: item.status === 'approved' ? COLORS.success : COLORS.primary, fontWeight: 'bold' }}>({item.role?.toUpperCase()})</Text></Text>
                    {item.status === 'approved' && <Icon name="check-circle" size={16} color={COLORS.success} />}
                </View>
                <Text style={styles.userEmail}>{item.email}</Text>
                {item.cedula && <Text style={styles.userEmail}>C.C.: {item.cedula}</Text>}
                <Text style={styles.userDate}>Registrado: {new Date(item.fechaRegistro).toLocaleDateString()}</Text>

                {/* Role Changer inline */}
                {isAdmin && (
                    <View style={{ flexDirection: 'row', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                        {['coordinador', 'lider', 'logistica', 'conductor'].map(r => (
                            <TouchableOpacity
                                key={r}
                                style={[
                                    { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: COLORS.border },
                                    item.role === r ? { backgroundColor: COLORS.primary, borderColor: COLORS.primary } : { backgroundColor: COLORS.surfaceLight }
                                ]}
                                onPress={() => updateUserRole(item.id, r as UserRole)}
                            >
                                <Text style={{ fontSize: 10, fontWeight: 'bold', color: item.role === r ? COLORS.white : COLORS.textMuted }}>
                                    {r.toUpperCase()}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </View>

            <View style={styles.actions}>
                {item.status === 'pending' && (
                    <TouchableOpacity style={styles.approveBtn} onPress={() => approveUser(item.id, item.role)}>
                        <Icon name="check" size={20} color={COLORS.white} />
                    </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.rejectBtn} onPress={() => {
                    if (Platform.OS === 'web') {
                        if (window.confirm(item.status === 'approved' ? '¿Eliminar usuario del sistema?' : '¿Eliminar solicitud permanente?')) {
                            removeUser(item.id);
                        }
                    } else {
                        Alert.alert('Eliminar', item.status === 'approved' ? '¿Revocar acceso y eliminar usuario?' : '¿Eliminar solicitud?', [
                            { text: 'Cancelar', style: 'cancel' },
                            { text: 'Eliminar', style: 'destructive', onPress: () => removeUser(item.id) },
                        ])
                    }
                }}>
                    <Icon name="x" size={20} color={COLORS.danger} />
                </TouchableOpacity>
            </View>
        </View>
    );

    const filteredUsers = registeredUsers.filter(u => {
        const matchesSearch = u.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (u.cedula && u.cedula.includes(searchQuery));
        const matchesRole = filterRole === 'all' || u.role === filterRole;
        return matchesSearch && matchesRole;
    });

    const pendingUsers = filteredUsers.filter(u => u.status === 'pending');
    const approvedUsers = filteredUsers.filter(u => u.status === 'approved' && u.id !== user?.id);

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : null} style={styles.backBtn}>
                    <Icon name="arrow-left" size={24} color={COLORS.white} />
                </TouchableOpacity>
                <Text style={styles.title}>Gestión de Usuarios</Text>
                {isAdmin && (
                    <View style={styles.exportBar}>
                        {(['pdf', 'xlsx', 'csv'] as const).map(fmt => (
                            <TouchableOpacity
                                key={fmt}
                                style={[styles.exportBtn, exporting === fmt && { opacity: 0.5 }]}
                                onPress={() => handleExport(fmt)}
                                disabled={!!exporting}
                            >
                                <Icon
                                    name={fmt === 'pdf' ? 'file-text' : fmt === 'xlsx' ? 'grid' : 'list'}
                                    size={14}
                                    color={COLORS.primary}
                                />
                                <Text style={styles.exportBtnText}>
                                    {exporting === fmt ? '...' : fmt.toUpperCase()}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

                {isAdmin && user?.companyId && (
                    <View style={styles.companyCodeCard}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.companyCodeLabel}>Código de Empresa (Para que tus empleados se unan)</Text>
                            <Text style={styles.companyCodeText}>{user.companyId}</Text>
                        </View>
                        <TouchableOpacity style={styles.copyBtn} onPress={() => {
                            if (Platform.OS === 'web') navigator.clipboard.writeText(user.companyId!);
                            else Alert.alert('Copiado', 'Código copiado al portapapeles');
                        }}>
                            <Icon name="copy" size={20} color={COLORS.primary} />
                        </TouchableOpacity>
                    </View>
                )}

                <View style={{ paddingHorizontal: SPACING.lg, marginTop: SPACING.md }}>
                    <View style={styles.searchContainer}>
                        <Icon name="search" size={20} color={COLORS.textMuted} style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Buscar por nombre o cédula..."
                            placeholderTextColor={COLORS.textMuted}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <Icon name="x" size={20} color={COLORS.textMuted} style={{ padding: 4 }} />
                            </TouchableOpacity>
                        )}
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: SPACING.md }}>
                        {['all', 'admin', 'coordinador', 'lider', 'logistica', 'conductor'].map(r => (
                            <TouchableOpacity
                                key={r}
                                style={[
                                    styles.filterChip,
                                    filterRole === r && styles.filterChipActive
                                ]}
                                onPress={() => setFilterRole(r as UserRole | 'all')}
                            >
                                <Text style={[
                                    styles.filterChipText,
                                    filterRole === r && styles.filterChipTextActive
                                ]}>
                                    {r === 'all' ? 'Todos' : r.toUpperCase()}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {isAdmin && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Solicitudes Pendientes ({pendingUsers.length})</Text>
                        {pendingUsers.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Icon name="check-circle" size={32} color={COLORS.success} />
                                <Text style={styles.emptyText}>No hay solicitudes pendientes.</Text>
                            </View>
                        ) : (
                            <FlatList
                                data={pendingUsers}
                                keyExtractor={item => item.id}
                                renderItem={renderUserCard}
                                showsVerticalScrollIndicator={false}
                                scrollEnabled={false}
                            />
                        )}
                    </View>
                )}

                {isAdmin && approvedUsers.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Usuarios Activos ({approvedUsers.length})</Text>
                        <FlatList
                            data={approvedUsers}
                            keyExtractor={item => item.id}
                            renderItem={renderUserCard}
                            showsVerticalScrollIndicator={false}
                            scrollEnabled={false}
                        />
                    </View>
                )}

                {(isCoordinador || isAdmin) && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Crear Nuevo Usuario</Text>
                        <Text style={styles.subtitle}>
                            {isAdmin ? 'Como administrador, puedes crear usuarios con cualquier rol y se aprobarán inmediatamente.'
                                : 'Como coordinador, los usuarios que crees aquí ya estarán aprobados y podrán ingresar inmediatamente.'}
                        </Text>

                        <TextInput style={styles.input} placeholder="Nombre Completo" placeholderTextColor={COLORS.textMuted} value={nombre} onChangeText={setNombre} />
                        <TextInput style={styles.input} placeholder="Cédula" placeholderTextColor={COLORS.textMuted} value={cedula} onChangeText={setCedula} keyboardType="numeric" />
                        <TextInput style={styles.input} placeholder="Teléfono *" placeholderTextColor={COLORS.textMuted} value={telefono} onChangeText={setTelefono} keyboardType="phone-pad" />
                        <TextInput style={styles.input} placeholder="Correo Electrónico" placeholderTextColor={COLORS.textMuted} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
                        <TextInput style={styles.input} placeholder="Controles Temporales (Contraseña)" placeholderTextColor={COLORS.textMuted} value={password} onChangeText={setPassword} secureTextEntry />

                        <Text style={styles.label}>Rol de Acceso:</Text>
                        <View style={styles.roleContainer}>
                            {(isAdmin ? ['coordinador', 'lider', 'logistica', 'conductor'] : ['lider', 'logistica', 'conductor']).map(r => (
                                <TouchableOpacity
                                    key={r}
                                    style={[styles.roleChip, role === r && styles.roleChipActive]}
                                    onPress={() => setRole(r as UserRole)}
                                >
                                    <Text style={[styles.roleText, role === r && styles.roleTextActive]}>{r.toUpperCase()}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity style={styles.submitBtn} onPress={handleCreateSubUser}>
                            <Icon name="user-plus" size={20} color={COLORS.white} />
                            <Text style={styles.submitText}>Crear Usuario</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border, flexWrap: 'wrap', gap: SPACING.sm },
    backBtn: { marginRight: SPACING.md },
    title: { color: COLORS.white, fontSize: FONTS.sizes.lg, fontWeight: 'bold', flex: 1 },

    companyCodeCard: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary + '15',
        marginHorizontal: SPACING.lg, marginTop: SPACING.md, padding: SPACING.lg,
        borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.primary + '40',
    },
    companyCodeLabel: { color: COLORS.textMuted, fontSize: 13, marginBottom: 4 },
    companyCodeText: { color: COLORS.white, fontSize: 22, fontWeight: '900', letterSpacing: 2 },
    copyBtn: { padding: 8, backgroundColor: COLORS.surface, borderRadius: RADIUS.sm },

    exportBar: { flexDirection: 'row', gap: 8 },
    exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: COLORS.primary + '20', borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.primary + '40' },
    exportBtnText: { color: COLORS.primary, fontSize: 11, fontWeight: 'bold' },

    section: { padding: SPACING.lg, paddingBottom: 0 },
    sectionTitle: { color: COLORS.white, fontSize: FONTS.sizes.lg, fontWeight: 'bold', marginBottom: SPACING.md },
    subtitle: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm, marginBottom: SPACING.lg },

    emptyState: { alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, backgroundColor: COLORS.surface, borderRadius: RADIUS.md },
    emptyText: { color: COLORS.textMuted, marginTop: SPACING.sm },

    userCard: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, marginBottom: SPACING.md },
    userName: { color: COLORS.white, fontSize: FONTS.sizes.md, fontWeight: 'bold' },
    userEmail: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm },
    userDate: { color: COLORS.textMuted, fontSize: 11, marginTop: 4 },

    actions: { flexDirection: 'row', gap: SPACING.md },
    approveBtn: { width: 44, height: 44, borderRadius: RADIUS.round, backgroundColor: COLORS.success, alignItems: 'center', justifyContent: 'center' },
    rejectBtn: { width: 44, height: 44, borderRadius: RADIUS.round, backgroundColor: COLORS.danger + '20', alignItems: 'center', justifyContent: 'center' },

    input: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, color: COLORS.white, padding: SPACING.md, marginBottom: SPACING.md, fontSize: FONTS.sizes.md },
    label: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm, marginBottom: SPACING.sm, fontWeight: 'bold' },
    roleContainer: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.xl, flexWrap: 'wrap' },
    roleChip: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: COLORS.surfaceLight, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: 'transparent' },
    roleChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    roleText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: 'bold' },
    roleTextActive: { color: COLORS.white },

    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, borderWidth: 1, borderColor: COLORS.border, height: 48 },
    searchIcon: { marginRight: SPACING.sm },
    searchInput: { flex: 1, color: COLORS.white, fontSize: FONTS.sizes.md },

    filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.surface, marginRight: 8, borderWidth: 1, borderColor: COLORS.border },
    filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    filterChipText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: 'bold' },
    filterChipTextActive: { color: COLORS.white },

    submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, padding: SPACING.md, borderRadius: RADIUS.md },
    submitText: { color: COLORS.white, fontSize: FONTS.sizes.md, fontWeight: 'bold', marginLeft: SPACING.sm },
});

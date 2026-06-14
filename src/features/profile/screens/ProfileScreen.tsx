import React, { useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
    Image, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import Icon from '@expo/vector-icons/Feather';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../../core/theme';
import { useAppStore, UserRole } from '../../../store/appStore';
import { StorageService } from '../../../core/services/storageService';
import ScreenHeader from '../../../components/ScreenHeader';
import { haptic } from '../../../core/utils/haptics';

const ROLE_LABELS: Record<UserRole, string> = {
    admin: 'Administrador',
    coordinador: 'Coordinador',
    lider: 'Líder',
    conductor: 'Conductor',
    logistica: 'Logística',
};

const PLAN_LABELS: Record<string, string> = {
    free: 'Gratis',
    premium: 'Premium',
    enterprise: 'Enterprise',
};

export default function ProfileScreen() {
    const insets = useSafeAreaInsets();
    const user = useAppStore(s => s.user);
    const updateUser = useAppStore(s => s.updateUser);
    const changePassword = useAppStore(s => s.changePassword);
    const logout = useAppStore(s => s.logout);
    const deleteOwnAccount = useAppStore(s => s.deleteOwnAccount);

    const [nombre, setNombre] = useState(user?.nombre || '');
    const [telefono, setTelefono] = useState(user?.telefono || '');
    const [cedula, setCedula] = useState(user?.cedula || '');
    const [savingInfo, setSavingInfo] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);

    const [currentPass, setCurrentPass] = useState('');
    const [newPass, setNewPass] = useState('');
    const [confirmPass, setConfirmPass] = useState('');
    const [changingPass, setChangingPass] = useState(false);

    if (!user) return null;

    const initials = (user.nombre || user.email).slice(0, 2).toUpperCase();
    const infoDirty = nombre.trim() !== (user.nombre || '') || telefono !== (user.telefono || '') || cedula !== (user.cedula || '');

    // ── Photo ──────────────────────────────────────────────
    const compress = async (uri: string) => {
        const r = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 600 } }], { compress: 0.7, format: 'jpeg' as any });
        return r.uri;
    };

    const uploadPhoto = async (uri: string) => {
        try {
            setUploadingPhoto(true);
            const compressed = await compress(uri);
            const url = await StorageService.uploadImage(compressed, `avatars/${user.id}_${Date.now()}.jpg`);
            await updateUser(user.id, { avatarUrl: url });
            haptic.success();
        } catch (e: any) {
            haptic.error();
            Alert.alert('Error', e?.message || 'No se pudo subir la foto.');
        } finally {
            setUploadingPhoto(false);
        }
    };

    const pickFromGallery = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permiso requerido', 'Concede acceso a la galería.'); return; }
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] as any, allowsEditing: true, aspect: [1, 1] });
        if (!result.canceled && result.assets[0]?.uri) uploadPhoto(result.assets[0].uri);
    };

    const takePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permiso requerido', 'Concede acceso a la cámara.'); return; }
        const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'] as any, allowsEditing: true, aspect: [1, 1] });
        if (!result.canceled && result.assets[0]?.uri) uploadPhoto(result.assets[0].uri);
    };

    const changePhoto = () => {
        haptic.light();
        Alert.alert('Foto de perfil', '¿Cómo quieres agregar tu foto?', [
            { text: 'Tomar foto', onPress: takePhoto },
            { text: 'Elegir de galería', onPress: pickFromGallery },
            { text: 'Cancelar', style: 'cancel' },
        ]);
    };

    // ── Save personal info ─────────────────────────────────
    const saveInfo = async () => {
        if (!nombre.trim()) { Alert.alert('Atención', 'El nombre no puede estar vacío.'); return; }
        try {
            setSavingInfo(true);
            await updateUser(user.id, { nombre: nombre.trim(), telefono: telefono.trim(), cedula: cedula.trim() });
            haptic.success();
            Alert.alert('Listo', 'Tus datos se actualizaron correctamente.');
        } catch (e: any) {
            haptic.error();
            Alert.alert('Error', e?.message || 'No se pudieron guardar los datos.');
        } finally {
            setSavingInfo(false);
        }
    };

    // ── Change password ────────────────────────────────────
    const submitPassword = async () => {
        if (!currentPass || !newPass || !confirmPass) { Alert.alert('Atención', 'Completa todos los campos de contraseña.'); return; }
        if (newPass.length < 6) { Alert.alert('Atención', 'La nueva contraseña debe tener al menos 6 caracteres.'); return; }
        if (newPass !== confirmPass) { Alert.alert('Atención', 'La confirmación no coincide con la nueva contraseña.'); return; }
        setChangingPass(true);
        const res = await changePassword(currentPass, newPass);
        setChangingPass(false);
        if (res.success) {
            haptic.success();
            setCurrentPass(''); setNewPass(''); setConfirmPass('');
            Alert.alert('Listo', 'Tu contraseña se actualizó correctamente.');
        } else {
            haptic.error();
            Alert.alert('Error', res.reason || 'No se pudo cambiar la contraseña.');
        }
    };

    // ── Danger ─────────────────────────────────────────────
    const confirmLogout = () => {
        Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Cerrar sesión', style: 'destructive', onPress: () => { haptic.medium(); logout(); } },
        ]);
    };

    const confirmDelete = () => {
        Alert.alert('Eliminar cuenta', 'Esta acción es permanente y borrará tu cuenta. ¿Continuar?', [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Eliminar', style: 'destructive', onPress: async () => {
                    haptic.warning();
                    const res = await deleteOwnAccount();
                    if (!res.success) Alert.alert('Error', res.reason || 'No se pudo eliminar la cuenta.');
                },
            },
        ]);
    };

    return (
        <View style={styles.container}>
            <ScreenHeader title="Mi Perfil" subtitle={user.companyName || ROLE_LABELS[user.role]} icon="user" />
            <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>

                {/* Avatar */}
                <View style={styles.avatarSection}>
                    <TouchableOpacity activeOpacity={0.85} onPress={changePhoto} style={styles.avatarWrap}>
                        {user.avatarUrl ? (
                            <Image source={{ uri: user.avatarUrl }} style={styles.avatarImg} />
                        ) : (
                            <View style={styles.avatarFallback}><Text style={styles.avatarInitials}>{initials}</Text></View>
                        )}
                        <View style={styles.cameraBadge}>
                            {uploadingPhoto ? <ActivityIndicator size="small" color={COLORS.white} /> : <Icon name="camera" size={16} color={COLORS.white} />}
                        </View>
                    </TouchableOpacity>
                    <Text style={styles.name}>{user.nombre}</Text>
                    <View style={styles.rolePill}>
                        <Text style={styles.rolePillText}>{ROLE_LABELS[user.role]}</Text>
                    </View>
                </View>

                {/* Personal info */}
                <Text style={styles.sectionLabel}>DATOS PERSONALES</Text>
                <View style={styles.card}>
                    <Field icon="user" label="Nombre completo" value={nombre} onChangeText={setNombre} placeholder="Tu nombre" />
                    <Field icon="phone" label="Teléfono" value={telefono} onChangeText={setTelefono} placeholder="Tu teléfono" keyboardType="phone-pad" />
                    <Field icon="credit-card" label="Cédula / ID" value={cedula} onChangeText={setCedula} placeholder="Tu identificación" />
                    {/* Email read-only */}
                    <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>Correo (no editable)</Text>
                        <View style={[styles.inputRow, { opacity: 0.6 }]}>
                            <Icon name="mail" size={18} color={COLORS.textMuted} />
                            <Text style={styles.readonlyText}>{user.email}</Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={[styles.primaryBtn, (!infoDirty || savingInfo) && styles.btnDisabled]}
                        onPress={saveInfo}
                        disabled={!infoDirty || savingInfo}
                    >
                        {savingInfo ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.primaryBtnText}>Guardar cambios</Text>}
                    </TouchableOpacity>
                </View>

                {/* Security */}
                <Text style={styles.sectionLabel}>SEGURIDAD</Text>
                <View style={styles.card}>
                    <Field icon="lock" label="Contraseña actual" value={currentPass} onChangeText={setCurrentPass} placeholder="••••••••" secureTextEntry />
                    <Field icon="key" label="Nueva contraseña" value={newPass} onChangeText={setNewPass} placeholder="Mínimo 6 caracteres" secureTextEntry />
                    <Field icon="key" label="Confirmar nueva contraseña" value={confirmPass} onChangeText={setConfirmPass} placeholder="Repite la contraseña" secureTextEntry />
                    <TouchableOpacity
                        style={[styles.primaryBtn, changingPass && styles.btnDisabled]}
                        onPress={submitPassword}
                        disabled={changingPass}
                    >
                        {changingPass ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.primaryBtnText}>Cambiar contraseña</Text>}
                    </TouchableOpacity>
                </View>

                {/* Account info */}
                <Text style={styles.sectionLabel}>CUENTA</Text>
                <View style={styles.card}>
                    <InfoRow icon="briefcase" label="Empresa" value={user.companyName || '—'} />
                    <InfoRow icon="award" label="Plan" value={PLAN_LABELS[user.plan] || user.plan} />
                    <InfoRow icon="shield" label="Rol" value={ROLE_LABELS[user.role]} />
                    <InfoRow icon="calendar" label="Miembro desde" value={user.fechaRegistro} last />
                </View>

                {/* Danger zone */}
                <TouchableOpacity style={styles.logoutBtn} onPress={confirmLogout}>
                    <Icon name="log-out" size={18} color={COLORS.textPrimary} />
                    <Text style={styles.logoutText}>Cerrar sesión</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={confirmDelete}>
                    <Icon name="trash-2" size={18} color={COLORS.danger} />
                    <Text style={styles.deleteText}>Eliminar mi cuenta</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}

function Field({ icon, label, ...inputProps }: any) {
    return (
        <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <View style={styles.inputRow}>
                <Icon name={icon} size={18} color={COLORS.textMuted} />
                <TextInput style={styles.input} placeholderTextColor={COLORS.textMuted} {...inputProps} />
            </View>
        </View>
    );
}

function InfoRow({ icon, label, value, last }: any) {
    return (
        <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
            <Icon name={icon} size={18} color={COLORS.primaryLight} />
            <Text style={styles.infoLabel}>{label}</Text>
            <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },

    avatarSection: { alignItems: 'center', marginBottom: SPACING.lg },
    avatarWrap: { width: 104, height: 104, marginBottom: SPACING.md },
    avatarImg: { width: 104, height: 104, borderRadius: 52, borderWidth: 3, borderColor: COLORS.primaryLight },
    avatarFallback: { width: 104, height: 104, borderRadius: 52, backgroundColor: COLORS.surfaceLight, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: COLORS.primaryLight },
    avatarInitials: { color: COLORS.white, fontSize: FONTS.sizes.xxxl, fontWeight: '800' },
    cameraBadge: {
        position: 'absolute', bottom: 0, right: 0,
        width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.primary,
        alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: COLORS.background,
    },
    name: { color: COLORS.white, fontSize: FONTS.sizes.xl, fontWeight: '800' },
    rolePill: { marginTop: 6, backgroundColor: COLORS.primary + '22', paddingHorizontal: 12, paddingVertical: 4, borderRadius: RADIUS.round },
    rolePillText: { color: COLORS.primaryLight, fontSize: FONTS.sizes.xs, fontWeight: '700' },

    sectionLabel: { color: COLORS.textMuted, fontSize: FONTS.sizes.xs, fontWeight: '700', letterSpacing: 1.2, marginBottom: SPACING.sm, marginTop: SPACING.md },

    card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm },

    fieldGroup: { marginBottom: SPACING.md },
    fieldLabel: { color: COLORS.textSecondary, fontSize: FONTS.sizes.xs, marginBottom: 6, fontWeight: '600' },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.surfaceLight, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
    input: { flex: 1, color: COLORS.textPrimary, fontSize: FONTS.sizes.md, paddingVertical: SPACING.md },
    readonlyText: { flex: 1, color: COLORS.textSecondary, fontSize: FONTS.sizes.md, paddingVertical: SPACING.md },

    primaryBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: SPACING.md, alignItems: 'center', marginTop: 4, ...SHADOWS.sm },
    primaryBtnText: { color: COLORS.white, fontWeight: '700', fontSize: FONTS.sizes.md },
    btnDisabled: { opacity: 0.5 },

    infoRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.md },
    infoRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
    infoLabel: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm },
    infoValue: { flex: 1, textAlign: 'right', color: COLORS.white, fontSize: FONTS.sizes.sm, fontWeight: '600' },

    logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: COLORS.surfaceLight, borderRadius: RADIUS.md, paddingVertical: SPACING.md, marginTop: SPACING.lg, borderWidth: 1, borderColor: COLORS.border },
    logoutText: { color: COLORS.textPrimary, fontWeight: '700', fontSize: FONTS.sizes.md },
    deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, paddingVertical: SPACING.md, marginTop: SPACING.sm },
    deleteText: { color: COLORS.danger, fontWeight: '700', fontSize: FONTS.sizes.sm },
});

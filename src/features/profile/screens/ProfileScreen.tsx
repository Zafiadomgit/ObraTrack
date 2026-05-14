import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, Switch, Alert, Image, ActivityIndicator,
    Animated, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { auth } from '../../../config/firebase';
import { useAppStore } from '../../../store/appStore';
import { FONTS, SPACING, RADIUS, SHADOWS } from '../../../core/theme';
import Icon from '@expo/vector-icons/Feather';
import { resetWelcomeGuide } from '../../../components/WelcomeGuide';
import { useNavigation } from '@react-navigation/native';
import { useLangStore, useT } from '../../../core/i18n';
import { useColors, ThemeColors } from '../../../core/theme/ThemeContext';
import { useThemeStore } from '../../../core/theme/themeStore';

const AVATAR_KEY = (id: string) => `obratrack_avatar_${id}`;

const ROLE_LABELS: Record<string, string> = {
    admin: 'Administrador',
    coordinador: 'Coordinador',
    lider: 'Líder de Obra',
    logistica: 'Logística',
    conductor: 'Conductor',
};

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
    free:       { label: 'Gratuito',    color: '#94A3B8' },
    premium:    { label: 'Premium',     color: '#F59E0B' },
    enterprise: { label: 'Enterprise',  color: '#6366F1' },
};

export default function ProfileScreen() {
    const insets = useSafeAreaInsets();
    const navigation = useNavigation<any>();
    const { user, updateUser, logout } = useAppStore();
    const C = useColors();
    const styles = React.useMemo(() => makeStyles(C), [C]);
    const t = useT();

    // ── Editable fields ──────────────────────────────────────────────
    const [nombre, setNombre] = useState(user?.nombre ?? '');
    const [telefono, setTelefono] = useState(user?.telefono ?? '');
    const [avatarUri, setAvatarUri] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [infoChanged, setInfoChanged] = useState(false);

    // ── Password change ──────────────────────────────────────────────
    const [pwModalVisible, setPwModalVisible] = useState(false);
    const [currentPw, setCurrentPw] = useState('');
    const [newPw, setNewPw] = useState('');
    const [confirmPw, setConfirmPw] = useState('');
    const [pwLoading, setPwLoading] = useState(false);
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    // ── Preferences ──────────────────────────────────────────────────
    const { language: lang, setLanguage } = useLangStore();
    const { isDark: darkMode, toggle: toggleTheme } = useThemeStore();
    const [notifs, setNotifs] = useState(true);

    // ── Feedback flash ───────────────────────────────────────────────
    const flashAnim = useRef(new Animated.Value(0)).current;
    const [flashMsg, setFlashMsg] = useState('');

    const showFlash = (msg: string) => {
        setFlashMsg(msg);
        flashAnim.setValue(1);
        Animated.timing(flashAnim, { toValue: 0, duration: 2200, useNativeDriver: true }).start();
    };

    // ── Load persisted data ──────────────────────────────────────────
    useEffect(() => {
        if (!user) return;
        AsyncStorage.getItem(AVATAR_KEY(user.id)).then(uri => {
            if (uri) setAvatarUri(uri);
        });
    }, []);

    // ── Track info changes ───────────────────────────────────────────
    useEffect(() => {
        setInfoChanged(nombre !== (user?.nombre ?? '') || telefono !== (user?.telefono ?? ''));
    }, [nombre, telefono]);

    // ── Pick avatar ──────────────────────────────────────────────────
    const pickAvatar = async () => {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
            Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para cambiar la foto.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
        });
        if (!result.canceled && result.assets[0]) {
            const uri = result.assets[0].uri;
            setAvatarUri(uri);
            if (user) await AsyncStorage.setItem(AVATAR_KEY(user.id), uri);
            showFlash('✅ Foto actualizada');
        }
    };

    const removeAvatar = async () => {
        setAvatarUri(null);
        if (user) await AsyncStorage.removeItem(AVATAR_KEY(user.id));
        showFlash('🗑 Foto eliminada');
    };

    // ── Save name / phone ────────────────────────────────────────────
    const saveInfo = async () => {
        if (!user || !nombre.trim()) return;
        setIsSaving(true);
        try {
            await updateUser(user.id, {
                nombre: nombre.trim(),
                ...(telefono.trim() ? { telefono: telefono.trim() } : {}),
            });
            setInfoChanged(false);
            showFlash('✅ Perfil actualizado');
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setIsSaving(false);
        }
    };

    // ── Change password ──────────────────────────────────────────────
    const handleChangePassword = async () => {
        if (!newPw || !confirmPw || !currentPw) {
            Alert.alert('Campos requeridos', 'Completa todos los campos.');
            return;
        }
        if (newPw.length < 6) {
            Alert.alert('Contraseña corta', 'Mínimo 6 caracteres.');
            return;
        }
        if (newPw !== confirmPw) {
            Alert.alert('No coinciden', 'La nueva contraseña y la confirmación no coinciden.');
            return;
        }
        const firebaseUser = auth.currentUser;
        if (!firebaseUser || !firebaseUser.email) return;
        setPwLoading(true);
        try {
            const cred = EmailAuthProvider.credential(firebaseUser.email, currentPw);
            await reauthenticateWithCredential(firebaseUser, cred);
            await updatePassword(firebaseUser, newPw);
            setPwModalVisible(false);
            setCurrentPw(''); setNewPw(''); setConfirmPw('');
            showFlash('✅ Contraseña actualizada');
        } catch (e: any) {
            if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
                Alert.alert('Contraseña incorrecta', 'La contraseña actual no es correcta.');
            } else {
                Alert.alert('Error', e.message);
            }
        } finally {
            setPwLoading(false);
        }
    };

    // ── Language ─────────────────────────────────────────────────────
    const toggleLang = async () => {
        const next = lang === 'es' ? 'en' : 'es';
        await setLanguage(next);
        showFlash(next === 'es' ? '🌐 Idioma: Español' : '🌐 Language: English');
    };

    // ── Dark mode ────────────────────────────────────────────────────
    const toggleDarkMode = async () => {
        await toggleTheme();
        showFlash(!darkMode ? '🌙 Modo oscuro activado' : '☀️ Modo claro activado');
    };

    // ── Reset guide ──────────────────────────────────────────────────
    const handleResetGuide = async () => {
        if (!user) return;
        await resetWelcomeGuide(user.id);
        showFlash('📖 Guía restablecida — se mostrará al volver al inicio');
    };

    const initials = (user?.nombre ?? 'U').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
    const planInfo = PLAN_LABELS[user?.plan ?? 'free'];

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>

            {/* ── Toast flash ── */}
            <Animated.View
                style={[styles.toast, { opacity: flashAnim, transform: [{ translateY: flashAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }] }]}
                pointerEvents="none"
            >
                <Text style={styles.toastText}>{flashMsg}</Text>
            </Animated.View>

            {/* ── Header ── */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Icon name="arrow-left" size={20} color={C.white} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Mi Perfil</Text>
                {infoChanged ? (
                    <TouchableOpacity style={styles.saveBtn} onPress={saveInfo} disabled={isSaving}>
                        {isSaving
                            ? <ActivityIndicator size="small" color={C.white} />
                            : <Text style={styles.saveBtnText}>{t.save}</Text>}
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 70 }} />
                )}
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
                keyboardShouldPersistTaps="handled"
            >
                {/* ── Avatar hero ── */}
                <View style={styles.avatarSection}>
                    <TouchableOpacity style={styles.avatarWrap} onPress={pickAvatar} activeOpacity={0.85}>
                        {avatarUri ? (
                            <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
                        ) : (
                            <View style={styles.avatarFallback}>
                                <Text style={styles.avatarInitials}>{initials}</Text>
                            </View>
                        )}
                        <View style={styles.avatarEditBadge}>
                            <Icon name="camera" size={14} color={C.white} />
                        </View>
                    </TouchableOpacity>

                    {avatarUri && (
                        <TouchableOpacity style={styles.removePhotoBtn} onPress={removeAvatar}>
                            <Icon name="trash-2" size={13} color={C.danger} />
                            <Text style={styles.removePhotoText}>Quitar foto</Text>
                        </TouchableOpacity>
                    )}

                    <Text style={styles.heroName}>{user?.nombre}</Text>
                    <View style={styles.badgesRow}>
                        <View style={styles.roleBadge}>
                            <Text style={styles.roleBadgeText}>{ROLE_LABELS[user?.role ?? ''] ?? user?.role}</Text>
                        </View>
                        <View style={[styles.planBadge, { borderColor: planInfo.color + '80', backgroundColor: planInfo.color + '18' }]}>
                            <Icon name="star" size={10} color={planInfo.color} style={{ marginRight: 4 }} />
                            <Text style={[styles.planBadgeText, { color: planInfo.color }]}>{planInfo.label}</Text>
                        </View>
                    </View>
                </View>

                {/* ── Info section ── */}
                <SectionCard title="Información Personal" icon="user">
                    <FieldRow label="Nombre completo" icon="edit-2">
                        <TextInput
                            style={styles.fieldInput}
                            value={nombre}
                            onChangeText={setNombre}
                            placeholder="Tu nombre"
                            placeholderTextColor={C.textMuted}
                        />
                    </FieldRow>
                    <Divider />
                    <FieldRow label="Teléfono" icon="phone">
                        <TextInput
                            style={styles.fieldInput}
                            value={telefono}
                            onChangeText={setTelefono}
                            placeholder="Sin teléfono"
                            placeholderTextColor={C.textMuted}
                            keyboardType="phone-pad"
                        />
                    </FieldRow>
                    <Divider />
                    <FieldRow label="Correo electrónico" icon="mail">
                        <Text style={[styles.fieldValue, { color: C.textMuted }]}>{user?.email}</Text>
                    </FieldRow>
                    <Divider />
                    <FieldRow label="Cédula / ID" icon="credit-card">
                        <Text style={styles.fieldValue}>{user?.cedula ?? '—'}</Text>
                    </FieldRow>
                    <Divider />
                    <FieldRow label="Empresa" icon="briefcase">
                        <Text style={styles.fieldValue}>{user?.companyName ?? user?.companyId ?? '—'}</Text>
                    </FieldRow>
                </SectionCard>

                {/* ── Security section ── */}
                <SectionCard title="Seguridad" icon="lock">
                    <TouchableOpacity style={styles.actionRow} onPress={() => setPwModalVisible(true)}>
                        <View style={[styles.actionIconBox, { backgroundColor: '#EF444420' }]}>
                            <Icon name="key" size={16} color="#EF4444" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.actionLabel}>Cambiar contraseña</Text>
                            <Text style={styles.actionSub}>Actualiza tu contraseña de acceso</Text>
                        </View>
                        <Icon name="chevron-right" size={16} color={C.textMuted} />
                    </TouchableOpacity>
                </SectionCard>

                {/* ── Preferences section ── */}
                <SectionCard title="Preferencias" icon="settings">
                    {/* Language */}
                    <View style={styles.prefRow}>
                        <View style={[styles.actionIconBox, { backgroundColor: '#3B82F620' }]}>
                            <Icon name="globe" size={16} color="#3B82F6" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.actionLabel}>{t.language}</Text>
                            <Text style={styles.actionSub}>{lang === 'es' ? t.languageEs : t.languageEn}</Text>
                        </View>
                        <TouchableOpacity style={styles.langToggle} onPress={toggleLang}>
                            <Text style={[styles.langOption, lang === 'es' && styles.langOptionActive]}>ES</Text>
                            <Text style={[styles.langOption, lang === 'en' && styles.langOptionActive]}>EN</Text>
                        </TouchableOpacity>
                    </View>

                    <Divider />

                    {/* Dark mode */}
                    <View style={styles.prefRow}>
                        <View style={[styles.actionIconBox, { backgroundColor: '#F59E0B20' }]}>
                            <Icon name={darkMode ? 'moon' : 'sun'} size={16} color="#F59E0B" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.actionLabel}>Modo oscuro</Text>
                            <Text style={styles.actionSub}>{darkMode ? 'Activado' : 'Desactivado'}</Text>
                        </View>
                        <Switch
                            value={darkMode}
                            onValueChange={toggleDarkMode}
                            trackColor={{ false: C.border, true: C.primary + '80' }}
                            thumbColor={darkMode ? C.primary : C.textMuted}
                        />
                    </View>

                    <Divider />

                    {/* Notifications */}
                    <View style={styles.prefRow}>
                        <View style={[styles.actionIconBox, { backgroundColor: '#10B98120' }]}>
                            <Icon name="bell" size={16} color="#10B981" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.actionLabel}>Notificaciones</Text>
                            <Text style={styles.actionSub}>{notifs ? 'Activadas' : 'Desactivadas'}</Text>
                        </View>
                        <Switch
                            value={notifs}
                            onValueChange={setNotifs}
                            trackColor={{ false: C.border, true: C.primary + '80' }}
                            thumbColor={notifs ? C.primary : C.textMuted}
                        />
                    </View>
                </SectionCard>

                {/* ── App section ── */}
                <SectionCard title="Aplicación" icon="info">
                    <TouchableOpacity style={styles.actionRow} onPress={handleResetGuide}>
                        <View style={[styles.actionIconBox, { backgroundColor: '#8B5CF620' }]}>
                            <Icon name="book-open" size={16} color="#8B5CF6" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.actionLabel}>Ver guía de bienvenida</Text>
                            <Text style={styles.actionSub}>Repasa cómo funciona ObraTrack</Text>
                        </View>
                        <Icon name="chevron-right" size={16} color={C.textMuted} />
                    </TouchableOpacity>
                    <Divider />
                    <View style={styles.prefRow}>
                        <View style={[styles.actionIconBox, { backgroundColor: C.surfaceLight }]}>
                            <Icon name="code" size={16} color={C.textMuted} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.actionLabel}>Versión</Text>
                            <Text style={styles.actionSub}>ObraTrack v1.0.0</Text>
                        </View>
                    </View>
                </SectionCard>

                {/* ── Logout ── */}
                <TouchableOpacity style={styles.logoutRow} onPress={logout}>
                    <Icon name="log-out" size={18} color={C.danger} />
                    <Text style={styles.logoutText}>{t.signOut}</Text>
                </TouchableOpacity>
            </ScrollView>

            {/* ── Password modal ── */}
            <Modal visible={pwModalVisible} transparent animationType="slide">
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <TouchableOpacity
                        style={styles.modalBackdrop}
                        activeOpacity={1}
                        onPress={() => setPwModalVisible(false)}
                    />
                    <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 20 }]}>
                        <View style={styles.modalHandle} />
                        <Text style={styles.modalTitle}>Cambiar Contraseña</Text>
                        <Text style={styles.modalSub}>Ingresa tu contraseña actual y luego la nueva</Text>

                        <PwInput label="Contraseña actual" value={currentPw} onChange={setCurrentPw} show={showCurrent} onToggle={() => setShowCurrent(v => !v)} />
                        <PwInput label="Nueva contraseña" value={newPw} onChange={setNewPw} show={showNew} onToggle={() => setShowNew(v => !v)} />
                        <PwInput label="Confirmar nueva contraseña" value={confirmPw} onChange={setConfirmPw} show={showConfirm} onToggle={() => setShowConfirm(v => !v)} />

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setPwModalVisible(false)}>
                                <Text style={styles.cancelText}>{t.cancel}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.confirmBtn} onPress={handleChangePassword} disabled={pwLoading}>
                                {pwLoading
                                    ? <ActivityIndicator size="small" color={C.white} />
                                    : <Text style={styles.confirmText}>{t.save}</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

// ─── Sub-components (each reads theme via hook) ────────────────────────────────

function SectionCard({ title, icon, children }: { title: string; icon: keyof typeof Icon.glyphMap; children: React.ReactNode }) {
    const C = useColors();
    return (
        <View style={{ marginHorizontal: SPACING.md, marginTop: SPACING.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.sm }}>
                <Icon name={icon} size={14} color={C.primary} />
                <Text style={{ color: C.textMuted, fontSize: FONTS.sizes.xs, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.8 }}>{title}</Text>
            </View>
            <View style={{ backgroundColor: C.surface, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderWidth: 1, borderColor: C.border, ...SHADOWS.sm }}>
                {children}
            </View>
        </View>
    );
}

function FieldRow({ label, icon, children }: { label: string; icon: keyof typeof Icon.glyphMap; children: React.ReactNode }) {
    const C = useColors();
    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.md }}>
            <Icon name={icon} size={15} color={C.textMuted} style={{ marginRight: SPACING.sm }} />
            <View style={{ flex: 1 }}>
                <Text style={{ color: C.textMuted, fontSize: FONTS.sizes.xs, marginBottom: 2 }}>{label}</Text>
                {children}
            </View>
        </View>
    );
}

function Divider() {
    const C = useColors();
    return <View style={{ height: 1, backgroundColor: C.border, marginVertical: 2, marginHorizontal: -SPACING.md }} />;
}

function PwInput({ label, value, onChange, show, onToggle }: {
    label: string; value: string; onChange: (v: string) => void;
    show: boolean; onToggle: () => void;
}) {
    const C = useColors();
    return (
        <View style={{ marginBottom: SPACING.md }}>
            <Text style={{ color: C.textSecondary, fontSize: FONTS.sizes.sm, marginBottom: 6 }}>{label}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.surfaceLight, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.border }}>
                <TextInput
                    style={{ flex: 1, color: C.white, padding: SPACING.md, fontSize: FONTS.sizes.md }}
                    value={value}
                    onChangeText={onChange}
                    secureTextEntry={!show}
                    placeholder="••••••••"
                    placeholderTextColor={C.textMuted}
                    autoCapitalize="none"
                />
                <TouchableOpacity onPress={onToggle} style={{ padding: SPACING.md }}>
                    <Icon name={show ? 'eye-off' : 'eye'} size={18} color={C.textMuted} />
                </TouchableOpacity>
            </View>
        </View>
    );
}

// ─── Dynamic styles (function of current theme colors) ────────────────────────

const makeStyles = (C: ThemeColors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },

    toast: {
        position: 'absolute', top: 60, alignSelf: 'center', zIndex: 999,
        backgroundColor: C.surface, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
        borderRadius: RADIUS.round, borderWidth: 1, borderColor: C.border, ...SHADOWS.md,
    },
    toastText: { color: C.white, fontSize: FONTS.sizes.sm, fontWeight: '600' },

    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
        backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
    },
    backBtn: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: C.surfaceLight, alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { color: C.white, fontSize: FONTS.sizes.lg, fontWeight: 'bold' },
    saveBtn: {
        backgroundColor: C.primary, paddingHorizontal: SPACING.md,
        paddingVertical: 8, borderRadius: RADIUS.md, minWidth: 70, alignItems: 'center',
    },
    saveBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: FONTS.sizes.sm },

    avatarSection: {
        alignItems: 'center', paddingVertical: SPACING.xl,
        backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
    },
    avatarWrap: { position: 'relative', marginBottom: SPACING.sm },
    avatarImg: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: C.primary },
    avatarFallback: {
        width: 100, height: 100, borderRadius: 50,
        backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center',
        borderWidth: 3, borderColor: C.primary + '60',
    },
    avatarInitials: { color: '#FFFFFF', fontSize: 36, fontWeight: 'bold' },
    avatarEditBadge: {
        position: 'absolute', bottom: 2, right: 2,
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center',
        borderWidth: 2, borderColor: C.surface,
    },
    removePhotoBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: SPACING.sm },
    removePhotoText: { color: C.danger, fontSize: FONTS.sizes.xs },
    heroName: { color: C.white, fontSize: FONTS.sizes.xl, fontWeight: 'bold', marginBottom: SPACING.sm },
    badgesRow: { flexDirection: 'row', gap: SPACING.sm },
    roleBadge: {
        backgroundColor: C.surfaceLight, paddingHorizontal: 10, paddingVertical: 4,
        borderRadius: RADIUS.round, borderWidth: 1, borderColor: C.border,
    },
    roleBadgeText: { color: C.textSecondary, fontSize: FONTS.sizes.xs, fontWeight: '600' },
    planBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.round, borderWidth: 1 },
    planBadgeText: { fontSize: FONTS.sizes.xs, fontWeight: 'bold' },

    fieldInput: { color: C.white, fontSize: FONTS.sizes.md, paddingVertical: 2 },
    fieldValue: { color: C.white, fontSize: FONTS.sizes.md },

    actionRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.sm },
    actionIconBox: { width: 34, height: 34, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
    actionLabel: { color: C.white, fontSize: FONTS.sizes.md, fontWeight: '600' },
    actionSub: { color: C.textMuted, fontSize: FONTS.sizes.xs, marginTop: 1 },

    prefRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.sm },

    langToggle: { flexDirection: 'row', borderRadius: RADIUS.md, overflow: 'hidden', borderWidth: 1, borderColor: C.border },
    langOption: { paddingHorizontal: 10, paddingVertical: 4, color: C.textMuted, fontSize: 12, fontWeight: 'bold', backgroundColor: C.surfaceLight },
    langOptionActive: { color: '#FFFFFF', backgroundColor: C.primary },

    logoutRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: SPACING.sm, marginHorizontal: SPACING.lg, marginTop: SPACING.md,
        marginBottom: SPACING.lg, paddingVertical: SPACING.md,
        borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.danger + '50',
    },
    logoutText: { color: C.danger, fontSize: FONTS.sizes.md, fontWeight: 'bold' },

    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
    modalSheet: {
        backgroundColor: C.surface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
        padding: SPACING.xl, ...SHADOWS.lg,
    },
    modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: SPACING.lg },
    modalTitle: { color: C.white, fontSize: FONTS.sizes.xl, fontWeight: 'bold', marginBottom: 4 },
    modalSub: { color: C.textMuted, fontSize: FONTS.sizes.sm, marginBottom: SPACING.lg },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.sm, marginTop: SPACING.sm },
    cancelBtn: { padding: SPACING.md },
    cancelText: { color: C.textSecondary, fontWeight: 'bold' },
    confirmBtn: { backgroundColor: C.primary, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderRadius: RADIUS.md, minWidth: 100, alignItems: 'center' },
    confirmText: { color: '#FFFFFF', fontWeight: 'bold' },
});

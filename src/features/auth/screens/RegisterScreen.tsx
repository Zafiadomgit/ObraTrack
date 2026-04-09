import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ScrollView, Image, Dimensions } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAppStore, UserRole } from '../../../store/appStore';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../../core/theme';
import Icon from '@expo/vector-icons/Feather';
import { analytics } from '../../../core/services/analyticsService';

export default function RegisterScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const registerUser = useAppStore(state => state.registerUser);
    const registerCompany = useAppStore(state => state.registerCompany);

    const [mode, setMode] = useState<'create_company' | 'join_company'>('create_company');
    const [companyName, setCompanyName] = useState('');
    const [companyCode, setCompanyCode] = useState('');

    const [nombre, setNombre] = useState('');
    const [cedula, setCedula] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [selectedRole, setSelectedRole] = useState<UserRole>('lider');

    const showAlert = (title: string, message: string, buttons?: any[]) => {
        if (Platform.OS === 'web') {
            window.alert(`${title}\n\n${message}`);
            if (buttons && buttons.length > 0) {
                // Execute the first button's onPress if it exists, roughly simulating 'OK'
                buttons[0]?.onPress?.();
            }
        } else {
            Alert.alert(title, message, buttons);
        }
    };

    const handleRegister = async () => {
        if (!nombre || !email || !password || !confirmPassword || !cedula) {
            showAlert('Campos Incompletos', 'Por favor, llena todos los campos, incluyendo tu cédula.');
            return;
        }
        if (password !== confirmPassword) {
            showAlert('Error', 'Las contraseñas no coinciden.');
            return;
        }
        if (password.length < 6) {
            showAlert('Error', 'La contraseña debe tener al menos 6 caracteres.');
            return;
        }

        if (mode === 'create_company') {
            if (!companyName) {
                showAlert('Falta Empresa', 'Ingresa el nombre de tu empresa para crear la cuenta.');
                return;
            }
            const selectedPlan = route.params?.selectedPlan || 'free';
            const result = await registerCompany(nombre, email, password, cedula, companyName, selectedPlan);
            if (result.success) {
                analytics.trackSignUp('admin');
                showAlert('Empresa Creada', '¡Bienvenido! Tu cuenta de administrador ha sido creada exitosamente.');
                // Note: The appStore auto-logs in the user and auth state will change handling navigation automatically
            } else {
                showAlert('Error', result.reason || 'Hubo un problema al crear la cuenta.');
            }
        } else {
            if (!companyCode) {
                showAlert('Falta Código', 'Ingresa el código que te proporcionó el administrador.');
                return;
            }
            const result = await registerUser(nombre, email, password, cedula, selectedRole, false, '', companyCode);
            if (result.success) {
                analytics.trackSignUp(selectedRole);
                showAlert(
                    'Solicitud Enviada',
                    `Tu solicitud como ${selectedRole} ha sido enviada. El administrador debe aprobarte antes de que puedas iniciar sesión.`,
                    [{ text: 'Entendido', onPress: () => {
                        if (navigation.canGoBack()) {
                            navigation.goBack();
                        } else {
                            const isWebLarge = Platform.OS === 'web' && Dimensions.get('window').width > 768;
                            navigation.navigate(isWebLarge ? 'WebLanding' : 'Login' as never);
                        }
                    }}]
                );
            } else {
                showAlert('Error', result.reason || 'Este correo ya está registrado.');
            }
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.headerContainer}>
                    <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Login' as never)} style={styles.backBtn}>
                        <Icon name="arrow-left" size={24} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                    <Image source={require('../../../../assets/logo-main.png')} style={{ width: 72, height: 72, resizeMode: 'contain', alignSelf: 'center', marginBottom: 8 }} />
                    <Text style={styles.title}>Crear Cuenta</Text>
                    <Text style={styles.subtitle}>Únete a ObraTrack y controla tus proyectos.</Text>
                </View>

                <View style={styles.modeTabs}>
                    <TouchableOpacity 
                        style={[styles.modeTab, mode === 'create_company' && styles.modeTabActive]} 
                        onPress={() => setMode('create_company')}
                    >
                        <Text style={[styles.modeTabText, mode === 'create_company' && styles.modeTabTextActive]}>Crear Empresa</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.modeTab, mode === 'join_company' && styles.modeTabActive]} 
                        onPress={() => setMode('join_company')}
                    >
                        <Text style={[styles.modeTabText, mode === 'join_company' && styles.modeTabTextActive]}>Unirme a Empresa</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.formContainer}>
                    {mode === 'create_company' ? (
                        <View style={styles.inputGroup}>
                            <Icon name="briefcase" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Nombre de la Empresa"
                                placeholderTextColor={COLORS.textMuted}
                                value={companyName}
                                onChangeText={setCompanyName}
                            />
                        </View>
                    ) : (
                        <View style={styles.inputGroup}>
                            <Icon name="key" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Código de la Empresa (ej. EMP-123U)"
                                placeholderTextColor={COLORS.textMuted}
                                value={companyCode}
                                onChangeText={setCompanyCode}
                                autoCapitalize="characters"
                            />
                        </View>
                    )}

                    <View style={styles.inputGroup}>
                        <Icon name="user" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Tu Nombre Completo"
                            placeholderTextColor={COLORS.textMuted}
                            value={nombre}
                            onChangeText={setNombre}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Icon name="credit-card" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Cédula"
                            placeholderTextColor={COLORS.textMuted}
                            value={cedula}
                            onChangeText={setCedula}
                            keyboardType="numeric"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Icon name="mail" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Correo electrónico"
                            placeholderTextColor={COLORS.textMuted}
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Icon name="lock" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Contraseña"
                            placeholderTextColor={COLORS.textMuted}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPassword}
                        />
                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
                            <Icon name={showPassword ? "eye-off" : "eye"} size={20} color={COLORS.textMuted} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.inputGroup}>
                        <Icon name="check-circle" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Confirmar Contraseña"
                            placeholderTextColor={COLORS.textMuted}
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry={!showConfirmPassword}
                        />
                        <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={{ padding: 4 }}>
                            <Icon name={showConfirmPassword ? "eye-off" : "eye"} size={20} color={COLORS.textMuted} />
                        </TouchableOpacity>
                    </View>

                    {mode === 'join_company' && (
                        <>
                            <Text style={styles.label}>Rol de Acceso Solicitado:</Text>
                            <View style={styles.roleContainer}>
                        {(['coordinador', 'lider', 'logistica', 'conductor'] as UserRole[]).map(r => (
                            <TouchableOpacity
                                key={r}
                                style={[styles.roleChip, selectedRole === r && styles.roleChipActive]}
                                onPress={() => setSelectedRole(r)}
                            >
                                <Text style={[styles.roleText, selectedRole === r && styles.roleTextActive]}>{r.toUpperCase()}</Text>
                            </TouchableOpacity>
                        ))}
                            </View>
                        </>
                    )}

                </View>

                <TouchableOpacity style={styles.registerBtn} onPress={handleRegister}>
                    <Text style={styles.registerText}>Registrarme</Text>
                </TouchableOpacity>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>¿Ya tienes cuenta? </Text>
                    <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Login' as never)}>
                        <Text style={styles.footerLink}>Ingresa aquí</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    content: { flexGrow: 1, padding: SPACING.xl, justifyContent: 'center', maxWidth: 450, width: '100%', alignSelf: 'center' },

    headerContainer: { marginBottom: SPACING.xl },
    backBtn: { marginBottom: SPACING.md, width: 40, height: 40, justifyContent: 'center' },
    title: { fontSize: 28, fontWeight: '900', color: COLORS.white, marginBottom: SPACING.xs },
    subtitle: { color: COLORS.textSecondary, fontSize: FONTS.sizes.md },

    modeTabs: { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: RADIUS.md, marginBottom: SPACING.xl, padding: 4 },
    modeTab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: RADIUS.sm },
    modeTabActive: { backgroundColor: COLORS.primary },
    modeTabText: { color: COLORS.textMuted, fontWeight: 'bold', fontSize: 13 },
    modeTabTextActive: { color: COLORS.white },

    formContainer: { width: '100%', marginBottom: SPACING.xl },
    inputGroup: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
        borderRadius: RADIUS.md, marginBottom: SPACING.md, paddingHorizontal: SPACING.md,
        borderWidth: 1, borderColor: COLORS.border, height: 56,
    },
    inputIcon: { marginRight: SPACING.sm },
    input: { flex: 1, color: COLORS.white, fontSize: FONTS.sizes.md, height: '100%' },

    registerBtn: {
        backgroundColor: COLORS.primary, height: 56, borderRadius: RADIUS.md,
        alignItems: 'center', justifyContent: 'center', marginTop: SPACING.xl, ...SHADOWS.md,
    },
    registerText: { color: COLORS.white, fontWeight: 'bold', fontSize: FONTS.sizes.md },

    footer: { flexDirection: 'row', justifyContent: 'center', marginTop: SPACING.xl },
    footerText: { color: COLORS.textMuted, fontSize: FONTS.sizes.md },
    footerLink: { color: COLORS.primary, fontSize: FONTS.sizes.md, fontWeight: 'bold' },

    label: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm, marginBottom: SPACING.sm, fontWeight: 'bold' },
    roleContainer: { flexDirection: 'row', gap: SPACING.xs, flexWrap: 'wrap' },
    roleChip: { paddingHorizontal: 12, paddingVertical: 10, backgroundColor: COLORS.surfaceLight, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border },
    roleChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    roleText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: 'bold' },
    roleTextActive: { color: COLORS.white },
});

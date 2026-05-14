import React, { useState, useEffect } from 'react';
import {
    View, Text, TextInput, StyleSheet, TouchableOpacity,
    KeyboardAvoidingView, Platform, Image, ActivityIndicator,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { analytics } from '../../../core/services/analyticsService';
import { useAppStore } from '../../../store/appStore';
import { FONTS, SPACING, RADIUS, SHADOWS } from '../../../core/theme';
import { useColors, ThemeColors } from '../../../core/theme/ThemeContext';
import Icon from '@expo/vector-icons/Feather';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useT } from '../../../core/i18n';

const CRED_EMAIL_KEY = 'obratrack_saved_email';
const CRED_PASS_KEY  = 'obratrack_saved_pass';

export default function LoginScreen() {
    const navigation = useNavigation();
    const login = useAppStore(state => state.login);
    const C = useColors();
    const t = useT();
    const styles = React.useMemo(() => makeStyles(C), [C]);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    // Biometric / saved-credentials state
    const [savedEmail, setSavedEmail] = useState<string | null>(null);
    const [savedPass, setSavedPass]   = useState<string | null>(null);
    const [biometricAvailable, setBiometricAvailable] = useState(false);

    // ── On mount: load saved credentials + check biometric hardware ─────────
    useEffect(() => {
        (async () => {
            try {
                const [storedEmail, storedPass] = await Promise.all([
                    SecureStore.getItemAsync(CRED_EMAIL_KEY),
                    SecureStore.getItemAsync(CRED_PASS_KEY),
                ]);

                if (storedEmail && storedPass) {
                    setSavedEmail(storedEmail);
                    setSavedPass(storedPass);
                    // Pre-fill fields so the user can tap "Ingresar" directly
                    setEmail(storedEmail);
                    setPassword(storedPass);
                }

                const hasHardware = await LocalAuthentication.hasHardwareAsync();
                const isEnrolled  = await LocalAuthentication.isEnrolledAsync();
                setBiometricAvailable(hasHardware && isEnrolled && !!storedEmail && !!storedPass);
            } catch (e) {
                console.error('Error loading saved credentials:', e);
            }
        })();
    }, []);

    // ── Standard login ───────────────────────────────────────────────────────
    const handleLogin = async () => {
        if (!email.trim() || !password) { alert(t.enterEmailAndPassword); return; }
        setLoading(true);
        try {
            const result = await login(email.trim(), password);
            if (result.success) {
                // Save credentials securely for next time
                await SecureStore.setItemAsync(CRED_EMAIL_KEY, email.trim());
                await SecureStore.setItemAsync(CRED_PASS_KEY, password);
                analytics.trackLogin('email');
            } else {
                alert(result.reason || t.error);
            }
        } finally {
            setLoading(false);
        }
    };

    // ── Biometric login ──────────────────────────────────────────────────────
    const handleBiometricAuth = async () => {
        if (!savedEmail || !savedPass) return;
        try {
            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: t.biometricRequired ?? 'Confirma tu identidad',
                fallbackLabel: t.usePassword ?? 'Usar contraseña',
                cancelLabel: 'Cancelar',
            });
            if (result.success) {
                setLoading(true);
                try {
                    const authResult = await login(savedEmail, savedPass);
                    if (!authResult.success) {
                        alert(authResult.reason || t.biometricError);
                    } else {
                        analytics.trackLogin('biometric');
                    }
                } finally {
                    setLoading(false);
                }
            }
        } catch (error) {
            console.error(error);
            alert(t.biometricError ?? 'Error de autenticación biométrica');
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <View style={styles.content}>
                {/* Logo */}
                <View style={styles.logoContainer}>
                    <Image source={require('../../../../assets/logo-symbol-transparent.png')} style={styles.logoImage} />
                    <Text style={styles.logoText}>OBRA<Text style={styles.logoTextAccent}>TRACK</Text></Text>
                    <Text style={styles.subtitle}>{t.appTagline}</Text>
                </View>

                {/* Form */}
                <View style={styles.formContainer}>
                    <View style={styles.inputGroup}>
                        <Icon name="mail" size={20} color={C.textMuted} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder={t.email}
                            placeholderTextColor={C.textMuted}
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoComplete="email"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Icon name="lock" size={20} color={C.textMuted} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder={t.password}
                            placeholderTextColor={C.textMuted}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPassword}
                            autoComplete="password"
                        />
                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
                            <Icon name={showPassword ? 'eye-off' : 'eye'} size={20} color={C.textMuted} />
                        </TouchableOpacity>
                    </View>

                    {/* Login button */}
                    <TouchableOpacity
                        style={[styles.loginBtn, loading && { opacity: 0.7 }]}
                        onPress={handleLogin}
                        disabled={loading}
                    >
                        {loading
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.loginText}>{t.signIn}</Text>
                        }
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.forgotBtn} onPress={() => (navigation as any).navigate('ForgotPassword')}>
                        <Text style={styles.forgotText}>{t.forgotPassword}</Text>
                    </TouchableOpacity>

                    {/* Biometric button — only when hardware + saved credentials available */}
                    {biometricAvailable && (
                        <TouchableOpacity style={styles.biometricBtn} onPress={handleBiometricAuth} disabled={loading}>
                            <Ionicons name="finger-print" size={26} color={C.primary} />
                            <Text style={styles.biometricText}>{t.biometricSignIn ?? 'Ingresar con Huella / Face ID'}</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>{t.noAccount} </Text>
                    <TouchableOpacity onPress={() => (navigation as any).navigate('Register')}>
                        <Text style={styles.footerLink}>{t.register}</Text>
                    </TouchableOpacity>
                </View>
                <TouchableOpacity style={{ alignItems: 'center', marginTop: SPACING.md }} onPress={() => (navigation as any).navigate('PrivacyPolicy')}>
                    <Text style={{ color: C.textMuted, fontSize: 11 }}>{t.privacyPolicy}</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

function makeStyles(C: ThemeColors) {
    return StyleSheet.create({
        container: { flex: 1, backgroundColor: C.background },
        content: {
            flex: 1, padding: SPACING.xl, justifyContent: 'center',
            maxWidth: 450, width: '100%', alignSelf: 'center',
        },
        logoContainer: { alignItems: 'center', marginBottom: SPACING.xxl * 1.5 },
        logoImage: { width: 120, height: 120, resizeMode: 'contain', marginBottom: SPACING.sm },
        logoText: { fontSize: 32, fontWeight: '900', color: C.white, marginTop: -SPACING.sm, letterSpacing: 1 },
        logoTextAccent: { color: '#4FC3F7' },
        subtitle: { color: C.textSecondary, fontSize: FONTS.sizes.sm, marginTop: 4 },

        formContainer: { width: '100%' },
        inputGroup: {
            flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface,
            borderRadius: RADIUS.md, marginBottom: SPACING.md, paddingHorizontal: SPACING.md,
            borderWidth: 1, borderColor: C.border, height: 56,
        },
        inputIcon: { marginRight: SPACING.sm },
        input: { flex: 1, color: C.white, fontSize: FONTS.sizes.md, height: '100%' },

        loginBtn: {
            backgroundColor: C.primary, height: 56, borderRadius: RADIUS.md,
            alignItems: 'center', justifyContent: 'center', marginTop: SPACING.sm, ...SHADOWS.md,
        },
        loginText: { color: C.white, fontSize: FONTS.sizes.md, fontWeight: 'bold' },

        forgotBtn: { alignItems: 'center', paddingVertical: SPACING.sm },
        forgotText: { color: C.primary, fontSize: FONTS.sizes.sm },

        biometricBtn: {
            flexDirection: 'row', backgroundColor: C.primary + '15', height: 56,
            borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center',
            marginTop: SPACING.md, borderWidth: 1, borderColor: C.primary + '40', gap: SPACING.sm,
        },
        biometricText: { color: C.primary, fontSize: FONTS.sizes.md, fontWeight: 'bold' },

        footer: { flexDirection: 'row', justifyContent: 'center', marginTop: SPACING.xl },
        footerText: { color: C.textSecondary, fontSize: FONTS.sizes.sm },
        footerLink: { color: C.primary, fontSize: FONTS.sizes.sm, fontWeight: 'bold' },
    });
}

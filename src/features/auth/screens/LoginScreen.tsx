import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, Image } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { analytics } from '../../../core/services/analyticsService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppStore } from '../../../store/appStore';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../../core/theme';
import Icon from '@expo/vector-icons/Feather';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

export default function LoginScreen() {
    const navigation = useNavigation();
    const login = useAppStore(state => state.login);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [hasLoggedInBefore, setHasLoggedInBefore] = useState(false);

    useEffect(() => {
        checkBiometricStatus();
    }, []);

    const checkBiometricStatus = async () => {
        try {
            const val = await AsyncStorage.getItem('biometricEnabled');
            if (val === 'true') {
                setHasLoggedInBefore(true);
            }
        } catch (e) {
            console.error('Error checking biometric status', e);
        }
    };

    const handleLogin = async () => {
        if (email && password) {
            const result = await login(email, password);
            if (result.success) {
                await AsyncStorage.setItem('biometricEnabled', 'true');
                analytics.trackLogin('email');
            } else {
                alert(result.reason || 'Error al iniciar sesión');
            }
        } else {
            alert('Ingresa email y contraseña');
        }
    };

    const handleBiometricAuth = async () => {
        try {
            const hasHardware = await LocalAuthentication.hasHardwareAsync();
            const isEnrolled = await LocalAuthentication.isEnrolledAsync();
            if (hasHardware && isEnrolled) {
                const result = await LocalAuthentication.authenticateAsync({
                    promptMessage: 'Autenticación requerida para ingresar a ObraTrack',
                    fallbackLabel: 'Usar contraseña'
                });
                if (result.success) {
                    const authResult = await login('biometric@obratrack.com', 'biometric_token');
                    if (!authResult.success) {
                        alert(authResult.reason || 'Error en autenticación biométrica');
                    }
                }
            } else {
                alert('La autenticación biométrica no está configurada en este dispositivo.');
            }
        } catch (error) {
            console.error(error);
            alert('Error al intentar autenticar.');
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={styles.content}>
                <View style={styles.logoContainer}>
                    <Image source={require('../../../../assets/logo-main.png')} style={styles.logoImage} />
                    <Text style={styles.logoText}>OBRA<Text style={styles.logoTextAccent}>TRACK</Text></Text>
                    <Text style={styles.subtitle}>Gestión de proyectos para ingenieros</Text>
                </View>

                <View style={styles.formContainer}>
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

                    <TouchableOpacity style={styles.loginBtn} onPress={handleLogin}>
                        <Text style={styles.loginText}>Ingresar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.forgotBtn} onPress={() => (navigation as any).navigate('ForgotPassword')}>
                        <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
                    </TouchableOpacity>

                    {hasLoggedInBefore && (
                        <TouchableOpacity style={styles.biometricBtn} onPress={handleBiometricAuth}>
                            <Ionicons name="finger-print" size={24} color={COLORS.primary} />
                            <Text style={styles.biometricText}>Ingresar con Huella / FaceID</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>¿No tienes cuenta? </Text>
                    <TouchableOpacity onPress={() => (navigation as any).navigate('Register')}><Text style={styles.footerLink}>Regístrate</Text></TouchableOpacity>
                </View>
                <TouchableOpacity style={{ alignItems: 'center', marginTop: SPACING.md }} onPress={() => (navigation as any).navigate('PrivacyPolicy')}>
                    <Text style={{ color: COLORS.textMuted, fontSize: 11 }}>Política de Privacidad</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    content: { flex: 1, padding: SPACING.xl, justifyContent: 'center', maxWidth: 450, width: '100%', alignSelf: 'center' },
    logoContainer: { alignItems: 'center', marginBottom: SPACING.xxl * 1.5 },
    logoImage: { width: 230, height: 230, resizeMode: 'contain', marginBottom: -SPACING.xl },
    logoText: { fontSize: 32, fontWeight: '900', color: COLORS.white, marginTop: -SPACING.sm, letterSpacing: 1 },
    logoTextAccent: { color: COLORS.primary },
    subtitle: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm, marginTop: 4 },

    formContainer: { width: '100%' },
    inputGroup: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
        borderRadius: RADIUS.md, marginBottom: SPACING.md, paddingHorizontal: SPACING.md,
        borderWidth: 1, borderColor: COLORS.border, height: 56,
    },
    inputIcon: { marginRight: SPACING.sm },
    input: { flex: 1, color: COLORS.white, fontSize: FONTS.sizes.md, height: '100%' },

    loginBtn: {
        backgroundColor: COLORS.primary, height: 56, borderRadius: RADIUS.md,
        alignItems: 'center', justifyContent: 'center', marginTop: SPACING.sm, ...SHADOWS.md,
    },
    loginText: { color: COLORS.white, fontSize: FONTS.sizes.md, fontWeight: 'bold' },

    biometricBtn: {
        flexDirection: 'row', backgroundColor: COLORS.primary + '15', height: 56, borderRadius: RADIUS.md,
        alignItems: 'center', justifyContent: 'center', marginTop: SPACING.md, borderWidth: 1, borderColor: COLORS.primary + '40',
    },
    biometricText: { color: COLORS.primary, fontSize: FONTS.sizes.md, fontWeight: 'bold', marginLeft: SPACING.sm },

    dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: SPACING.xl },
    divider: { flex: 1, height: 1, backgroundColor: COLORS.border },
    dividerText: { color: COLORS.textMuted, paddingHorizontal: SPACING.md, fontSize: FONTS.sizes.sm },

    googleBtn: {
        flexDirection: 'row', backgroundColor: COLORS.surface, height: 56, borderRadius: RADIUS.md,
        alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border,
    },
    googleText: { color: COLORS.textSecondary, fontSize: FONTS.sizes.md, fontWeight: '600', marginLeft: SPACING.sm },

    footer: { flexDirection: 'row', justifyContent: 'center', marginTop: SPACING.xl },
    footerText: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm },
    footerLink: { color: COLORS.primary, fontSize: FONTS.sizes.sm, fontWeight: 'bold' },

    forgotBtn: { alignItems: 'center', paddingVertical: SPACING.sm },
    forgotText: { color: COLORS.primary, fontSize: FONTS.sizes.sm },
});

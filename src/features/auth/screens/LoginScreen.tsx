import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, Image, ActivityIndicator } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { analytics } from '../../../core/services/analyticsService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppStore } from '../../../store/appStore';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../../core/theme';
import Icon from '@expo/vector-icons/Feather';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useT } from '../../../core/i18n';

export default function LoginScreen() {
    const navigation = useNavigation();
    const login = useAppStore(state => state.login);
    const t = useT();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [hasLoggedInBefore, setHasLoggedInBefore] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        checkBiometricStatus();
    }, []);

    const checkBiometricStatus = async () => {
        // Biometric login is native-only and requires previously stored credentials.
        if (Platform.OS === 'web') return;
        try {
            const val = await AsyncStorage.getItem('biometricEnabled');
            const savedEmail = await SecureStore.getItemAsync('bioEmail');
            if (val === 'true' && savedEmail) {
                setHasLoggedInBefore(true);
            }
        } catch (e) {
            console.error('Error checking biometric status', e);
        }
    };

    const handleLogin = async () => {
        if (loading) return;
        if (!email || !password) {
            alert(t.enterEmailAndPassword);
            return;
        }
        setLoading(true);
        try {
            const result = await login(email.trim(), password);
            if (result.success) {
                analytics.trackLogin('email');
                // Persist credentials securely so the user can re-login with biometrics.
                if (Platform.OS !== 'web') {
                    try {
                        await SecureStore.setItemAsync('bioEmail', email.trim());
                        await SecureStore.setItemAsync('bioPassword', password);
                        await AsyncStorage.setItem('biometricEnabled', 'true');
                    } catch (e) {
                        console.error('Error storing biometric credentials', e);
                    }
                }
            } else {
                alert(result.reason || t.error);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleBiometricAuth = async () => {
        if (loading) return;
        setLoading(true);
        try {
            const hasHardware = await LocalAuthentication.hasHardwareAsync();
            const isEnrolled = await LocalAuthentication.isEnrolledAsync();
            if (!hasHardware || !isEnrolled) {
                alert(t.biometricNotConfigured);
                return;
            }

            const savedEmail = await SecureStore.getItemAsync('bioEmail');
            const savedPassword = await SecureStore.getItemAsync('bioPassword');
            if (!savedEmail || !savedPassword) {
                // No stored credentials — user must sign in with password at least once.
                alert(t.biometricNotConfigured);
                return;
            }

            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: t.biometricRequired,
                fallbackLabel: t.usePassword,
            });
            if (result.success) {
                const authResult = await login(savedEmail, savedPassword);
                if (authResult.success) {
                    analytics.trackLogin('biometric');
                } else {
                    // Stored credentials are no longer valid (e.g. password changed).
                    await SecureStore.deleteItemAsync('bioEmail');
                    await SecureStore.deleteItemAsync('bioPassword');
                    await AsyncStorage.setItem('biometricEnabled', 'false');
                    alert(authResult.reason || t.biometricError);
                }
            }
        } catch (error) {
            console.error(error);
            alert(t.biometricError);
        } finally {
            setLoading(false);
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
                    <Text style={styles.subtitle}>{t.appTagline}</Text>
                </View>

                <View style={styles.formContainer}>
                    <View style={styles.inputGroup}>
                        <Icon name="mail" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder={t.email}
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
                            placeholder={t.password}
                            placeholderTextColor={COLORS.textMuted}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPassword}
                        />
                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
                            <Icon name={showPassword ? "eye-off" : "eye"} size={20} color={COLORS.textMuted} />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={[styles.loginBtn, loading && { opacity: 0.6 }]} onPress={handleLogin} disabled={loading}>
                        {loading ? (
                            <ActivityIndicator color={COLORS.white} />
                        ) : (
                            <Text style={styles.loginText}>{t.signIn}</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.forgotBtn} onPress={() => (navigation as any).navigate('ForgotPassword')} disabled={loading}>
                        <Text style={styles.forgotText}>{t.forgotPassword}</Text>
                    </TouchableOpacity>

                    {hasLoggedInBefore && (
                        <TouchableOpacity style={[styles.biometricBtn, loading && { opacity: 0.6 }]} onPress={handleBiometricAuth} disabled={loading}>
                            <Ionicons name="finger-print" size={24} color={COLORS.primary} />
                            <Text style={styles.biometricText}>{t.biometricSignIn}</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>{t.noAccount} </Text>
                    <TouchableOpacity onPress={() => (navigation as any).navigate('Register')}><Text style={styles.footerLink}>{t.register}</Text></TouchableOpacity>
                </View>
                <TouchableOpacity style={{ alignItems: 'center', marginTop: SPACING.md }} onPress={() => (navigation as any).navigate('PrivacyPolicy')}>
                    <Text style={{ color: COLORS.textMuted, fontSize: 11 }}>{t.privacyPolicy}</Text>
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
    logoTextAccent: { color: '#4FC3F7' },
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

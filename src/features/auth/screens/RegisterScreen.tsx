import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ScrollView, Image, Dimensions } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAppStore, UserRole } from '../../../store/appStore';
import { FONTS, SPACING, RADIUS, SHADOWS } from '../../../core/theme';
import { useColors, ThemeColors } from '../../../core/theme/ThemeContext';
import Icon from '@expo/vector-icons/Feather';
import { analytics } from '../../../core/services/analyticsService';
import { useT } from '../../../core/i18n';

export default function RegisterScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const C = useColors();
    const t = useT();
    const styles = React.useMemo(() => makeStyles(C), [C]);
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
            showAlert(t.incompleteFields, t.fillAllFields);
            return;
        }
        if (password !== confirmPassword) {
            showAlert(t.error, t.passwordsNoMatch);
            return;
        }
        if (password.length < 6) {
            showAlert(t.error, t.passwordTooShort);
            return;
        }

        if (mode === 'create_company') {
            if (!companyName) {
                showAlert(t.missingCompany, t.enterCompanyName);
                return;
            }
            const selectedPlan = route.params?.selectedPlan || 'free';
            const result = await registerCompany(nombre, email, password, cedula, companyName, selectedPlan);
            if (result.success) {
                analytics.trackSignUp('admin');
                showAlert(t.companyCreated, t.welcomeAdmin);
            } else {
                showAlert(t.error, result.reason || t.registerError);
            }
        } else {
            if (!companyCode) {
                showAlert(t.missingCode, t.enterCompanyCode);
                return;
            }
            const result = await registerUser(nombre, email, password, cedula, selectedRole, false, '', companyCode);
            if (result.success) {
                analytics.trackSignUp(selectedRole);
                showAlert(
                    t.requestSent,
                    t.requestSentMessage(selectedRole),
                    [{ text: t.understood, onPress: () => {
                        if (navigation.canGoBack()) {
                            navigation.goBack();
                        } else {
                            const isWebLarge = Platform.OS === 'web' && Dimensions.get('window').width > 768;
                            navigation.navigate(isWebLarge ? 'WebLanding' : 'Login' as never);
                        }
                    }}]
                );
            } else {
                showAlert(t.error, result.reason || t.registerError);
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
                        <Icon name="arrow-left" size={24} color={C.textSecondary} />
                    </TouchableOpacity>
                    <Image source={require('../../../../assets/logo-symbol-transparent.png')} style={{ width: 72, height: 72, resizeMode: 'contain', alignSelf: 'center', marginBottom: 8 }} />
                    <Text style={styles.title}>{t.createAccount}</Text>
                    <Text style={styles.subtitle}>{t.joinObraTrack}</Text>
                </View>

                <View style={styles.modeTabs}>
                    <TouchableOpacity 
                        style={[styles.modeTab, mode === 'create_company' && styles.modeTabActive]} 
                        onPress={() => setMode('create_company')}
                    >
                        <Text style={[styles.modeTabText, mode === 'create_company' && styles.modeTabTextActive]}>{t.createCompany}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.modeTab, mode === 'join_company' && styles.modeTabActive]}
                        onPress={() => setMode('join_company')}
                    >
                        <Text style={[styles.modeTabText, mode === 'join_company' && styles.modeTabTextActive]}>{t.joinCompany}</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.formContainer}>
                    {mode === 'create_company' ? (
                        <View style={styles.inputGroup}>
                            <Icon name="briefcase" size={20} color={C.textMuted} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder={t.companyName}
                                placeholderTextColor={C.textMuted}
                                value={companyName}
                                onChangeText={setCompanyName}
                            />
                        </View>
                    ) : (
                        <View style={styles.inputGroup}>
                            <Icon name="key" size={20} color={C.textMuted} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder={t.companyCode}
                                placeholderTextColor={C.textMuted}
                                value={companyCode}
                                onChangeText={setCompanyCode}
                                autoCapitalize="characters"
                            />
                        </View>
                    )}

                    <View style={styles.inputGroup}>
                        <Icon name="user" size={20} color={C.textMuted} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder={t.fullName}
                            placeholderTextColor={C.textMuted}
                            value={nombre}
                            onChangeText={setNombre}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Icon name="credit-card" size={20} color={C.textMuted} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder={t.idNumber}
                            placeholderTextColor={C.textMuted}
                            value={cedula}
                            onChangeText={setCedula}
                            keyboardType="numeric"
                        />
                    </View>

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
                        />
                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
                            <Icon name={showPassword ? "eye-off" : "eye"} size={20} color={C.textMuted} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.inputGroup}>
                        <Icon name="check-circle" size={20} color={C.textMuted} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder={t.confirmPassword}
                            placeholderTextColor={C.textMuted}
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry={!showConfirmPassword}
                        />
                        <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={{ padding: 4 }}>
                            <Icon name={showConfirmPassword ? "eye-off" : "eye"} size={20} color={C.textMuted} />
                        </TouchableOpacity>
                    </View>

                    {mode === 'join_company' && (
                        <>
                            <Text style={styles.label}>{t.requestedRole}</Text>
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
                    <Text style={styles.registerText}>{t.signUp}</Text>
                </TouchableOpacity>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>{t.alreadyHaveAccount} </Text>
                    <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Login' as never)}>
                        <Text style={styles.footerLink}>{t.signInHere}</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

function makeStyles(C: ThemeColors) {
    return StyleSheet.create({
        container: { flex: 1, backgroundColor: C.background },
        content: { flexGrow: 1, padding: SPACING.xl, justifyContent: 'center', maxWidth: 450, width: '100%', alignSelf: 'center' },

        headerContainer: { marginBottom: SPACING.xl },
        backBtn: { marginBottom: SPACING.md, width: 40, height: 40, justifyContent: 'center' },
        title: { fontSize: 28, fontWeight: '900', color: C.white, marginBottom: SPACING.xs },
        subtitle: { color: C.textSecondary, fontSize: FONTS.sizes.md },

        modeTabs: { flexDirection: 'row', backgroundColor: C.surface, borderRadius: RADIUS.md, marginBottom: SPACING.xl, padding: 4 },
        modeTab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: RADIUS.sm },
        modeTabActive: { backgroundColor: C.primary },
        modeTabText: { color: C.textMuted, fontWeight: 'bold', fontSize: 13 },
        modeTabTextActive: { color: C.white },

        formContainer: { width: '100%', marginBottom: SPACING.xl },
        inputGroup: {
            flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface,
            borderRadius: RADIUS.md, marginBottom: SPACING.md, paddingHorizontal: SPACING.md,
            borderWidth: 1, borderColor: C.border, height: 56,
        },
        inputIcon: { marginRight: SPACING.sm },
        input: { flex: 1, color: C.white, fontSize: FONTS.sizes.md, height: '100%' },

        registerBtn: {
            backgroundColor: C.primary, height: 56, borderRadius: RADIUS.md,
            alignItems: 'center', justifyContent: 'center', marginTop: SPACING.xl, ...SHADOWS.md,
        },
        registerText: { color: C.white, fontWeight: 'bold', fontSize: FONTS.sizes.md },

        footer: { flexDirection: 'row', justifyContent: 'center', marginTop: SPACING.xl },
        footerText: { color: C.textMuted, fontSize: FONTS.sizes.md },
        footerLink: { color: C.primary, fontSize: FONTS.sizes.md, fontWeight: 'bold' },

        label: { color: C.textSecondary, fontSize: FONTS.sizes.sm, marginBottom: SPACING.sm, fontWeight: 'bold' },
        roleContainer: { flexDirection: 'row', gap: SPACING.xs, flexWrap: 'wrap' },
        roleChip: { paddingHorizontal: 12, paddingVertical: 10, backgroundColor: C.surfaceLight, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: C.border },
        roleChipActive: { backgroundColor: C.primary, borderColor: C.primary },
        roleText: { color: C.textSecondary, fontSize: 11, fontWeight: 'bold' },
        roleTextActive: { color: C.white },
    });
}

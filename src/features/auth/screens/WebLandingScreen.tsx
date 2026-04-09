import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Image, Linking } from 'react-native';
// expo-av is only used on web for the background video.
// Conditional require prevents the native ExponentAV module from loading on Android/iOS.
const { Video, ResizeMode } = Platform.OS === 'web' ? require('expo-av') : { Video: null, ResizeMode: {} };
import Icon from '@expo/vector-icons/Feather';
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '../../../core/theme';
import { useAppStore } from '../../../store/appStore';
import { useNavigation } from '@react-navigation/native';

const CURRENT_YEAR = new Date().getFullYear();

export default function WebLandingScreen() {
    const navigation = useNavigation<any>();
    const login = useAppStore(state => state.login);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleLogin = async () => {
        if (email && password) {
            const result = await login(email, password);
            if (!result.success) {
                window.alert(result.reason || 'Error al iniciar sesión');
            }
        } else {
            window.alert('Ingresa email y contraseña');
        }
    };

    return (
        <View style={styles.root}>
            {/* Background Video — only on web where expo-av is available */}
            {Platform.OS === 'web' && Video && (
                <Video
                    source={{ uri: 'https://cdn.pixabay.com/video/2021/08/25/86236-592864197_large.mp4' }}
                    style={StyleSheet.absoluteFillObject}
                    resizeMode={ResizeMode.COVER}
                    shouldPlay
                    isLooping
                    isMuted
                />
            )}
            {/* Dark Overlay */}
            <View style={[StyleSheet.absoluteFillObject, styles.overlay]} />

            {/* All scrollable content sits on top */}
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* ── Navbar ─────────────────────────────────────────────── */}
                <View style={styles.navbar}>
                    <View style={styles.navLogo}>
                        <Image source={require('../../../../assets/logo-main.png')} style={{ width: 40, height: 40, resizeMode: 'contain', marginRight: 8 }} />
                        <Text style={styles.navLogoText}>OBRA<Text style={{ color: COLORS.primary }}>TRACK</Text></Text>
                    </View>
                    <View style={styles.navLinks}>
                        <TouchableOpacity><Text style={styles.navLink}>Inicio</Text></TouchableOpacity>
                        <TouchableOpacity><Text style={styles.navLink}>Características</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => Linking.openURL('mailto:soporte@obratrack.app')}><Text style={styles.navLink}>Contacto</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.navRegisterBtn} onPress={() => navigation.navigate('Register')}>
                            <Text style={styles.navRegisterText}>Registrarse</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ── Hero + Login Card ──────────────────────────────────── */}
                <View style={styles.heroContainer}>
                    {/* Left: Copy */}
                    <View style={styles.heroTextContainer}>
                        <Text style={styles.heroTitle}>Control Total de tus Proyectos de Construcción</Text>
                        <Text style={styles.heroDescription}>
                            ObraTrack centraliza la gestión de materiales, avances de obra, despacho logístico y control de personal. Diseñado para Ingenieros, Coordinadores y Contratistas.
                        </Text>
                        <View style={styles.featureList}>
                            {['Monitoreo de Materiales en tiempo real', 'Bitácora Diaria con fotos', 'Gestión de Personal y Cuadrillas', 'Reportes PDF profesionales', 'Logística y seguimiento de envíos'].map(f => (
                                <View key={f} style={styles.featureItem}>
                                    <Icon name="check-circle" size={22} color={COLORS.success} />
                                    <Text style={styles.featureText}>{f}</Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* Right: Login Card */}
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                        <View style={styles.loginCard}>
                            <Text style={styles.loginTitle}>Acceso al Panel Web</Text>
                            <Text style={styles.loginSubtitle}>Ingresa tus credenciales para continuar</Text>

                            <View style={styles.inputGroup}>
                                <Icon name="mail" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Correo electrónico corporativo"
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
                                    <Icon name={showPassword ? 'eye-off' : 'eye'} size={20} color={COLORS.textMuted} />
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity style={styles.forgotBtn} onPress={() => navigation.navigate('ForgotPassword')}>
                                <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.loginBtn} onPress={handleLogin}>
                                <Text style={styles.loginBtnText}>Ingresar al Proyecto</Text>
                                <Icon name="arrow-right" size={20} color={COLORS.white} />
                            </TouchableOpacity>

                            <View style={styles.divider}>
                                <View style={styles.line} />
                                <Text style={styles.orText}>o</Text>
                                <View style={styles.line} />
                            </View>

                            <TouchableOpacity style={styles.createAccountBtn} onPress={() => navigation.navigate('Register')}>
                                <Text style={styles.createAccountText}>Crear una cuenta nueva</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={{ alignItems: 'center', marginTop: SPACING.lg }} onPress={() => navigation.navigate('PrivacyPolicy')}>
                                <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>Política de Privacidad</Text>
                            </TouchableOpacity>
                        </View>
                    </KeyboardAvoidingView>
                </View>

                {/* ── Plans Banner ────────────────────────────────────────── */}
                <View style={styles.plansBanner}>
                    <Text style={styles.plansBannerTitle}>Elige tu Plan</Text>
                    <View style={styles.plansRow}>
                        {/* ── Gratis ── */}
                        <View style={styles.planCard}>
                            <Text style={styles.planName}>Gratis</Text>
                            <Text style={styles.planPrice}>$0 <Text style={styles.planPer}>/mes</Text></Text>
                            <View style={styles.planFeatures}>
                                {['1 admin + 1 por cada rol', '1 proyecto activo', 'Hasta 3 fotos por registro', 'Bitácora diaria básica'].map(f =>
                                    <Text key={f} style={styles.planFeature}>✓ {f}</Text>
                                )}
                            </View>
                            <TouchableOpacity style={styles.planBtnOutline} onPress={() => navigation.navigate('Register', { selectedPlan: 'free' })}>
                                <Text style={styles.planBtnOutlineText}>Empezar gratis</Text>
                            </TouchableOpacity>
                        </View>

                        {/* ── Premium ── */}
                        <View style={[styles.planCard, styles.planCardPro]}>
                            <View style={styles.proTag}><Text style={styles.proTagText}>MÁS POPULAR</Text></View>
                            <Text style={[styles.planName, { color: COLORS.white }]}>Premium</Text>
                            <Text style={[styles.planPrice, { color: COLORS.primary }]}>$44.900 <Text style={styles.planPer}>COP/mes</Text></Text>
                            <View style={styles.planFeatures}>
                                {['5 usuarios por rol', '5 proyectos activos', 'Reportes PDF con firma', 'Logística de envíos', 'Exportación Excel y CSV', 'Usuarios extra (add-on)'].map(f =>
                                    <Text key={f} style={[styles.planFeature, { color: COLORS.white }]}>✓ {f}</Text>
                                )}
                            </View>
                            <TouchableOpacity style={styles.planBtnSolid} onPress={() => navigation.navigate('Register', { selectedPlan: 'premium' })}>
                                <Text style={styles.planBtnSolidText}>Activar Premium</Text>
                            </TouchableOpacity>
                        </View>

                        {/* ── Enterprise ── */}
                        <View style={[styles.planCard, styles.planCardEnterprise]}>
                            <Text style={[styles.planName, { color: '#F39C12' }]}>Enterprise</Text>
                            <Text style={[styles.planPrice, { color: '#F39C12' }]}>$94.900 <Text style={styles.planPer}>COP/mes</Text></Text>
                            <View style={styles.planFeatures}>
                                {['Usuarios ilimitados', 'Proyectos ilimitados', 'Todo lo de Premium', 'Prioridad en soporte', 'SLA garantizado'].map(f =>
                                    <Text key={f} style={[styles.planFeature, { color: COLORS.white }]}>✓ {f}</Text>
                                )}
                            </View>
                            <TouchableOpacity style={[styles.planBtnSolid, { backgroundColor: '#F39C12' }]} onPress={() => navigation.navigate('Register', { selectedPlan: 'enterprise' })}>
                                <Text style={styles.planBtnSolidText}>Activar Enterprise</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>


                {/* ── Footer ──────────────────────────────────────────────── */}
                <View style={styles.footer}>
                    <View style={styles.footerTop}>
                        {/* Brand */}
                        <View style={styles.footerBrandCol}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm }}>
                                <Image source={require('../../../../assets/logo-main.png')} style={{ width: 32, height: 32, resizeMode: 'contain', marginRight: 8 }} />
                                <Text style={styles.footerBrand}>OBRA<Text style={{ color: COLORS.primary }}>TRACK</Text></Text>
                            </View>
                            <Text style={styles.footerTagline}>
                                Software de gestión para la industria de la construcción.
                                Diseñado en Colombia 🇨🇴 para el mercado latinoamericano.
                            </Text>
                        </View>

                        {/* Links */}
                        <View style={styles.footerLinksCol}>
                            <Text style={styles.footerColTitle}>Producto</Text>
                            <TouchableOpacity><Text style={styles.footerLink}>Características</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => navigation.navigate('Register')}><Text style={styles.footerLink}>Crear cuenta</Text></TouchableOpacity>
                            <TouchableOpacity><Text style={styles.footerLink}>Precios</Text></TouchableOpacity>
                        </View>

                        <View style={styles.footerLinksCol}>
                            <Text style={styles.footerColTitle}>Soporte</Text>
                            <TouchableOpacity onPress={() => Linking.openURL('mailto:soporte@obratrack.app')}>
                                <Text style={styles.footerLink}>Contacto</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => navigation.navigate('PrivacyPolicy')}>
                                <Text style={styles.footerLink}>Política de Privacidad</Text>
                            </TouchableOpacity>
                            <TouchableOpacity><Text style={styles.footerLink}>Términos de Uso</Text></TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.footerBottom}>
                        <Text style={styles.footerDisclaimer}>
                            © {CURRENT_YEAR} ObraTrack. Todos los derechos reservados.
                            ObraTrack no se hace responsable por la exactitud de los datos ingresados por los usuarios.
                            El uso de esta plataforma implica la aceptación de los Términos de Uso y la Política de Privacidad.
                        </Text>
                    </View>
                </View>

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: COLORS.background },
    overlay: { backgroundColor: 'rgba(10, 18, 28, 0.80)' },
    scrollContent: { flexGrow: 1 },

    // ── Navbar ──────────────────────────────────────────────────────────────────
    navbar: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 48, paddingVertical: 20, zIndex: 10,
    },
    navLogo: { flexDirection: 'row', alignItems: 'center' },
    navLogoText: { fontSize: 26, fontWeight: '900', color: COLORS.white, letterSpacing: 2 },
    navLinks: { flexDirection: 'row', alignItems: 'center' },
    navLink: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '600', marginLeft: 36 },
    navRegisterBtn: {
        marginLeft: 36, borderWidth: 2, borderColor: COLORS.primary,
        paddingVertical: 9, paddingHorizontal: 22, borderRadius: 50,
    },
    navRegisterText: { color: COLORS.primary, fontWeight: 'bold', fontSize: 15 },

    // ── Hero ────────────────────────────────────────────────────────────────────
    heroContainer: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: '8%', paddingVertical: 60, zIndex: 10, flexWrap: 'wrap', gap: 40,
    },
    heroTextContainer: { flex: 1, minWidth: 300, maxWidth: 560 },
    heroTitle: { fontSize: 52, fontWeight: '900', color: COLORS.white, lineHeight: 62, marginBottom: SPACING.xl },
    heroDescription: { fontSize: 17, color: COLORS.textSecondary, lineHeight: 27, marginBottom: SPACING.xxl },
    featureList: { marginTop: SPACING.md },
    featureItem: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
    featureText: { color: COLORS.white, fontSize: 16, fontWeight: '600', marginLeft: SPACING.md },

    // ── Login Card ──────────────────────────────────────────────────────────────
    loginCard: {
        width: 420, backgroundColor: 'rgba(26, 38, 53, 0.95)',
        borderRadius: RADIUS.lg, padding: 36, borderWidth: 1,
        borderColor: 'rgba(46, 64, 96, 0.5)',
        ...(({ boxShadow: '0px 25px 50px -12px rgba(0,0,0,0.5)' } as any)),
    },
    loginTitle: { fontSize: 26, fontWeight: 'bold', color: COLORS.white, marginBottom: 4 },
    loginSubtitle: { fontSize: 14, color: COLORS.textMuted, marginBottom: SPACING.xl },
    inputGroup: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(15, 25, 35, 0.6)',
        borderRadius: RADIUS.md, marginBottom: SPACING.md, paddingHorizontal: SPACING.md,
        borderWidth: 1, borderColor: COLORS.border, height: 56,
    },
    inputIcon: { marginRight: SPACING.sm },
    input: {
        flex: 1, color: COLORS.white, fontSize: 15, height: '100%',
        ...((Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) as any),
    },
    forgotBtn: { alignSelf: 'flex-end', marginBottom: SPACING.lg },
    forgotText: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
    loginBtn: {
        backgroundColor: COLORS.primary, height: 56, borderRadius: RADIUS.md,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, ...SHADOWS.md,
    },
    loginBtnText: { color: COLORS.white, fontSize: 17, fontWeight: 'bold' },
    divider: { flexDirection: 'row', alignItems: 'center', marginVertical: SPACING.lg },
    line: { flex: 1, height: 1, backgroundColor: COLORS.border },
    orText: { color: COLORS.textMuted, paddingHorizontal: SPACING.md, fontSize: 13 },
    createAccountBtn: {
        height: 56, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(46, 64, 96, 0.2)',
    },
    createAccountText: { color: COLORS.white, fontSize: 15, fontWeight: '600' },

    // ── Plans ────────────────────────────────────────────────────────────────────
    plansBanner: {
        paddingHorizontal: '8%', paddingVertical: 60, backgroundColor: 'rgba(10, 18, 28, 0.85)', zIndex: 10,
    },
    plansBannerTitle: { fontSize: 34, fontWeight: '900', color: COLORS.white, textAlign: 'center', marginBottom: 36 },
    plansRow: { flexDirection: 'row', justifyContent: 'center', gap: 24, flexWrap: 'wrap' },
    planCard: {
        width: 320, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
        padding: 32, borderWidth: 1, borderColor: COLORS.border,
    },
    planCardPro: {
        backgroundColor: COLORS.primary + '18', borderColor: COLORS.primary, position: 'relative',
    },
    planCardEnterprise: {
        backgroundColor: '#F39C1215', borderColor: '#F39C12',
    },
    proTag: {
        position: 'absolute', top: -13, alignSelf: 'center',
        backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 4, borderRadius: 20,
    },
    proTagText: { color: COLORS.white, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
    planName: { color: COLORS.textSecondary, fontSize: 16, fontWeight: '700', marginBottom: 8 },
    planPrice: { color: COLORS.white, fontSize: 32, fontWeight: '900', marginBottom: 20 },
    planPer: { fontSize: 14, fontWeight: '400', color: COLORS.textMuted },
    planFeatures: { marginBottom: 28, gap: 10 },
    planFeature: { color: COLORS.textSecondary, fontSize: 14 },
    planBtnOutline: {
        height: 48, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.primary,
        alignItems: 'center', justifyContent: 'center',
    },
    planBtnOutlineText: { color: COLORS.primary, fontWeight: 'bold', fontSize: 15 },
    planBtnSolid: {
        height: 48, borderRadius: RADIUS.md, backgroundColor: COLORS.primary,
        alignItems: 'center', justifyContent: 'center',
    },
    planBtnSolidText: { color: COLORS.white, fontWeight: 'bold', fontSize: 15 },

    // ── Footer ───────────────────────────────────────────────────────────────────
    footer: { backgroundColor: 'rgba(5, 10, 18, 0.95)', zIndex: 10 },
    footerTop: {
        flexDirection: 'row', flexWrap: 'wrap', gap: 48,
        paddingHorizontal: '8%', paddingTop: 48, paddingBottom: 32,
        borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    footerBrandCol: { flex: 2, minWidth: 240 },
    footerBrand: { fontSize: 22, fontWeight: '900', color: COLORS.white, letterSpacing: 2 },
    footerTagline: { color: COLORS.textMuted, fontSize: 13, lineHeight: 22, maxWidth: 320 },
    footerLinksCol: { flex: 1, minWidth: 140 },
    footerColTitle: { color: COLORS.white, fontWeight: '700', fontSize: 14, marginBottom: 16 },
    footerLink: { color: COLORS.textMuted, fontSize: 13, marginBottom: 12 },

    footerBottom: {
        paddingHorizontal: '8%', paddingVertical: 20, alignItems: 'center',
    },
    footerDisclaimer: {
        color: COLORS.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 20, maxWidth: 700,
    },
});

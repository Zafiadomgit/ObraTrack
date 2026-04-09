import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, Image, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../../config/firebase';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../../core/theme';
import Icon from '@expo/vector-icons/Feather';

export default function ForgotPasswordScreen() {
    const navigation = useNavigation<any>();
    const [email, setEmail] = useState('');
    const [sent, setSent] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleReset = async () => {
        if (!email.trim()) {
            if (Platform.OS === 'web') window.alert('Ingresa tu correo electrónico.');
            else Alert.alert('Error', 'Ingresa tu correo electrónico.');
            return;
        }
        setLoading(true);
        try {
            await sendPasswordResetEmail(auth, email.trim());
            setSent(true);
        } catch (error: any) {
            const msg = error.code === 'auth/user-not-found'
                ? 'No existe una cuenta con ese correo.'
                : 'Error al enviar el correo. Verifica la dirección.';
            if (Platform.OS === 'web') window.alert(msg);
            else Alert.alert('Error', msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={styles.content}>
                {/* Header */}
                <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Login' as never)} style={styles.backBtn}>
                    <Icon name="arrow-left" size={24} color={COLORS.textSecondary} />
                </TouchableOpacity>

                <Image source={require('../../../../assets/logo-main.png')} style={styles.logo} />

                {!sent ? (
                    <>
                        <Text style={styles.title}>¿Olvidaste tu contraseña?</Text>
                        <Text style={styles.subtitle}>
                            Ingresa tu correo y te enviaremos un enlace para restablecerla.
                        </Text>

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
                                autoComplete="email"
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.btn, loading && { opacity: 0.7 }]}
                            onPress={handleReset}
                            disabled={loading}
                        >
                            <Text style={styles.btnText}>
                                {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
                            </Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <View style={styles.successContainer}>
                        <Icon name="check-circle" size={56} color={COLORS.success} />
                        <Text style={styles.title}>¡Correo enviado!</Text>
                        <Text style={styles.subtitle}>
                            Revisa tu bandeja de entrada (y spam) en {email}.{'\n\n'}
                            Sigue las instrucciones del correo para crear una nueva contraseña.
                        </Text>
                        <TouchableOpacity style={styles.btn} onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Login' as never)}>
                            <Text style={styles.btnText}>Volver al inicio de sesión</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    content: { flex: 1, padding: SPACING.xl, justifyContent: 'center', maxWidth: 450, width: '100%', alignSelf: 'center' },

    backBtn: { position: 'absolute', top: SPACING.xl, left: SPACING.xl, width: 40, height: 40, justifyContent: 'center' },
    logo: { width: 80, height: 80, resizeMode: 'contain', alignSelf: 'center', marginBottom: SPACING.lg },

    title: { fontSize: 26, fontWeight: '900', color: COLORS.white, marginBottom: SPACING.sm, textAlign: 'center' },
    subtitle: { color: COLORS.textSecondary, fontSize: FONTS.sizes.md, textAlign: 'center', marginBottom: SPACING.xl },

    inputGroup: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
        borderRadius: RADIUS.md, marginBottom: SPACING.md, paddingHorizontal: SPACING.md,
        borderWidth: 1, borderColor: COLORS.border, height: 56,
    },
    inputIcon: { marginRight: SPACING.sm },
    input: { flex: 1, color: COLORS.white, fontSize: FONTS.sizes.md, height: '100%' },

    btn: {
        backgroundColor: COLORS.primary, height: 56, borderRadius: RADIUS.md,
        alignItems: 'center', justifyContent: 'center', marginTop: SPACING.lg, ...SHADOWS.md,
    },
    btnText: { color: COLORS.white, fontWeight: 'bold', fontSize: FONTS.sizes.md },

    successContainer: { alignItems: 'center' },
});

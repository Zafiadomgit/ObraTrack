import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useAppStore } from '../../../store/appStore';
import { useMaterialStore } from '../../materials/store/materialStore';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../../core/theme';
import Icon from '@expo/vector-icons/Feather';

const { width } = Dimensions.get('window');

const ONBOARDING_STEPS = [
    {
        title: "Tu Empresa Centralizada",
        desc: "ObraTrack es una plataforma Multi-Tenant. Crea tu empresa o únete a una existente mediante un código único para mantener la información en un solo lugar seguro.",
        icon: "briefcase" as const
    },
    {
        title: "Control Total de Proyectos",
        desc: "Asigna personal a diferentes cuadrillas y gestiona costos de materiales estandarizados, equipos y bitácoras diarias fácilmente.",
        icon: "clipboard" as const
    },
    {
        title: "Logística y Despachos",
        desc: "Gestiona transportes en tiempo real. Los conductores y logística pueden reportar entregas y novedades directamente desde la app móvil.",
        icon: "truck" as const
    }
];

export default function OnboardingScreen() {
    const [step, setStep] = useState(0);
    const navigation = useNavigation<any>();
    const completeOnboarding = useAppStore(state => state.completeOnboarding);
    const currentUser = useAppStore(state => state.user);
    const initializeCentralWarehouse = useMaterialStore(state => state.initializeCentralWarehouse);

    const handleNext = async () => {
        if (step < ONBOARDING_STEPS.length - 1) {
            setStep(step + 1);
        } else {
            // Finalize Onboarding
            await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
            if (currentUser) {
                await initializeCentralWarehouse(currentUser.id, currentUser.companyId || 'default-company');
            }
            await completeOnboarding();
        }
    };

    const currentData = ONBOARDING_STEPS[step];

    return (
        <View style={styles.container}>
            <View style={styles.content}>
                <View style={styles.iconContainer}>
                    <Icon name={currentData.icon} size={64} color={COLORS.primary} />
                </View>
                <Text style={styles.title}>{currentData.title}</Text>
                <Text style={styles.desc}>{currentData.desc}</Text>

                <View style={styles.dots}>
                    {ONBOARDING_STEPS.map((_, idx) => (
                        <View key={idx} style={[styles.dot, step === idx && styles.dotActive]} />
                    ))}
                </View>
            </View>

            <TouchableOpacity style={styles.btn} onPress={handleNext}>
                <Text style={styles.btnText}>{step === ONBOARDING_STEPS.length - 1 ? 'Comenzar a usar la app' : 'Siguiente'}</Text>
                <Icon name={step === ONBOARDING_STEPS.length - 1 ? "check" : "chevron-right"} size={20} color={COLORS.white} />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background, padding: SPACING.xl, justifyContent: 'space-between' },
    content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    iconContainer: {
        width: 120, height: 120, borderRadius: 60,
        backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center',
        marginBottom: SPACING.xxl, ...SHADOWS.md
    },
    title: { fontSize: 24, fontWeight: 'bold', color: COLORS.white, marginBottom: SPACING.md, textAlign: 'center' },
    desc: { fontSize: FONTS.sizes.md, color: COLORS.textSecondary, textAlign: 'center', paddingHorizontal: SPACING.md, lineHeight: 24 },
    dots: { flexDirection: 'row', marginTop: SPACING.xxl * 2, gap: 8 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.surface },
    dotActive: { width: 24, backgroundColor: COLORS.primary },
    btn: {
        backgroundColor: COLORS.primary, height: 56, borderRadius: RADIUS.md,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', ...SHADOWS.md, marginBottom: SPACING.xl
    },
    btnText: { color: COLORS.white, fontWeight: 'bold', fontSize: FONTS.sizes.md, marginRight: SPACING.sm }
});

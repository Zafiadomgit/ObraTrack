import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, Modal, TouchableOpacity,
    ScrollView, Dimensions, Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FONTS, SPACING, RADIUS, SHADOWS } from '../core/theme';
import { useColors, ThemeColors } from '../core/theme/ThemeContext';

const { width: SW, height: SH } = Dimensions.get('window');

// ─── Step definition ──────────────────────────────────────────────────────────
interface GuideStep {
    icon: keyof typeof Icon.glyphMap;
    color: string;
    title: string;
    description: string;
    tip?: string;
}

// ─── Steps by role ────────────────────────────────────────────────────────────
const STEPS_ADMIN: GuideStep[] = [
    {
        icon: 'home',
        color: '#3B82F6',
        title: '¡Bienvenido a ObraTrack!',
        description: 'Tu plataforma de gestión de obras y proyectos de construcción. Desde aquí controlas todo: proyectos, personal, materiales, logística y reportes en un solo lugar.',
        tip: '💡 Navega por las pestañas inferiores para acceder a cada sección.',
    },
    {
        icon: 'briefcase',
        color: '#F59E0B',
        title: 'Mis Proyectos',
        description: 'Crea y administra tus obras. Cada proyecto tiene su propio panel con bitácora, personal, materiales, equipos, envíos y reportes.',
        tip: '💡 Presiona el botón + (abajo a la derecha) para crear tu primer proyecto.',
    },
    {
        icon: 'book-open',
        color: '#3B82F6',
        title: 'Bitácora Diaria',
        description: 'Registra las actividades del día en cada obra. Puedes adjuntar fotos, registrar hora de inicio/fin de jornada y el estado del clima.',
        tip: '💡 Entra a un proyecto → Bitácora para agregar el primer registro del día.',
    },
    {
        icon: 'users',
        color: '#10B981',
        title: 'Personal & Cuadrillas',
        description: 'Gestiona los trabajadores de cada obra. Registra su rol, salario diario y lleva el control de asistencia. Crea plantillas de cuadrillas para reutilizarlas en futuros proyectos.',
        tip: '💡 Desde el Dashboard puedes crear plantillas de cuadrilla rápidamente.',
    },
    {
        icon: 'box',
        color: '#6366F1',
        title: 'Materiales e Inventario',
        description: 'Controla el stock de materiales por proyecto y en tu bodega central. Recibe alertas cuando el stock esté bajo el mínimo configurado.',
        tip: '💡 Al crear un proyecto se cargan automáticamente materiales estándar según el tipo de obra.',
    },
    {
        icon: 'tool',
        color: '#F59E0B',
        title: 'Equipos y Maquinaria',
        description: 'Registra los equipos asignados a cada proyecto: estado, ubicación y observaciones. Mantén un registro de mantenimiento preventivo.',
        tip: '💡 Cambia el estado del equipo directamente desde la tarjeta.',
    },
    {
        icon: 'truck',
        color: '#8B5CF6',
        title: 'Logística de Envíos',
        description: 'Gestiona los despachos de materiales desde bodega central a las obras. Asigna conductores, rastrea el estado del viaje y confirma la recepción.',
        tip: '💡 Los conductores ven sus viajes directamente en su pantalla al ingresar.',
    },
    {
        icon: 'file-text',
        color: '#EF4444',
        title: 'Reportes PDF y Excel',
        description: 'Genera reportes diarios firmados digitalmente en PDF con toda la información de la jornada. También exporta datos en formato Excel o CSV.',
        tip: '💡 La firma digital del ingeniero se puede dibujar o cargar desde galería.',
    },
    {
        icon: 'shopping-cart',
        color: '#8E44AD',
        title: 'Proveedores',
        description: 'Mantén un directorio de tus proveedores con nombre, teléfono, correo y notas. Accesible desde la pestaña "Proveedores" en la barra inferior.',
        tip: '💡 Los proveedores son globales para toda tu empresa.',
    },
    {
        icon: 'user-check',
        color: '#EF4444',
        title: 'Gestión de Usuarios',
        description: 'Invita a tu equipo: coordinadores, líderes de obra, personal de logística y conductores. Cada rol tiene acceso solo a lo que necesita.',
        tip: '💡 Ve a Acceso Rápido → Usuarios para agregar tu equipo ahora.',
    },
];

const STEPS_COORDINADOR: GuideStep[] = [
    {
        icon: 'home',
        color: '#3B82F6',
        title: '¡Bienvenido, Coordinador!',
        description: 'Como coordinador tienes acceso completo a los proyectos, personal, materiales, logística y reportes de tu empresa.',
        tip: '💡 Tu dashboard muestra el resumen de todas las obras activas.',
    },
    {
        icon: 'briefcase',
        color: '#F59E0B',
        title: 'Proyectos',
        description: 'Supervisa y crea proyectos. Cada obra tiene su panel completo con bitácora, personal, materiales, equipos y reportes.',
        tip: '💡 Usa el botón + para crear un nuevo proyecto desde la pestaña Proyectos.',
    },
    {
        icon: 'book-open',
        color: '#3B82F6',
        title: 'Bitácora Diaria',
        description: 'Revisa y registra las actividades del día en cada obra, con fotos, clima y horas de jornada.',
        tip: '💡 Entra al proyecto → Bitácora para ver el historial de actividades.',
    },
    {
        icon: 'users',
        color: '#10B981',
        title: 'Control de Personal',
        description: 'Gestiona cuadrillas, registra asistencia y lleva el control de costos laborales por proyecto.',
        tip: '💡 Puedes ver el resumen de personal activo en el Dashboard.',
    },
    {
        icon: 'box',
        color: '#6366F1',
        title: 'Materiales',
        description: 'Controla el inventario de cada obra y la bodega central. Recibe alertas de stock bajo.',
        tip: '💡 Desde Bodega Central puedes despachar materiales a las obras.',
    },
    {
        icon: 'truck',
        color: '#8B5CF6',
        title: 'Envíos y Logística',
        description: 'Crea órdenes de despacho, asigna conductores y rastrea los envíos en tiempo real.',
        tip: '💡 El conductor recibe la notificación del viaje en su app.',
    },
    {
        icon: 'file-text',
        color: '#EF4444',
        title: 'Reportes',
        description: 'Genera reportes diarios en PDF con firma digital y exporta datos en Excel/CSV para análisis.',
        tip: '💡 Los reportes quedan disponibles para compartir directamente desde el teléfono.',
    },
];

const STEPS_LIDER: GuideStep[] = [
    {
        icon: 'home',
        color: '#3B82F6',
        title: '¡Bienvenido, Líder de Obra!',
        description: 'Como líder de obra tienes acceso a la bitácora, personal, materiales y equipos de los proyectos asignados.',
        tip: '💡 Tu dashboard muestra el resumen de las obras activas.',
    },
    {
        icon: 'book-open',
        color: '#3B82F6',
        title: 'Bitácora Diaria',
        description: 'Registra las actividades del día: qué se hizo, el clima, las horas de jornada y fotos del avance.',
        tip: '💡 Registra la bitácora todos los días para tener un historial completo.',
    },
    {
        icon: 'users',
        color: '#10B981',
        title: 'Control de Asistencia',
        description: 'Registra qué trabajadores estuvieron presentes cada día. El sistema calcula automáticamente el costo laboral.',
        tip: '💡 Marca la asistencia desde Personal → el trabajador seleccionado.',
    },
    {
        icon: 'box',
        color: '#6366F1',
        title: 'Materiales de la Obra',
        description: 'Revisa el inventario disponible en tu obra. Puedes registrar uso de materiales y ver qué necesita reabastecimiento.',
        tip: '💡 El sistema te alertará cuando el stock de algún material esté bajo.',
    },
    {
        icon: 'tool',
        color: '#F59E0B',
        title: 'Equipos',
        description: 'Registra el estado de los equipos en tu obra: operativo, en mantenimiento o fuera de servicio.',
        tip: '💡 Actualiza el estado del equipo cada vez que haya un cambio.',
    },
];

const STEPS_LOGISTICA: GuideStep[] = [
    {
        icon: 'home',
        color: '#3B82F6',
        title: '¡Bienvenido, Personal de Logística!',
        description: 'Tu pantalla principal muestra los despachos activos y la bodega central de materiales.',
        tip: '💡 Usa las pestañas del menú para navegar entre envíos y bodega.',
    },
    {
        icon: 'truck',
        color: '#8B5CF6',
        title: 'Gestión de Envíos',
        description: 'Crea órdenes de despacho seleccionando materiales de la bodega, la obra destino y el conductor asignado.',
        tip: '💡 El conductor recibe automáticamente la notificación del nuevo viaje.',
    },
    {
        icon: 'package',
        color: '#6366F1',
        title: 'Bodega Central',
        description: 'Administra el inventario de la bodega central. Agrega entradas de material y controla el stock disponible para despacho.',
        tip: '💡 Mantén el stock actualizado para evitar faltantes en las obras.',
    },
];

const STEPS_CONDUCTOR: GuideStep[] = [
    {
        icon: 'home',
        color: '#3B82F6',
        title: '¡Bienvenido, Conductor!',
        description: 'Tu pantalla muestra los viajes que te han asignado. Acepta o rechaza cada despacho y actualiza el estado en tiempo real.',
        tip: '💡 Revisa esta pantalla al inicio de cada jornada.',
    },
    {
        icon: 'truck',
        color: '#8B5CF6',
        title: 'Mis Viajes',
        description: 'Ves los viajes pendientes, activos y finalizados. Para cada viaje tienes la información del destino, los materiales y el contacto.',
        tip: '💡 Acepta el viaje → Inicia → Finaliza al entregar.',
    },
    {
        icon: 'map-pin',
        color: '#10B981',
        title: 'Actualizar Ubicación',
        description: 'Puedes compartir tu ubicación en tiempo real para que logística rastree el envío. Solo actívalo desde el detalle del viaje.',
        tip: '💡 La app necesita permiso de ubicación para esta función.',
    },
];

function getSteps(role?: string): GuideStep[] {
    switch (role) {
        case 'admin': return STEPS_ADMIN;
        case 'coordinador': return STEPS_COORDINADOR;
        case 'lider': return STEPS_LIDER;
        case 'logistica': return STEPS_LOGISTICA;
        case 'conductor': return STEPS_CONDUCTOR;
        default: return STEPS_ADMIN;
    }
}

// ─── Component ────────────────────────────────────────────────────────────────
interface Props {
    userId: string;
    role: string;
}

export default function WelcomeGuide({ userId, role }: Props) {
    const insets = useSafeAreaInsets();
    const C = useColors();
    const styles = React.useMemo(() => makeStyles(C), [C]);
    const [visible, setVisible] = useState(false);
    const [step, setStep] = useState(0);
    const steps = getSteps(role);
    const current = steps[step];

    // Animated progress bar
    const progress = new Animated.Value(0);

    useEffect(() => {
        checkIfShouldShow();
    }, [userId]);

    useEffect(() => {
        Animated.timing(progress, {
            toValue: (step + 1) / steps.length,
            duration: 300,
            useNativeDriver: false,
        }).start();
    }, [step]);

    const checkIfShouldShow = async () => {
        try {
            const key = `obratrack_guide_done_${userId}`;
            const done = await AsyncStorage.getItem(key);
            if (!done) setVisible(true);
        } catch { /* ignore */ }
    };

    const markDone = async () => {
        try {
            await AsyncStorage.setItem(`obratrack_guide_done_${userId}`, '1');
        } catch { /* ignore */ }
        setVisible(false);
    };

    const handleNext = () => {
        if (step < steps.length - 1) setStep(s => s + 1);
        else markDone();
    };

    const handleBack = () => {
        if (step > 0) setStep(s => s - 1);
    };

    if (!visible) return null;

    return (
        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
            <View style={styles.overlay}>
                <View style={[styles.card, { paddingBottom: insets.bottom + SPACING.lg }]}>

                    {/* Progress bar */}
                    <View style={styles.progressTrack}>
                        <Animated.View
                            style={[styles.progressFill, {
                                width: progress.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: ['0%', '100%'],
                                }),
                                backgroundColor: current.color,
                            }]}
                        />
                    </View>

                    {/* Step counter + skip */}
                    <View style={styles.topRow}>
                        <Text style={styles.stepCount}>{step + 1} / {steps.length}</Text>
                        <TouchableOpacity onPress={markDone} style={styles.skipBtn}>
                            <Text style={styles.skipText}>Omitir</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Icon */}
                    <View style={[styles.iconWrap, { backgroundColor: current.color + '22' }]}>
                        <View style={[styles.iconCircle, { backgroundColor: current.color }]}>
                            <Icon name={current.icon} size={36} color="#FFFFFF" />
                        </View>
                    </View>

                    {/* Content */}
                    <ScrollView
                        contentContainerStyle={styles.content}
                        showsVerticalScrollIndicator={false}
                    >
                        <Text style={styles.title}>{current.title}</Text>
                        <Text style={styles.description}>{current.description}</Text>

                        {current.tip && (
                            <View style={[styles.tipBox, { borderColor: current.color + '60', backgroundColor: current.color + '15' }]}>
                                <Text style={[styles.tipText, { color: current.color }]}>{current.tip}</Text>
                            </View>
                        )}
                    </ScrollView>

                    {/* Dots */}
                    <View style={styles.dots}>
                        {steps.map((_, i) => (
                            <View
                                key={i}
                                style={[
                                    styles.dot,
                                    i === step
                                        ? { backgroundColor: current.color, width: 20 }
                                        : { backgroundColor: C.border },
                                ]}
                            />
                        ))}
                    </View>

                    {/* Buttons */}
                    <View style={styles.btnRow}>
                        {step > 0 ? (
                            <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
                                <Icon name="arrow-left" size={18} color={C.textSecondary} />
                                <Text style={styles.backText}>Atrás</Text>
                            </TouchableOpacity>
                        ) : <View style={{ flex: 1 }} />}

                        <TouchableOpacity
                            style={[styles.nextBtn, { backgroundColor: current.color }]}
                            onPress={handleNext}
                        >
                            <Text style={styles.nextText}>
                                {step < steps.length - 1 ? 'Siguiente' : '¡Empezar!'}
                            </Text>
                            <Icon
                                name={step < steps.length - 1 ? 'arrow-right' : 'check'}
                                size={18}
                                color="#FFF"
                            />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

// ─── Public helper: reset guide (for re-showing from settings) ────────────────
export async function resetWelcomeGuide(userId: string) {
    await AsyncStorage.removeItem(`obratrack_guide_done_${userId}`);
}

// ─── Styles ───────────────────────────────────────────────────────────────────
function makeStyles(C: ThemeColors) {
    return StyleSheet.create({
        overlay: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.75)',
            justifyContent: 'flex-end',
        },
        card: {
            backgroundColor: C.surface,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingTop: SPACING.sm,
            maxHeight: SH * 0.88,
            ...SHADOWS.lg,
        },

        progressTrack: {
            height: 3,
            backgroundColor: C.border,
            marginHorizontal: SPACING.xl,
            borderRadius: 2,
            marginBottom: SPACING.sm,
        },
        progressFill: {
            height: 3,
            borderRadius: 2,
        },

        topRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: SPACING.xl,
            marginBottom: SPACING.md,
        },
        stepCount: {
            color: C.textMuted,
            fontSize: FONTS.sizes.sm,
            fontWeight: '600',
        },
        skipBtn: {
            paddingVertical: 4,
            paddingHorizontal: 12,
            backgroundColor: C.surfaceLight,
            borderRadius: 20,
        },
        skipText: {
            color: C.textMuted,
            fontSize: FONTS.sizes.sm,
            fontWeight: '600',
        },

        iconWrap: {
            width: 100,
            height: 100,
            borderRadius: 50,
            alignItems: 'center',
            justifyContent: 'center',
            alignSelf: 'center',
            marginBottom: SPACING.lg,
        },
        iconCircle: {
            width: 72,
            height: 72,
            borderRadius: 36,
            alignItems: 'center',
            justifyContent: 'center',
        },

        content: {
            paddingHorizontal: SPACING.xl,
            paddingBottom: SPACING.md,
        },
        title: {
            color: C.white,
            fontSize: FONTS.sizes.xl,
            fontWeight: 'bold',
            textAlign: 'center',
            marginBottom: SPACING.md,
        },
        description: {
            color: C.textSecondary,
            fontSize: FONTS.sizes.md,
            lineHeight: 24,
            textAlign: 'center',
            marginBottom: SPACING.lg,
        },
        tipBox: {
            borderRadius: RADIUS.md,
            borderWidth: 1,
            padding: SPACING.md,
            marginBottom: SPACING.sm,
        },
        tipText: {
            fontSize: FONTS.sizes.sm,
            lineHeight: 20,
            fontWeight: '600',
        },

        dots: {
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 6,
            marginVertical: SPACING.md,
        },
        dot: {
            height: 6,
            borderRadius: 3,
            width: 6,
        },

        btnRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: SPACING.xl,
            gap: SPACING.md,
        },
        backBtn: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: SPACING.md,
            backgroundColor: C.surfaceLight,
            borderRadius: RADIUS.md,
        },
        backText: {
            color: C.textSecondary,
            fontWeight: '600',
            fontSize: FONTS.sizes.md,
        },
        nextBtn: {
            flex: 2,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingVertical: SPACING.md,
            borderRadius: RADIUS.md,
        },
        nextText: {
            color: '#FFFFFF',
            fontWeight: 'bold',
            fontSize: FONTS.sizes.md,
        },
    });
}

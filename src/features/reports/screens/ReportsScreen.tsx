import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Modal } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAppStore } from '../../../store/appStore';
import { useReportStore } from '../store/reportStore';
import { useProjectStore } from '../../projects/store/projectStore';
import { usePersonnelStore } from '../../personnel/store/personnelStore';
import { useMaterialStore } from '../../materials/store/materialStore';
import { pdfService } from '../services/pdfService';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../../core/theme';
import { useSubscription } from '../../auth/hooks/useSubscription';
import Icon from '@expo/vector-icons/Feather';
import { format, subDays, addDays, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import SignatureScreen from 'react-native-signature-canvas';
import * as ImagePicker from 'expo-image-picker';
import { exportService } from '../services/exportService';

export default function ReportsScreen() {
    const route = useRoute<any>();
    const { projectId } = route.params;
    const { user } = useAppStore();
    const project = useProjectStore(state => state.projects).find(p => p.id === projectId && p.userId === user?.id);
    const dailyLogs = useReportStore(state => state.dailyLogs).filter(l => l.projectId === projectId && l.userId === user?.id);
    const workers = usePersonnelStore(state => state.workers).filter(w => w.projectId === projectId && w.userId === user?.id);
    const materials = useMaterialStore(state => state.materials).filter(m => m.projectId === projectId && m.userId === user?.id);

    // In a real scenario we'd query history. Let's mock a simple history or empty state.
    const [history] = useState([
        { id: '1', date: '2026-03-12T00:00:00.000Z' },
        { id: '2', date: '2026-03-11T00:00:00.000Z' }
    ]);

    const [selectedDate, setSelectedDate] = useState(new Date());
    const [isGenerating, setIsGenerating] = useState(false);
    const { isPro, canGenerateReport, canUseReports } = useSubscription();

    const [showPaywall, setShowPaywall] = useState(!canUseReports());
    const [showSignatureModal, setShowSignatureModal] = useState(false);
    const navigation = useNavigation<any>();

    // Animations for paywall
    const fadeAnim = useState(new Animated.Value(0))[0];
    const slideAnim = useState(new Animated.Value(50))[0];

    useEffect(() => {
        if (!canUseReports()) {
            setShowPaywall(true);
        }
    }, [canUseReports]);

    useEffect(() => {
        if (showPaywall) {
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
                Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 7, useNativeDriver: true })
            ]).start();
        } else {
            fadeAnim.setValue(0);
            slideAnim.setValue(50);
        }
    }, [showPaywall]);

    // isPro and canGenerateReport come from useSubscription hook (backed by getPlanLimits)

    const handlePrevDay = () => setSelectedDate(subDays(selectedDate, 1));
    const handleNextDay = () => setSelectedDate(addDays(selectedDate, 1));

    const handleGenerateRequest = (format: 'pdf' | 'excel' | 'csv') => {
        if (!canGenerateReport() || !canUseReports()) {
            setShowPaywall(true);
            return;
        }

        if (format === 'pdf') {
            setShowSignatureModal(true);
        } else {
            handleExportData(format);
        }
    };

    const handleSignatureOK = async (signatureBase64: string) => {
        setShowSignatureModal(false);
        if (!project || !user) return;

        setIsGenerating(true);
        try {
            // Find the daily log for the selected date
            const dailyLog = dailyLogs.find(log => isSameDay(new Date(log.fecha), selectedDate));

            // The user wants ALL project workers listed for cost tracking
            const projectWorkers = workers;

            const payload = {
                project,
                dailyLog,
                presentWorkers: projectWorkers,
                materials,
                isPro,
                date: selectedDate,
                engineerName: user.nombre,
                engineerSignature: signatureBase64
            };

            const fileName = `Reporte_${project.nombreProyecto.replace(/\s+/g, '_')}_${format(selectedDate, 'yyyy-MM-dd')}.pdf`;
            const uri = await pdfService.generateDailyReport(payload, fileName);

            // Note: Expo sharing might not respect filenames on all platforms depending on the implementation
            // but we use it in the share dialog.
            await pdfService.sharePDF(uri);
        } catch (error) {
            alert('Error al generar el PDF.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSignatureCancel = () => {
        setShowSignatureModal(false);
        alert('Se requiere firma para generar el documento oficial.');
    };

    const handlePickSignatureImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            alert('Se necesita permiso para acceder a la galería.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false,
            quality: 0.8,
            base64: true,
        });

        if (!result.canceled && result.assets[0].base64) {
            const base64Img = `data:image/jpeg;base64,${result.assets[0].base64}`;
            await handleSignatureOK(base64Img);
        }
    };

    const handleExportData = async (format: 'excel' | 'csv') => {
        if (!project || !user) return;
        setIsGenerating(true);
        try {
            const dailyLog = dailyLogs.find(log => isSameDay(new Date(log.fecha), selectedDate));
            const presentWorkers = dailyLog
                ? workers.filter(w => dailyLog.trabajadoresPresentes.includes(w.id))
                : [];

            const payload = {
                project,
                dailyLog,
                presentWorkers,
                materials,
                isPro,
                date: selectedDate,
                engineerName: user.nombre
            };

            if (format === 'excel') {
                await exportService.exportToExcel(payload);
            } else if (format === 'csv') {
                await exportService.exportToCSV(payload);
            }
        } catch (error) {
            alert(`Error al generar el exporte en ${format.toUpperCase()}.`);
        } finally {
            setIsGenerating(false);
        }
    };

    if (showPaywall) {
        return (
            <View style={styles.paywallContainer}>
                <TouchableOpacity style={styles.closePaywallBtn} onPress={() => setShowPaywall(false)}>
                    <Icon name="x" size={24} color={COLORS.textSecondary} />
                </TouchableOpacity>

                <Animated.View style={[styles.paywallContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                    <View style={styles.iconCircle}>
                        <Icon name="file-text" size={48} color={COLORS.primary} />
                        <View style={styles.proBadge}>
                            <Text style={styles.proBadgeText}>PRO</Text>
                        </View>
                    </View>

                    <Text style={styles.paywallTitle}>Reportes Profesionales en 1 Toque</Text>
                    <Text style={styles.paywallDesc}>
                        Los ingenieros Pro ahorran hasta 8 horas al mes generando informes automáticos con fotos, logo y firmas al instante.
                    </Text>

                    <View style={styles.benefitsList}>
                        <View style={styles.benefitRow}>
                            <Icon name="check-circle" size={20} color={COLORS.success} />
                            <Text style={styles.benefitText}>Exportación PDF sin límites</Text>
                        </View>
                        <View style={styles.benefitRow}>
                            <Icon name="check-circle" size={20} color={COLORS.success} />
                            <Text style={styles.benefitText}>Marca de agua profesional</Text>
                        </View>
                        <View style={styles.benefitRow}>
                            <Icon name="check-circle" size={20} color={COLORS.success} />
                            <Text style={styles.benefitText}>Firma digital con validez y peso legal</Text>
                        </View>
                    </View>

                    <TouchableOpacity style={styles.upgradeBtn}>
                        <Text style={styles.upgradeBtnText}>👉 Activar Plan Profesional</Text>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
            <View style={styles.headerCard}>
                <Text style={styles.sectionTitle}>Generar Informe Diario</Text>

                <View style={styles.dateSelector}>
                    <TouchableOpacity onPress={handlePrevDay} style={styles.dateBtn}>
                        <Icon name="chevron-left" size={24} color={COLORS.primary} />
                    </TouchableOpacity>

                    <View style={styles.dateDisplay}>
                        <Icon name="calendar" size={16} color={COLORS.textSecondary} style={{ marginBottom: 4 }} />
                        <Text style={styles.dateText}>
                            {format(selectedDate, "dd MMM yyyy", { locale: es }).toUpperCase()}
                        </Text>
                    </View>

                    <TouchableOpacity onPress={handleNextDay} style={styles.dateBtn}>
                        <Icon name="chevron-right" size={24} color={COLORS.primary} />
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    style={[styles.generateBtn, isGenerating && styles.disabledBtn]}
                    onPress={() => handleGenerateRequest('pdf')}
                    disabled={isGenerating}
                >
                    <Icon name="file-text" size={20} color={COLORS.white} />
                    <Text style={styles.generateBtnText}>
                        {isGenerating ? 'Ejecutando...' : 'Generar PDF'}
                    </Text>
                </TouchableOpacity>

                <View style={styles.exportRow}>
                    <TouchableOpacity
                        style={[styles.exportBtn, { backgroundColor: '#27AE60' }, isGenerating && styles.disabledBtn]}
                        onPress={() => handleGenerateRequest('excel')}
                        disabled={isGenerating}
                    >
                        <Icon name="file" size={16} color={COLORS.white} />
                        <Text style={styles.exportBtnText}>Excel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.exportBtn, isGenerating && styles.disabledBtn]}
                        onPress={() => handleGenerateRequest('csv')}
                        disabled={isGenerating}
                    >
                        <Icon name="align-left" size={16} color={COLORS.white} />
                        <Text style={styles.exportBtnText}>CSV</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.historySection}>
                <Text style={styles.historyTitle}>Historial de reportes generados</Text>

                {history.map((item, index) => (
                    <View key={item.id} style={styles.historyCard}>
                        <View style={styles.historyIconBox}>
                            <Icon name="file" size={20} color={COLORS.primary} />
                        </View>
                        <View style={styles.historyInfo}>
                            <Text style={styles.historyDate}>
                                {format(new Date(item.date), "dd MMMM yyyy", { locale: es })}
                            </Text>
                            <Text style={styles.historyStatus}>Generado exitosamente</Text>
                        </View>
                        <TouchableOpacity style={styles.downloadIconBtn}>
                            <Icon name="download" size={20} color={COLORS.textSecondary} />
                        </TouchableOpacity>
                    </View>
                ))}
            </View>

            <Modal visible={showSignatureModal} animationType="slide" transparent={true}>
                <View style={styles.signatureModalContainer}>
                    <View style={styles.signatureModalHeader}>
                        <Text style={styles.signatureModalTitle}>Firma del Ingeniero</Text>
                        <TouchableOpacity onPress={handleSignatureCancel}>
                            <Icon name="x" size={24} color={COLORS.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={styles.uploadImageBtn} onPress={handlePickSignatureImage}>
                        <Icon name="image" size={18} color={COLORS.primary} style={{ marginRight: 8 }} />
                        <Text style={styles.uploadImageText}>Cargar Firma desde Galería</Text>
                    </TouchableOpacity>

                    <View style={styles.signatureBox}>
                        <SignatureScreen
                            onOK={handleSignatureOK}
                            onEmpty={() => alert("La firma no puede estar vacía")}
                            descriptionText="O dibuja tu firma táctil aquí abajo:"
                            clearText="Borrar"
                            confirmText="Guardar y Generar PDF"
                            webStyle=".m-signature-pad {box-shadow: none; border: none;}"
                            backgroundColor={COLORS.surfaceLight}
                            penColor={COLORS.white}
                        />
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },

    headerCard: {
        backgroundColor: COLORS.surface,
        margin: SPACING.md,
        padding: SPACING.lg,
        borderRadius: RADIUS.lg,
        ...SHADOWS.md,
    },
    sectionTitle: {
        color: COLORS.white,
        fontSize: FONTS.sizes.lg,
        fontWeight: 'bold',
        marginBottom: SPACING.md,
        textAlign: 'center'
    },
    dateSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.surfaceLight,
        borderRadius: RADIUS.md,
        padding: SPACING.sm,
        marginBottom: SPACING.lg,
    },
    dateBtn: {
        padding: SPACING.sm,
        backgroundColor: COLORS.surface,
        borderRadius: RADIUS.sm,
    },
    dateDisplay: {
        alignItems: 'center',
    },
    dateText: {
        color: COLORS.white,
        fontSize: FONTS.sizes.lg,
        fontWeight: 'bold',
    },
    generateBtn: {
        backgroundColor: COLORS.primary,
        flexDirection: 'row',
        padding: SPACING.md,
        borderRadius: RADIUS.md,
        alignItems: 'center',
        justifyContent: 'center',
        ...SHADOWS.md,
    },
    disabledBtn: {
        opacity: 0.7,
    },
    generateBtnText: {
        color: COLORS.white,
        fontSize: FONTS.sizes.md,
        fontWeight: 'bold',
        marginLeft: SPACING.sm,
    },

    historySection: {
        paddingHorizontal: SPACING.md,
        marginTop: SPACING.md,
    },
    historyTitle: {
        color: COLORS.textSecondary,
        fontSize: FONTS.sizes.md,
        fontWeight: 'bold',
        marginBottom: SPACING.md,
    },
    historyCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        padding: SPACING.md,
        borderRadius: RADIUS.md,
        marginBottom: SPACING.sm,
        ...SHADOWS.sm,
    },
    historyIconBox: {
        width: 40,
        height: 40,
        borderRadius: RADIUS.md,
        backgroundColor: COLORS.primary + '20',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: SPACING.md,
    },
    historyInfo: {
        flex: 1,
    },
    historyDate: {
        color: COLORS.white,
        fontSize: FONTS.sizes.md,
        fontWeight: 'bold',
    },
    historyStatus: {
        color: COLORS.success,
        fontSize: FONTS.sizes.xs,
        marginTop: 2,
    },
    downloadIconBtn: {
        padding: SPACING.sm,
    },

    // Paywall Styles
    paywallContainer: {
        flex: 1,
        backgroundColor: COLORS.background,
        justifyContent: 'center',
        padding: SPACING.xl,
    },
    closePaywallBtn: {
        position: 'absolute',
        top: 50,
        right: 20,
        padding: SPACING.sm,
        zIndex: 10,
    },
    paywallContent: {
        backgroundColor: COLORS.surface,
        padding: SPACING.xl,
        borderRadius: RADIUS.xl,
        alignItems: 'center',
        ...SHADOWS.lg,
        borderWidth: 1,
        borderColor: COLORS.primary + '30',
    },
    iconCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: COLORS.primary + '15',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.lg,
        position: 'relative',
    },
    proBadge: {
        position: 'absolute',
        bottom: -5,
        backgroundColor: '#F39C12',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: COLORS.surface,
    },
    proBadgeText: {
        color: COLORS.white,
        fontSize: 10,
        fontWeight: 'bold',
    },
    paywallTitle: {
        color: COLORS.white,
        fontSize: FONTS.sizes.xl,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: SPACING.md,
    },
    paywallDesc: {
        color: COLORS.textMuted,
        fontSize: FONTS.sizes.md,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: SPACING.xl,
    },
    benefitsList: {
        width: '100%',
        marginBottom: SPACING.xl,
        backgroundColor: COLORS.surfaceLight,
        padding: SPACING.lg,
        borderRadius: RADIUS.md,
    },
    benefitRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    benefitText: {
        color: COLORS.white,
        fontSize: FONTS.sizes.sm,
        marginLeft: SPACING.sm,
        flex: 1,
    },
    upgradeBtn: {
        backgroundColor: COLORS.primary,
        width: '100%',
        paddingVertical: SPACING.md,
        borderRadius: RADIUS.md,
        alignItems: 'center',
        ...SHADOWS.md,
    },
    upgradeBtnText: {
        color: COLORS.white,
        fontSize: FONTS.sizes.md,
        fontWeight: 'bold',
    },

    // Signature Modal
    signatureModalContainer: {
        flex: 1,
        backgroundColor: COLORS.background,
        paddingTop: 50,
    },
    signatureModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SPACING.lg,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    signatureModalTitle: {
        color: COLORS.white,
        fontSize: FONTS.sizes.lg,
        fontWeight: 'bold',
    },
    uploadImageBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.surfaceLight,
        padding: SPACING.md,
        borderRadius: RADIUS.md,
        margin: SPACING.lg,
        marginBottom: 0
    },
    uploadImageText: {
        color: COLORS.primary,
        fontSize: FONTS.sizes.md,
        fontWeight: 'bold'
    },
    signatureBox: {
        flex: 1,
    },
    exportRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: SPACING.md,
    },
    exportBtn: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: COLORS.primary,
        padding: SPACING.md,
        borderRadius: RADIUS.md,
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 4,
        ...SHADOWS.md,
    },
    exportBtnText: {
        color: COLORS.white,
        fontSize: FONTS.sizes.md,
        fontWeight: 'bold',
        marginLeft: SPACING.sm,
    }
});

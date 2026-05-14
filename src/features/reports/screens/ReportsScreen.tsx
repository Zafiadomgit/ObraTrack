import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Modal } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAppStore } from '../../../store/appStore';
import { useReportStore } from '../store/reportStore';
import { useProjectStore } from '../../projects/store/projectStore';
import { usePersonnelStore } from '../../personnel/store/personnelStore';
import { useMaterialStore } from '../../materials/store/materialStore';
import { pdfService } from '../services/pdfService';
import { FONTS, SPACING, RADIUS, SHADOWS } from '../../../core/theme';
import { useColors, ThemeColors } from '../../../core/theme/ThemeContext';
import { useT } from '../../../core/i18n';
import { useSubscription } from '../../auth/hooks/useSubscription';
import Icon from '@expo/vector-icons/Feather';
import { format, subDays, addDays, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import SignatureScreen from 'react-native-signature-canvas';
import * as ImagePicker from 'expo-image-picker';
import { exportService } from '../services/exportService';

export default function ReportsScreen() {
    const C = useColors();
    const t = useT();
    const styles = React.useMemo(() => makeStyles(C), [C]);

    const route = useRoute<any>();
    const { user } = useAppStore();
    const allProjects = useProjectStore(state => state.projects).filter(p => p.userId === user?.id);
    const navigation = useNavigation<any>();

    // projectId can come from route params (when navigated from a project) or be selected here
    const [selectedProjectId, setSelectedProjectId] = useState<string>(
        route.params?.projectId || allProjects[0]?.id || ''
    );
    const projectId = selectedProjectId;

    const project = allProjects.find(p => p.id === projectId);
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
    // 'choose' = pick method screen, 'draw' = full-screen canvas
    const [signatureStep, setSignatureStep] = useState<'choose' | 'draw'>('choose');

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
            setSignatureStep('choose');
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
            alert(t.pdfGenError);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSignatureCancel = () => {
        if (signatureStep === 'draw') {
            // Go back to method picker instead of closing
            setSignatureStep('choose');
        } else {
            setShowSignatureModal(false);
        }
    };

    const handlePickSignatureImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            alert(t.galleryPermission);
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
            alert(t.exportDataError(format.toUpperCase()));
        } finally {
            setIsGenerating(false);
        }
    };

    if (showPaywall) {
        return (
            <View style={styles.paywallContainer}>
                <TouchableOpacity style={styles.closePaywallBtn} onPress={() => setShowPaywall(false)}>
                    <Icon name="x" size={24} color={C.textSecondary} />
                </TouchableOpacity>

                <Animated.View style={[styles.paywallContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                    <View style={styles.iconCircle}>
                        <Icon name="file-text" size={48} color={C.primary} />
                        <View style={styles.proBadge}>
                            <Text style={styles.proBadgeText}>PRO</Text>
                        </View>
                    </View>

                    <Text style={styles.paywallTitle}>{t.paywallReportsTitle}</Text>
                    <Text style={styles.paywallDesc}>
                        {t.paywallReportsDesc}
                    </Text>

                    <View style={styles.benefitsList}>
                        <View style={styles.benefitRow}>
                            <Icon name="check-circle" size={20} color={C.success} />
                            <Text style={styles.benefitText}>{t.benefitPdfUnlimited}</Text>
                        </View>
                        <View style={styles.benefitRow}>
                            <Icon name="check-circle" size={20} color={C.success} />
                            <Text style={styles.benefitText}>{t.benefitWatermark}</Text>
                        </View>
                        <View style={styles.benefitRow}>
                            <Icon name="check-circle" size={20} color={C.success} />
                            <Text style={styles.benefitText}>{t.benefitDigitalSignature}</Text>
                        </View>
                    </View>

                    <TouchableOpacity style={styles.upgradeBtn}>
                        <Text style={styles.upgradeBtnText}>{t.activateProfessionalPlan}</Text>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        );
    }

    // If no projects exist at all, show an empty state
    if (allProjects.length === 0) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: SPACING.xl }]}>
                <Icon name="folder" size={56} color={C.textMuted} />
                <Text style={[styles.sectionTitle, { marginTop: SPACING.lg, textAlign: 'center' }]}>
                    {t.noProjectsYet ?? 'Sin proyectos'}
                </Text>
                <Text style={{ color: C.textMuted, textAlign: 'center', marginTop: SPACING.sm }}>
                    {t.createProjectFirst ?? 'Crea un proyecto primero para generar reportes.'}
                </Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
            <View style={styles.headerCard}>
                <Text style={styles.sectionTitle}>{t.generateDailyReport}</Text>

                {/* Project picker — visible when arriving from dashboard */}
                {allProjects.length > 1 && (
                    <View style={{ marginBottom: SPACING.md }}>
                        <Text style={styles.pickerLabel}>{t.selectProject ?? 'Proyecto'}</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                            {allProjects.map(p => (
                                <TouchableOpacity
                                    key={p.id}
                                    style={[styles.projectChip, selectedProjectId === p.id && styles.projectChipActive]}
                                    onPress={() => setSelectedProjectId(p.id)}
                                >
                                    <Text style={[styles.projectChipText, selectedProjectId === p.id && styles.projectChipTextActive]}
                                        numberOfLines={1}>
                                        {p.nombreProyecto}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                <View style={styles.dateSelector}>
                    <TouchableOpacity onPress={handlePrevDay} style={styles.dateBtn}>
                        <Icon name="chevron-left" size={24} color={C.primary} />
                    </TouchableOpacity>

                    <View style={styles.dateDisplay}>
                        <Icon name="calendar" size={16} color={C.textSecondary} style={{ marginBottom: 4 }} />
                        <Text style={styles.dateText}>
                            {format(selectedDate, "dd MMM yyyy", { locale: es }).toUpperCase()}
                        </Text>
                    </View>

                    <TouchableOpacity onPress={handleNextDay} style={styles.dateBtn}>
                        <Icon name="chevron-right" size={24} color={C.primary} />
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    style={[styles.generateBtn, isGenerating && styles.disabledBtn]}
                    onPress={() => handleGenerateRequest('pdf')}
                    disabled={isGenerating}
                >
                    <Icon name="file-text" size={20} color={C.white} />
                    <Text style={styles.generateBtnText}>
                        {isGenerating ? t.executing : t.generatePDF}
                    </Text>
                </TouchableOpacity>

                <View style={styles.exportRow}>
                    <TouchableOpacity
                        style={[styles.exportBtn, { backgroundColor: '#27AE60' }, isGenerating && styles.disabledBtn]}
                        onPress={() => handleGenerateRequest('excel')}
                        disabled={isGenerating}
                    >
                        <Icon name="file" size={16} color={C.white} />
                        <Text style={styles.exportBtnText}>Excel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.exportBtn, isGenerating && styles.disabledBtn]}
                        onPress={() => handleGenerateRequest('csv')}
                        disabled={isGenerating}
                    >
                        <Icon name="align-left" size={16} color={C.white} />
                        <Text style={styles.exportBtnText}>CSV</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.historySection}>
                <Text style={styles.historyTitle}>{t.reportHistory}</Text>

                {history.map((item, index) => (
                    <View key={item.id} style={styles.historyCard}>
                        <View style={styles.historyIconBox}>
                            <Icon name="file" size={20} color={C.primary} />
                        </View>
                        <View style={styles.historyInfo}>
                            <Text style={styles.historyDate}>
                                {format(new Date(item.date), "dd MMMM yyyy", { locale: es })}
                            </Text>
                            <Text style={styles.historyStatus}>{t.generatedSuccessfully}</Text>
                        </View>
                        <TouchableOpacity style={styles.downloadIconBtn}>
                            <Icon name="download" size={20} color={C.textSecondary} />
                        </TouchableOpacity>
                    </View>
                ))}
            </View>

            <Modal visible={showSignatureModal} animationType="slide" transparent={false}>
                <View style={styles.signatureModalContainer}>
                    {/* ── Header ── */}
                    <View style={styles.signatureModalHeader}>
                        <TouchableOpacity onPress={handleSignatureCancel} style={styles.sigBackBtn}>
                            <Icon name={signatureStep === 'draw' ? 'arrow-left' : 'x'} size={22} color={C.textSecondary} />
                        </TouchableOpacity>
                        <Text style={styles.signatureModalTitle}>
                            {signatureStep === 'draw' ? t.drawSignatureDivider ?? 'Dibujar firma' : t.engineerSignature}
                        </Text>
                        <View style={{ width: 36 }} />
                    </View>

                    {signatureStep === 'choose' ? (
                        /* ── Step 1: choose method ── */
                        <View style={styles.sigChooseContainer}>
                            <View style={styles.sigChooseTopSection}>
                                <Icon name="edit-3" size={52} color={C.primary} style={{ marginBottom: SPACING.md }} />
                                <Text style={styles.sigChooseTitle}>{t.engineerSignature}</Text>
                                <Text style={styles.sigChooseSub}>{'Elige cómo adjuntar la firma al reporte'}</Text>
                            </View>

                            {/* Draw */}
                            <TouchableOpacity
                                style={styles.sigOptionBtn}
                                onPress={() => setSignatureStep('draw')}
                            >
                                <View style={[styles.sigOptionIcon, { backgroundColor: C.primary + '20' }]}>
                                    <Icon name="edit-3" size={22} color={C.primary} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.sigOptionTitle}>{'Dibujar firma'}</Text>
                                    <Text style={styles.sigOptionSub}>{'Traza tu firma con el dedo en pantalla'}</Text>
                                </View>
                                <Icon name="chevron-right" size={18} color={C.textMuted} />
                            </TouchableOpacity>

                            {/* Gallery */}
                            <TouchableOpacity
                                style={styles.sigOptionBtn}
                                onPress={handlePickSignatureImage}
                            >
                                <View style={[styles.sigOptionIcon, { backgroundColor: C.primary + '20' }]}>
                                    <Icon name="image" size={22} color={C.primary} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.sigOptionTitle}>{t.loadSignatureFromGallery}</Text>
                                    <Text style={styles.sigOptionSub}>{'Selecciona una imagen de tu galería'}</Text>
                                </View>
                                <Icon name="chevron-right" size={18} color={C.textMuted} />
                            </TouchableOpacity>

                            {/* Without signature */}
                            <TouchableOpacity
                                style={[styles.sigOptionBtn, { borderColor: C.success + '50' }]}
                                onPress={() => handleSignatureOK('')}
                            >
                                <View style={[styles.sigOptionIcon, { backgroundColor: C.success + '20' }]}>
                                    <Icon name="file-text" size={22} color={C.success} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.sigOptionTitle, { color: C.success }]}>{t.generatePDFWithoutSignature}</Text>
                                    <Text style={styles.sigOptionSub}>{'El reporte se genera sin firma digital'}</Text>
                                </View>
                                <Icon name="chevron-right" size={18} color={C.textMuted} />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        /* ── Step 2: draw canvas (full screen) ── */
                        <View style={styles.signatureBox}>
                            <SignatureScreen
                                onOK={handleSignatureOK}
                                onEmpty={() => alert(t.emptySignatureError)}
                                descriptionText=""
                                clearText={t.delete ?? 'Limpiar'}
                                confirmText={'Guardar y Generar PDF'}
                                webStyle={`
                                    .m-signature-pad { box-shadow: none; border: none; }
                                    .m-signature-pad--body { border: 1px solid #e0e0e0; border-radius: 8px; margin: 8px; }
                                    .m-signature-pad--footer { background: #f8f8f8; padding: 8px; }
                                    .m-signature-pad--footer .button { background: #2563EB; color: white; border-radius: 8px; font-size: 15px; padding: 10px 20px; }
                                `}
                                backgroundColor="#FFFFFF"
                                penColor="#1A1A2E"
                            />
                        </View>
                    )}
                </View>
            </Modal>
        </ScrollView>
    );
}

function makeStyles(C: ThemeColors) {
    return StyleSheet.create({
        container: { flex: 1, backgroundColor: C.background },

        headerCard: {
            backgroundColor: C.surface,
            margin: SPACING.md,
            padding: SPACING.lg,
            borderRadius: RADIUS.lg,
            ...SHADOWS.md,
        },
        sectionTitle: {
            color: C.white,
            fontSize: FONTS.sizes.lg,
            fontWeight: 'bold',
            marginBottom: SPACING.md,
            textAlign: 'center'
        },
        dateSelector: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: C.surfaceLight,
            borderRadius: RADIUS.md,
            padding: SPACING.sm,
            marginBottom: SPACING.lg,
        },
        dateBtn: {
            padding: SPACING.sm,
            backgroundColor: C.surface,
            borderRadius: RADIUS.sm,
        },
        dateDisplay: {
            alignItems: 'center',
        },
        dateText: {
            color: C.white,
            fontSize: FONTS.sizes.lg,
            fontWeight: 'bold',
        },
        generateBtn: {
            backgroundColor: C.primary,
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
            color: C.white,
            fontSize: FONTS.sizes.md,
            fontWeight: 'bold',
            marginLeft: SPACING.sm,
        },

        historySection: {
            paddingHorizontal: SPACING.md,
            marginTop: SPACING.md,
        },
        historyTitle: {
            color: C.textSecondary,
            fontSize: FONTS.sizes.md,
            fontWeight: 'bold',
            marginBottom: SPACING.md,
        },
        historyCard: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: C.surface,
            padding: SPACING.md,
            borderRadius: RADIUS.md,
            marginBottom: SPACING.sm,
            ...SHADOWS.sm,
        },
        historyIconBox: {
            width: 40,
            height: 40,
            borderRadius: RADIUS.md,
            backgroundColor: C.primary + '20',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: SPACING.md,
        },
        historyInfo: {
            flex: 1,
        },
        historyDate: {
            color: C.white,
            fontSize: FONTS.sizes.md,
            fontWeight: 'bold',
        },
        historyStatus: {
            color: C.success,
            fontSize: FONTS.sizes.xs,
            marginTop: 2,
        },
        downloadIconBtn: {
            padding: SPACING.sm,
        },

        // Paywall Styles
        paywallContainer: {
            flex: 1,
            backgroundColor: C.background,
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
            backgroundColor: C.surface,
            padding: SPACING.xl,
            borderRadius: RADIUS.xl,
            alignItems: 'center',
            ...SHADOWS.lg,
            borderWidth: 1,
            borderColor: C.primary + '30',
        },
        iconCircle: {
            width: 100,
            height: 100,
            borderRadius: 50,
            backgroundColor: C.primary + '15',
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
            borderColor: C.surface,
        },
        proBadgeText: {
            color: C.white,
            fontSize: 10,
            fontWeight: 'bold',
        },
        paywallTitle: {
            color: C.white,
            fontSize: FONTS.sizes.xl,
            fontWeight: 'bold',
            textAlign: 'center',
            marginBottom: SPACING.md,
        },
        paywallDesc: {
            color: C.textMuted,
            fontSize: FONTS.sizes.md,
            textAlign: 'center',
            lineHeight: 24,
            marginBottom: SPACING.xl,
        },
        benefitsList: {
            width: '100%',
            marginBottom: SPACING.xl,
            backgroundColor: C.surfaceLight,
            padding: SPACING.lg,
            borderRadius: RADIUS.md,
        },
        benefitRow: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: SPACING.md,
        },
        benefitText: {
            color: C.white,
            fontSize: FONTS.sizes.sm,
            marginLeft: SPACING.sm,
            flex: 1,
        },
        upgradeBtn: {
            backgroundColor: C.primary,
            width: '100%',
            paddingVertical: SPACING.md,
            borderRadius: RADIUS.md,
            alignItems: 'center',
            ...SHADOWS.md,
        },
        upgradeBtnText: {
            color: C.white,
            fontSize: FONTS.sizes.md,
            fontWeight: 'bold',
        },

        // Signature Modal
        signatureModalContainer: {
            flex: 1,
            backgroundColor: C.background,
            paddingTop: 50,
        },
        signatureModalHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: SPACING.lg,
            paddingVertical: SPACING.md,
            backgroundColor: C.surface,
            borderBottomWidth: 1,
            borderBottomColor: C.border,
        },
        sigBackBtn: {
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: C.surfaceLight,
            alignItems: 'center', justifyContent: 'center',
        },
        signatureModalTitle: {
            color: C.white,
            fontSize: FONTS.sizes.lg,
            fontWeight: 'bold',
        },
        // Step 1 – method picker
        sigChooseContainer: {
            flex: 1,
            padding: SPACING.xl,
            justifyContent: 'center',
        },
        sigChooseTopSection: {
            alignItems: 'center',
            marginBottom: SPACING.xl,
        },
        sigChooseTitle: {
            color: C.white,
            fontSize: FONTS.sizes.xl,
            fontWeight: 'bold',
            marginBottom: SPACING.sm,
            textAlign: 'center',
        },
        sigChooseSub: {
            color: C.textMuted,
            fontSize: FONTS.sizes.sm,
            textAlign: 'center',
        },
        sigOptionBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: SPACING.md,
            backgroundColor: C.surface,
            borderRadius: RADIUS.lg,
            padding: SPACING.lg,
            marginBottom: SPACING.md,
            borderWidth: 1,
            borderColor: C.border,
        },
        sigOptionIcon: {
            width: 46, height: 46, borderRadius: 23,
            alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
        },
        sigOptionTitle: {
            color: C.white,
            fontSize: FONTS.sizes.md,
            fontWeight: '700',
            marginBottom: 2,
        },
        sigOptionSub: {
            color: C.textMuted,
            fontSize: FONTS.sizes.xs,
        },
        // Step 2 – canvas
        signatureBox: {
            flex: 1,
            margin: SPACING.md,
            borderRadius: RADIUS.md,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: C.border,
            backgroundColor: '#FFFFFF',
        },
        // Legacy (kept for safety)
        uploadImageBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: C.surfaceLight,
            padding: SPACING.md,
            borderRadius: RADIUS.md,
            margin: SPACING.lg,
            marginBottom: 0,
        },
        uploadImageText: {
            color: C.primary,
            fontSize: FONTS.sizes.md,
            fontWeight: 'bold',
        },
        // Project picker
        pickerLabel: {
            color: C.textSecondary,
            fontSize: FONTS.sizes.sm,
            marginBottom: 8,
            fontWeight: '600',
        },
        projectChip: {
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: RADIUS.md,
            backgroundColor: C.surfaceLight,
            borderWidth: 1,
            borderColor: C.border,
            maxWidth: 160,
        },
        projectChipActive: {
            backgroundColor: C.primary + '30',
            borderColor: C.primary,
        },
        projectChipText: {
            color: C.textSecondary,
            fontSize: FONTS.sizes.sm,
        },
        projectChipTextActive: {
            color: C.primary,
            fontWeight: 'bold',
        },

        exportRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: SPACING.md,
        },
        exportBtn: {
            flex: 1,
            flexDirection: 'row',
            backgroundColor: C.primary,
            padding: SPACING.md,
            borderRadius: RADIUS.md,
            alignItems: 'center',
            justifyContent: 'center',
            marginHorizontal: 4,
            ...SHADOWS.md,
        },
        exportBtnText: {
            color: C.white,
            fontSize: FONTS.sizes.md,
            fontWeight: 'bold',
            marginLeft: SPACING.sm,
        }
    });
}

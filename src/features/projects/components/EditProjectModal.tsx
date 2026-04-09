import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../../core/theme';
import Icon from '@expo/vector-icons/Feather';
import { useProjectStore, Project } from '../store/projectStore';
import { ProjectType, PROJECT_TYPE_ICONS, PROJECT_TYPE_LABELS } from '../../materials/data/standardMaterials';
import { useAppStore } from '../../../store/appStore';

interface EditProjectModalProps {
    visible: boolean;
    onClose: () => void;
    project: Project;
}

export default function EditProjectModal({ visible, onClose, project }: EditProjectModalProps) {
    const insets = useSafeAreaInsets();
    const { user } = useAppStore();
    const updateProject = useProjectStore(state => state.updateProject);

    const [nombre, setNombre] = useState(project.nombreProyecto);
    const [ubicacion, setUbicacion] = useState(project.ubicacion);
    const [fechaInicio, setFechaInicio] = useState(project.fechaInicio);
    const [fechaFin, setFechaFin] = useState(project.fechaFin || '');
    const [tipoProyecto, setTipoProyecto] = useState<ProjectType>(project.tipoProyecto);

    useEffect(() => {
        if (visible) {
            setNombre(project.nombreProyecto);
            setUbicacion(project.ubicacion);
            setFechaInicio(project.fechaInicio);
            setFechaFin(project.fechaFin || '');
            setTipoProyecto(project.tipoProyecto);
        }
    }, [visible, project]);

    const handleSave = () => {
        const companyId = user?.companyId || 'default-company';
        updateProject(project.id, project.version || 1, {
            nombreProyecto: nombre,
            ubicacion,
            fechaInicio,
            fechaFin: fechaFin.trim() === '' ? undefined : fechaFin,
            tipoProyecto
        }, companyId);
        onClose();
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.overlay}
            >
                <View style={[styles.content, { paddingBottom: Math.max(insets.bottom, SPACING.xl) }]}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Editar Proyecto</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Icon name="x" size={24} color={COLORS.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.scrollArea}>
                        <Text style={styles.label}>Nombre del Proyecto</Text>
                        <TextInput
                            style={styles.input}
                            value={nombre}
                            onChangeText={setNombre}
                            placeholderTextColor={COLORS.textMuted}
                        />

                        <Text style={styles.label}>Tipo de Obra</Text>
                        <View style={styles.typeGrid}>
                            {(Object.keys(PROJECT_TYPE_LABELS) as ProjectType[]).map((type) => (
                                <TouchableOpacity
                                    key={type}
                                    style={[styles.typeCard, tipoProyecto === type && styles.typeCardActive]}
                                    onPress={() => setTipoProyecto(type)}
                                >
                                    <Text style={styles.typeIcon}>{PROJECT_TYPE_ICONS[type]}</Text>
                                    <Text style={[styles.typeLabel, tipoProyecto === type && styles.typeLabelActive]}>
                                        {PROJECT_TYPE_LABELS[type]}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.label}>Ubicación</Text>
                        <TextInput
                            style={styles.input}
                            value={ubicacion}
                            onChangeText={setUbicacion}
                            placeholderTextColor={COLORS.textMuted}
                        />

                        <Text style={styles.label}>Fecha de Inicio (YYYY-MM-DD)</Text>
                        <TextInput
                            style={styles.input}
                            value={fechaInicio}
                            onChangeText={setFechaInicio}
                            placeholderTextColor={COLORS.textMuted}
                        />

                        <Text style={styles.label}>Fecha de Fin (Opcional)</Text>
                        <TextInput
                            style={styles.input}
                            value={fechaFin}
                            onChangeText={setFechaFin}
                            placeholder="YYYY-MM-DD"
                            placeholderTextColor={COLORS.textMuted}
                        />

                        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                            <Text style={styles.saveText}>Guardar Cambios</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
    content: { backgroundColor: COLORS.background, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, paddingTop: SPACING.xl, paddingHorizontal: SPACING.lg, maxHeight: '90%' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
    title: { color: COLORS.white, fontSize: FONTS.sizes.xl, fontWeight: 'bold' },
    closeBtn: { padding: 4 },
    scrollArea: { marginBottom: 20 },
    label: { color: COLORS.textSecondary, fontSize: 13, fontWeight: 'bold', marginBottom: 8, marginTop: SPACING.md },
    input: { backgroundColor: COLORS.surface, color: COLORS.white, paddingHorizontal: SPACING.md, height: 50, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },

    typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    typeCard: { width: '48%', backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.sm, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
    typeCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '20' },
    typeIcon: { fontSize: 24, marginBottom: 4 },
    typeLabel: { color: COLORS.textMuted, fontSize: 11, textAlign: 'center', fontWeight: '500' },
    typeLabelActive: { color: COLORS.white, fontWeight: 'bold' },

    saveBtn: { backgroundColor: COLORS.primary, height: 56, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', marginTop: SPACING.xl, ...SHADOWS.md },
    saveText: { color: COLORS.white, fontWeight: 'bold', fontSize: 16 }
});

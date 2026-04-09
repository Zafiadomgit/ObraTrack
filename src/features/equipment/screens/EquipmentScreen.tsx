import React, { useState } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, Modal,
    TextInput, ScrollView, Alert, Platform, Image
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useEquipmentStore, Equipment, EquipmentStatus, EquipmentCategory } from '../store/equipmentStore';
import { useAppStore } from '../../../store/appStore';
import Icon from '@expo/vector-icons/Feather';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../../core/theme';

const STATUS_COLORS: Record<EquipmentStatus, string> = {
    disponible: COLORS.success,
    en_uso: COLORS.primary,
    mantenimiento: '#f59e0b',
    dado_de_baja: COLORS.danger,
};
const STATUS_LABELS: Record<EquipmentStatus, string> = {
    disponible: 'Disponible',
    en_uso: 'En uso',
    mantenimiento: 'Mantenimiento',
    dado_de_baja: 'Dado de baja',
};
const CATEGORIES: EquipmentCategory[] = ['herramienta', 'maquinaria', 'vehiculo', 'electronico', 'seguridad', 'otro'];
const CAT_LABELS: Record<EquipmentCategory, string> = {
    herramienta: '🔧 Herramienta',
    maquinaria: '⚙️ Maquinaria',
    vehiculo: '🚗 Vehículo',
    electronico: '💻 Electrónico',
    seguridad: '🦺 Seguridad',
    otro: '📦 Otro',
};

export default function EquipmentScreen(props: any) {
    const insets = useSafeAreaInsets();
    const navRoute = useRoute<any>();
    const currentRoute = props.route?.params ? props.route : navRoute;
    const projectId = currentRoute?.params?.projectId || 'central';

    const currentUser = useAppStore(state => state.user);
    const allEquipment = useEquipmentStore(state => state.equipment);
    const { addEquipment, updateEquipment, deleteEquipment, updateStatus } = useEquipmentStore();

    const equipment = allEquipment.filter(e => e.projectId === projectId && e.userId === currentUser?.id);

    // Filter / search
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<EquipmentStatus | 'all'>('all');

    // Add Modal
    const [addModal, setAddModal] = useState(false);
    const [nombre, setNombre] = useState('');
    const [categoria, setCategoria] = useState<EquipmentCategory>('herramienta');
    const [serial, setSerial] = useState('');
    const [marca, setMarca] = useState('');
    const [modelo, setModelo] = useState('');
    const [notas, setNotas] = useState('');
    const [photoUri, setPhotoUri] = useState<string | undefined>(undefined);
    const [saving, setSaving] = useState(false);

    // Detail Modal
    const [detailItem, setDetailItem] = useState<Equipment | null>(null);
    const [editMode, setEditMode] = useState(false);

    const showAlert = (title: string, msg: string) => {
        if (Platform.OS === 'web') window.alert(`${title}: ${msg}`);
        else Alert.alert(title, msg);
    };

    const pickPhoto = async () => {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { showAlert('Permiso denegado', 'Se necesita acceso a la galería.'); return; }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true, aspect: [4, 3], quality: 0.7,
        });
        if (!result.canceled && result.assets?.[0]) setPhotoUri(result.assets[0].uri);
    };

    const takePhoto = async () => {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { showAlert('Permiso denegado', 'Se necesita acceso a la cámara.'); return; }
        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true, aspect: [4, 3], quality: 0.7,
        });
        if (!result.canceled && result.assets?.[0]) setPhotoUri(result.assets[0].uri);
    };

    const resetForm = () => {
        setNombre(''); setCategoria('herramienta'); setSerial(''); setMarca('');
        setModelo(''); setNotas(''); setPhotoUri(undefined);
    };

    const handleAdd = async () => {
        if (!nombre.trim()) { showAlert('Error', 'El nombre del equipo es obligatorio.'); return; }
        setSaving(true);
        try {
            await addEquipment({
                userId: currentUser!.id,
                projectId,
                nombre: nombre.trim(),
                categoria,
                serial: serial.trim() || undefined,
                marca: marca.trim() || undefined,
                modelo: modelo.trim() || undefined,
                notas: notas.trim() || undefined,
                photoUrl: photoUri,
                estado: 'disponible',
                fechaAdquisicion: new Date().toISOString().split('T')[0],
            }, currentUser!.companyId || 'default-company');
            resetForm();
            setAddModal(false);
        } catch (e) {
            showAlert('Error', 'No se pudo guardar el equipo.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (item: Equipment) => {
        const confirm = () => deleteEquipment(item.id, currentUser!.companyId || 'default-company');
        if (Platform.OS === 'web') {
            if (window.confirm(`¿Eliminar "${item.nombre}"?`)) confirm();
        } else {
            Alert.alert('Eliminar equipo', `¿Eliminar "${item.nombre}"?`, [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Eliminar', style: 'destructive', onPress: confirm },
            ]);
        }
        setDetailItem(null);
    };

    const filtered = equipment.filter(e => {
        const matchSearch = e.nombre.toLowerCase().includes(search.toLowerCase()) ||
            (e.serial && e.serial.toLowerCase().includes(search.toLowerCase()));
        const matchStatus = filterStatus === 'all' || e.estado === filterStatus;
        return matchSearch && matchStatus;
    });

    const renderEquipmentCard = ({ item }: { item: Equipment }) => (
        <TouchableOpacity style={styles.card} onPress={() => setDetailItem(item)}>
            {item.photoUrl ? (
                <Image source={{ uri: item.photoUrl }} style={styles.cardPhoto} />
            ) : (
                <View style={[styles.cardPhoto, styles.cardPhotoPlaceholder]}>
                    <Icon name="tool" size={28} color={COLORS.textMuted} />
                </View>
            )}
            <View style={styles.cardInfo}>
                <Text style={styles.cardName} numberOfLines={1}>{item.nombre}</Text>
                <Text style={styles.cardMeta}>{CAT_LABELS[item.categoria]}</Text>
                {item.serial && <Text style={styles.cardSerial}>Serial: {item.serial}</Text>}
                {item.marca && <Text style={styles.cardMeta}>{item.marca} {item.modelo}</Text>}
            </View>
            <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.estado] + '22' }]}>
                <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[item.estado] }]} />
                <Text style={[styles.statusText, { color: STATUS_COLORS[item.estado] }]}>
                    {STATUS_LABELS[item.estado]}
                </Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>Equipos</Text>
                    <Text style={styles.subtitle}>{equipment.length} equipos registrados</Text>
                </View>
                <TouchableOpacity style={styles.addBtn} onPress={() => { resetForm(); setAddModal(true); }}>
                    <Icon name="plus" size={22} color={COLORS.white} />
                </TouchableOpacity>
            </View>

            {/* Search + Filters */}
            <View style={styles.searchRow}>
                <View style={styles.searchBox}>
                    <Icon name="search" size={18} color={COLORS.textMuted} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Buscar por nombre o serial..."
                        placeholderTextColor={COLORS.textMuted}
                        value={search}
                        onChangeText={setSearch}
                    />
                </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ paddingHorizontal: SPACING.md, gap: 8 }}>
                {(['all', 'disponible', 'en_uso', 'mantenimiento', 'dado_de_baja'] as const).map(s => (
                    <TouchableOpacity
                        key={s}
                        style={[styles.filterChip, filterStatus === s && styles.filterChipActive]}
                        onPress={() => setFilterStatus(s)}
                    >
                        <Text style={[styles.filterChipText, filterStatus === s && styles.filterChipTextActive]}>
                            {s === 'all' ? 'Todos' : STATUS_LABELS[s]}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* List */}
            <FlatList
                data={filtered}
                keyExtractor={i => i.id}
                renderItem={renderEquipmentCard}
                contentContainerStyle={{ padding: SPACING.md, paddingBottom: 120 }}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Icon name="tool" size={40} color={COLORS.textMuted} />
                        <Text style={styles.emptyText}>Sin equipos registrados</Text>
                        <Text style={styles.emptyHint}>Toca + para agregar el primer equipo</Text>
                    </View>
                }
            />

            {/* ── Add Equipment Modal ──────────────────────────────────────────── */}
            <Modal visible={addModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalSheet}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Nuevo Equipo</Text>
                            <TouchableOpacity onPress={() => setAddModal(false)}>
                                <Icon name="x" size={24} color={COLORS.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Photo */}
                            <View style={{ flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.lg }}>
                                {photoUri ? (
                                    <View style={[styles.photoPicker, { flex: 1, marginBottom: 0, borderWidth: 0 }]}>
                                        <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                                        <TouchableOpacity style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', padding: 6, borderRadius: 20 }} onPress={() => setPhotoUri(undefined)}>
                                            <Icon name="x" size={16} color={COLORS.white} />
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <>
                                        <TouchableOpacity style={[styles.photoPicker, { flex: 1, marginBottom: 0 }]} onPress={pickPhoto}>
                                            <View style={styles.photoPickerInner}>
                                                <Icon name="image" size={28} color={COLORS.primary} />
                                                <Text style={styles.photoPickerText}>Galería</Text>
                                            </View>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[styles.photoPicker, { flex: 1, marginBottom: 0 }]} onPress={takePhoto}>
                                            <View style={styles.photoPickerInner}>
                                                <Icon name="camera" size={28} color={COLORS.primary} />
                                                <Text style={styles.photoPickerText}>Cámara</Text>
                                            </View>
                                        </TouchableOpacity>
                                    </>
                                )}
                            </View>

                            {/* Category chips */}
                            <Text style={styles.inputLabel}>Categoría</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.md }}>
                                {CATEGORIES.map(c => (
                                    <TouchableOpacity
                                        key={c}
                                        style={[styles.catChip, categoria === c && styles.catChipActive]}
                                        onPress={() => setCategoria(c)}
                                    >
                                        <Text style={[styles.catChipText, categoria === c && { color: COLORS.white }]}>
                                            {CAT_LABELS[c]}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            <Text style={styles.inputLabel}>Nombre del equipo *</Text>
                            <TextInput style={styles.input} placeholder="Ej: Taladro Percutor" placeholderTextColor={COLORS.textMuted} value={nombre} onChangeText={setNombre} />

                            <Text style={styles.inputLabel}>Serial (opcional)</Text>
                            <TextInput style={styles.input} placeholder="Ej: SN-2024-001" placeholderTextColor={COLORS.textMuted} value={serial} onChangeText={setSerial} />

                            <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Marca</Text>
                                    <TextInput style={styles.input} placeholder="Ej: Bosch" placeholderTextColor={COLORS.textMuted} value={marca} onChangeText={setMarca} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Modelo</Text>
                                    <TextInput style={styles.input} placeholder="Ej: GBH 2-26" placeholderTextColor={COLORS.textMuted} value={modelo} onChangeText={setModelo} />
                                </View>
                            </View>

                            <Text style={styles.inputLabel}>Notas (opcional)</Text>
                            <TextInput
                                style={[styles.input, { height: 80 }]}
                                placeholder="Observaciones del estado, ubicación, etc."
                                placeholderTextColor={COLORS.textMuted}
                                value={notas}
                                onChangeText={setNotas}
                                multiline
                            />

                            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleAdd} disabled={saving}>
                                <Icon name="save" size={20} color={COLORS.white} />
                                <Text style={styles.saveBtnText}>{saving ? 'Guardando...' : 'Guardar Equipo'}</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* ── Equipment Detail Modal ───────────────────────────────────────── */}
            <Modal visible={!!detailItem} animationType="slide" transparent onRequestClose={() => setDetailItem(null)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalSheet}>
                        {detailItem && (
                            <>
                                <View style={styles.modalHeader}>
                                    <Text style={styles.modalTitle} numberOfLines={1}>{detailItem.nombre}</Text>
                                    <TouchableOpacity onPress={() => setDetailItem(null)}>
                                        <Icon name="x" size={24} color={COLORS.textSecondary} />
                                    </TouchableOpacity>
                                </View>
                                <ScrollView showsVerticalScrollIndicator={false}>
                                    {detailItem.photoUrl && (
                                        <Image source={{ uri: detailItem.photoUrl }} style={styles.detailPhoto} />
                                    )}

                                    {/* Status Selector */}
                                    <Text style={styles.inputLabel}>Estado</Text>
                                    <View style={styles.statusRow}>
                                        {(Object.keys(STATUS_LABELS) as EquipmentStatus[]).map(s => (
                                            <TouchableOpacity
                                                key={s}
                                                style={[styles.statusChip, detailItem.estado === s && { backgroundColor: STATUS_COLORS[s], borderColor: STATUS_COLORS[s] }]}
                                                onPress={async () => {
                                                    await updateStatus(detailItem.id, currentUser!.companyId || 'default-company', s);
                                                    setDetailItem({ ...detailItem, estado: s });
                                                }}
                                            >
                                                <Text style={[styles.statusChipText, detailItem.estado === s && { color: COLORS.white }]}>
                                                    {STATUS_LABELS[s]}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    {/* Info rows */}
                                    <View style={styles.infoGrid}>
                                        <InfoRow icon="tag" label="Categoría" value={CAT_LABELS[detailItem.categoria]} />
                                        {detailItem.serial && <InfoRow icon="hash" label="Serial" value={detailItem.serial} />}
                                        {detailItem.marca && <InfoRow icon="briefcase" label="Marca / Modelo" value={`${detailItem.marca} ${detailItem.modelo || ''}`.trim()} />}
                                        {detailItem.fechaAdquisicion && <InfoRow icon="calendar" label="Fecha adquisición" value={detailItem.fechaAdquisicion} />}
                                        {detailItem.notas && <InfoRow icon="file-text" label="Notas" value={detailItem.notas} />}
                                    </View>

                                    <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(detailItem)}>
                                        <Icon name="trash-2" size={18} color={COLORS.danger} />
                                        <Text style={styles.deleteBtnText}>Eliminar equipo</Text>
                                    </TouchableOpacity>
                                </ScrollView>
                            </>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
    return (
        <View style={styles.infoRow}>
            <Icon name={icon as any} size={16} color={COLORS.primary} style={{ marginRight: SPACING.sm }} />
            <View>
                <Text style={styles.infoLabel}>{label}</Text>
                <Text style={styles.infoValue}>{value}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },

    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.lg, paddingBottom: SPACING.sm },
    title: { color: COLORS.white, fontSize: FONTS.sizes.xl, fontWeight: '900' },
    subtitle: { color: COLORS.textMuted, fontSize: FONTS.sizes.sm },
    addBtn: { width: 48, height: 48, borderRadius: RADIUS.round, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', ...SHADOWS.md },

    searchRow: { paddingHorizontal: SPACING.md, marginBottom: SPACING.sm },
    searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, borderWidth: 1, borderColor: COLORS.border, height: 44, gap: 8 },
    searchInput: { flex: 1, color: COLORS.white, fontSize: FONTS.sizes.md },
    filterRow: { maxHeight: 44, marginBottom: SPACING.sm },
    filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
    filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    filterChipText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
    filterChipTextActive: { color: COLORS.white },

    // Card
    card: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.md, marginBottom: SPACING.md, overflow: 'hidden', ...SHADOWS.sm },
    cardPhoto: { width: 80, height: 80 },
    cardPhotoPlaceholder: { backgroundColor: COLORS.surfaceLight, alignItems: 'center', justifyContent: 'center' },
    cardInfo: { flex: 1, padding: SPACING.md },
    cardName: { color: COLORS.white, fontSize: FONTS.sizes.md, fontWeight: 'bold', marginBottom: 2 },
    cardMeta: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm },
    cardSerial: { color: COLORS.primary, fontSize: 11, marginTop: 2 },

    statusBadge: { flexDirection: 'row', alignItems: 'center', margin: SPACING.md, paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.sm, gap: 5 },
    statusDot: { width: 7, height: 7, borderRadius: 4 },
    statusText: { fontSize: 11, fontWeight: '700' },

    empty: { alignItems: 'center', paddingVertical: 60 },
    emptyText: { color: COLORS.textMuted, fontSize: FONTS.sizes.md, marginTop: SPACING.md },
    emptyHint: { color: COLORS.textMuted, fontSize: FONTS.sizes.sm, marginTop: 4 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalSheet: { backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.lg, maxHeight: '90%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
    modalTitle: { color: COLORS.white, fontSize: FONTS.sizes.lg, fontWeight: 'bold', flex: 1 },

    photoPicker: { height: 140, backgroundColor: COLORS.surfaceLight, borderRadius: RADIUS.md, marginBottom: SPACING.lg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border, borderStyle: 'dashed' },
    photoPickerInner: { alignItems: 'center', gap: 8 },
    photoPickerText: { color: COLORS.primary, fontSize: FONTS.sizes.sm },
    photoPreview: { width: '100%', height: '100%', resizeMode: 'cover' },

    inputLabel: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm, fontWeight: '600', marginBottom: 4, marginTop: SPACING.sm },
    input: { backgroundColor: COLORS.surfaceLight, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, color: COLORS.white, paddingHorizontal: SPACING.md, paddingVertical: 12, fontSize: FONTS.sizes.md, marginBottom: 4 },

    catChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.surfaceLight, borderWidth: 1, borderColor: COLORS.border, marginRight: 8 },
    catChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    catChipText: { color: COLORS.textSecondary, fontSize: 12 },

    saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, padding: SPACING.md, borderRadius: RADIUS.md, marginTop: SPACING.lg, gap: 8, ...SHADOWS.md },
    saveBtnText: { color: COLORS.white, fontWeight: 'bold', fontSize: FONTS.sizes.md },

    // Detail
    detailPhoto: { width: '100%', height: 200, borderRadius: RADIUS.md, marginBottom: SPACING.lg, resizeMode: 'cover' },
    statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: SPACING.lg },
    statusChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.surfaceLight, borderWidth: 1, borderColor: COLORS.border },
    statusChipText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },

    infoGrid: { backgroundColor: COLORS.surfaceLight, borderRadius: RADIUS.md, overflow: 'hidden', marginBottom: SPACING.lg },
    infoRow: { flexDirection: 'row', alignItems: 'flex-start', padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    infoLabel: { color: COLORS.textMuted, fontSize: 11, marginBottom: 2 },
    infoValue: { color: COLORS.white, fontSize: FONTS.sizes.md },

    deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.danger, gap: 8, marginBottom: SPACING.xxl },
    deleteBtnText: { color: COLORS.danger, fontWeight: 'bold' },
});

import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMaterialStore } from '../../materials/store/materialStore';
import Icon from '@expo/vector-icons/Feather';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../../core/theme';

export default function SuppliersScreen() {
    const insets = useSafeAreaInsets();
    const { suppliers, addSupplier, deleteSupplier } = useMaterialStore();
    const [modalVisible, setModalVisible] = useState(false);
    const [newSupplier, setNewSupplier] = useState('');

    const handleAdd = () => {
        if (!newSupplier.trim()) return;
        addSupplier(newSupplier.trim());
        setNewSupplier('');
        setModalVisible(false);
    };

    const handleDelete = (name: string) => {
        Alert.alert(
            'Eliminar Proveedor',
            `¿Estás seguro de eliminar a "${name}"?`,
            [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Eliminar', style: 'destructive', onPress: () => deleteSupplier(name) }
            ]
        );
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <Text style={styles.title}>Mis Proveedores</Text>
                <Text style={styles.subtitle}>Gestiona tus contactos globales de suministros</Text>
            </View>

            <FlatList
                data={suppliers}
                keyExtractor={item => item}
                contentContainerStyle={styles.list}
                renderItem={({ item }) => (
                    <View style={styles.card}>
                        <View style={styles.cardLeft}>
                            <View style={styles.iconBox}>
                                <Icon name="truck" size={20} color={COLORS.primary} />
                            </View>
                            <Text style={styles.supplierName}>{item}</Text>
                        </View>
                        <TouchableOpacity onPress={() => handleDelete(item)}>
                            <Icon name="trash-2" size={18} color={COLORS.danger} />
                        </TouchableOpacity>
                    </View>
                )}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Icon name="users" size={48} color={COLORS.textMuted} />
                        <Text style={styles.emptyText}>No tienes proveedores registrados</Text>
                    </View>
                }
            />

            <TouchableOpacity
                style={[styles.fab, { bottom: 20 + insets.bottom }]}
                onPress={() => setModalVisible(true)}
            >
                <Icon name="plus" size={24} color={COLORS.white} />
            </TouchableOpacity>

            <Modal visible={modalVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Nuevo Proveedor</Text>
                        <TextInput
                            style={styles.input}
                            value={newSupplier}
                            onChangeText={setNewSupplier}
                            placeholder="Nombre de la empresa"
                            placeholderTextColor={COLORS.textMuted}
                            autoFocus
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                                <Text style={styles.cancelText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.confirmBtn} onPress={handleAdd}>
                                <Text style={styles.confirmText}>Guardar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: { padding: SPACING.xl, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    title: { color: COLORS.white, fontSize: 24, fontWeight: 'bold' },
    subtitle: { color: COLORS.textMuted, fontSize: 14, marginTop: 4 },
    list: { padding: SPACING.md },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.surface,
        padding: SPACING.md,
        borderRadius: RADIUS.md,
        marginBottom: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.sm
    },
    cardLeft: { flexDirection: 'row', alignItems: 'center' },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.primary + '15',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: SPACING.md
    },
    supplierName: { color: COLORS.white, fontSize: 16, fontWeight: '600' },
    fab: {
        position: 'absolute',
        right: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        ...SHADOWS.lg
    },
    empty: { alignItems: 'center', marginTop: 100 },
    emptyText: { color: COLORS.textMuted, marginTop: SPACING.md, fontSize: 16 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: SPACING.xl },
    modalContent: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.xl },
    modalTitle: { color: COLORS.white, fontSize: 20, fontWeight: 'bold', marginBottom: SPACING.lg },
    input: { backgroundColor: COLORS.surfaceLight, color: COLORS.white, padding: SPACING.md, borderRadius: RADIUS.md, fontSize: 16, marginBottom: SPACING.xl },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end' },
    cancelBtn: { padding: SPACING.md, marginRight: SPACING.sm },
    cancelText: { color: COLORS.textMuted, fontWeight: 'bold' },
    confirmBtn: { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderRadius: RADIUS.md },
    confirmText: { color: COLORS.white, fontWeight: 'bold' }
});

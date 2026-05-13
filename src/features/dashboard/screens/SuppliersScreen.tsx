import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMaterialStore, Supplier } from '../../materials/store/materialStore';
import { useAppStore } from '../../../store/appStore';
import Icon from '@expo/vector-icons/Feather';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../../core/theme';

export default function SuppliersScreen() {
    const insets = useSafeAreaInsets();
    const { user } = useAppStore();
    const { suppliers, loadSuppliers, addSupplier, updateSupplier, deleteSupplier } = useMaterialStore();

    const [modalVisible, setModalVisible] = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

    const [newName, setNewName] = useState('');
    const [editName, setEditName] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [editNotes, setEditNotes] = useState('');

    const companyId = user?.companyId || '';

    useEffect(() => {
        if (companyId) loadSuppliers(companyId);
    }, [companyId]);

    const handleAdd = async () => {
        if (!newName.trim()) return;
        await addSupplier(newName.trim(), companyId);
        setNewName('');
        setModalVisible(false);
    };

    const handleOpenEdit = (supplier: Supplier) => {
        setSelectedSupplier(supplier);
        setEditName(supplier.name);
        setEditPhone(supplier.phone || '');
        setEditEmail(supplier.email || '');
        setEditNotes(supplier.notes || '');
        setEditModalVisible(true);
    };

    const handleSaveEdit = async () => {
        if (!selectedSupplier || !editName.trim()) return;
        await updateSupplier(selectedSupplier.id, {
            name: editName.trim(),
            phone: editPhone.trim(),
            email: editEmail.trim(),
            notes: editNotes.trim(),
        }, companyId);
        setEditModalVisible(false);
        setSelectedSupplier(null);
    };

    const handleDelete = (supplier: Supplier) => {
        Alert.alert(
            'Eliminar Proveedor',
            `¿Estás seguro de eliminar a "${supplier.name}"?`,
            [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Eliminar', style: 'destructive', onPress: () => deleteSupplier(supplier.id, companyId) }
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
                keyExtractor={item => item.id}
                contentContainerStyle={[styles.list, { paddingBottom: 90 + insets.bottom }]}
                renderItem={({ item }) => (
                    <View style={styles.card}>
                        <View style={styles.cardLeft}>
                            <View style={styles.iconBox}>
                                <Icon name="truck" size={20} color={COLORS.primary} />
                            </View>
                            <View>
                                <Text style={styles.supplierName}>{item.name}</Text>
                                {item.phone ? <Text style={styles.supplierDetail}>{item.phone}</Text> : null}
                                {item.email ? <Text style={styles.supplierDetail}>{item.email}</Text> : null}
                            </View>
                        </View>
                        <View style={styles.cardActions}>
                            <TouchableOpacity style={styles.editBtn} onPress={() => handleOpenEdit(item)}>
                                <Icon name="edit-2" size={16} color={COLORS.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
                                <Icon name="trash-2" size={16} color={COLORS.danger} />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Icon name="users" size={48} color={COLORS.textMuted} />
                        <Text style={styles.emptyText}>No tienes proveedores registrados</Text>
                    </View>
                }
            />

            {/* FAB */}
            <TouchableOpacity
                style={[styles.fab, { bottom: 70 + insets.bottom }]}
                onPress={() => setModalVisible(true)}
            >
                <Icon name="plus" size={24} color={COLORS.white} />
            </TouchableOpacity>

            {/* Modal: Nuevo Proveedor */}
            <Modal visible={modalVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Nuevo Proveedor</Text>
                        <TextInput
                            style={styles.input}
                            value={newName}
                            onChangeText={setNewName}
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

            {/* Modal: Editar Proveedor */}
            <Modal visible={editModalVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Editar Proveedor</Text>
                        <TextInput style={styles.input} value={editName} onChangeText={setEditName} placeholder="Nombre *" placeholderTextColor={COLORS.textMuted} />
                        <TextInput style={styles.input} value={editPhone} onChangeText={setEditPhone} placeholder="Teléfono" placeholderTextColor={COLORS.textMuted} keyboardType="phone-pad" />
                        <TextInput style={styles.input} value={editEmail} onChangeText={setEditEmail} placeholder="Correo electrónico" placeholderTextColor={COLORS.textMuted} keyboardType="email-address" autoCapitalize="none" />
                        <TextInput style={[styles.input, { height: 80 }]} value={editNotes} onChangeText={setEditNotes} placeholder="Notas adicionales" placeholderTextColor={COLORS.textMuted} multiline />
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditModalVisible(false)}>
                                <Text style={styles.cancelText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.confirmBtn} onPress={handleSaveEdit}>
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
    cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    cardActions: { flexDirection: 'row', gap: 8 },
    iconBox: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: COLORS.primary + '15',
        alignItems: 'center', justifyContent: 'center',
        marginRight: SPACING.md
    },
    supplierName: { color: COLORS.white, fontSize: 16, fontWeight: '600' },
    supplierDetail: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
    editBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary + '20', alignItems: 'center', justifyContent: 'center' },
    deleteBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.danger + '20', alignItems: 'center', justifyContent: 'center' },
    fab: {
        position: 'absolute', right: 20,
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: COLORS.primary,
        alignItems: 'center', justifyContent: 'center',
        ...SHADOWS.lg
    },
    empty: { alignItems: 'center', marginTop: 100 },
    emptyText: { color: COLORS.textMuted, marginTop: SPACING.md, fontSize: 16 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: SPACING.xl },
    modalContent: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.xl },
    modalTitle: { color: COLORS.white, fontSize: 20, fontWeight: 'bold', marginBottom: SPACING.lg },
    input: { backgroundColor: COLORS.surfaceLight, color: COLORS.white, padding: SPACING.md, borderRadius: RADIUS.md, fontSize: 16, marginBottom: SPACING.md },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: SPACING.sm },
    cancelBtn: { padding: SPACING.md, marginRight: SPACING.sm },
    cancelText: { color: COLORS.textMuted, fontWeight: 'bold' },
    confirmBtn: { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderRadius: RADIUS.md },
    confirmText: { color: COLORS.white, fontWeight: 'bold' }
});

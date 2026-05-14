import React, { useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    TextInput, Modal, Alert, ScrollView, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Icon from '@expo/vector-icons/Feather';
import { FONTS, SPACING, RADIUS, SHADOWS } from '../../../core/theme';
import { useColors, ThemeColors } from '../../../core/theme/ThemeContext';
import { useT } from '../../../core/i18n';
import { useAppStore } from '../../../store/appStore';
import { useSupplierStore, Supplier, Invoice, InvoiceStatus } from '../store/supplierStore';

// ─── Constants ────────────────────────────────────────────────────────────────

const SUP_CATEGORIES = [
    'General', 'Cemento', 'Acero', 'Eléctrico',
    'Hidrosanitario', 'Acabados', 'Herramientas', 'Maquinaria', 'Servicios',
];

const STATUS_COLORS: Record<InvoiceStatus, string> = {
    pendiente: '#F59E0B',
    pagada: '#10B981',
    vencida: '#EF4444',
};


const ICON_PALETTE = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const parseDate = (str: string): number | null => {
    const parts = str.split('/');
    if (parts.length !== 3) return null;
    const d = parseInt(parts[0]), m = parseInt(parts[1]) - 1, y = parseInt(parts[2]);
    if (isNaN(d) || isNaN(m) || isNaN(y) || y < 2000) return null;
    const ts = new Date(y, m, d).getTime();
    return isNaN(ts) ? null : ts;
};

const fmtDate = (ts: number): string => {
    const d = new Date(ts);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

const iconColor = (name: string): string =>
    ICON_PALETTE[name.charCodeAt(0) % ICON_PALETTE.length];

const resolveStatus = (inv: Invoice): InvoiceStatus => {
    if (inv.estado === 'pagada') return 'pagada';
    if (inv.fechaVencimiento && inv.fechaVencimiento < Date.now() && inv.estado === 'pendiente')
        return 'vencida';
    return inv.estado;
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SuppliersScreen() {
    const insets = useSafeAreaInsets();
    const C = useColors();
    const t = useT();
    const styles = React.useMemo(() => makeStyles(C), [C]);
    const STATUS_LABELS = React.useMemo<Record<InvoiceStatus, string>>(() => ({
        pendiente: t.invoicePendingLabel,
        pagada: t.invoicePaidLabel,
        vencida: t.invoiceOverdueLabel,
    }), [t]);
    const currentUser = useAppStore(s => s.user);
    const companyId = currentUser?.companyId || 'default-company';

    const {
        suppliers, invoices, loading, loadAll,
        addSupplier, updateSupplier, deleteSupplier,
        addInvoice, updateInvoice, deleteInvoice,
    } = useSupplierStore();

    // Load on screen focus
    useFocusEffect(useCallback(() => { loadAll(companyId); }, [companyId]));

    // ── Tabs ────────────────────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState<'suppliers' | 'invoices'>('suppliers');
    const [invoiceFilter, setInvoiceFilter] = useState<'all' | InvoiceStatus>('all');

    // ── Detail view ─────────────────────────────────────────────────────────
    const [detailSupplier, setDetailSupplier] = useState<Supplier | null>(null);

    // ── Supplier form ────────────────────────────────────────────────────────
    const [showSupModal, setShowSupModal] = useState(false);
    const [editSup, setEditSup] = useState<Supplier | null>(null);
    const [supNombre, setSupNombre] = useState('');
    const [supCategoria, setSupCategoria] = useState('General');
    const [supContacto, setSupContacto] = useState('');
    const [supTelefono, setSupTelefono] = useState('');
    const [supEmail, setSupEmail] = useState('');
    const [supNotas, setSupNotas] = useState('');

    // ── Invoice form ─────────────────────────────────────────────────────────
    const [showInvModal, setShowInvModal] = useState(false);
    const [editInv, setEditInv] = useState<Invoice | null>(null);
    const [invSupplierId, setInvSupplierId] = useState('');
    const [invNumero, setInvNumero] = useState('');
    const [invFecha, setInvFecha] = useState('');
    const [invVence, setInvVence] = useState('');
    const [invMonto, setInvMonto] = useState('');
    const [invDescripcion, setInvDescripcion] = useState('');
    const [invProyecto, setInvProyecto] = useState('');
    const [invEstado, setInvEstado] = useState<InvoiceStatus>('pendiente');
    const [invNota, setInvNota] = useState('');

    // ── Supplier handlers ────────────────────────────────────────────────────

    const openAddSupplier = () => {
        setEditSup(null);
        setSupNombre(''); setSupCategoria('General');
        setSupContacto(''); setSupTelefono(''); setSupEmail(''); setSupNotas('');
        setShowSupModal(true);
    };

    const openEditSupplier = (s: Supplier) => {
        setEditSup(s);
        setSupNombre(s.nombre); setSupCategoria(s.categoria);
        setSupContacto(s.contacto || ''); setSupTelefono(s.telefono || '');
        setSupEmail(s.email || ''); setSupNotas(s.notas || '');
        setShowSupModal(true);
    };

    const handleSaveSupplier = async () => {
        if (!supNombre.trim()) { Alert.alert(t.error, t.supplierNameRequired); return; }
        // Build data without undefined — Firestore rejects undefined field values
        const data: Omit<Supplier, 'id' | 'createdAt'> = {
            companyId,
            nombre: supNombre.trim(),
            categoria: supCategoria,
        };
        if (supContacto.trim()) data.contacto = supContacto.trim();
        if (supTelefono.trim()) data.telefono = supTelefono.trim();
        if (supEmail.trim()) data.email = supEmail.trim();
        if (supNotas.trim()) data.notas = supNotas.trim();
        try {
            if (editSup) {
                await updateSupplier(editSup.id, data, companyId);
            } else {
                await addSupplier(data, companyId);
            }
            setShowSupModal(false);
        } catch (err) {
            console.error('handleSaveSupplier error:', err);
            Alert.alert(t.error, t.supplierSaveError);
        }
    };

    const handleDeleteSupplier = (s: Supplier) => {
        const invCount = invoices.filter(inv => inv.supplierId === s.id).length;
        Alert.alert(
            t.deleteSupplierTitle,
            t.deleteSupplierConfirm(s.nombre),
            [
                { text: t.cancel, style: 'cancel' },
                {
                    text: t.delete, style: 'destructive',
                    onPress: async () => {
                        await deleteSupplier(s.id, companyId);
                        if (detailSupplier?.id === s.id) setDetailSupplier(null);
                    }
                }
            ]
        );
    };

    // ── Invoice handlers ─────────────────────────────────────────────────────

    const openAddInvoice = (presetSupplierId?: string) => {
        // If there are no suppliers yet, open the supplier modal instead
        if (suppliers.length === 0 && !presetSupplierId) {
            openAddSupplier();
            return;
        }
        setEditInv(null);
        setInvSupplierId(presetSupplierId || suppliers[0]?.id || '');
        setInvNumero(''); setInvFecha(fmtDate(Date.now())); setInvVence('');
        setInvMonto(''); setInvDescripcion(''); setInvProyecto('');
        setInvEstado('pendiente'); setInvNota('');
        setShowInvModal(true);
    };

    const openEditInvoice = (inv: Invoice) => {
        setEditInv(inv);
        setInvSupplierId(inv.supplierId);
        setInvNumero(inv.numero);
        setInvFecha(fmtDate(inv.fecha));
        setInvVence(inv.fechaVencimiento ? fmtDate(inv.fechaVencimiento) : '');
        setInvMonto(inv.monto.toString());
        setInvDescripcion(inv.descripcion || '');
        setInvProyecto(inv.proyecto || '');
        setInvEstado(inv.estado);
        setInvNota(inv.notas || '');
        setShowInvModal(true);
    };

    const handleSaveInvoice = async () => {
        if (!invNumero.trim()) { Alert.alert(t.error, t.invoiceNumberRequired); return; }
        const fecha = parseDate(invFecha);
        if (!fecha) { Alert.alert(t.error, t.invalidDateFormat); return; }
        const monto = parseFloat(invMonto.replace(',', '.'));
        if (isNaN(monto) || monto < 0) { Alert.alert(t.error, t.invalidAmount); return; }
        if (!invSupplierId) { Alert.alert(t.error, t.supplierRequired); return; }

        try {
            const supplierName = suppliers.find(s => s.id === invSupplierId)?.nombre || '';
            // Build data without undefined — Firestore rejects undefined field values
            const data: Omit<Invoice, 'id' | 'createdAt'> = {
                supplierId: invSupplierId, supplierName, companyId,
                numero: invNumero.trim(), fecha, monto, estado: invEstado,
            };
            const fechaVencimiento = invVence.trim() ? parseDate(invVence) : null;
            if (fechaVencimiento) data.fechaVencimiento = fechaVencimiento;
            if (invDescripcion.trim()) data.descripcion = invDescripcion.trim();
            if (invProyecto.trim()) data.proyecto = invProyecto.trim();
            if (invNota.trim()) data.notas = invNota.trim();

            if (editInv) {
                await updateInvoice(editInv.id, data, companyId);
            } else {
                await addInvoice(data, companyId);
            }
            setShowInvModal(false);
        } catch (err) {
            console.error('handleSaveInvoice error:', err);
            Alert.alert(t.error, t.invoiceSaveError);
        }
    };

    const handleDeleteInvoice = (inv: Invoice) => {
        Alert.alert(t.deleteInvoiceTitle, `¿Eliminar la factura "${inv.numero}"?`, [
            { text: t.cancel, style: 'cancel' },
            {
                text: t.delete, style: 'destructive',
                onPress: () => deleteInvoice(inv.id, companyId),
            }
        ]);
    };

    // ── Computed values ──────────────────────────────────────────────────────

    const totalPending = invoices.reduce((sum, inv) =>
        sum + (resolveStatus(inv) !== 'pagada' ? inv.monto : 0), 0);
    const pendingCount = invoices.filter(inv => resolveStatus(inv) !== 'pagada').length;

    const filteredInvoices = invoices
        .filter(inv => invoiceFilter === 'all' || resolveStatus(inv) === invoiceFilter)
        .sort((a, b) => b.fecha - a.fecha);

    // ── Modals (defined before early return so they're available in both views)

    const renderSupplierModal = () => (
        <Modal visible={showSupModal} transparent animationType="slide">
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>{editSup ? t.editSupplier : t.newSupplier}</Text>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>{t.supplierNameLabel}</Text>
                            <TextInput style={styles.input} value={supNombre} onChangeText={setSupNombre}
                                placeholder="Ej. Cemex S.A." placeholderTextColor={C.textMuted} autoFocus />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>{t.supplierCategoryLabel}</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                                {SUP_CATEGORIES.map(cat => (
                                    <TouchableOpacity key={cat}
                                        style={[styles.chip, supCategoria === cat && styles.chipActive]}
                                        onPress={() => setSupCategoria(cat)}>
                                        <Text style={[styles.chipText, supCategoria === cat && styles.chipTextActive]}>{cat}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>{t.contactPersonLabel}</Text>
                            <TextInput style={styles.input} value={supContacto} onChangeText={setSupContacto}
                                placeholder="Nombre del contacto" placeholderTextColor={C.textMuted} />
                        </View>

                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <View style={[styles.inputGroup, { flex: 1 }]}>
                                <Text style={styles.inputLabel}>{t.supplierPhone}</Text>
                                <TextInput style={styles.input} value={supTelefono} onChangeText={setSupTelefono}
                                    placeholder="+57 300..." keyboardType="phone-pad" placeholderTextColor={C.textMuted} />
                            </View>
                            <View style={[styles.inputGroup, { flex: 1 }]}>
                                <Text style={styles.inputLabel}>{t.supplierEmail}</Text>
                                <TextInput style={styles.input} value={supEmail} onChangeText={setSupEmail}
                                    placeholder="correo@empresa.com" keyboardType="email-address" placeholderTextColor={C.textMuted} />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>{t.supplierNotes}</Text>
                            <TextInput style={[styles.input, { height: 72, textAlignVertical: 'top' }]}
                                value={supNotas} onChangeText={setSupNotas}
                                placeholder="Observaciones, condiciones de pago..." placeholderTextColor={C.textMuted} multiline />
                        </View>
                    </ScrollView>

                    <View style={styles.modalActions}>
                        <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowSupModal(false)}>
                            <Text style={styles.cancelText}>{t.cancel}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.confirmBtn} onPress={handleSaveSupplier}>
                            <Text style={styles.confirmText}>{editSup ? t.save : t.addLabel}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );

    const renderInvoiceModal = () => (
        <Modal visible={showInvModal} transparent animationType="slide">
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>{editInv ? t.editInvoice : t.newInvoice}</Text>
                    <ScrollView showsVerticalScrollIndicator={false}>

                        {/* Supplier picker — hidden when inside a detail view */}
                        {!detailSupplier && (
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>{t.selectSupplier}</Text>
                                {suppliers.length === 0 ? (
                                    <Text style={[styles.inputLabel, { color: C.danger }]}>{t.firstCreateSupplier}</Text>
                                ) : (
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                                        {suppliers.map(s => (
                                            <TouchableOpacity key={s.id}
                                                style={[styles.chip, invSupplierId === s.id && styles.chipActive]}
                                                onPress={() => setInvSupplierId(s.id)}>
                                                <Text style={[styles.chipText, invSupplierId === s.id && styles.chipTextActive]}>{s.nombre}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                )}
                            </View>
                        )}

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>{t.invoiceNumber}</Text>
                            <TextInput style={styles.input} value={invNumero} onChangeText={setInvNumero}
                                placeholder="FAC-001" placeholderTextColor={C.textMuted} autoFocus />
                        </View>

                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <View style={[styles.inputGroup, { flex: 1 }]}>
                                <Text style={styles.inputLabel}>{t.invoiceDateLabel}</Text>
                                <TextInput style={styles.input} value={invFecha} onChangeText={setInvFecha}
                                    placeholder="DD/MM/YYYY" placeholderTextColor={C.textMuted} keyboardType="numeric" />
                            </View>
                            <View style={[styles.inputGroup, { flex: 1 }]}>
                                <Text style={styles.inputLabel}>{t.invoiceDueDateLabel}</Text>
                                <TextInput style={styles.input} value={invVence} onChangeText={setInvVence}
                                    placeholder="DD/MM/YYYY" placeholderTextColor={C.textMuted} keyboardType="numeric" />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>{t.invoiceAmountLabel}</Text>
                            <TextInput style={styles.input} value={invMonto} onChangeText={setInvMonto}
                                placeholder="0.00" keyboardType="numeric" placeholderTextColor={C.textMuted} />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>{t.invoiceStatusLabel}</Text>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                {(['pendiente', 'pagada', 'vencida'] as InvoiceStatus[]).map(st => (
                                    <TouchableOpacity key={st}
                                        style={[styles.statusBtn,
                                        invEstado === st && { backgroundColor: STATUS_COLORS[st] + '25', borderColor: STATUS_COLORS[st] }]}
                                        onPress={() => setInvEstado(st)}>
                                        <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[st] }]} />
                                        <Text style={[styles.chipText, invEstado === st && { color: STATUS_COLORS[st], fontWeight: 'bold' }]}>
                                            {STATUS_LABELS[st]}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>{t.invoiceDescriptionLabel}</Text>
                            <TextInput style={styles.input} value={invDescripcion} onChangeText={setInvDescripcion}
                                placeholder="Materiales suministrados..." placeholderTextColor={C.textMuted} />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>{t.invoiceProjectLabel}</Text>
                            <TextInput style={styles.input} value={invProyecto} onChangeText={setInvProyecto}
                                placeholder="Nombre del proyecto" placeholderTextColor={C.textMuted} />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>{t.internalNotesLabel}</Text>
                            <TextInput style={[styles.input, { height: 64, textAlignVertical: 'top' }]}
                                value={invNota} onChangeText={setInvNota}
                                placeholder="Observaciones..." placeholderTextColor={C.textMuted} multiline />
                        </View>

                    </ScrollView>

                    <View style={styles.modalActions}>
                        <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowInvModal(false)}>
                            <Text style={styles.cancelText}>{t.cancel}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.confirmBtn} onPress={handleSaveInvoice}>
                            <Text style={styles.confirmText}>{editInv ? t.save : t.registerLabel}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );

    // ── Invoice card render ───────────────────────────────────────────────────

    const renderInvoiceCard = (inv: Invoice, showSupplierName = false) => {
        const status = resolveStatus(inv);
        return (
            <View key={inv.id} style={styles.invoiceCard}>
                <View style={[styles.statusBar, { backgroundColor: STATUS_COLORS[status] }]} />
                <View style={{ flex: 1, padding: SPACING.md }}>
                    <View style={styles.invTopRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.invNumber}>{inv.numero}</Text>
                            {showSupplierName && (
                                <Text style={styles.invSupplierName}>{inv.supplierName}</Text>
                            )}
                        </View>
                        <Text style={styles.invAmount}>${inv.monto.toLocaleString()}</Text>
                    </View>

                    <View style={styles.invMidRow}>
                        <Icon name="calendar" size={12} color={C.textMuted} />
                        <Text style={styles.invDate}>
                            {fmtDate(inv.fecha)}
                            {inv.fechaVencimiento ? `  ·  ${t.dueDatePrefix}: ${fmtDate(inv.fechaVencimiento)}` : ''}
                        </Text>
                    </View>

                    {inv.descripcion ? (
                        <Text style={styles.invDesc} numberOfLines={1}>{inv.descripcion}</Text>
                    ) : null}

                    {inv.proyecto ? (
                        <View style={styles.invProjectRow}>
                            <Icon name="briefcase" size={11} color={C.textMuted} />
                            <Text style={styles.invProjectText}>{inv.proyecto}</Text>
                        </View>
                    ) : null}

                    <View style={styles.invBottomRow}>
                        <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[status] + '22' }]}>
                            <Text style={[styles.statusBadgeText, { color: STATUS_COLORS[status] }]}>
                                {STATUS_LABELS[status]}
                            </Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                            <TouchableOpacity onPress={() => openEditInvoice(inv)}>
                                <Icon name="edit-2" size={15} color={C.textMuted} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDeleteInvoice(inv)}>
                                <Icon name="trash-2" size={15} color={C.danger} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>
        );
    };

    // ── DETAIL VIEW ───────────────────────────────────────────────────────────

    if (detailSupplier) {
        const sup = suppliers.find(s => s.id === detailSupplier.id) || detailSupplier;
        const supInvoices = invoices.filter(inv => inv.supplierId === sup.id).sort((a, b) => b.fecha - a.fecha);
        const supPending = supInvoices.reduce((sum, inv) => sum + (resolveStatus(inv) !== 'pagada' ? inv.monto : 0), 0);
        const supPaid = supInvoices.reduce((sum, inv) => sum + (inv.estado === 'pagada' ? inv.monto : 0), 0);
        const supOverdue = supInvoices.filter(inv => resolveStatus(inv) === 'vencida').length;
        const color = iconColor(sup.nombre);

        return (
            <View style={[styles.container, { paddingTop: insets.top }]}>
                {/* Header */}
                <View style={styles.detailHeader}>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => setDetailSupplier(null)}>
                        <Icon name="arrow-left" size={20} color={C.white} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.detailTitle} numberOfLines={1}>{sup.nombre}</Text>
                        <Text style={styles.detailSubtitle}>{sup.categoria}</Text>
                    </View>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => openEditSupplier(sup)}>
                        <Icon name="edit-2" size={18} color={C.white} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.iconBtn, { backgroundColor: C.danger + '25' }]} onPress={() => handleDeleteSupplier(sup)}>
                        <Icon name="trash-2" size={18} color={C.danger} />
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 40 }}>

                    {/* Contact info card */}
                    <View style={styles.contactCard}>
                        <View style={[styles.supCircle, { backgroundColor: color }]}>
                            <Text style={styles.supInitial}>{sup.nombre[0]?.toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1, gap: 5 }}>
                            {sup.contacto ? (
                                <View style={styles.infoRow}>
                                    <Icon name="user" size={13} color={C.textMuted} />
                                    <Text style={styles.infoText}>{sup.contacto}</Text>
                                </View>
                            ) : null}
                            {sup.telefono ? (
                                <View style={styles.infoRow}>
                                    <Icon name="phone" size={13} color={C.textMuted} />
                                    <Text style={styles.infoText}>{sup.telefono}</Text>
                                </View>
                            ) : null}
                            {sup.email ? (
                                <View style={styles.infoRow}>
                                    <Icon name="mail" size={13} color={C.textMuted} />
                                    <Text style={styles.infoText}>{sup.email}</Text>
                                </View>
                            ) : null}
                            {sup.notas ? (
                                <View style={styles.infoRow}>
                                    <Icon name="file-text" size={13} color={C.textMuted} />
                                    <Text style={styles.infoText} numberOfLines={2}>{sup.notas}</Text>
                                </View>
                            ) : null}
                            {!sup.contacto && !sup.telefono && !sup.email && !sup.notas && (
                                <Text style={[styles.infoText, { fontStyle: 'italic' }]}>{t.noContactInfo}</Text>
                            )}
                        </View>
                    </View>

                    {/* Stats */}
                    <View style={styles.statsRow}>
                        <View style={styles.statBox}>
                            <Text style={styles.statValue}>{supInvoices.length}</Text>
                            <Text style={styles.statLabel}>{t.totalInvoicesLabel}</Text>
                        </View>
                        <View style={styles.statBox}>
                            <Text style={[styles.statValue, { color: '#F59E0B' }]}>${supPending.toLocaleString()}</Text>
                            <Text style={styles.statLabel}>{t.pendingAmountLabel}</Text>
                        </View>
                        <View style={styles.statBox}>
                            <Text style={[styles.statValue, { color: '#10B981' }]}>${supPaid.toLocaleString()}</Text>
                            <Text style={styles.statLabel}>{t.paidAmountLabel}</Text>
                        </View>
                        {supOverdue > 0 && (
                            <View style={styles.statBox}>
                                <Text style={[styles.statValue, { color: '#EF4444' }]}>{supOverdue}</Text>
                                <Text style={styles.statLabel}>{t.overdueCountLabel}</Text>
                            </View>
                        )}
                    </View>

                    {/* Invoices list */}
                    <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionTitle}>{t.invoicesTitle}</Text>
                        <TouchableOpacity style={styles.addInvBtn} onPress={() => openAddInvoice(sup.id)}>
                            <Icon name="plus" size={15} color="#fff" />
                            <Text style={styles.addInvBtnText}>{t.newInvoice}</Text>
                        </TouchableOpacity>
                    </View>

                    {supInvoices.length === 0 ? (
                        <View style={styles.emptyInv}>
                            <Icon name="file-text" size={36} color={C.textMuted} />
                            <Text style={styles.emptyInvText}>{t.noInvoicesForSupplier}</Text>
                            <Text style={styles.emptyInvSub}>{t.tapNewInvoice}</Text>
                        </View>
                    ) : (
                        supInvoices.map(inv => renderInvoiceCard(inv, false))
                    )}
                </ScrollView>

                {renderSupplierModal()}
                {renderInvoiceModal()}
            </View>
        );
    }

    // ── MAIN VIEW ─────────────────────────────────────────────────────────────

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>

            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>{t.suppliersTitle}</Text>
                    <Text style={styles.subtitle}>
                        {t.supplierSubtitle(suppliers.length, pendingCount, totalPending.toLocaleString())}
                    </Text>
                </View>
            </View>

            {/* Tabs */}
            <View style={styles.tabsContainer}>
                <TouchableOpacity
                    style={[styles.tabBtn, activeTab === 'suppliers' && styles.tabBtnActive]}
                    onPress={() => setActiveTab('suppliers')}>
                    <Icon name="users" size={15} color={activeTab === 'suppliers' ? C.white : C.textMuted} style={{ marginRight: 5 }} />
                    <Text style={[styles.tabText, activeTab === 'suppliers' && styles.tabTextActive]}>{t.supplierTab}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tabBtn, activeTab === 'invoices' && styles.tabBtnActive]}
                    onPress={() => setActiveTab('invoices')}>
                    <Icon name="file-text" size={15} color={activeTab === 'invoices' ? C.white : C.textMuted} style={{ marginRight: 5 }} />
                    <Text style={[styles.tabText, activeTab === 'invoices' && styles.tabTextActive]}>{t.invoicesTab}</Text>
                    {pendingCount > 0 && (
                        <View style={styles.tabBadge}>
                            <Text style={styles.tabBadgeText}>{pendingCount}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator color={C.primary} size="large" />
                </View>

            ) : activeTab === 'suppliers' ? (
                // ── SUPPLIERS LIST ─────────────────────────────────────────────
                <FlatList
                    data={suppliers}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.list}
                    renderItem={({ item }) => {
                        const supInvs = invoices.filter(inv => inv.supplierId === item.id);
                        const pending = supInvs.reduce((sum, inv) => sum + (resolveStatus(inv) !== 'pagada' ? inv.monto : 0), 0);
                        const pendInvCount = supInvs.filter(inv => resolveStatus(inv) !== 'pagada').length;
                        const color = iconColor(item.nombre);
                        return (
                            <TouchableOpacity
                                style={styles.supplierCard}
                                onPress={() => setDetailSupplier(item)}
                                activeOpacity={0.82}>
                                <View style={[styles.supCircle, { backgroundColor: color }]}>
                                    <Text style={styles.supInitial}>{item.nombre[0]?.toUpperCase()}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <View style={styles.supplierNameRow}>
                                        <Text style={styles.supplierName}>{item.nombre}</Text>
                                        <View style={[styles.catBadge, { backgroundColor: color + '25' }]}>
                                            <Text style={[styles.catBadgeText, { color }]}>{item.categoria}</Text>
                                        </View>
                                    </View>
                                    {(item.telefono || item.email) ? (
                                        <Text style={styles.supplierContact} numberOfLines={1}>
                                            {item.telefono ? `📞 ${item.telefono}` : ''}
                                            {item.telefono && item.email ? '   ' : ''}
                                            {item.email ? `✉ ${item.email}` : ''}
                                        </Text>
                                    ) : null}
                                    {pending > 0 ? (
                                        <Text style={styles.pendingText}>
                                            {t.supplierPendingBalance(pendInvCount, pending.toLocaleString())}
                                        </Text>
                                    ) : supInvs.length > 0 ? (
                                        <Text style={styles.paidText}>{t.supplierUpToDate(supInvs.length)}</Text>
                                    ) : (
                                        <Text style={styles.noInvText}>{t.noInvoices}</Text>
                                    )}
                                </View>
                                <Icon name="chevron-right" size={18} color={C.textMuted} />
                            </TouchableOpacity>
                        );
                    }}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Icon name="users" size={48} color={C.textMuted} />
                            <Text style={styles.emptyText}>{t.noSuppliersRegistered}</Text>
                            <Text style={styles.emptySubText}>{t.addFirstSupplier}</Text>
                        </View>
                    }
                />

            ) : (
                // ── INVOICES LIST ──────────────────────────────────────────────
                <View style={{ flex: 1 }}>
                    {/* Summary row */}
                    <View style={styles.invSummaryRow}>
                        <View style={styles.invSumBox}>
                            <Text style={[styles.invSumValue, { color: '#F59E0B' }]}>${totalPending.toLocaleString()}</Text>
                            <Text style={styles.invSumLabel}>{t.pendingAmountLabel}</Text>
                        </View>
                        <View style={styles.invSumBox}>
                            <Text style={[styles.invSumValue, { color: '#EF4444' }]}>
                                {invoices.filter(inv => resolveStatus(inv) === 'vencida').length}
                            </Text>
                            <Text style={styles.invSumLabel}>{t.overdueCountLabel}</Text>
                        </View>
                        <View style={styles.invSumBox}>
                            <Text style={[styles.invSumValue, { color: '#10B981' }]}>
                                {invoices.filter(inv => inv.estado === 'pagada').length}
                            </Text>
                            <Text style={styles.invSumLabel}>{t.paidCountLabel}</Text>
                        </View>
                    </View>

                    {/* Filter chips */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}
                        style={{ paddingVertical: SPACING.sm }}
                        contentContainerStyle={{ paddingHorizontal: SPACING.md, gap: 8 }}>
                        {(['all', 'pendiente', 'pagada', 'vencida'] as const).map(f => (
                            <TouchableOpacity key={f}
                                style={[styles.filterChip, invoiceFilter === f && styles.filterChipActive,
                                f !== 'all' && invoiceFilter !== f && { borderColor: STATUS_COLORS[f as InvoiceStatus] + '55' }]}
                                onPress={() => setInvoiceFilter(f)}>
                                {f !== 'all' && (
                                    <View style={[styles.filterDot,
                                    { backgroundColor: invoiceFilter === f ? '#fff' : STATUS_COLORS[f as InvoiceStatus] }]} />
                                )}
                                <Text style={[styles.filterChipText, invoiceFilter === f && styles.filterChipTextActive]}>
                                    {f === 'all' ? t.allInvoicesFilter : STATUS_LABELS[f as InvoiceStatus]}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    <FlatList
                        data={filteredInvoices}
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.list}
                        renderItem={({ item }) => renderInvoiceCard(item, true)}
                        ListEmptyComponent={
                            <View style={styles.empty}>
                                <Icon name="file-text" size={48} color={C.textMuted} />
                                <Text style={styles.emptyText}>
                                    {invoiceFilter === 'all' ? t.noInvoicesRegistered : t.noInvoicesForFilter(STATUS_LABELS[invoiceFilter as InvoiceStatus] ?? '')}
                                </Text>
                            </View>
                        }
                    />
                </View>
            )}

            {/* FAB */}
            <TouchableOpacity
                style={[styles.fab, { bottom: 20 + insets.bottom }]}
                onPress={() => activeTab === 'suppliers' ? openAddSupplier() : openAddInvoice()}>
                <Icon name="plus" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            {renderSupplierModal()}
            {renderInvoiceModal()}
        </View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (C: ThemeColors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },

    // Header
    header: {
        padding: SPACING.xl,
        backgroundColor: C.surface,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
    },
    title: { color: C.white, fontSize: 24, fontWeight: 'bold' },
    subtitle: { color: C.textMuted, fontSize: 13, marginTop: 4 },

    // Tabs
    tabsContainer: {
        flexDirection: 'row',
        backgroundColor: C.surface,
        padding: SPACING.xs,
        margin: SPACING.md,
        borderRadius: RADIUS.md,
    },
    tabBtn: {
        flex: 1, flexDirection: 'row',
        paddingVertical: SPACING.sm,
        alignItems: 'center', justifyContent: 'center',
        borderRadius: RADIUS.sm,
    },
    tabBtnActive: { backgroundColor: C.primary },
    tabText: { color: C.textMuted, fontSize: FONTS.sizes.sm, fontWeight: 'bold' },
    tabTextActive: { color: C.white },
    tabBadge: {
        backgroundColor: C.danger, borderRadius: 8,
        minWidth: 16, height: 16,
        alignItems: 'center', justifyContent: 'center',
        marginLeft: 5, paddingHorizontal: 3,
    },
    tabBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

    // List
    list: { padding: SPACING.md, paddingBottom: 100 },

    // Supplier card
    supplierCard: {
        backgroundColor: C.surface,
        borderRadius: RADIUS.md,
        padding: SPACING.md,
        marginBottom: SPACING.sm,
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.md,
        borderWidth: 1,
        borderColor: C.border,
        ...SHADOWS.sm,
    },
    supCircle: {
        width: 46, height: 46, borderRadius: 23,
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    supInitial: { color: '#FFFFFF', fontSize: 19, fontWeight: 'bold' },
    supplierNameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 2 },
    supplierName: { color: C.white, fontSize: 15, fontWeight: '700' },
    catBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
    catBadgeText: { fontSize: 11, fontWeight: '600' },
    supplierContact: { color: C.textMuted, fontSize: 12, marginTop: 1 },
    pendingText: { color: '#F59E0B', fontSize: 12, marginTop: 3, fontWeight: '600' },
    paidText: { color: '#10B981', fontSize: 12, marginTop: 3, fontWeight: '600' },
    noInvText: { color: C.textMuted, fontSize: 12, marginTop: 3 },

    // Invoice card
    invoiceCard: {
        backgroundColor: C.surface,
        borderRadius: RADIUS.md,
        marginBottom: SPACING.sm,
        borderWidth: 1,
        borderColor: C.border,
        flexDirection: 'row',
        overflow: 'hidden',
        ...SHADOWS.sm,
    },
    statusBar: { width: 4 },
    invTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
    invNumber: { color: C.white, fontWeight: 'bold', fontSize: FONTS.sizes.md },
    invAmount: { color: C.white, fontWeight: 'bold', fontSize: FONTS.sizes.md },
    invSupplierName: { color: C.primary, fontSize: 12, fontWeight: '600', marginTop: 1 },
    invMidRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 },
    invDate: { color: C.textMuted, fontSize: 11 },
    invDesc: { color: C.textSecondary, fontSize: 11, marginBottom: 3 },
    invProjectRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
    invProjectText: { color: C.textMuted, fontSize: 11 },
    invBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    statusBadgeText: { fontSize: 11, fontWeight: 'bold' },

    // Invoice summary row (in Facturas tab)
    invSummaryRow: {
        flexDirection: 'row',
        paddingHorizontal: SPACING.md,
        gap: SPACING.sm,
        marginBottom: SPACING.sm,
    },
    invSumBox: {
        flex: 1, backgroundColor: C.surface,
        borderRadius: RADIUS.md, padding: SPACING.md,
        alignItems: 'center', borderWidth: 1, borderColor: C.border,
    },
    invSumValue: { color: C.white, fontSize: 18, fontWeight: 'bold' },
    invSumLabel: { color: C.textMuted, fontSize: 11, marginTop: 2 },

    // Filters
    filterChip: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 12, paddingVertical: 6,
        borderRadius: 20, backgroundColor: C.surfaceLight,
        borderWidth: 1, borderColor: C.border,
    },
    filterChipActive: { backgroundColor: C.primary, borderColor: C.primary },
    filterChipText: { color: C.textSecondary, fontSize: 12, fontWeight: '600' },
    filterChipTextActive: { color: C.white },
    filterDot: { width: 7, height: 7, borderRadius: 3.5, marginRight: 5 },

    // Detail view
    detailHeader: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
        backgroundColor: C.surface,
        borderBottomWidth: 1, borderBottomColor: C.border,
        gap: SPACING.sm,
    },
    iconBtn: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: C.surfaceLight,
        alignItems: 'center', justifyContent: 'center',
    },
    detailTitle: { color: C.white, fontSize: FONTS.sizes.lg, fontWeight: 'bold' },
    detailSubtitle: { color: C.textMuted, fontSize: FONTS.sizes.xs, marginTop: 1 },

    contactCard: {
        backgroundColor: C.surface,
        borderRadius: RADIUS.lg,
        padding: SPACING.lg,
        flexDirection: 'row',
        gap: SPACING.md,
        borderWidth: 1, borderColor: C.border,
        marginBottom: SPACING.md,
        alignItems: 'flex-start',
    },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    infoText: { color: C.textSecondary, fontSize: 13 },

    statsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
    statBox: {
        flex: 1, backgroundColor: C.surface,
        borderRadius: RADIUS.md, padding: SPACING.md,
        alignItems: 'center', borderWidth: 1, borderColor: C.border,
    },
    statValue: { color: C.white, fontSize: 18, fontWeight: 'bold' },
    statLabel: { color: C.textMuted, fontSize: 11, marginTop: 2 },

    sectionHeaderRow: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: SPACING.md,
    },
    sectionTitle: { color: C.white, fontSize: FONTS.sizes.lg, fontWeight: 'bold' },
    addInvBtn: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: C.primary,
        paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
        borderRadius: RADIUS.md, gap: 4,
    },
    addInvBtnText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },

    emptyInv: { alignItems: 'center', padding: SPACING.xxl },
    emptyInvText: { color: C.textMuted, fontSize: 15, marginTop: SPACING.md, fontWeight: '600' },
    emptyInvSub: { color: C.textMuted, fontSize: 12, marginTop: 4 },

    // Empty state
    empty: { alignItems: 'center', marginTop: 80 },
    emptyText: { color: C.textMuted, marginTop: SPACING.md, fontSize: 16 },
    emptySubText: { color: C.textMuted, fontSize: 13, marginTop: 4 },

    // FAB
    fab: {
        position: 'absolute', right: 20,
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: C.primary,
        alignItems: 'center', justifyContent: 'center',
        ...SHADOWS.lg,
    },

    // Modal
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.72)',
        justifyContent: 'center', padding: SPACING.lg,
    },
    modalContent: {
        backgroundColor: C.surface,
        borderRadius: RADIUS.lg,
        padding: SPACING.xl,
        maxHeight: '90%',
    },
    modalTitle: { color: C.white, fontSize: 20, fontWeight: 'bold', marginBottom: SPACING.lg },
    inputGroup: { marginBottom: SPACING.md },
    inputLabel: { color: C.textSecondary, fontSize: 13, marginBottom: 6 },
    input: {
        backgroundColor: C.surfaceLight, color: C.white,
        padding: SPACING.md, borderRadius: RADIUS.md, fontSize: 15,
    },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: SPACING.md },
    cancelBtn: { padding: SPACING.md, marginRight: SPACING.sm },
    cancelText: { color: C.textMuted, fontWeight: 'bold' },
    confirmBtn: {
        backgroundColor: C.primary,
        paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md,
        borderRadius: RADIUS.md,
    },
    confirmText: { color: '#FFFFFF', fontWeight: 'bold' },

    // Choice chips
    chip: {
        paddingHorizontal: 14, paddingVertical: 7,
        borderRadius: RADIUS.md, backgroundColor: C.surfaceLight,
        borderWidth: 1, borderColor: C.border,
    },
    chipActive: { backgroundColor: C.primary + '30', borderColor: C.primary },
    chipText: { color: C.textSecondary, fontSize: 13 },
    chipTextActive: { color: C.primary, fontWeight: 'bold' },

    // Status buttons in invoice form
    statusBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 9, borderRadius: RADIUS.md,
        backgroundColor: C.surfaceLight, borderWidth: 1, borderColor: C.border,
        gap: 5,
    },
    statusDot: { width: 7, height: 7, borderRadius: 3.5 },

});

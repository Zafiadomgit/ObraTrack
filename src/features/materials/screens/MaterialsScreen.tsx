import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, ScrollView, Alert } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMaterialStore, Material } from '../store/materialStore';
import { useAppStore } from '../../../store/appStore';
import { useProjectStore } from '../../projects/store/projectStore';
import Icon from '@expo/vector-icons/Feather';
import GlobalFAB from '../../../components/GlobalFAB';
import { FONTS, SPACING, RADIUS, SHADOWS } from '../../../core/theme';
import { useColors, ThemeColors } from '../../../core/theme/ThemeContext';
import { useT } from '../../../core/i18n';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ExportService } from '../../../core/services/exportService';

export default function MaterialsScreen(props: any) {
    const insets = useSafeAreaInsets();
    const C = useColors();
    const t = useT();
    const styles = React.useMemo(() => makeStyles(C), [C]);
    const navRoute = useRoute<any>();

    // WebDashboard passing props directly vs Stack.Screen context using navRoute
    const currentRoute = props.route?.params ? props.route : navRoute;
    const projectId = currentRoute?.params?.projectId || 'central';
    const isGlobal = projectId === 'central';
    const currentUser = useAppStore(state => state.user);
    const allMaterials = useMaterialStore(state => state.materials);
    const projects = useProjectStore(state => state.projects);
    const { deleteMaterial, enviarAObra, confirmarLlegada, restoreCentralCatalog } = useMaterialStore();

    // Tabs: Stock / En Obra
    const [activeTab, setActiveTab] = useState<'stock' | 'obra'>('stock');

    // Transaction Modal
    const [modalVisible, setModalVisible] = useState(false);
    const [activeMaterial, setActiveMaterial] = useState<Material | null>(null);
    const [transactionType, setTransactionType] = useState<'in' | 'out' | 'send' | 'confirm'>('in');
    const [amount, setAmount] = useState('');
    const [transactionNote, setTransactionNote] = useState('');
    const [targetProjectId, setTargetProjectId] = useState('');
    const [confirmAmount, setConfirmAmount] = useState('');

    // History Modal
    const [historyModal, setHistoryModal] = useState(false);
    const [historyMaterial, setHistoryMaterial] = useState<Material | null>(null);

    const [addModalVisible, setAddModalVisible] = useState(false);
    const [newNombre, setNewNombre] = useState('');
    const [newUnidad, setNewUnidad] = useState('unidad');
    const [newAlerta, setNewAlerta] = useState('');
    const [newCategoria, setNewCategoria] = useState('General');
    const [newCosto, setNewCosto] = useState('');
    const [newStandardQty, setNewStandardQty] = useState('');
    const [newProveedor, setNewProveedor] = useState('');

    // Filters
    const [filter, setFilter] = useState<'all' | 'low' | 'category' | 'supplier'>('all');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);

    // Multi-select
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const isSelecting = selectedIds.size > 0;

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleBulkDelete = () => {
        Alert.alert(
            'Eliminar materiales',
            `¿Eliminar ${selectedIds.size} material(es) permanentemente? Se perderá todo su historial.`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: () => {
                        const companyId = currentUser?.companyId || 'default-company';
                        selectedIds.forEach(id => deleteMaterial(id, companyId));
                        setSelectedIds(new Set());
                    }
                }
            ]
        );
    };

    const categories = ['Obra Gris', 'Acero', 'Eléctrico', 'Hidrosanitario', 'Acabados', 'Herramientas', 'General'];
    const units = ['unidad', 'Bultos', 'kg', 'm3', 'ml', 'galón', 'rollo', 'lámina', 'varilla'];
    const suppliers = useMaterialStore(state => state.suppliers);

    const materials = allMaterials.filter(m => {
        if (m.projectId !== projectId) return false;
        if (currentUser?.role !== 'admin' && m.userId !== currentUser?.id) return false;
        if (filter === 'low') {
            const isLow = activeTab === 'stock' ? (m.stock <= m.minimoAlerta) : (m.cantidadActual < m.stockMinimoObra);
            return isLow;
        }
        if (filter === 'category' && selectedCategory) return m.categoria === selectedCategory;
        if (filter === 'supplier' && selectedSupplier) return m.proveedor === selectedSupplier;
        return true;
    });

    const openTransaction = (material: Material, type: 'in' | 'out' | 'send' | 'confirm') => {
        setActiveMaterial(material);
        setTransactionType(type);
        setAmount(type === 'confirm' ? (material.enviado > 0 ? material.enviado.toString() : '') : '');
        setConfirmAmount(type === 'confirm' ? material.enviado.toString() : '');
        setTransactionNote('');
        setTargetProjectId('');
        setModalVisible(true);
    };

    const handleTransaction = () => {
        if (!activeMaterial || !amount) {
            Alert.alert('Error', 'Debe ingresar una cantidad');
            return;
        }

        const value = parseFloat(amount.replace(',', '.'));
        if (isNaN(value) || value <= 0) {
            Alert.alert('Error', 'Cantidad inválida');
            return;
        }

        const store = useMaterialStore.getState();

        const companyId = currentUser?.companyId || 'default-company';
        try {
            if (transactionType === 'in') {
                store.registerMaterialEntry(activeMaterial.id, activeMaterial.version || 1, value, companyId, transactionNote);
                Alert.alert('Éxito', `Entrada de ${value} ${activeMaterial.unidad} registrada en Bodega`);
            } else if (transactionType === 'out') {
                if (activeTab === 'stock') {
                    // Direct exit from warehouse
                    if (activeMaterial.stock < value) {
                        Alert.alert('Stock insuficiente', `Solo hay ${activeMaterial.stock} disponibles en Bodega.`);
                        return;
                    }
                    store.updateMaterial(activeMaterial.id, activeMaterial.version || 1, {
                        stock: activeMaterial.stock - value,
                        historialTransacciones: [...(activeMaterial.historialTransacciones || []), { tipo: 'salida', cantidad: value, fecha: Date.now(), nota: `Salida de Bodega: ${transactionNote}` }]
                    }, companyId);
                    Alert.alert('Éxito', `Salida de ${value} ${activeMaterial.unidad} registrada de Bodega`);
                } else {
                    // Exit from site (obra)
                    if (activeMaterial.cantidadActual < value) {
                        Alert.alert('Stock insuficiente en Obra', `Solo hay ${activeMaterial.cantidadActual} disponibles en sitio. ¿Has confirmado la llegada de materiales sentados?`);
                        return;
                    }
                    store.registerMaterialExit(activeMaterial.id, activeMaterial.version || 1, value, companyId, transactionNote);
                    const updated = store.materials.find(m => m.id === activeMaterial.id);
                    Alert.alert(
                        'Uso Registrado',
                        `Se descontaron ${value} ${activeMaterial.unidad}.\nQuedan ${updated?.cantidadActual} en sitio.\nTotal usado histórico: ${updated?.totalUsado}`
                    );
                }
            } else if (transactionType === 'send') {
                if (!amount) { Alert.alert('Error', 'Debe ingresar una cantidad'); return; }
                const val = parseFloat(amount.replace(',', '.'));
                if (isNaN(val) || val <= 0) { Alert.alert('Error', 'Cantidad inválida'); return; }
                if (activeMaterial.stock < val) {
                    Alert.alert('Stock insuficiente', `No puedes enviar ${val}, solo hay ${activeMaterial.stock} en Bodega.`);
                    return;
                }
                if (!targetProjectId) {
                    Alert.alert('Error', 'Selecciona un proyecto destino');
                    return;
                }
                enviarAObra(activeMaterial.id, activeMaterial.version || 1, val, targetProjectId, companyId, transactionNote);
                Alert.alert('Éxito', `Despacho de ${val} ${activeMaterial.unidad} iniciado`);
            } else if (transactionType === 'confirm') {
                if (!confirmAmount) { Alert.alert('Error', 'Debe ingresar una cantidad recibida'); return; }
                const finalVal = parseFloat(confirmAmount.replace(',', '.'));
                if (isNaN(finalVal) || finalVal <= 0) {
                    Alert.alert('Error', 'Cantidad recibida inválida');
                    return;
                }
                if (activeMaterial.enviado < finalVal) {
                    Alert.alert('Cantidad excedida', `Solo hay ${activeMaterial.enviado} pendientes por llegar.`);
                    return;
                }
                confirmarLlegada(activeMaterial.id, activeMaterial.version || 1, finalVal, companyId, transactionNote);
                Alert.alert('Éxito', `Se han recibido ${finalVal} ${activeMaterial.unidad}`);
            }
            setModalVisible(false);
            setAmount('');
            setConfirmAmount('');
            setTransactionNote('');
            setTargetProjectId('');
        } catch (error) {
            Alert.alert('Error', 'No se pudo procesar la transacción');
            console.error(error);
        }
    };

    const handleCreateMaterial = () => {
        if (!newNombre.trim() || !newUnidad.trim()) return;
        const companyId = currentUser?.companyId || 'default-company';

        useMaterialStore.getState().addMaterial({
            projectId,
            companyId: currentUser?.companyId || 'default-company',
            userId: currentUser?.id || 'unknown',
            nombre: newNombre,
            unidad: newUnidad,
            categoria: newCategoria,
            costoUnitario: Number(newCosto) || 0,
            minimoAlerta: Number(newAlerta) || 0,
            stockMinimoObra: Number(newStandardQty) || 0,
            proveedor: newProveedor || undefined,
        }, companyId);

        setAddModalVisible(false);
        setNewNombre(''); setNewUnidad('unidad');
        setNewAlerta(''); setNewCategoria('General');
        setNewCosto(''); setNewStandardQty(''); setNewProveedor('');
    };

    const handleExport = async () => {
        if (!currentUser) return;
        const exportData = materials.map(m => ({
            'Material': m.nombre,
            'Categoría': m.categoria || 'General',
            'Stock Central': m.stock,
            'Stock Obra': m.cantidadActual,
            'En Tránsito': m.enviado || 0,
            'Total Usado': m.totalUsado || 0,
            'Unidad': m.unidad,
            'Costo Unitario': m.costoUnitario || 0,
            'Proveedor': m.proveedor || 'N/A'
        }));
        await ExportService.exportToExcel(
            currentUser.companyId || 'default-company',
            currentUser.id,
            exportData,
            `Inventario_${projectId === 'central' ? 'Bodega' : 'Obra'}_${format(new Date(), 'yyyyMMdd')}`,
            'Inventario'
        );
    };

    const getTransactionColor = (tipo: string) => {
        switch (tipo) {
            case 'entrada': return C.success;
            case 'salida': return C.danger;
            case 'envio': return C.primary;
            case 'confirmacion': return '#F39C12';
            default: return C.textMuted;
        }
    };

    const getTransactionIcon = (tipo: string) => {
        switch (tipo) {
            case 'entrada': return 'arrow-down-left';
            case 'salida': return 'arrow-up-right';
            case 'envio': return 'truck';
            case 'confirmacion': return 'check-circle';
            default: return 'activity';
        }
    };

    const getTransactionLabel = (tipo: string) => {
        switch (tipo) {
            case 'entrada': return 'Entrada Bodega';
            case 'salida': return 'Uso/Salida Obra';
            case 'envio': return 'Despacho a Obra';
            case 'confirmacion': return 'Llegada Confirmada';
            default: return tipo;
        }
    };

    const renderMaterial = ({ item }: { item: Material }) => {
        const isLowStock = item.stock <= item.minimoAlerta;
        const valorTotal = item.costoUnitario * (activeTab === 'stock' ? item.stock : item.cantidadActual);
        const isSelected = selectedIds.has(item.id);

        return (
            <TouchableOpacity
                style={[styles.materialCard, isSelected && styles.materialCardSelected]}
                onLongPress={() => { if (!isSelecting) setSelectedIds(new Set([item.id])); }}
                onPress={() => { if (isSelecting) toggleSelect(item.id); }}
                activeOpacity={isSelecting ? 0.7 : 1}
                delayLongPress={400}
            >
                {isSelecting && (
                    <View style={styles.selectionIndicator}>
                        <Icon
                            name={isSelected ? 'check-circle' : 'circle'}
                            size={22}
                            color={isSelected ? C.primary : C.textMuted}
                        />
                    </View>
                )}
                <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                        <View style={styles.materialNameRow}>
                            <Text style={styles.materialName}>{item.nombre}</Text>
                            <View style={{ flexDirection: 'row', gap: 4 }}>
                                {item.categoria ? (
                                    <View style={styles.categoriaBadge}>
                                        <Text style={styles.categoriaText}>{item.categoria}</Text>
                                    </View>
                                ) : null}
                                {item.proveedor ? (
                                    <View style={[styles.categoriaBadge, { backgroundColor: C.success + '20' }]}>
                                        <Text style={[styles.categoriaText, { color: C.success }]}>{item.proveedor}</Text>
                                    </View>
                                ) : null}
                            </View>
                        </View>
                        <Text style={styles.unit}>Unidad: {item.unidad}</Text>
                    </View>
                    <View style={styles.headerRight}>
                        {isLowStock && (
                            <View style={styles.alertBadge}>
                                <Icon name="alert-triangle" size={12} color={C.danger} />
                                <Text style={styles.alertText}>Stock Bajo</Text>
                            </View>
                        )}
                        <TouchableOpacity
                            style={styles.historyBtn}
                            onPress={() => { setHistoryMaterial(item); setHistoryModal(true); }}
                        >
                            <Icon name="clock" size={16} color={C.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.historyBtn, { marginLeft: 4 }]}
                            onPress={() =>
                                Alert.alert(
                                    'Eliminar material',
                                    `¿Eliminar "${item.nombre}" permanentemente? Se perderá todo su historial.`,
                                    [
                                        { text: 'Cancelar', style: 'cancel' },
                                        { text: 'Eliminar', style: 'destructive', onPress: () => deleteMaterial(item.id, currentUser?.companyId || 'default-company') },
                                    ]
                                )
                            }
                        >
                            <Icon name="trash-2" size={16} color={C.danger} />
                        </TouchableOpacity>
                    </View>
                </View>

                {activeTab === 'stock' ? (
                    <View style={styles.stockBox}>
                        <Text style={styles.stockLabel}>Stock Central</Text>
                        <Text style={[styles.stockValue, isLowStock && { color: C.danger }]}>
                            {item.stock} <Text style={{ fontSize: 14 }}>{item.unidad}</Text>
                        </Text>
                        {item.costoUnitario > 0 && (
                            <Text style={styles.valorText}>
                                Valor: ${valorTotal.toFixed(2)} (${item.costoUnitario}/{item.unidad})
                            </Text>
                        )}
                    </View>
                ) : (
                    <View style={styles.stockBox}>
                        <Text style={styles.stockLabel}>En Obra / Sitio</Text>
                        <Text style={[styles.stockValue, item.cantidadActual < item.stockMinimoObra && { color: C.danger }]}>
                            {item.cantidadActual} <Text style={{ fontSize: 14 }}>{item.unidad}</Text>
                        </Text>
                        {item.stockMinimoObra > 0 && (
                            <View style={{ marginTop: 8, width: '100%' }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <Text style={{ color: C.textMuted, fontSize: 11 }}>Estándar en obra: {item.stockMinimoObra} {item.unidad}</Text>
                                    <Text style={{ color: item.cantidadActual >= item.stockMinimoObra ? C.success : C.danger, fontSize: 11, fontWeight: 'bold' }}>
                                        {item.cantidadActual >= item.stockMinimoObra ? '✓ OK' : '⚠ Bajo estándar'}
                                    </Text>
                                </View>
                                <View style={{ height: 6, backgroundColor: C.surfaceLight, borderRadius: 3 }}>
<View style={{
                                        height: 6, borderRadius: 3,
                                        backgroundColor: item.cantidadActual >= item.stockMinimoObra ? C.success : C.danger,
                                        width: `${Math.min(100, (item.cantidadActual / item.stockMinimoObra) * 100)}%`
                                    }} />
                                </View>
                            </View>
                        )}
                        {item.enviado > 0 && (
                            <Text style={styles.enviadoText}>+ {item.enviado} {item.unidad} en tránsito</Text>
                        )}
                        {item.costoUnitario > 0 && (
                            <Text style={styles.valorText}>
                                Valor en obra: ${valorTotal.toFixed(2)}
                            </Text>
                        )}
                        <View style={styles.consumptionBadge}>
                            <Text style={styles.consumptionText}>Consumo en sitio: {item.totalUsado || 0} {item.unidad}</Text>
                        </View>
                    </View>
                )}

                {!isSelecting && (activeTab === 'stock' ? (
                    <View style={styles.actionsRow}>
                        <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: C.success + '20' }]}
                            onPress={() => openTransaction(item, 'in')}
                        >
                            <Icon name="arrow-down-left" size={16} color={C.success} />
                            <Text style={[styles.actionText, { color: C.success }]}>Entrada</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: C.primary + '20' }]}
                            onPress={() => openTransaction(item, 'send')}
                        >
                            <Icon name="truck" size={16} color={C.primary} />
                            <Text style={[styles.actionText, { color: C.info }]}>Enviar</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: C.danger + '20' }]}
                            onPress={() => openTransaction(item, 'out')}
                        >
                            <Icon name="minus-circle" size={16} color={C.danger} />
                            <Text style={[styles.actionText, { color: C.danger }]}>Salida</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.actionsRow}>
                        {item.enviado > 0 ? (
                            <TouchableOpacity
                                style={[styles.actionBtn, { backgroundColor: '#F39C12' + '20' }]}
                                onPress={() => openTransaction(item, 'confirm')}
                            >
                                <Icon name="check-circle" size={16} color="#F39C12" />
                                <Text style={[styles.actionText, { color: '#F39C12' }]}>Confirmar Llegada</Text>
                            </TouchableOpacity>
                        ) : null}
                        <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: C.danger + '20' }]}
                            onPress={() => openTransaction(item, 'out')}
                        >
                            <Icon name="minus-circle" size={16} color={C.danger} />
                            <Text style={[styles.actionText, { color: C.danger }]}>Registrar Uso</Text>
                        </TouchableOpacity>
                    </View>
                ))}
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
            <View style={styles.tabsContainer}>
                <TouchableOpacity
                    style={[styles.tabBtn, activeTab === 'stock' && styles.tabBtnActive]}
                    onPress={() => setActiveTab('stock')}
                >
                    <Icon name="archive" size={18} color={activeTab === 'stock' ? C.white : C.textMuted} style={{ marginRight: 6 }} />
                    <Text style={[styles.tabText, activeTab === 'stock' && styles.tabTextActive]}>Bodega / Stock</Text>
                </TouchableOpacity>
                {!isGlobal && (
                    <TouchableOpacity
                        style={[styles.tabBtn, activeTab === 'obra' && styles.tabBtnActive]}
                        onPress={() => setActiveTab('obra')}
                    >
                        <Icon name="map-pin" size={18} color={activeTab === 'obra' ? C.white : C.textMuted} style={{ marginRight: 6 }} />
                        <Text style={[styles.tabText, activeTab === 'obra' && styles.tabTextActive]}>En Obra</Text>
                    </TouchableOpacity>
                )}
            </View>

            {isGlobal && materials.length < 5 && ['admin', 'coordinador'].includes(currentUser?.role || '') && (
                <View style={{ paddingHorizontal: SPACING.md, paddingTop: SPACING.md }}>
                    <TouchableOpacity
                        style={{ backgroundColor: C.primary + '20', padding: SPACING.sm, borderRadius: RADIUS.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
                        onPress={() => {
                            restoreCentralCatalog(currentUser?.id || 'unknown', currentUser?.companyId || 'default-company');
                            Alert.alert('Catálogo Restaurado', 'Se han cargado los materiales estándar en Bodega Central.');
                        }}
                    >
                        <Icon name="refresh-cw" size={16} color={C.primary} style={{ marginRight: 8 }} />
                        <Text style={{ color: C.info, fontWeight: 'bold' }}>Restaurar Catálogo Estándar</Text>
                    </TouchableOpacity>
                </View>
            )}

            <View style={styles.filtersWrapper}>
                <View style={styles.filterHeaderRow}>
                    <Text style={{ color: C.white, fontWeight: 'bold', marginLeft: SPACING.md, marginBottom: 8 }}>Filtros</Text>
                    {materials.length > 0 && (
                        <TouchableOpacity style={styles.exportBtn} onPress={handleExport}>
                            <Icon name="download" size={14} color={C.success} />
                            <Text style={styles.exportBtnText}>Exportar Excel</Text>
                        </TouchableOpacity>
                    )}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
                    <TouchableOpacity
                        style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
                        onPress={() => setFilter('all')}
                    >
                        <Text style={[styles.filterChipText, filter === 'all' && styles.filterChipTextActive]}>Todos</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.filterChip, filter === 'low' && styles.filterChipActive, { borderColor: C.danger }]}
                        onPress={() => setFilter('low')}
                    >
                        <Icon name="alert-circle" size={14} color={filter === 'low' ? C.white : C.danger} style={{ marginRight: 4 }} />
                        <Text style={[styles.filterChipText, filter === 'low' && styles.filterChipTextActive, { color: filter === 'low' ? C.white : C.danger }]}>Bajo Stock</Text>
                    </TouchableOpacity>

                    {categories.map(cat => (
                        <TouchableOpacity
                            key={cat}
                            style={[styles.filterChip, filter === 'category' && selectedCategory === cat && styles.filterChipActive]}
                            onPress={() => { setFilter('category'); setSelectedCategory(cat); }}
                        >
                            <Text style={[styles.filterChipText, filter === 'category' && selectedCategory === cat && styles.filterChipTextActive]}>{cat}</Text>
                        </TouchableOpacity>
                    ))}

                    {suppliers.map(sup => (
                        <TouchableOpacity
                            key={sup}
                            style={[styles.filterChip, filter === 'supplier' && selectedSupplier === sup && styles.filterChipActive]}
                            onPress={() => { setFilter('supplier'); setSelectedSupplier(sup); }}
                        >
                            <Text style={[styles.filterChipText, filter === 'supplier' && selectedSupplier === sup && styles.filterChipTextActive]}>{sup}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <FlatList
                data={materials}
                renderItem={renderMaterial}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContainer}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Icon name="package" size={48} color={C.textMuted} />
                        <Text style={styles.emptyText}>No hay materiales registrados</Text>
                    </View>
                }
            />

            {isSelecting && (
                <View style={styles.selectionToolbar}>
                    <TouchableOpacity style={styles.selectionCancelBtn} onPress={() => setSelectedIds(new Set())}>
                        <Icon name="x" size={20} color={C.textSecondary} />
                    </TouchableOpacity>
                    <Text style={styles.selectionCount}>{selectedIds.size} seleccionado(s)</Text>
                    <TouchableOpacity style={styles.selectionDeleteBtn} onPress={handleBulkDelete}>
                        <Icon name="trash-2" size={18} color={C.white} />
                        <Text style={styles.selectionDeleteText}>Eliminar</Text>
                    </TouchableOpacity>
                </View>
            )}

            {!isSelecting && ['admin', 'coordinador'].includes(currentUser?.role || '') && (
                <GlobalFAB
                    icon="plus"
                    style={{ bottom: 20 + insets.bottom }}
                    onPress={() => setAddModalVisible(true)}
                />
            )}

            {/* Transaction Modal */}
            <Modal visible={modalVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>
                            {transactionType === 'in' ? 'Entrada Bodega' :
                                transactionType === 'out' ? (activeTab === 'stock' ? 'Salida Bodega' : 'Registrar Consumo en Sitio') :
                                    transactionType === 'send' ? 'Despacho a Obra' :
                                        'Confirmar Llegada'}
                        </Text>
                        <Text style={styles.modalMaterial}>{activeMaterial?.nombre}</Text>

                        {transactionType === 'send' && (
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Proyecto Destino</Text>
                                <View style={{ gap: 8, marginBottom: 12 }}>
                                    {projects.filter(p => p.id !== projectId).map(p => ( // Filter out current project
                                        <TouchableOpacity
                                            key={p.id}
                                            style={[styles.projectSelect, targetProjectId === p.id && styles.projectSelectActive]}
                                            onPress={() => setTargetProjectId(p.id)}
                                        >
                                            <Text style={[styles.projectSelectText, targetProjectId === p.id && { color: C.white }]}>
                                                {p.nombreProyecto}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}

                        <View style={styles.inputGroup}>
                            {transactionType === 'confirm' ? (
                                <>
                                    <Text style={styles.inputLabel}>Cantidad Recibida (Confirmar o Editar):</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={confirmAmount}
                                        onChangeText={setConfirmAmount}
                                        keyboardType="numeric"
                                        placeholder="Ej: 10"
                                        placeholderTextColor={C.textMuted}
                                        autoFocus
                                    />
                                </>
                            ) : (
                                <>
                                    <Text style={styles.inputLabel}>{transactionType === 'send' ? 'Cantidad a Despachar' : 'Cantidad'}:</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={amount}
                                        onChangeText={setAmount}
                                        keyboardType="numeric"
                                        placeholder="Ej: 10"
                                        placeholderTextColor={C.textMuted}
                                        autoFocus
                                    />
                                </>
                            )}
                        </View>

                        {(transactionType === 'in' || transactionType === 'out' || transactionType === 'send' || transactionType === 'confirm') && (
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Nota (opcional)</Text>
                                <TextInput
                                    style={styles.inputLeft}
                                    value={transactionNote}
                                    onChangeText={setTransactionNote}
                                    placeholder="Ej. Proveedor ABC, pedido #123"
                                    placeholderTextColor={C.textMuted}
                                />
                            </View>
                        )}

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                                <Text style={styles.cancelText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.confirmBtn, {
                                    backgroundColor: transactionType === 'in' ? C.success :
                                        transactionType === 'out' ? C.danger :
                                            transactionType === 'send' ? C.primary : '#F39C12'
                                }]}
                                onPress={handleTransaction}
                            >
                                <Text style={styles.confirmText}>Confirmar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Add Material Modal */}
            <Modal visible={addModalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Nuevo Material</Text>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Nombre del Material*</Text>
                                <TextInput style={styles.inputLeft} value={newNombre} onChangeText={setNewNombre}
                                    placeholder="Ej. Cemento Portland" placeholderTextColor={C.textMuted} />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Categoría</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', gap: 8 }}>
                                    {categories.map(cat => (
                                        <TouchableOpacity
                                            key={cat}
                                            style={[styles.choiceChip, newCategoria === cat && styles.choiceChipActive]}
                                            onPress={() => setNewCategoria(cat)}
                                        >
                                            <Text style={[styles.choiceChipText, newCategoria === cat && styles.choiceChipTextActive]}>{cat}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Unidad de Medida*</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', gap: 8 }}>
                                    {units.map(u => (
                                        <TouchableOpacity
                                            key={u}
                                            style={[styles.choiceChip, newUnidad === u && styles.choiceChipActive]}
                                            onPress={() => setNewUnidad(u)}
                                        >
                                            <Text style={[styles.choiceChipText, newUnidad === u && styles.choiceChipTextActive]}>{u}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Proveedor</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', gap: 8 }}>
                                    <TouchableOpacity
                                        style={[styles.choiceChip, newProveedor === '' && styles.choiceChipActive]}
                                        onPress={() => setNewProveedor('')}
                                    >
                                        <Text style={[styles.choiceChipText, newProveedor === '' && styles.choiceChipTextActive]}>Ninguno</Text>
                                    </TouchableOpacity>
                                    {suppliers.map(sup => (
                                        <TouchableOpacity
                                            key={sup}
                                            style={[styles.choiceChip, newProveedor === sup && styles.choiceChipActive]}
                                            onPress={() => setNewProveedor(sup)}
                                        >
                                            <Text style={[styles.choiceChipText, newProveedor === sup && styles.choiceChipTextActive]}>{sup}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Costo Unitario ($)</Text>
                                <TextInput style={styles.inputLeft} value={newCosto} onChangeText={setNewCosto}
                                    keyboardType="numeric" placeholder="Ej. 12.00" placeholderTextColor={C.textMuted} />
                            </View>

                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                <View style={[styles.inputGroup, { flex: 1 }]}>
                                    <Text style={styles.inputLabel}>Alerta Bodega</Text>
                                    <TextInput style={styles.inputLeft} value={newAlerta} onChangeText={setNewAlerta}
                                        keyboardType="numeric" placeholder="10" placeholderTextColor={C.textMuted} />
                                </View>
                                <View style={[styles.inputGroup, { flex: 1 }]}>
                                    <Text style={styles.inputLabel}>Mínimo en Obra</Text>
                                    <TextInput style={styles.inputLeft} value={newStandardQty} onChangeText={setNewStandardQty}
                                        keyboardType="numeric" placeholder="25" placeholderTextColor={C.textMuted} />
                                </View>
                            </View>
                        </ScrollView>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setAddModalVisible(false)}>
                                <Text style={styles.cancelText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: C.primary }]} onPress={handleCreateMaterial}>
                                <Text style={styles.confirmText}>Guardar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* History Modal */}
            <Modal visible={historyModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxHeight: '80%' }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md }}>
                            <Text style={styles.modalTitle}>Historial: {historyMaterial?.nombre}</Text>
                            <TouchableOpacity onPress={() => setHistoryModal(false)}>
                                <Icon name="x" size={22} color={C.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {(historyMaterial?.historialTransacciones || []).length === 0 ? (
                                <Text style={{ color: C.textMuted, textAlign: 'center', padding: SPACING.xl }}>
                                    Sin movimientos registrados
                                </Text>
                            ) : (
                                [...(historyMaterial?.historialTransacciones || [])].reverse().map((tx, idx) => (
                                    <View key={idx} style={styles.historyItem}>
                                        <View style={[styles.historyIcon, { backgroundColor: getTransactionColor(tx.tipo) + '20' }]}>
                                            <Icon name={getTransactionIcon(tx.tipo) as any} size={16} color={getTransactionColor(tx.tipo)} />
                                        </View>
                                        <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                                <Text style={[styles.txLabel, { color: getTransactionColor(tx.tipo) }]}>
                                                    {getTransactionLabel(tx.tipo)}
                                                </Text>
                                                <Text style={styles.txQty}>
                                                    {tx.cantidad} {historyMaterial?.unidad}
                                                </Text>
                                            </View>
                                            <Text style={styles.txDate}>
                                                {format(new Date(tx.fecha), "dd MMM yyyy, HH:mm", { locale: es })}
                                            </Text>
                                            {tx.nota ? <Text style={styles.txNote}>{tx.nota}</Text> : null}
                                        </View>
                                    </View>
                                ))
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View >
    );
}

function makeStyles(C: ThemeColors) {
    return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    tabsContainer: { flexDirection: 'row', backgroundColor: C.surface, padding: SPACING.xs, margin: SPACING.md, borderRadius: RADIUS.md },
    tabBtn: { flex: 1, flexDirection: 'row', paddingVertical: SPACING.sm, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.sm },
    tabBtnActive: { backgroundColor: C.primary },
    tabText: { color: C.textMuted, fontSize: FONTS.sizes.sm, fontWeight: 'bold' },
    tabTextActive: { color: C.white },
    listContainer: { padding: SPACING.md, paddingTop: 0, paddingBottom: 120 },

    materialCard: { backgroundColor: C.surface, padding: SPACING.md, borderRadius: RADIUS.md, marginBottom: SPACING.md, ...SHADOWS.sm },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.md },
    headerRight: { alignItems: 'flex-end', gap: 6 },
    materialNameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 2 },
    materialName: { color: C.white, fontSize: FONTS.sizes.lg, fontWeight: 'bold' },
    unit: { color: C.textSecondary, fontSize: FONTS.sizes.sm },
    categoriaBadge: { backgroundColor: C.primary + '25', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
    categoriaText: { color: C.info, fontSize: 11, fontWeight: 'bold' },
    alertBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.danger + '20', paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.sm },
    alertText: { color: C.danger, fontSize: 10, fontWeight: 'bold', marginLeft: 4 },
    projectSelect: { padding: 10, backgroundColor: C.surfaceLight, borderRadius: 8, borderWidth: 1, borderColor: C.border, marginBottom: 8 },
    projectSelectActive: { backgroundColor: C.primary, borderColor: C.primary },
    projectSelectText: { color: C.textSecondary, fontSize: 13, fontWeight: 'bold' },
    historyBtn: { padding: 4 },

    stockBox: { backgroundColor: C.surfaceLight, padding: SPACING.md, borderRadius: RADIUS.sm, alignItems: 'center', marginBottom: SPACING.md },
    stockLabel: { color: C.textSecondary, fontSize: FONTS.sizes.sm },
    stockValue: { color: C.info, fontSize: 32, fontWeight: 'bold' },
    enviadoText: { color: '#F39C12', fontSize: FONTS.sizes.xs, marginTop: 4, fontWeight: 'bold' },
    valorText: { color: C.textSecondary, fontSize: FONTS.sizes.xs, marginTop: 4 },
    consumptionBadge: { marginTop: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: C.surfaceLight, borderRadius: 4, alignSelf: 'flex-start' },
    consumptionText: { color: C.textSecondary, fontSize: 11, fontWeight: '600' },

    actionsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
    actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: SPACING.sm, borderRadius: RADIUS.sm },
    actionText: { fontWeight: 'bold', marginLeft: 6, fontSize: FONTS.sizes.sm },

    filtersWrapper: { marginBottom: SPACING.md },
    filterHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingRight: SPACING.md },
    exportBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.success + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.sm, marginBottom: 8 },
    exportBtnText: { color: C.success, fontSize: 12, fontWeight: 'bold', marginLeft: 6 },
    filtersScroll: { paddingHorizontal: SPACING.md },
    filterChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: C.surfaceLight, marginRight: 8, borderWidth: 1, borderColor: C.border },
    filterChipActive: { backgroundColor: C.primary, borderColor: C.primary },
    filterChipText: { color: C.textSecondary, fontSize: 12, fontWeight: '600' },
    filterChipTextActive: { color: C.white },

    choiceChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.md, backgroundColor: C.surfaceLight, marginRight: 8, borderWidth: 1, borderColor: C.border },
    choiceChipActive: { backgroundColor: C.primary + '30', borderColor: C.primary },
    choiceChipText: { color: C.textSecondary, fontSize: 13 },
    choiceChipTextActive: { color: C.info, fontWeight: 'bold' },

    emptyState: { alignItems: 'center', justifyContent: 'center', padding: SPACING.xxl, marginTop: 40 },
    emptyText: { color: C.white, fontSize: FONTS.sizes.md, fontWeight: 'bold', marginTop: SPACING.md },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: SPACING.xl },
    modalContent: { backgroundColor: C.surface, padding: SPACING.xl, borderRadius: RADIUS.lg },
    modalTitle: { color: C.white, fontSize: FONTS.sizes.xl, fontWeight: 'bold', marginBottom: 4 },
    modalMaterial: { color: C.info, fontSize: FONTS.sizes.md, marginBottom: SPACING.xl },
    inputGroup: { marginBottom: SPACING.lg },
    inputLabel: { color: C.textSecondary, marginBottom: 8, fontSize: FONTS.sizes.sm },
    input: { backgroundColor: C.surfaceLight, color: C.white, fontSize: 24, padding: SPACING.md, borderRadius: RADIUS.md, textAlign: 'center', fontWeight: 'bold' },
    inputLeft: { backgroundColor: C.surfaceLight, color: C.white, fontSize: 15, padding: SPACING.md, borderRadius: RADIUS.md },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: SPACING.md },
    cancelBtn: { padding: SPACING.md, marginRight: SPACING.sm },
    cancelText: { color: C.textSecondary, fontWeight: 'bold' },
    confirmBtn: { paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderRadius: RADIUS.md },
    confirmText: { color: C.white, fontWeight: 'bold' },

    historyItem: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: C.border },
    historyIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    txLabel: { fontWeight: 'bold', fontSize: FONTS.sizes.sm },
    txQty: { color: C.white, fontWeight: 'bold', fontSize: FONTS.sizes.sm },
    txDate: { color: C.textMuted, fontSize: 11, marginTop: 2 },
    txNote: { color: C.textSecondary, fontSize: 11, marginTop: 2, fontStyle: 'italic' },

    // Multi-select
    materialCardSelected: { borderWidth: 2, borderColor: C.primary },
    selectionIndicator: { position: 'absolute', top: SPACING.sm, right: SPACING.sm, zIndex: 10 },
    selectionToolbar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.surface,
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        borderTopWidth: 1,
        borderTopColor: C.border,
        gap: SPACING.md,
    },
    selectionCancelBtn: { padding: 8 },
    selectionCount: { flex: 1, color: C.white, fontWeight: 'bold', fontSize: FONTS.sizes.md },
    selectionDeleteBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.danger,
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.sm,
        borderRadius: RADIUS.md,
        gap: 6,
    },
    selectionDeleteText: { color: C.white, fontWeight: 'bold', fontSize: FONTS.sizes.sm },
    });
}

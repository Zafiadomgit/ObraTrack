import { create } from 'zustand';
import { db } from '../../../config/firebase';
import { collection, doc, setDoc, updateDoc, deleteDoc, query, where, writeBatch, runTransaction, getDocs, limit, startAfter, QueryDocumentSnapshot } from 'firebase/firestore';
import { MaterialSchema } from '../../../core/validations/schemas';
import { ErrorService } from '../../../core/services/errorService';
import { ActivityService } from '../../../core/services/activityService';
import { useAppStore } from '../../../store/appStore';

export interface MaterialTransaccion {
    tipo: 'entrada' | 'salida' | 'envio' | 'confirmacion';
    cantidad: number;
    fecha: number;
    nota?: string;
}

export interface Material {
    id: string;
    createdAt: number;
    updatedAt: number;
    synced: boolean;
    userId: string;
    companyId: string;
    projectId: string;
    version?: number;

    nombre: string;
    unidad: string;
    categoria: string;
    costoUnitario: number;
    stock: number;
    enviado: number;
    cantidadActual: number;
    minimoAlerta: number;
    stockMinimoObra: number;
    totalUsado: number;
    proveedor?: string;
    unidadDestino?: string;
    historialTransacciones: MaterialTransaccion[];
}

interface MaterialState {
    materials: Material[];
    suppliers: string[];

    lastDoc: QueryDocumentSnapshot<any> | null;
    hasMore: boolean;
    loading: boolean;
    loadingMore: boolean;

    loadMaterials: (userId: string, companyId: string, role: string) => Promise<void>;
    loadMoreMaterials: (userId: string, companyId: string, role: string) => Promise<void>;
    clearMaterials: () => void;

    addMaterial: (data: Omit<Material, 'id' | 'createdAt' | 'updatedAt' | 'synced' | 'cantidadActual' | 'stock' | 'enviado' | 'historialTransacciones' | 'totalUsado' | 'version'>, companyId: string) => Promise<void>;
    updateMaterial: (id: string, currentVersion: number, updates: Partial<Material>, companyId: string) => Promise<void>;
    deleteMaterial: (id: string, companyId: string) => Promise<void>;
    registerMaterialEntry: (id: string, currentVersion: number, amount: number, companyId: string, nota?: string) => Promise<void>;
    registerMaterialExit: (id: string, currentVersion: number, amount: number, companyId: string, nota?: string) => Promise<void>;
    enviarAObra: (sourceId: string, currentVersion: number, amount: number, targetProjectId: string, companyId: string, nota?: string) => Promise<void>;
    confirmarLlegada: (id: string, currentVersion: number, amount: number, companyId: string, nota?: string) => Promise<void>;
    addSupplier: (name: string) => Promise<void>;
    deleteSupplier: (name: string) => Promise<void>;
    restoreCentralCatalog: (userId: string, companyId: string) => Promise<void>;
    initializeCentralWarehouse: (userId: string, companyId: string) => Promise<void>;
}

let unsubMaterials: (() => void) | null = null;
const generateId = () => Math.random().toString(36).substr(2, 9);

export const useMaterialStore = create<MaterialState>((set, get) => ({
    materials: [],
    suppliers: ['Argos', 'Holcim', 'HomeCenter', 'Ferretería Central'],
    lastDoc: null,
    hasMore: true,
    loading: false,
    loadingMore: false,

    loadMaterials: async (userId, companyId, role) => {
        if (!companyId) return;
        set({ loading: true, hasMore: true });

        try {
            let q = collection(db, `companies/${companyId}/materials`) as any;
            if (role !== 'superAdmin') {
                q = query(q, where('userId', '==', userId));
            }
            q = query(q, limit(15)); // Basic limit, relying on ID sort for now

            const snapshot = await getDocs(q);
            const loaded = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Material));
            
            set({ 
                materials: loaded, 
                lastDoc: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
                hasMore: snapshot.docs.length === 15,
                loading: false 
            });
        } catch (error) {
            ErrorService.handleError(error, 'Load Materials');
            set({ loading: false });
        }
    },

    loadMoreMaterials: async (userId, companyId, role) => {
        const { lastDoc, hasMore, loadingMore } = get();
        if (!companyId || !lastDoc || !hasMore || loadingMore) return;
        
        set({ loadingMore: true });

        try {
            let q = collection(db, `companies/${companyId}/materials`) as any;
            if (role !== 'superAdmin') {
                q = query(q, where('userId', '==', userId));
            }
            q = query(q, startAfter(lastDoc), limit(15));

            const snapshot = await getDocs(q);
            const loaded = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Material));
            
            set(state => ({ 
                materials: [...state.materials, ...loaded], 
                lastDoc: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : state.lastDoc,
                hasMore: snapshot.docs.length === 15,
                loadingMore: false 
            }));
        } catch (error) {
            ErrorService.handleError(error, 'Load More Materials');
            set({ loadingMore: false });
        }
    },

    clearMaterials: () => {
        set({ materials: [], lastDoc: null, hasMore: true });
    },

    addMaterial: async (data, companyId) => {
        try {
            const id = generateId();
            const newMat: Material = {
                ...data,
                id,
                companyId,
                stock: 0,
                enviado: 0,
                cantidadActual: 0,
                totalUsado: 0,
                stockMinimoObra: data.stockMinimoObra || 0,
                historialTransacciones: [],
                createdAt: Date.now(),
                updatedAt: Date.now(),
                version: 1,
                synced: true
            };
            
            const parsed = MaterialSchema.safeParse(newMat);
            if (!parsed.success) throw parsed.error;

            await setDoc(doc(db, `companies/${companyId}/materials`, id), parsed.data);
            set(state => ({ materials: [parsed.data as Material, ...state.materials] }));
            ActivityService.logActivity(companyId, data.userId, 'added_material', 'material', id, `Material "${parsed.data.nombre}" agregado.`);
        } catch (error) {
            ErrorService.handleError(error, 'Add Material');
        }
    },

    updateMaterial: async (id, currentVersion, updates, companyId) => {
        try {
            const docRef = doc(db, `companies/${companyId}/materials`, id);
            await runTransaction(db, async (transaction) => {
                const docSnap = await transaction.get(docRef);
                if (!docSnap.exists()) throw new Error('El material no existe.');
                
                const existingData = docSnap.data();
                if (existingData.version !== currentVersion) {
                    throw new Error('Conflicto detectado: Alguien más ha modificado este material.');
                }
                
                const updatedData = {
                    ...existingData,
                    ...updates,
                    updatedAt: Date.now(),
                    version: currentVersion + 1
                };
                transaction.update(docRef, updatedData);
                set(state => ({ materials: state.materials.map(m => m.id === id ? updatedData as Material : m) }));
            });
            ActivityService.logActivity(companyId, 'system', 'updated_material', 'material', id, `Material actualizado.`);
        } catch (error) {
            ErrorService.handleError(error, 'Update Material');
        }
    },

    deleteMaterial: async (id, companyId) => {
        try {
            await deleteDoc(doc(db, `companies/${companyId}/materials`, id));
            set(state => ({ materials: state.materials.filter(m => m.id !== id) }));
            ActivityService.logActivity(companyId, 'system', 'deleted_material', 'material', id, `Material eliminado.`);
        } catch (error) {
            ErrorService.handleError(error, 'Delete Material');
        }
    },

    registerMaterialEntry: async (id, currentVersion, amount, companyId, nota) => {
        try {
            if (amount <= 0) throw new Error('La cantidad debe ser mayor a 0');
            const docRef = doc(db, `companies/${companyId}/materials`, id);
            
            await runTransaction(db, async (transaction) => {
                const docSnap = await transaction.get(docRef);
                if (!docSnap.exists()) throw new Error('Material no encontrado');
                
                const m = docSnap.data() as Material;
                if (m.version !== currentVersion) throw new Error('Conflicto: material modificado por otro usuario.');

                const newTx: MaterialTransaccion = { tipo: 'entrada', cantidad: amount, fecha: Date.now(), nota };
                const newData = {
                    stock: m.stock + amount,
                    historialTransacciones: [...m.historialTransacciones, newTx],
                    updatedAt: Date.now(),
                    version: currentVersion + 1
                };
                transaction.update(docRef, newData);
                set(state => ({ materials: state.materials.map(mat => mat.id === id ? {...mat, ...newData} : mat) }));
            });
            ActivityService.logActivity(companyId, 'system', 'material_entry', 'material', id, `Entrada de ${amount} unidades registrada.`);
        } catch (error) {
            ErrorService.handleError(error, 'Register Material Entry');
        }
    },

    registerMaterialExit: async (id, currentVersion, amount, companyId, nota) => {
        try {
            if (amount <= 0) throw new Error('La cantidad debe ser mayor a 0');
            const docRef = doc(db, `companies/${companyId}/materials`, id);

            await runTransaction(db, async (transaction) => {
                const docSnap = await transaction.get(docRef);
                if (!docSnap.exists()) throw new Error('Material no encontrado');
                
                const m = docSnap.data() as Material;
                if (m.version !== currentVersion) throw new Error('Conflicto: material modificado por otro usuario.');

                const newTx: MaterialTransaccion = { tipo: 'salida', cantidad: amount, fecha: Date.now(), nota };
                const newData = {
                    cantidadActual: Math.max(0, m.cantidadActual - amount),
                    totalUsado: (m.totalUsado || 0) + amount,
                    historialTransacciones: [...m.historialTransacciones, newTx],
                    updatedAt: Date.now(),
                    version: currentVersion + 1
                };
                transaction.update(docRef, newData);
                set(state => ({ materials: state.materials.map(mat => mat.id === id ? {...mat, ...newData} : mat) }));
            });
            ActivityService.logActivity(companyId, 'system', 'material_exit', 'material', id, `Salida de ${amount} unidades registrada.`);
        } catch (error) {
            ErrorService.handleError(error, 'Register Material Exit');
        }
    },

    enviarAObra: async (sourceId, currentVersion, amount, targetProjectId, companyId, nota) => {
        try {
            const { materials } = get();
            const sourceMaterial = materials.find(m => m.id === sourceId);
            if (!sourceMaterial || sourceMaterial.stock < amount) throw new Error('Stock insuficiente');

            await runTransaction(db, async (transaction) => {
                const sourceRef = doc(db, `companies/${companyId}/materials`, sourceId);
                const sourceSnap = await transaction.get(sourceRef);
                
                if (!sourceSnap.exists()) throw new Error('Material origen no encontrado');
                const sData = sourceSnap.data() as Material;
                
                if (sData.version !== currentVersion) throw new Error('Conflicto de versión en material origen');
                if (sData.stock < amount) throw new Error('Stock insuficiente verificado en servidor');

                // 1. Update source
                const sourceNewData = {
                    stock: sData.stock - amount,
                    historialTransacciones: [...sData.historialTransacciones, {
                        tipo: 'envio' as const, cantidad: amount, fecha: Date.now(), nota: `Despacho a proyecto ${targetProjectId}: ${nota || ''}`
                    }],
                    updatedAt: Date.now(),
                    version: currentVersion + 1
                };
                transaction.update(sourceRef, sourceNewData);

                // 2. Check if target exists
                // We use local state to find the target material id, then verify in tx
                const targetMaterial = materials.find(m => m.projectId === targetProjectId && m.nombre === sData.nombre);
                
                let targetUpdated = false;
                let targetNewData: any = null;
                let newTargetMat: any = null;
                
                if (targetMaterial) {
                    const targetRef = doc(db, `companies/${companyId}/materials`, targetMaterial.id);
                    const targetSnap = await transaction.get(targetRef);
                    if (targetSnap.exists()) {
                        const tData = targetSnap.data() as Material;
                        targetNewData = {
                            enviado: tData.enviado + amount,
                            historialTransacciones: [...tData.historialTransacciones, {
                                tipo: 'entrada' as const, cantidad: amount, fecha: Date.now(), nota: `En camino desde Bodega: ${nota || ''}`
                            }],
                            updatedAt: Date.now(),
                            version: (tData.version || 1) + 1
                        };
                        transaction.update(targetRef, targetNewData);
                        targetUpdated = true;
                    }
                } else {
                    const newId = generateId();
                    const newRef = doc(db, `companies/${companyId}/materials`, newId);
                    const newProjMaterial: Material = {
                        id: newId,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        synced: true,
                        userId: sData.userId,
                        companyId,
                        projectId: targetProjectId,
                        nombre: sData.nombre,
                        unidad: sData.unidad,
                        categoria: sData.categoria,
                        costoUnitario: sData.costoUnitario,
                        stock: 0,
                        enviado: amount,
                        cantidadActual: 0,
                        minimoAlerta: sData.minimoAlerta,
                        stockMinimoObra: sData.stockMinimoObra,
                        totalUsado: 0,
                        version: 1,
                        historialTransacciones: [{
                            tipo: 'entrada', cantidad: amount, fecha: Date.now(), nota: `Nuevo despacho desde Bodega: ${nota || ''}`
                        }]
                    };
                    transaction.set(newRef, newProjMaterial);
                    newTargetMat = newProjMaterial;
                }
                
                // Store state updates
                set(state => {
                    const mats = state.materials.map(mat => mat.id === sourceId ? {...mat, ...sourceNewData} : mat);
                    if (targetUpdated) {
                        return { materials: mats.map(mat => mat.id === targetMaterial!.id ? {...mat, ...targetNewData} : mat) };
                    } else if (newTargetMat) {
                        return { materials: [newTargetMat, ...mats] };
                    }
                    return { materials: mats };
                });
            });
            ActivityService.logActivity(companyId, 'system', 'material_transfer', 'material', sourceId, `Enviadas ${amount} unidades al proyecto ${targetProjectId}.`);
        } catch (error) {
            ErrorService.handleError(error, 'Enviar a Obra');
        }
    },

    confirmarLlegada: async (id, currentVersion, amount, companyId, nota) => {
        try {
            const docRef = doc(db, `companies/${companyId}/materials`, id);
            await runTransaction(db, async (transaction) => {
                const docSnap = await transaction.get(docRef);
                if (!docSnap.exists()) throw new Error('Material no encontrado');
                
                const m = docSnap.data() as Material;
                if (m.version !== currentVersion) throw new Error('Conflicto detectado (versión obsoleta).');

                const newData = {
                    enviado: Math.max(0, m.enviado - amount),
                    cantidadActual: m.cantidadActual + amount,
                    historialTransacciones: [...m.historialTransacciones, {
                        tipo: 'entrada' as const, cantidad: amount, fecha: Date.now(), nota: `Llegada confirmada: ${nota || ''}`
                    }],
                    updatedAt: Date.now(),
                    version: currentVersion + 1
                };
                transaction.update(docRef, newData);
                set(state => ({ materials: state.materials.map(mat => mat.id === id ? {...mat, ...newData} : mat) }));
            });
        } catch (error) {
            ErrorService.handleError(error, 'Confirmar Llegada');
        }
    },

    addSupplier: async (name) => set((s) => ({ suppliers: s.suppliers.includes(name) ? s.suppliers : [...s.suppliers, name] })),
    deleteSupplier: async (name) => set((s) => ({ suppliers: s.suppliers.filter(sup => sup !== name) })),

    restoreCentralCatalog: async (userId, companyId) => {
        try {
            const { materials } = get();
            const currentCentralIds = new Set(materials.filter(m => m.projectId === 'central').map(m => m.nombre.toLowerCase()));

            const standardMats = Object.values(require('../data/standardMaterials').STANDARD_MATERIALS)
                .flat()
                .filter((m: any) => !currentCentralIds.has(m.nombre.toLowerCase()))
                .map((m: any, idx: number) => ({
                    ...m,
                    id: `resto_${Date.now()}_${idx}`,
                    projectId: 'central',
                    userId: userId,
                    companyId,
                    stock: 0,
                    enviado: 0,
                    cantidadActual: 0,
                    totalUsado: 0,
                    historialTransacciones: [],
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    synced: true,
                    version: 1,
                } as Material));

            if (standardMats.length === 0) return;

            const batch = writeBatch(db);
            const newMats: Material[] = [];
            standardMats.forEach(mat => {
                batch.set(doc(db, `companies/${companyId}/materials`, mat.id), mat);
                newMats.push(mat as Material);
            });
            await batch.commit();
            set(state => ({ materials: [...newMats, ...state.materials] }));
        } catch (error) {
            ErrorService.handleError(error, 'Restore Catalog');
        }
    },

    initializeCentralWarehouse: async (userId: string, companyId: string) => {
        try {
            const initialMaterials = Object.values(require('../data/standardMaterials').STANDARD_MATERIALS).flat().map((m: any, idx: number) => ({
                ...m,
                id: `init_${userId}_${idx}`,
                projectId: 'central',
                userId: userId,
                companyId,
                version: 1,
                stock: 0,
                enviado: 0,
                cantidadActual: 0,
                totalUsado: 0,
                historialTransacciones: [],
                createdAt: Date.now(),
                updatedAt: Date.now(),
                synced: true
            } as Material));

            const batch = writeBatch(db);
            const newMats: Material[] = [];
            initialMaterials.forEach(mat => {
                batch.set(doc(db, `companies/${companyId}/materials`, mat.id), mat);
                newMats.push(mat as Material);
            });
            await batch.commit();
            set(state => ({ materials: [...newMats, ...state.materials] }));
        } catch (error) {
            ErrorService.handleError(error, 'Init Central Warehouse');
        }
    },
}));

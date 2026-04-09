import { create } from 'zustand';
import { db } from '../../../config/firebase';
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, query, where } from 'firebase/firestore';

export type EquipmentStatus = 'disponible' | 'en_uso' | 'mantenimiento' | 'dado_de_baja';
export type EquipmentCategory = 'herramienta' | 'maquinaria' | 'vehiculo' | 'electronico' | 'seguridad' | 'otro';

export interface Equipment {
    id: string;
    createdAt: number;
    updatedAt: number;
    userId: string;
    projectId: string;

    nombre: string;
    categoria: EquipmentCategory;
    serial?: string;          // Optional serial number
    marca?: string;           // Optional brand
    modelo?: string;          // Optional model
    photoUrl?: string;        // Firebase Storage or local uri
    estado: EquipmentStatus;
    notas?: string;
    fechaAdquisicion?: string;
    companyId: string;
    version?: number;
}

interface EquipmentState {
    equipment: Equipment[];

    subscribeToEquipment: (userId: string, companyId: string, role: string) => void;
    unsubscribeFromEquipment: () => void;

    addEquipment: (data: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'companyId'>, companyId: string) => Promise<void>;
    updateEquipment: (id: string, companyId: string, updates: Partial<Equipment>) => Promise<void>;
    deleteEquipment: (id: string, companyId: string) => Promise<void>;
    updateStatus: (id: string, companyId: string, status: EquipmentStatus) => Promise<void>;
}

let unsubEquipment: (() => void) | null = null;
const generateId = () => Math.random().toString(36).substr(2, 9);

export const useEquipmentStore = create<EquipmentState>((set, get) => ({
    equipment: [],

    subscribeToEquipment: (userId, companyId, role) => {
        if (unsubEquipment) unsubEquipment();
        const basePath = `companies/${companyId}/equipment`;
        const q = (role === 'superAdmin' || role === 'admin')
            ? collection(db, basePath)
            : query(collection(db, basePath), where('userId', '==', userId));

        unsubEquipment = onSnapshot(q, (snapshot) => {
            const loaded = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Equipment));
            set({ equipment: loaded });
        });
    },

    unsubscribeFromEquipment: () => {
        if (unsubEquipment) { unsubEquipment(); unsubEquipment = null; }
        set({ equipment: [] });
    },

    addEquipment: async (data, companyId) => {
        const id = generateId();
        const now = Date.now();
        const item: Equipment = { id, createdAt: now, updatedAt: now, version: 1, ...data, companyId };
        await setDoc(doc(db, `companies/${companyId}/equipment`, id), item);
    },

    updateEquipment: async (id, companyId, updates) => {
        await updateDoc(doc(db, `companies/${companyId}/equipment`, id), { ...updates, updatedAt: Date.now() });
    },

    deleteEquipment: async (id, companyId) => {
        await deleteDoc(doc(db, `companies/${companyId}/equipment`, id));
    },

    updateStatus: async (id, companyId, status) => {
        await updateDoc(doc(db, `companies/${companyId}/equipment`, id), { estado: status, updatedAt: Date.now() });
    },
}));

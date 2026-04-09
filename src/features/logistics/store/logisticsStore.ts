import { create } from 'zustand';
import { db } from '../../../config/firebase';
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, query, where } from 'firebase/firestore';

export type ShipmentStatus = 'en_transito' | 'entregado' | 'retrasado';
export type ConductorStatus = 'pendiente' | 'aceptado' | 'en_camino' | 'finalizado';

export interface ShipmentMaterial {
    materialId: string;
    nombre: string;
    cantidad: number;
    unidad: string;
}

export interface Shipment {
    id: string;
    userId: string;               // Who created the shipment (coordinator/logistics)
    conductorId?: string;         // UID of the assigned driver
    projectId?: string;
    destino: string;
    origen: string;
    estado: ShipmentStatus;
    conductorStatus: ConductorStatus;
    placaCamion: string;
    conductor: string;            // Display name (kept for backwards compat)
    telefonoConductor: string;
    fechaSalida: string;
    fechaEstimada: string;
    materiales: ShipmentMaterial[];
    ubicacionGPS?: { lat: number; lng: number };
    observaciones?: string;
    receivedPhotos?: string[];    // URIs/URLs of photos taken by driver on delivery
    finalizadoAt?: number;        // Timestamp when driver completed the trip
    createdAt: number;
    companyId: string;
    version?: number;
}

interface LogisticsState {
    shipments: Shipment[];
    subscribeToShipments: (userId: string, companyId: string, role: string) => void;
    unsubscribeFromShipments: () => void;
    addShipment: (data: Omit<Shipment, 'id' | 'createdAt' | 'estado' | 'conductorStatus' | 'version' | 'companyId'>, companyId: string) => Promise<string>;
    updateShipmentStatus: (id: string, status: ShipmentStatus, companyId: string, ubicacionGPS?: { lat: number; lng: number }) => Promise<void>;
    updateShipmentLocation: (id: string, companyId: string, ubicacionGPS: { lat: number; lng: number }) => Promise<void>;
    deleteShipment: (id: string, companyId: string) => Promise<void>;
    acceptShipment: (id: string, companyId: string) => Promise<void>;
    completeShipment: (id: string, companyId: string, photos?: string[], ubicacionGPS?: { lat: number; lng: number }) => Promise<void>;
}

let unsubLogistics: (() => void) | null = null;
const generateId = () => Math.random().toString(36).substr(2, 9);

export const useLogisticsStore = create<LogisticsState>((set, get) => ({
    shipments: [],

    subscribeToShipments: (userId, companyId, role) => {
        if (unsubLogistics) unsubLogistics();

        let q;
        const basePath = `companies/${companyId}/shipments`;
        if (role === 'superAdmin' || role === 'admin' || role === 'coordinador' || role === 'logistica') {
            q = (role === 'superAdmin' || role === 'admin')
                ? collection(db, basePath)
                : query(collection(db, basePath), where('userId', '==', userId));
        } else if (role === 'conductor') {
            q = query(collection(db, basePath), where('conductorId', '==', userId));
        } else {
            q = query(collection(db, basePath), where('userId', '==', userId));
        }

        unsubLogistics = onSnapshot(q, (snapshot) => {
            const loaded = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shipment));
            set({ shipments: loaded });
        });
    },

    unsubscribeFromShipments: () => {
        if (unsubLogistics) { unsubLogistics(); unsubLogistics = null; }
        set({ shipments: [] });
    },

    addShipment: async (data, companyId) => {
        const id = generateId();
        const newShipment: Shipment = {
            ...data,
            id,
            companyId,
            version: 1,
            estado: 'en_transito',
            conductorStatus: 'pendiente',
            createdAt: Date.now(),
        };

        const cleanData = Object.fromEntries(Object.entries(newShipment).filter(([_, v]) => v !== undefined));
        await setDoc(doc(db, `companies/${companyId}/shipments`, id), cleanData as any);
        return id;
    },

    updateShipmentStatus: async (id, status, companyId, ubicacionGPS) => {
        const payload: any = { estado: status };
        if (ubicacionGPS) payload.ubicacionGPS = ubicacionGPS;
        await updateDoc(doc(db, `companies/${companyId}/shipments`, id), payload);
    },

    updateShipmentLocation: async (id, companyId, ubicacionGPS) => {
        await updateDoc(doc(db, `companies/${companyId}/shipments`, id), { ubicacionGPS });
    },

    deleteShipment: async (id, companyId) => {
        await deleteDoc(doc(db, `companies/${companyId}/shipments`, id));
    },

    acceptShipment: async (id, companyId) => {
        await updateDoc(doc(db, `companies/${companyId}/shipments`, id), { conductorStatus: 'aceptado' });
    },

    completeShipment: async (id, companyId, photos = [], ubicacionGPS) => {
        const payload: any = {
            conductorStatus: 'finalizado',
            estado: 'entregado',
            receivedPhotos: photos,
            finalizadoAt: Date.now(),
        };
        if (ubicacionGPS) payload.ubicacionGPS = ubicacionGPS;
        await updateDoc(doc(db, `companies/${companyId}/shipments`, id), payload);
    },
}));

import { create } from 'zustand';
import { db } from '../../../config/firebase';
import { collection, doc, setDoc, deleteDoc, getDocs, updateDoc } from 'firebase/firestore';

const genId = () => Math.random().toString(36).substr(2, 9) + Date.now().toString(36);

export type InvoiceStatus = 'pendiente' | 'pagada' | 'vencida';

export interface Supplier {
    id: string;
    companyId: string;
    nombre: string;
    categoria: string;
    contacto?: string;
    telefono?: string;
    email?: string;
    notas?: string;
    createdAt: number;
}

export interface InvoiceAttachment {
    uri: string;       // Firebase Storage URL (after upload) or local URI (before)
    type: 'image' | 'pdf';
    name: string;
}

export interface Invoice {
    id: string;
    supplierId: string;
    supplierName: string;
    companyId: string;
    numero: string;
    fecha: number;
    fechaVencimiento?: number;
    monto: number;
    estado: InvoiceStatus;
    proyecto?: string;
    descripcion?: string;
    notas?: string;
    adjuntos?: InvoiceAttachment[];
    createdAt: number;
}

interface SupplierState {
    suppliers: Supplier[];
    invoices: Invoice[];
    loading: boolean;

    loadAll: (companyId: string) => Promise<void>;

    addSupplier: (data: Omit<Supplier, 'id' | 'createdAt'>, companyId: string) => Promise<void>;
    updateSupplier: (id: string, updates: Partial<Supplier>, companyId: string) => Promise<void>;
    deleteSupplier: (id: string, companyId: string) => Promise<void>;

    addInvoice: (data: Omit<Invoice, 'id' | 'createdAt'>, companyId: string) => Promise<void>;
    updateInvoice: (id: string, updates: Partial<Invoice>, companyId: string) => Promise<void>;
    deleteInvoice: (id: string, companyId: string) => Promise<void>;
}

export const useSupplierStore = create<SupplierState>((set) => ({
    suppliers: [],
    invoices: [],
    loading: false,

    loadAll: async (companyId) => {
        if (!companyId) return;
        set({ loading: true });
        try {
            const [sSnap, iSnap] = await Promise.all([
                getDocs(collection(db, `companies/${companyId}/suppliers`)),
                getDocs(collection(db, `companies/${companyId}/invoices`)),
            ]);
            set({
                suppliers: sSnap.docs.map(d => ({ id: d.id, ...d.data() } as Supplier)),
                invoices: iSnap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice)),
                loading: false,
            });
        } catch {
            set({ loading: false });
        }
    },

    addSupplier: async (data, companyId) => {
        const id = genId();
        const supplier: Supplier = { ...data, id, companyId, createdAt: Date.now() };
        await setDoc(doc(db, `companies/${companyId}/suppliers`, id), supplier);
        set(s => ({ suppliers: [...s.suppliers, supplier] }));
    },

    updateSupplier: async (id, updates, companyId) => {
        await updateDoc(doc(db, `companies/${companyId}/suppliers`, id), updates as any);
        set(s => ({ suppliers: s.suppliers.map(x => x.id === id ? { ...x, ...updates } : x) }));
    },

    deleteSupplier: async (id, companyId) => {
        await deleteDoc(doc(db, `companies/${companyId}/suppliers`, id));
        // Also delete all invoices from that supplier
        const state = useSupplierStore.getState();
        const supplierInvoices = state.invoices.filter(x => x.supplierId === id);
        await Promise.all(supplierInvoices.map(inv =>
            deleteDoc(doc(db, `companies/${companyId}/invoices`, inv.id))
        ));
        set(s => ({
            suppliers: s.suppliers.filter(x => x.id !== id),
            invoices: s.invoices.filter(x => x.supplierId !== id),
        }));
    },

    addInvoice: async (data, companyId) => {
        const id = genId();
        const invoice: Invoice = { ...data, id, companyId, createdAt: Date.now() };
        await setDoc(doc(db, `companies/${companyId}/invoices`, id), invoice);
        set(s => ({ invoices: [...s.invoices, invoice] }));
    },

    updateInvoice: async (id, updates, companyId) => {
        await updateDoc(doc(db, `companies/${companyId}/invoices`, id), updates as any);
        set(s => ({ invoices: s.invoices.map(x => x.id === id ? { ...x, ...updates } : x) }));
    },

    deleteInvoice: async (id, companyId) => {
        await deleteDoc(doc(db, `companies/${companyId}/invoices`, id));
        set(s => ({ invoices: s.invoices.filter(x => x.id !== id) }));
    },
}));

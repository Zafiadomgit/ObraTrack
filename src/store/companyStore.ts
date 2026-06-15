import { create } from 'zustand';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

export interface CompanyMember {
    id: string;
    role: string;
    nombre?: string;
}

interface CompanyState {
    members: CompanyMember[];
    loadMembers: (companyId: string) => Promise<void>;
}

/**
 * Roster of every user in the company (id + role). Used to resolve which
 * userIds are visible to the current user under the role hierarchy. Reading
 * the roster requires the Firestore rule that lets approved members read
 * their company's user docs.
 */
export const useCompanyStore = create<CompanyState>((set) => ({
    members: [],
    loadMembers: async (companyId) => {
        if (!companyId) return;
        try {
            const snap = await getDocs(query(collection(db, 'users'), where('companyId', '==', companyId)));
            set({
                members: snap.docs.map(d => {
                    const data = d.data() as any;
                    return { id: d.id, role: data.role, nombre: data.nombre };
                }),
            });
        } catch (e) {
            // Rules may block the roster read for some roles; fail soft so the
            // user at least keeps seeing their own data.
            console.warn('No se pudo cargar el roster de la empresa', e);
        }
    },
}));

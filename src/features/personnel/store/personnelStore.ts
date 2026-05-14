import { create } from 'zustand';
import { db } from '../../../config/firebase';
import { collection, doc, setDoc, updateDoc, deleteDoc, query, where, writeBatch, runTransaction, getDocs, limit, startAfter, QueryDocumentSnapshot } from 'firebase/firestore';
import { WorkerSchema } from '../../../core/validations/schemas';
import { ErrorService } from '../../../core/services/errorService';
import { ActivityService } from '../../../core/services/activityService';

/**
 * Each project member belongs to a Cuadrilla (crew).
 * A cuadrilla has: 1 leader + up to 2 technicians.
 * Day-worked tracking is a list of ISO date strings.
 */
export type MemberRole = 'lider' | 'tecnico' | 'ayudante';

export interface CrewMemberTemplate {
    nombre: string;
    rol: MemberRole;
    cargo: string;
    costoDia: number;
}

export interface Crew {
    id: string;
    companyId: string;
    userId?: string;
    nombre: string;
    miembros: CrewMemberTemplate[];
}

export interface Worker {
    id: string;
    createdAt: number;
    updatedAt: number;
    synced: boolean;
    userId: string;
    companyId: string;
    projectId: string;

    nombre: string;
    rol: MemberRole;
    cargo: string;              // Custom role name/title
    cuadrilla: string;          // e.g. "Cuadrilla A"
    costoDia: number;
    diasTrabajados: string[];   // ISO date strings, e.g. ["2026-03-01", "2026-03-02"]
    version?: number;
}

export interface PersonnelState {
    workers: Worker[];
    crews: Crew[];
    
    lastWorkerDoc: QueryDocumentSnapshot<any> | null;
    hasMoreWorkers: boolean;
    loadingWorkers: boolean;
    loadingMoreWorkers: boolean;

    loadPersonnel: (userId: string, companyId: string, role: string) => Promise<void>;
    loadMorePersonnel: (userId: string, companyId: string, role: string) => Promise<void>;
    clearPersonnel: () => void;

    addWorker: (data: Omit<Worker, 'id' | 'createdAt' | 'updatedAt' | 'synced' | 'diasTrabajados' | 'version'>, companyId: string) => Promise<void>;
    updateWorker: (id: string, currentVersion: number, data: Partial<Worker>, companyId: string) => Promise<void>;
    deleteWorker: (id: string, companyId: string) => Promise<void>;
    registrarDia: (workerId: string, currentVersion: number, fecha: string, companyId: string) => Promise<void>;
    quitarDia: (workerId: string, currentVersion: number, fecha: string, companyId: string) => Promise<void>;

    // Crew methods
    addCrew: (nombre: string, miembros: CrewMemberTemplate[], userId: string, companyId: string) => Promise<void>;
    deleteCrew: (id: string, companyId: string) => Promise<void>;
    addCrewToProject: (crewId: string, projectId: string, userId: string, companyId: string) => Promise<void>;
}

const generateId = () => Math.random().toString(36).substr(2, 9);
let unsubWorkers: (() => void) | null = null;
let unsubCrews: (() => void) | null = null;

export const usePersonnelStore = create<PersonnelState>((set, get) => ({
    workers: [],
    crews: [],
    lastWorkerDoc: null,
    hasMoreWorkers: true,
    loadingWorkers: false,
    loadingMoreWorkers: false,

    loadPersonnel: async (userId, companyId, role) => {
        if (!companyId) return;
        set({ loadingWorkers: true, hasMoreWorkers: true });

        try {
            let wQuery = collection(db, `companies/${companyId}/workers`) as any;
            let cQuery = collection(db, `companies/${companyId}/crews`) as any;

            if (role !== 'superAdmin') {
                wQuery = query(wQuery, where('userId', '==', userId));
                cQuery = query(cQuery, where('userId', '==', userId));
            }

            wQuery = query(wQuery, limit(20));

            // Load crews fully
            const cSnapshot = await getDocs(cQuery);
            const crewsLoaded = cSnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Crew));
            
            // Load workers
            const wSnapshot = await getDocs(wQuery);
            const workersLoaded = wSnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Worker));

            set({
                workers: workersLoaded,
                crews: crewsLoaded,
                lastWorkerDoc: wSnapshot.docs.length > 0 ? wSnapshot.docs[wSnapshot.docs.length - 1] : null,
                hasMoreWorkers: wSnapshot.docs.length === 20,
                loadingWorkers: false
            });
        } catch (error) {
            ErrorService.handleError(error, 'Load Personnel');
            set({ loadingWorkers: false });
        }
    },

    loadMorePersonnel: async (userId, companyId, role) => {
        const { lastWorkerDoc, hasMoreWorkers, loadingMoreWorkers } = get();
        if (!companyId || !lastWorkerDoc || !hasMoreWorkers || loadingMoreWorkers) return;

        set({ loadingMoreWorkers: true });
        
        try {
            let wQuery = collection(db, `companies/${companyId}/workers`) as any;
            if (role !== 'superAdmin') {
                wQuery = query(wQuery, where('userId', '==', userId));
            }
            wQuery = query(wQuery, startAfter(lastWorkerDoc), limit(20));
            
            const wSnapshot = await getDocs(wQuery);
            const workersLoaded = wSnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Worker));

            set(state => ({
                workers: [...state.workers, ...workersLoaded],
                lastWorkerDoc: wSnapshot.docs.length > 0 ? wSnapshot.docs[wSnapshot.docs.length - 1] : state.lastWorkerDoc,
                hasMoreWorkers: wSnapshot.docs.length === 20,
                loadingMoreWorkers: false
            }));
        } catch (error) {
            ErrorService.handleError(error, 'Load More Personnel');
            set({ loadingMoreWorkers: false });
        }
    },

    clearPersonnel: () => {
        set({ workers: [], crews: [], lastWorkerDoc: null, hasMoreWorkers: true });
    },

    addWorker: async (data, companyId) => {
        try {
            const id = generateId();
            const newWorker: Worker = {
                ...data,
                id,
                companyId,
                diasTrabajados: [],
                createdAt: Date.now(),
                updatedAt: Date.now(),
                synced: true,
                version: 1
            };
            
            const parsed = WorkerSchema.safeParse(newWorker);
            if (!parsed.success) throw parsed.error;

            await setDoc(doc(db, `companies/${companyId}/workers`, id), parsed.data);
            set(state => ({ workers: [parsed.data as Worker, ...state.workers] }));
            ActivityService.logActivity(companyId, data.userId, 'added_worker', 'worker', id, `Trabajador "${parsed.data.nombre}" registrado.`);
        } catch (error) {
            ErrorService.handleError(error, 'Add Worker');
        }
    },

    updateWorker: async (id, currentVersion, data, companyId) => {
        try {
            const docRef = doc(db, `companies/${companyId}/workers`, id);
            await runTransaction(db, async (transaction) => {
                const docSnap = await transaction.get(docRef);
                if (!docSnap.exists()) throw new Error('Trabajador no existe');
                if (docSnap.data().version !== currentVersion) throw new Error('Conflicto: trabajador modificado por otro usuario.');

                const updatedData = {
                    ...docSnap.data(),
                    ...data,
                    updatedAt: Date.now(),
                    version: currentVersion + 1
                };
                transaction.update(docRef, updatedData);
                set(state => ({ workers: state.workers.map(w => w.id === id ? updatedData as Worker : w) }));
            });
            ActivityService.logActivity(companyId, 'system', 'updated_worker', 'worker', id, `Trabajador actualizado.`);
        } catch (error) {
            ErrorService.handleError(error, 'Update Worker');
        }
    },

    deleteWorker: async (id, companyId) => {
        try {
            await deleteDoc(doc(db, `companies/${companyId}/workers`, id));
            set(state => ({ workers: state.workers.filter(w => w.id !== id) }));
            ActivityService.logActivity(companyId, 'system', 'deleted_worker', 'worker', id, `Trabajador eliminado.`);
        } catch (error) {
            ErrorService.handleError(error, 'Delete Worker');
        }
    },

    registrarDia: async (workerId, currentVersion, fecha, companyId) => {
        try {
            const docRef = doc(db, `companies/${companyId}/workers`, workerId);
            await runTransaction(db, async (transaction) => {
                const docSnap = await transaction.get(docRef);
                if (!docSnap.exists()) throw new Error('Trabajador no encontrado');
                
                const wData = docSnap.data() as Worker;
                if (wData.version !== currentVersion) throw new Error('Conflicto detectado.');

                if (!wData.diasTrabajados.includes(fecha)) {
                    const newData = {
                        diasTrabajados: [...wData.diasTrabajados, fecha],
                        updatedAt: Date.now(),
                        version: currentVersion + 1
                    };
                    transaction.update(docRef, newData);
                    set(state => ({ workers: state.workers.map(w => w.id === workerId ? {...w, ...newData} : w) }));
                }
            });
            ActivityService.logActivity(companyId, 'system', 'registered_day', 'worker', workerId, `Día de trabajo registrado para el ${fecha}.`);
        } catch (error) {
            ErrorService.handleError(error, 'Registrar Día');
        }
    },

    quitarDia: async (workerId, currentVersion, fecha, companyId) => {
        try {
            const docRef = doc(db, `companies/${companyId}/workers`, workerId);
            await runTransaction(db, async (transaction) => {
                const docSnap = await transaction.get(docRef);
                if (!docSnap.exists()) throw new Error('Trabajador no encontrado');
                
                const wData = docSnap.data() as Worker;
                if (wData.version !== currentVersion) throw new Error('Conflicto detectado.');

                if (wData.diasTrabajados.includes(fecha)) {
                    const newData = {
                        diasTrabajados: wData.diasTrabajados.filter(d => d !== fecha),
                        updatedAt: Date.now(),
                        version: currentVersion + 1
                    };
                    transaction.update(docRef, newData);
                    set(state => ({ workers: state.workers.map(w => w.id === workerId ? {...w, ...newData} : w) }));
                }
            });
        } catch (error) {
            ErrorService.handleError(error, 'Quitar Día');
        }
    },

    addCrew: async (nombre, miembros, userId, companyId) => {
        try {
            const id = generateId();
            const newDoc = { id, nombre, miembros, userId, companyId };
            await setDoc(doc(db, `companies/${companyId}/crews`, id), newDoc);
            set(state => ({ crews: [newDoc as any, ...state.crews]}));
        } catch (error) {
            ErrorService.handleError(error, 'Add Crew');
        }
    },

    deleteCrew: async (id, companyId) => {
        try {
            await deleteDoc(doc(db, `companies/${companyId}/crews`, id));
            set(state => ({ crews: state.crews.filter(c => c.id !== id) }));
        } catch (error) {
            ErrorService.handleError(error, 'Delete Crew');
        }
    },

    addCrewToProject: async (crewId, projectId, userId, companyId) => {
        try {
            const { crews } = get();
            const crew = crews.find(c => c.id === crewId);
            if (!crew) return;

            const batch = writeBatch(db);
            const newLocalWorkers: Worker[] = [];

            crew.miembros.forEach(m => {
                const workerId = generateId();
                const newWorker: Worker = {
                    id: workerId,
                    projectId,
                    userId,
                    companyId,
                    nombre: m.nombre,
                    rol: m.rol,
                    cargo: m.cargo || (m.rol === 'lider' ? 'Líder' : 'Técnico'),
                    cuadrilla: crew.nombre,
                    costoDia: m.costoDia,
                    diasTrabajados: [],
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    synced: true,
                    version: 1,
                };
                
                // Light validation here for bulk insert
                const parsed = WorkerSchema.safeParse(newWorker);
                if (parsed.success) {
                    batch.set(doc(db, `companies/${companyId}/workers`, workerId), parsed.data);
                    newLocalWorkers.push(parsed.data as Worker);
                }
            });

            await batch.commit();
            
            // local state update for new workers
            set(state => ({ workers: [...newLocalWorkers, ...state.workers] }));
            
            ActivityService.logActivity(companyId, userId, 'crew_assigned', 'crew', crewId, `Cuadrilla asignada al proyecto ${projectId}.`);
        } catch (error) {
            ErrorService.handleError(error, 'Add Crew To Project');
        }
    },
}));

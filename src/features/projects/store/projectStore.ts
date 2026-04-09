import { create } from 'zustand';
import { db } from '../../../config/firebase';
import { collection, doc, setDoc, updateDoc, deleteDoc, query, where, runTransaction, getDocs, limit, startAfter, QueryDocumentSnapshot, DocumentData, orderBy } from 'firebase/firestore';
import { ProjectType } from '../../../features/materials/data/standardMaterials';
import { ProjectSchema } from '../../../core/validations/schemas';
import { ErrorService } from '../../../core/services/errorService';
import { ActivityService } from '../../../core/services/activityService';

export type ProjectStatus = 'activo' | 'pausa' | 'completado';

export interface Project {
    id: string;
    createdAt: number;
    updatedAt: number;
    synced: boolean;
    userId: string;
    companyId?: string;
    collaborators?: string[];

    nombreProyecto: string;
    ubicacion: string;
    fechaInicio: string;
    fechaFin?: string;          // optional deadline
    estado: ProjectStatus;
    tipoProyecto: ProjectType;
    version?: number;
}

interface ProjectState {
    projects: Project[];
    lastDoc: QueryDocumentSnapshot<any> | null;
    hasMore: boolean;
    loading: boolean;
    loadingMore: boolean;

    addProject: (data: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'synced' | 'estado'>) => Promise<string>;
    updateProject: (id: string, currentVersion: number, data: Partial<Project>, companyId: string) => Promise<void>;
    deleteProject: (id: string, companyId: string, userId?: string) => Promise<void>;
    
    loadProjects: (userId: string, companyId: string, role: string) => Promise<void>;
    loadMoreProjects: (userId: string, companyId: string, role: string) => Promise<void>;
    clearProjects: () => void;
}

let unsub: (() => void) | null = null;
const generateId = () => Math.random().toString(36).substr(2, 9);

export const useProjectStore = create<ProjectState>((set, get) => ({
    projects: [],
    lastDoc: null,
    hasMore: true,
    loading: false,
    loadingMore: false,

    loadProjects: async (userId, companyId, role) => {
        if (!companyId) return;
        set({ loading: true, hasMore: true });

        try {
            let q = collection(db, `companies/${companyId}/projects`) as any;
            if (role !== 'superAdmin') {
                q = query(q, where('userId', '==', userId));
            }
            q = query(q, limit(15)); // No orderBy to avoid complex index requirements initially, relying on default ID sort

            const snapshot = await getDocs(q);
            const loaded = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
            
            set({ 
                projects: loaded, 
                lastDoc: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
                hasMore: snapshot.docs.length === 15,
                loading: false 
            });
        } catch (error) {
            ErrorService.handleError(error, 'Load Projects');
            set({ loading: false });
        }
    },

    loadMoreProjects: async (userId, companyId, role) => {
        const { lastDoc, hasMore, loadingMore } = get();
        if (!companyId || !lastDoc || !hasMore || loadingMore) return;
        
        set({ loadingMore: true });

        try {
            let q = collection(db, `companies/${companyId}/projects`) as any;
            if (role !== 'superAdmin') {
                q = query(q, where('userId', '==', userId));
            }
            q = query(q, startAfter(lastDoc), limit(15));

            const snapshot = await getDocs(q);
            const loaded = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
            
            set(state => ({ 
                projects: [...state.projects, ...loaded], 
                lastDoc: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : state.lastDoc,
                hasMore: snapshot.docs.length === 15,
                loadingMore: false 
            }));
        } catch (error) {
            ErrorService.handleError(error, 'Load More Projects');
            set({ loadingMore: false });
        }
    },

    clearProjects: () => {
        set({ projects: [], lastDoc: null, hasMore: true });
    },

    addProject: async (data) => {
        try {
            const id = generateId();
            const newProj = {
                ...data,
                id,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                synced: true,
                estado: 'activo' as const,
                version: 1,
                companyId: data.companyId || 'default-company',
                fechaInicio: data.fechaInicio || new Date().toISOString().split('T')[0]
            };
            
            const parsed = ProjectSchema.safeParse(newProj);
            if (!parsed.success) {
                throw parsed.error;
            }

            await setDoc(doc(db, `companies/${newProj.companyId}/projects`, id), parsed.data);
            
            set(state => ({ projects: [parsed.data as Project, ...state.projects] }));
            
            ActivityService.logActivity(newProj.companyId, data.userId, 'created_project', 'project', id, `Proyecto "${newProj.nombreProyecto}" creado.`);
            
            return id;
        } catch (error) {
            ErrorService.handleError(error, 'Add Project');
            throw error;
        }
    },

    updateProject: async (id, currentVersion, data, companyId) => {
        try {
            const docRef = doc(db, `companies/${companyId}/projects`, id);
            
            await runTransaction(db, async (transaction) => {
                const docSnap = await transaction.get(docRef);
                if (!docSnap.exists()) throw new Error('El proyecto no existe.');
                
                const existingData = docSnap.data();
                if (existingData.version !== currentVersion) {
                    throw new Error('Conflicto detectado: Alguien más ha modificado este proyecto.');
                }
                
                const updatedData = {
                    ...existingData,
                    ...data,
                    updatedAt: Date.now(),
                    version: currentVersion + 1
                };
                
                // Partial validation could be complex, but let's assume valid data for now if Zod passed at form level
                transaction.update(docRef, updatedData);
                
                // Update local state
                set(state => ({
                    projects: state.projects.map(p => p.id === id ? updatedData as Project : p)
                }));
            });
            
            const userId = data.userId || 'unknown_user';
            ActivityService.logActivity(companyId, userId, 'updated_project', 'project', id, `Proyecto actualizado correctamente.`);
        } catch (error) {
            ErrorService.handleError(error, 'Update Project');
            throw error;
        }
    },

    deleteProject: async (id, companyId, userId) => {
        try {
            await deleteDoc(doc(db, `companies/${companyId}/projects`, id));
            set(state => ({ projects: state.projects.filter(p => p.id !== id) }));
            ActivityService.logActivity(companyId, userId || 'unknown', 'deleted_project', 'project', id, `Proyecto eliminado.`);
        } catch (error) {
            ErrorService.handleError(error, 'Delete Project');
            throw error;
        }
    }
}));

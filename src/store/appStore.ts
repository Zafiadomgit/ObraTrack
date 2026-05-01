import { create } from 'zustand';
import { auth, db, secondaryAuth } from '../config/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, setPersistence, inMemoryPersistence, deleteUser as deleteFirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

export type UserRole = 'admin' | 'coordinador' | 'lider' | 'conductor' | 'logistica';

export interface User {
    id: string;
    companyId?: string;
    companyName?: string;
    nombre: string;
    cedula?: string;
    telefono?: string;
    email: string;
    role: UserRole;
    plan: 'free' | 'premium' | 'enterprise';
    status: 'pending' | 'approved' | 'suspended';
    fechaRegistro: string;
    hasCompletedOnboarding?: boolean;
}

interface AppState {
    user: User | null;
    setUser: (user: User | null) => void;
    login: (email: string, pass: string) => Promise<{ success: boolean; reason?: string }>;
    registerCompany: (nombre: string, email: string, pass: string, cedula: string, companyName: string, plan?: 'free' | 'premium' | 'enterprise') => Promise<{ success: boolean; reason?: string }>;
    registerUser: (nombre: string, email: string, pass: string, cedula: string, role: UserRole, forceApprove?: boolean, telefono?: string, companyId?: string) => Promise<{ success: boolean; reason?: string }>;
    updateUser: (id: string, data: Partial<User>) => Promise<void>;
    deleteUser: (id: string) => Promise<void>;
    logout: () => Promise<void>;
    deleteOwnAccount: () => Promise<{ success: boolean; reason?: string }>;
    completeOnboarding: () => Promise<void>;
    upgradeToPro: () => Promise<void>;
}

const today = () => new Date().toISOString().split('T')[0];

// Firebase REST API key (safe for client apps — protected by Firebase Security Rules)
const FIREBASE_API_KEY = 'AIzaSyDmf0VP25w5Xl5AwKy4LoHra5YrxFQIEO0';

export const useAppStore = create<AppState>((set, get) => ({
    user: null,

    setUser: (u) => set({ user: u }),

    login: async (email, pass) => {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, pass);
            const uid = userCredential.user.uid;
            const userDoc = await getDoc(doc(db, 'users', uid));

            if (userDoc.exists()) {
                const userData = userDoc.data() as User;
                if (userData.status === 'approved') {
                    set({ user: userData });
                    return { success: true };
                } else {
                    await signOut(auth);
                    return { success: false, reason: 'Tu cuenta está pendiente de aprobación por el Administrador.' };
                }
            } else {
                // If it's a new firebase user without firestore doc
                if (email === 'admin@obratrack.com') {
                    const adminUser: User = {
                        id: uid, nombre: 'Administrador Supremo', email,
                        role: 'superAdmin' as any, plan: 'premium', status: 'approved',
                        fechaRegistro: today(), hasCompletedOnboarding: true,
                        companyId: 'default-company'
                    };
                    await setDoc(doc(db, 'users', uid), adminUser);
                    set({ user: adminUser });
                    return { success: true };
                }
                return { success: false, reason: 'Usuario no encontrado en la base de datos de roles.' };
            }
        } catch (error: any) {
            let reason = 'Error de autenticación: ' + error.message;
            if (error.code === 'auth/user-not-found') reason = 'Usuario no encontrado';
            if (error.code === 'auth/wrong-password') reason = 'Contraseña incorrecta';
            if (error.code === 'auth/invalid-credential') reason = 'Credenciales no válidas.';
            return { success: false, reason };
        }
    },

    registerCompany: async (nombre, email, pass, cedula, companyName, plan = 'free') => {
        try {
            // Sign up and log in immediately as the admin of the new company
            const credential = await createUserWithEmailAndPassword(auth, email, pass);
            const uid = credential.user.uid;
            
            // Generate a unique company code that the admin can share
            const companyId = "EMP-" + Math.random().toString(36).substring(2, 8).toUpperCase();

            const newAdmin: User = {
                id: uid,
                companyId,
                companyName,
                nombre,
                cedula,
                email,
                role: 'admin',
                status: 'approved',
                plan: plan as any,
                fechaRegistro: today(),
                hasCompletedOnboarding: false,
            };

            await setDoc(doc(db, 'users', uid), newAdmin);
            set({ user: newAdmin });
            return { success: true };
        } catch (error: any) {
            let reason = 'Error al crear empresa: ' + error.message;
            if (error.code === 'auth/email-already-in-use') reason = 'El correo ya está registrado.';
            return { success: false, reason };
        }
    },

    registerUser: async (nombre, email, pass, cedula, role, forceApprove = false, telefono = '', companyId = 'default-company') => {
        try {
            let uid: string;

            if (forceApprove) {
                // ─── Admin creating a user via REST API ───────────────────────────
                // This is the ONLY safe way to create a user server-side without
                // touching the browser's auth state and logging out the admin.
                const response = await fetch(
                    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password: pass, returnSecureToken: false }),
                    }
                );
                const data = await response.json();
                if (data.error) {
                    const code = data.error.message;
                    if (code === 'EMAIL_EXISTS') throw new Error('El correo ya está registrado en Firebase.');
                    throw new Error(data.error.message);
                }
                uid = data.localId;
            } else {
                // ─── Self-registration (new user signs up) ────────────────────────
                // We must use the main auth instance so that setDoc has permissions.
                const credential = await createUserWithEmailAndPassword(auth, email, pass);
                uid = credential.user.uid;
            }

            const isAdminUser = email.toLowerCase() === 'admin@obratrack.com';
            const newUser: User = {
                id: uid,
                companyId,
                nombre,
                cedula,
                ...(telefono ? { telefono } : {}),
                email,
                role: isAdminUser ? ('superAdmin' as any) : role,
                status: (isAdminUser || forceApprove) ? 'approved' : 'pending',
                plan: 'free',
                fechaRegistro: today(),
                hasCompletedOnboarding: false,
            };

            await setDoc(doc(db, 'users', uid), newUser);
            
            if (!forceApprove && !isAdminUser) {
                // Empleado que se auto-registra queda PENDIENTE. Cerrar sesión.
                await signOut(auth);
            }

            return { success: true };

        } catch (error: any) {
            let reason = 'Error al registrar: ' + error.message;
            if (error.code === 'auth/email-already-in-use') reason = 'El correo ya está registrado en Firebase.';
            return { success: false, reason };
        }
    },

    updateUser: async (id, data) => {
        await updateDoc(doc(db, 'users', id), data as any);
        const current = get().user;
        if (current && current.id === id) {
            set({ user: { ...current, ...data } });
        }
    },

    deleteUser: async (id) => {
        await deleteDoc(doc(db, 'users', id));
    },

    completeOnboarding: async () => {
        const current = get().user;
        if (!current) return;
        await updateDoc(doc(db, 'users', current.id), { hasCompletedOnboarding: true });
        set({ user: { ...current, hasCompletedOnboarding: true } });
    },

    upgradeToPro: async () => {
        const current = get().user;
        if (!current) return;
        await updateDoc(doc(db, 'users', current.id), { plan: 'premium' });
        set({ user: { ...current, plan: 'premium' } });
    },

    logout: async () => {
        await signOut(auth);
        set({ user: null });
    },

    deleteOwnAccount: async () => {
        const current = get().user;
        if (!current) return { success: false, reason: 'No hay sesión activa.' };
        try {
            await deleteDoc(doc(db, 'users', current.id));
            const firebaseUser = auth.currentUser;
            if (firebaseUser) await deleteFirebaseUser(firebaseUser);
            set({ user: null });
            return { success: true };
        } catch (error: any) {
            if (error.code === 'auth/requires-recent-login') {
                return { success: false, reason: 'Por seguridad, vuelve a iniciar sesión y luego elimina tu cuenta.' };
            }
            return { success: false, reason: 'Error al eliminar la cuenta: ' + error.message };
        }
    },
}));

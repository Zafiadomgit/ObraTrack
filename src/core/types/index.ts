/**
 * ObraTrack - Shared Domain Types
 * These interfaces are the canonical source of truth for all entities in the app.
 */

export type UserRole = 'admin' | 'coordinador' | 'lider' | 'conductor' | 'logistica';
export type UserStatus = 'pending' | 'approved' | 'suspended';
export type ProjectStatus = 'Activo' | 'En pausa' | 'Completado';
export type MaterialUnit = 'unidades' | 'kg' | 'litros' | 'm2' | 'm3' | 'metros' | 'bolsas';

export interface AppUser {
    id: string;
    companyId?: string;
    nombre: string;
    cedula?: string;
    email: string;
    role: UserRole;
    plan: 'free' | 'pro';
    status: UserStatus;
    fechaRegistro: string;
    hasCompletedOnboarding?: boolean;
    projectIds?: string[];
    updatedAt?: number;
    version?: number;
}

export interface Project {
    id: string;
    companyId?: string;
    name: string;
    location: string;
    description?: string;
    status: ProjectStatus;
    progress: number;
    startDate?: string;
    endDate?: string;
    createdAt: string;
    updatedAt?: number;
    version?: number;
    ownerId: string;
    teamIds?: string[];
}

export interface Material {
    id: string;
    companyId?: string;
    name: string;
    quantity: number;
    unit: MaterialUnit;
    category?: string;
    description?: string;
    projectId?: string;
    updatedAt?: number;
    version?: number;
}

export interface Worker {
    id: string;
    companyId?: string;
    nombre: string;
    cedula?: string;
    role: UserRole;
    projectId?: string;
    startDate?: string;
    daysWorked?: number;
    updatedAt?: number;
    version?: number;
}

export interface DailyLog {
    id: string;
    companyId?: string;
    projectId: string;
    date: string;
    description: string;
    progress?: number;
    createdBy: string;
    photos?: string[];
    updatedAt?: number;
    version?: number;
}

export interface Report {
    id: string;
    projectId: string;
    date: string;
    generatedBy: string;
    pdfUrl?: string;
    type: 'daily' | 'weekly' | 'monthly';
}

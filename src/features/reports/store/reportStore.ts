import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface DailyLog {
    id: string; // was logId
    createdAt: number;
    updatedAt: number;
    synced: boolean;
    userId: string;
    companyId: string;
    projectId: string;
    version?: number;

    fecha: string;
    actividades: string;
    clima: 'soleado' | 'nublado' | 'lluvia';
    observaciones: string;
    listaFotos: string[]; // URIs
    trabajadoresPresentes: string[]; // Array de worker IDs
    horaInicio?: string; // ISO string or simple HH:mm
    horaFin?: string;    // ISO string or simple HH:mm
}

interface ReportState {
    dailyLogs: DailyLog[];
    addLog: (data: Omit<DailyLog, 'id' | 'createdAt' | 'updatedAt' | 'synced' | 'version'>, companyId: string) => void;
    updateLog: (id: string, currentVersion: number, data: Partial<DailyLog>) => void;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

export const useReportStore = create<ReportState>()(
    persist(
        (set) => ({
            dailyLogs: [],

            addLog: (data, companyId) => set((s) => ({
                dailyLogs: [...s.dailyLogs, {
                    ...data,
                    companyId,
                    id: generateId(),
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    synced: false,
                    version: 1,
                }]
            })),

            updateLog: (id, currentVersion, data) => set((s) => ({
                dailyLogs: s.dailyLogs.map(l =>
                    l.id === id && l.version === currentVersion ? {
                        ...l,
                        ...data,
                        updatedAt: Date.now(),
                        synced: false,
                        version: currentVersion + 1
                    } : l
                )
            })),
        }),
        {
            name: 'obratrack-reports-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);

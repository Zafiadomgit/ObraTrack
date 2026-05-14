import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'obratrack_theme';

interface ThemeState {
    isDark: boolean;
    toggle: () => Promise<void>;
    loadTheme: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
    isDark: true,

    toggle: async () => {
        const next = !get().isDark;
        set({ isDark: next });
        await AsyncStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light');
    },

    loadTheme: async () => {
        try {
            const stored = await AsyncStorage.getItem(STORAGE_KEY);
            set({ isDark: stored !== 'light' }); // default dark
        } catch {
            /* keep default */
        }
    },
}));

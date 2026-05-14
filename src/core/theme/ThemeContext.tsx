import React from 'react';
import { useThemeStore } from './themeStore';

// ─── Dark palette (original) ──────────────────────────────────────────────────
export const DARK_COLORS = {
    primary: '#00458B',
    primaryDark: '#003366',
    primaryLight: '#3370A8',
    secondary: '#606B7D',
    secondaryDark: '#4A5361',
    secondaryLight: '#8C95A3',

    background: '#0F1923',
    surface: '#1A2635',
    surfaceLight: '#243347',
    border: '#2E4060',

    textPrimary: '#F0F4F8',
    textSecondary: '#8A9BB0',
    textMuted: '#5A7090',

    success: '#8DC63F',
    warning: '#F39C12',
    danger: '#E74C3C',
    info: '#3498DB',

    white: '#FFFFFF',
    black: '#000000',
    overlay: 'rgba(0,0,0,0.6)',
    glassBg: 'rgba(26, 38, 53, 0.85)',
};

// ─── Light palette ────────────────────────────────────────────────────────────
export const LIGHT_COLORS = {
    primary: '#00458B',
    primaryDark: '#003366',
    primaryLight: '#3370A8',
    secondary: '#606B7D',
    secondaryDark: '#4A5361',
    secondaryLight: '#8C95A3',

    background: '#F1F5F9',
    surface: '#FFFFFF',
    surfaceLight: '#F8FAFC',
    border: '#CBD5E1',

    textPrimary: '#1E293B',
    textSecondary: '#475569',
    textMuted: '#94A3B8',

    success: '#16A34A',
    warning: '#D97706',
    danger: '#DC2626',
    info: '#2563EB',

    white: '#1E293B',      // "white text" → dark in light mode
    black: '#000000',
    overlay: 'rgba(0,0,0,0.35)',
    glassBg: 'rgba(255,255,255,0.9)',
};

export type ThemeColors = typeof DARK_COLORS;

// ─── Context ──────────────────────────────────────────────────────────────────
export const ThemeContext = React.createContext<ThemeColors>(DARK_COLORS);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const isDark = useThemeStore(s => s.isDark);
    const colors = isDark ? DARK_COLORS : LIGHT_COLORS;
    return (
        <ThemeContext.Provider value={colors}>
            {children}
        </ThemeContext.Provider>
    );
}

/** Hook: returns current theme colors (reactive, re-renders on toggle). */
export function useColors(): ThemeColors {
    return React.useContext(ThemeContext);
}

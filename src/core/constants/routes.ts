/**
 * ObraTrack Named Routes
 * Use these constants instead of raw strings when navigating.
 * Prevents typo bugs and makes refactoring easier.
 */

export const ROUTES = {
    // Auth Stack
    LOGIN: 'Login',
    REGISTER: 'Register',
    ONBOARDING: 'Onboarding',
    WEB_LANDING: 'WebLanding',

    // App Stack
    HOME: 'Home',
    DASHBOARD: 'Dashboard',

    // Nested
    PROJECT_DETAIL: 'ProjectDetail',
    MATERIALS: 'Materials',
    LOGISTICS: 'Logistics',
    DAILY_LOG: 'DailyLog',
    PERSONNEL: 'Personnel',
    REPORTS: 'Reports',
    SUPPLIERS: 'Suppliers',
    USER_MANAGEMENT: 'UserManagement',
} as const;

export type RouteKey = keyof typeof ROUTES;
export type RouteName = typeof ROUTES[RouteKey];

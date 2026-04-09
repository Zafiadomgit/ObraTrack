/**
 * ObraTrack Plan Limits
 * All plan restrictions must reference these constants.
 * 
 * Plan pricing:
 *   free:       $0
 *   premium:    $45.000 COP / mes  (Play Store ID: obratrack_premium_monthly)
 *   enterprise: $95.000 COP / mes  (Play Store ID: obratrack_enterprise_monthly)
 */

export type PlanTier = 'free' | 'premium' | 'enterprise';

export interface PlanLimits {
    // User limits by role
    MAX_ADMINS: number;
    MAX_COORDINADORES: number;
    MAX_LIDERES: number;
    MAX_LOGISTICA: number;
    MAX_CONDUCTORES: number;

    // Project & feature limits
    MAX_PROJECTS: number;
    MAX_PHOTOS_PER_LOG: number;
    MAX_MATERIALS: number;

    // Feature flags
    CAN_EXPORT_PDF: boolean;
    CAN_USE_REPORTS: boolean;
    CAN_USE_LOGISTICS: boolean;
    CAN_ADD_EXTRA_USERS: boolean;   // only premium+ can add extra-user packs
}

export const FREE_PLAN: PlanLimits = {
    MAX_ADMINS: 1,
    MAX_COORDINADORES: 1,
    MAX_LIDERES: 1,
    MAX_LOGISTICA: 1,
    MAX_CONDUCTORES: 1,
    MAX_PROJECTS: 1,
    MAX_PHOTOS_PER_LOG: 3,
    MAX_MATERIALS: 20,
    CAN_EXPORT_PDF: false,
    CAN_USE_REPORTS: false,
    CAN_USE_LOGISTICS: false,
    CAN_ADD_EXTRA_USERS: false,
};

export const PREMIUM_PLAN: PlanLimits = {
    MAX_ADMINS: 5,
    MAX_COORDINADORES: 5,
    MAX_LIDERES: 5,
    MAX_LOGISTICA: 5,
    MAX_CONDUCTORES: 5,
    MAX_PROJECTS: 5,
    MAX_PHOTOS_PER_LOG: 20,
    MAX_MATERIALS: 200,
    CAN_EXPORT_PDF: true,
    CAN_USE_REPORTS: true,
    CAN_USE_LOGISTICS: true,
    CAN_ADD_EXTRA_USERS: true,
};

export const ENTERPRISE_PLAN: PlanLimits = {
    MAX_ADMINS: Infinity,
    MAX_COORDINADORES: Infinity,
    MAX_LIDERES: Infinity,
    MAX_LOGISTICA: Infinity,
    MAX_CONDUCTORES: Infinity,
    MAX_PROJECTS: Infinity,
    MAX_PHOTOS_PER_LOG: Infinity,
    MAX_MATERIALS: Infinity,
    CAN_EXPORT_PDF: true,
    CAN_USE_REPORTS: true,
    CAN_USE_LOGISTICS: true,
    CAN_ADD_EXTRA_USERS: true,
};

export const PLAN_PRICES: Record<PlanTier, { label: string; price: string; priceValue: number; period: string }> = {
    free: { label: 'Gratis', price: '$0', priceValue: 0, period: '' },
    premium: { label: 'Premium', price: '$44.900 COP', priceValue: 44900, period: '/mes' },
    enterprise: { label: 'Enterprise', price: '$94.900 COP', priceValue: 94900, period: '/mes' },
};

export const ADDON_PRICES = {
    EXTRA_USER: { label: 'Usuario adicional', price: '$9.900 COP', priceValue: 9900 },
    EXTRA_PROJECT: { label: 'Proyecto adicional', price: '$14.900 COP', priceValue: 14900 },
};

// Play Store product IDs (configure in Google Play Console)
export const PLAY_STORE_PRODUCT_IDS: Record<Exclude<PlanTier, 'free'>, string> = {
    premium: 'obratrack_premium_monthly',
    enterprise: 'obratrack_enterprise_monthly',
};

export function getPlanLimits(plan: PlanTier | string): PlanLimits {
    if (plan === 'enterprise') return ENTERPRISE_PLAN;
    if (plan === 'premium') return PREMIUM_PLAN;
    return FREE_PLAN;
}

/** @deprecated Use getPlanLimits with 'premium' instead */
export const PRO_PLAN = PREMIUM_PLAN;


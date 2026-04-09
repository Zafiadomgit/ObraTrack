import { useAppStore } from '../../../store/appStore';
import { useProjectStore } from '../../projects/store/projectStore';
import { getPlanLimits, PlanTier } from '../../../core/constants/plans';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { UserRole } from '../../../store/appStore';

/**
 * 🛡️ useSubscription Hook
 * Centraliza la lógica de permisos y límites según el plan del admin de la compañía.
 * Uses getPlanLimits() from core/constants — never hardcode plan limits elsewhere.
 */
export const useSubscription = () => {
    const user = useAppStore(state => state.user);
    const projectsCount = useProjectStore(state => state.projects.length);

    const plan = (user?.plan as PlanTier) || 'free';
    const limits = getPlanLimits(plan);

    const isPremium = plan === 'premium' || plan === 'enterprise';
    const isEnterprise = plan === 'enterprise';

    /** Map role → limit field */
    const getLimitForRole = (role: UserRole | string): number => {
        switch (role) {
            case 'admin':       return limits.MAX_ADMINS;
            case 'coordinador': return limits.MAX_COORDINADORES;
            case 'lider':       return limits.MAX_LIDERES;
            case 'logistica':   return limits.MAX_LOGISTICA;
            case 'conductor':   return limits.MAX_CONDUCTORES;
            default:            return 1;
        }
    };

    return {
        // Plan state
        isPro: isPremium,           // backward-compat alias
        isPremium,
        isEnterprise,
        planName: plan,
        limits,

        // Project limit
        canCreateProject: isEnterprise || projectsCount < limits.MAX_PROJECTS,
        projectsUsed: projectsCount,
        projectsLimit: limits.MAX_PROJECTS,

        // User limit helpers (async — fetch count from Firestore)
        canAddUserOfRole: async (role: UserRole | string, companyId: string): Promise<boolean> => {
            if (isEnterprise) return true;
            const max = getLimitForRole(role);
            if (max === Infinity) return true;
            try {
                const snap = await getDocs(
                    query(
                        collection(db, 'users'),
                        where('companyId', '==', companyId),
                        where('role', '==', role),
                        where('status', '==', 'approved')
                    )
                );
                return snap.size < max;
            } catch {
                return true; // fail open
            }
        },

        getLimitForRole,

        // Feature gates (kept for backward compat)
        canGenerateReport: () => limits.CAN_EXPORT_PDF,
        canAddPhotos: (currentPhotosCount: number) =>
            isPremium || currentPhotosCount < limits.MAX_PHOTOS_PER_LOG,
        canAddCollaborator: () => isPremium || limits.MAX_COORDINADORES > 1,
        canUseLogistics: () => limits.CAN_USE_LOGISTICS,
        canUseReports: () => limits.CAN_USE_REPORTS,
    };
};

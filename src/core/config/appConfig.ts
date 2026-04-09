// Legacy alias — prefer importing getPlanLimits from 'core/constants/plans' directly
import { FREE_PLAN } from '../constants/plans';
export const APP_LIMITS = {
    FREE_MAX_PROJECTS: FREE_PLAN.MAX_PROJECTS,
    FREE_MAX_PHOTOS: FREE_PLAN.MAX_PHOTOS_PER_LOG,
};


export const APP_CONFIG = {
    version: '1.0.0',
    environment: 'development'
};

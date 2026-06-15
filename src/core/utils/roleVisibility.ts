/**
 * Role hierarchy for data visibility.
 *
 * A user sees their OWN data plus the data of every role BELOW them in the
 * hierarchy. Admin (and superAdmin) see everything in their company.
 *
 *   admin > coordinador > lider > logistica > conductor
 */
export const ROLE_RANK: Record<string, number> = {
    superAdmin: -1,
    admin: 0,
    coordinador: 1,
    lider: 2,
    logistica: 3,
    conductor: 4,
};

/** Lower number = higher in the hierarchy. Unknown roles default to top so
 *  records of an unknown owner are only revealed to admins / the owner. */
export const rankOf = (role?: string): number => {
    if (role && role in ROLE_RANK) return ROLE_RANK[role];
    return -1;
};

/** True when `role` can see everything in the company. */
export const seesEverything = (role?: string): boolean =>
    role === 'admin' || role === 'superAdmin';

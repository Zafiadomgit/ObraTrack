import { useMemo } from 'react';
import { useAppStore } from '../../store/appStore';
import { useCompanyStore } from '../../store/companyStore';
import { rankOf, seesEverything } from '../utils/roleVisibility';

interface VisibleUsers {
    /** Set of userIds the current user may see, or null meaning "everyone". */
    visibleIds: Set<string> | null;
    /** Predicate: can the current user see a record owned by `userId`? */
    canSee: (userId?: string) => boolean;
}

/**
 * Resolves which records the current user may see under the role hierarchy:
 * their own data plus everyone ranked at or below them. Admin/superAdmin see
 * everything (visibleIds === null).
 */
export function useVisibleUsers(): VisibleUsers {
    const user = useAppStore(s => s.user);
    const members = useCompanyStore(s => s.members);

    return useMemo(() => {
        if (!user) {
            const empty = new Set<string>();
            return { visibleIds: empty, canSee: () => false };
        }
        if (seesEverything(user.role)) {
            return { visibleIds: null, canSee: () => true };
        }
        const myRank = rankOf(user.role);
        const ids = new Set<string>([user.id]);
        members.forEach(m => {
            if (rankOf(m.role) >= myRank) ids.add(m.id);
        });
        return {
            visibleIds: ids,
            canSee: (userId?: string) => !!userId && ids.has(userId),
        };
    }, [user, members]);
}

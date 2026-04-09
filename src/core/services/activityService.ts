import { db } from '../../config/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ActivityLogSchema } from '../validations/schemas';

export class ActivityService {
    static async logActivity(
        companyId: string,
        userId: string,
        action: string,
        entityType?: string,
        entityId?: string,
        description?: string
    ) {
        try {
            if (!companyId || !userId) return;
            
            const logData = {
                id: Math.random().toString(36).substr(2, 9),
                companyId,
                userId,
                action,
                entityType,
                entityId,
                description,
                timestamp: Date.now()
            };

            const parsed = ActivityLogSchema.safeParse(logData);
            if (!parsed.success) {
                console.error('ActivityLog validation failed', parsed.error);
                return;
            }

            const colRef = collection(db, `companies/${companyId}/activityLogs`);
            await addDoc(colRef, {
                ...parsed.data,
                serverTime: serverTimestamp()
            });
        } catch (error) {
            console.error('Failed to write activity log:', error);
        }
    }
}

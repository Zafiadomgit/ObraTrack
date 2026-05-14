import { create } from 'zustand';
import { db } from '../../../config/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { ErrorService } from '../../../core/services/errorService';

export interface AppNotification {
    id: string;
    companyId: string;
    userId: string;
    type: 'info' | 'warning' | 'critical';
    message: string;
    read: boolean;
    createdAt: number;
}

interface NotificationState {
    notifications: AppNotification[];
    unreadCount: number;
    subscribeToNotifications: (userId: string, companyId: string) => void;
    unsubscribeFromNotifications: () => void;
    markAsRead: (id: string, companyId: string) => Promise<void>;
    markAllAsRead: (companyId: string, userId: string) => Promise<void>;
    sendNotification: (companyId: string, userId: string, type: 'info' | 'warning' | 'critical', message: string) => Promise<void>;
}

let unsubNotifications: (() => void) | null = null;

export const useNotificationStore = create<NotificationState>((set, get) => ({
    notifications: [],
    unreadCount: 0,

    subscribeToNotifications: (userId, companyId) => {
        if (unsubNotifications) unsubNotifications();
        if (!companyId || !userId) return;

        const q = query(
            collection(db, `companies/${companyId}/notifications`),
            where('userId', '==', userId)
        );

        unsubNotifications = onSnapshot(q, (snapshot) => {
            const loaded = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AppNotification))
                                        .sort((a, b) => b.createdAt - a.createdAt);
            const unread = loaded.filter(n => !n.read).length;
            set({ notifications: loaded, unreadCount: unread });
        }, (error) => {
            ErrorService.handleError(error, 'Subscribe to Notifications');
        });
    },

    unsubscribeFromNotifications: () => {
        if (unsubNotifications) {
            unsubNotifications();
            unsubNotifications = null;
        }
        set({ notifications: [], unreadCount: 0 });
    },

    markAsRead: async (id, companyId) => {
        try {
            await updateDoc(doc(db, `companies/${companyId}/notifications`, id), {
                read: true
            });
        } catch (error) {
            ErrorService.handleError(error, 'Mark Notification Read');
        }
    },

    markAllAsRead: async (companyId, userId) => {
        try {
            const { notifications } = get();
            const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
            for (const id of unreadIds) {
                // Not the most efficient without a batch, but simple and fine for notifications
                await updateDoc(doc(db, `companies/${companyId}/notifications`, id), {
                    read: true
                });
            }
        } catch (error) {
            ErrorService.handleError(error, 'Mark All Read');
        }
    },

    sendNotification: async (companyId, userId, type, message) => {
        try {
            await addDoc(collection(db, `companies/${companyId}/notifications`), {
                companyId,
                userId,
                type,
                message,
                read: false,
                createdAt: Date.now()
            });
        } catch (error) {
            ErrorService.handleError(error, 'Send Notification');
        }
    }
}));

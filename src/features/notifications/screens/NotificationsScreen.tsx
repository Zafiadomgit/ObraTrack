import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useNotificationStore } from '../store/notificationStore';
import { useAppStore } from '../../../store/appStore';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../../core/theme';
import Icon from '@expo/vector-icons/Feather';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function NotificationsScreen() {
    const insets = useSafeAreaInsets();
    const navigation = useNavigation();
    const user = useAppStore(state => state.user);
    const { notifications, markAsRead, markAllAsRead } = useNotificationStore();

    const getIconForType = (type: string) => {
        if (type === 'critical') return { name: 'alert-triangle', color: COLORS.danger };
        if (type === 'warning') return { name: 'alert-circle', color: COLORS.warning };
        return { name: 'info', color: COLORS.info };
    };

    const handleMarkAllRead = () => {
        if (user?.companyId) {
            markAllAsRead(user.companyId, user.id);
        }
    };

    const handlePressNotification = (id: string, read: boolean) => {
        if (!read && user?.companyId) {
            markAsRead(id, user.companyId);
        }
    };

    const renderItem = ({ item }: { item: any }) => {
        const iconConfig = getIconForType(item.type);
        return (
            <TouchableOpacity 
                style={[styles.notificationCard, !item.read && styles.unreadCard]}
                onPress={() => handlePressNotification(item.id, item.read)}
            >
                <View style={[styles.iconContainer, { backgroundColor: iconConfig.color + '15' }]}>
                    <Icon name={iconConfig.name as any} size={20} color={iconConfig.color} />
                </View>
                <View style={styles.content}>
                    <Text style={[styles.message, !item.read && styles.unreadMessage]}>{item.message}</Text>
                    <Text style={styles.time}>{format(new Date(item.createdAt), "d MMM yyyy, HH:mm", { locale: es })}</Text>
                </View>
                {!item.read && <View style={styles.unreadDot} />}
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Icon name="arrow-left" size={24} color={COLORS.white} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Notificaciones</Text>
                {notifications.some(n => !n.read) && (
                    <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllBtn}>
                        <Icon name="check-square" size={18} color={COLORS.primary} />
                    </TouchableOpacity>
                )}
            </View>

            {notifications.length === 0 ? (
                <View style={styles.center}>
                    <Icon name="bell-off" size={48} color={COLORS.textMuted} />
                    <Text style={styles.emptyText}>No tienes notificaciones</Text>
                </View>
            ) : (
                <FlatList
                    data={notifications}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    backBtn: { marginRight: SPACING.md, padding: 4 },
    headerTitle: { flex: 1, fontSize: FONTS.sizes.xl, fontWeight: 'bold', color: COLORS.white },
    markAllBtn: { padding: 4 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { color: COLORS.textMuted, marginTop: SPACING.md, fontSize: FONTS.sizes.md },
    listContent: { padding: SPACING.md },
    notificationCard: { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm, alignItems: 'center' },
    unreadCard: { backgroundColor: COLORS.surfaceLight, borderColor: COLORS.primary + '50' },
    iconContainer: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: SPACING.md },
    content: { flex: 1 },
    message: { color: COLORS.textSecondary, fontSize: FONTS.sizes.md, marginBottom: 4 },
    unreadMessage: { color: COLORS.white, fontWeight: 'bold' },
    time: { color: COLORS.textMuted, fontSize: FONTS.sizes.xs },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, marginLeft: SPACING.md }
});

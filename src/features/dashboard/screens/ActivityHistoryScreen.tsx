import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { collection, query, orderBy, limit, getDocs, startAfter, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAppStore } from '../../../store/appStore';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../../core/theme';
import Icon from '@expo/vector-icons/Feather';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ErrorService } from '../../../core/services/errorService';

interface ActivityLog {
    id: string;
    action: string;
    description: string;
    entityType: string;
    timestamp: number;
    userId: string;
    companyId: string;
}

export default function ActivityHistoryScreen({ navigation: propNavigation }: any) {
    const insets = useSafeAreaInsets();
    const hookNavigation = useNavigation<any>();
    const navigation = propNavigation?.navigate ? propNavigation : hookNavigation;
    const user = useAppStore(state => state.user);
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);

    const loadLogs = async (isLoadMore = false) => {
        if (!user?.companyId) return;
        if (isLoadMore && !lastDoc) return;
        
        if (isLoadMore) setLoadingMore(true);
        else setLoading(true);

        try {
            let q = query(
                collection(db, `companies/${user.companyId}/activityLogs`),
                orderBy('timestamp', 'desc'),
                limit(20)
            );

            if (isLoadMore && lastDoc) {
                q = query(
                    collection(db, `companies/${user.companyId}/activityLogs`),
                    orderBy('timestamp', 'desc'),
                    startAfter(lastDoc),
                    limit(20)
                );
            }

            const snapshot = await getDocs(q);
            const loadedLogs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as ActivityLog));

            if (snapshot.docs.length > 0) {
                setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
            } else {
                setLastDoc(null);
            }

            if (isLoadMore) {
                setLogs(prev => [...prev, ...loadedLogs]);
            } else {
                setLogs(loadedLogs);
            }
        } catch (error) {
            ErrorService.handleError(error, 'Activity logs');
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    useEffect(() => {
        loadLogs();
    }, [user?.companyId]);

    const getIconForAction = (action: string, entityType: string) => {
        if (action.includes('delete')) return 'trash-2';
        if (action.includes('add') || action.includes('create')) return 'plus-circle';
        if (action.includes('update')) return 'edit-2';
        if (entityType === 'material') return 'package';
        if (entityType === 'worker') return 'users';
        if (entityType === 'project') return 'briefcase';
        return 'activity';
    };

    const renderItem = ({ item }: { item: ActivityLog }) => (
        <View style={styles.logCard}>
            <View style={[styles.iconContainer, { backgroundColor: COLORS.primary + '15' }]}>
                <Icon name={getIconForAction(item.action, item.entityType)} size={20} color={COLORS.primary} />
            </View>
            <View style={styles.logContent}>
                <Text style={styles.logDescription}>{item.description || item.action}</Text>
                <View style={styles.logFooter}>
                    <Icon name="clock" size={12} color={COLORS.textMuted} />
                    <Text style={styles.logTime}>
                        {format(new Date(item.timestamp), "d MMM yyyy, HH:mm", { locale: es })}
                    </Text>
                    <Text style={styles.logUser}>• Usuario ID: {item.userId.substring(0,6)}...</Text>
                </View>
            </View>
        </View>
    );

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Icon name="arrow-left" size={24} color={COLORS.white} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Registro de Actividad</Text>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            ) : logs.length === 0 ? (
                <View style={styles.center}>
                    <Icon name="inbox" size={48} color={COLORS.textMuted} />
                    <Text style={styles.emptyText}>No hay actividad registrada aún.</Text>
                </View>
            ) : (
                <FlatList
                    data={logs}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    onEndReached={() => {
                        if (!loadingMore && lastDoc) {
                            loadLogs(true);
                        }
                    }}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color={COLORS.primary} style={{ margin: 20 }} /> : null}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.lg,
        paddingBottom: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    backBtn: {
        marginRight: SPACING.md,
        padding: 4,
    },
    headerTitle: {
        fontSize: FONTS.sizes.xl,
        fontWeight: 'bold',
        color: COLORS.white,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        color: COLORS.textMuted,
        marginTop: SPACING.md,
        fontSize: FONTS.sizes.md,
    },
    listContent: {
        padding: SPACING.md,
    },
    logCard: {
        flexDirection: 'row',
        backgroundColor: COLORS.surface,
        borderRadius: RADIUS.md,
        padding: SPACING.md,
        marginBottom: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.sm,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: SPACING.md,
    },
    logContent: {
        flex: 1,
        justifyContent: 'center',
    },
    logDescription: {
        color: COLORS.white,
        fontSize: FONTS.sizes.md,
        fontWeight: '500',
        marginBottom: 4,
    },
    logFooter: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    logTime: {
        color: COLORS.textMuted,
        fontSize: FONTS.sizes.xs,
        marginLeft: 4,
    },
    logUser: {
        color: COLORS.textMuted,
        fontSize: FONTS.sizes.xs,
        marginLeft: 8,
    }
});

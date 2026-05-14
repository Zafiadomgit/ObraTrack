import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, useWindowDimensions, Image, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from '@expo/vector-icons/Feather';
import { useColors, ThemeColors } from '../../core/theme/ThemeContext';
import { useAppStore } from '../../store/appStore';

// Web Screens (we'll implement these next or reuse existing ones in a wider format)
import DashboardScreen from '../dashboard/screens/DashboardScreen';
import HomeScreen from '../projects/screens/HomeScreen';
import SuppliersScreen from '../dashboard/screens/SuppliersScreen';
import UserManagementScreen from '../auth/screens/UserManagementScreen';
import ActivityHistoryScreen from '../dashboard/screens/ActivityHistoryScreen';
// Logistics and Materials
import MaterialsScreen from '../materials/screens/MaterialsScreen';
import EquipmentScreen from '../equipment/screens/EquipmentScreen';

// We create a mock screen for Envíos where the coordinator can view all envios
const WebLogisticsScreen = (props: any) => {
    const C = useColors();
    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: C.textMuted, fontSize: 24, fontWeight: 'bold' }}>Gestión Global de Envíos (Web)</Text>
        </View>
    );
};

const routes = [
    { title: 'Dashboard', icon: 'home', component: DashboardScreen, hidden: false },
    { title: 'Proyectos', icon: 'briefcase', component: HomeScreen, hidden: false },
    { title: 'Materiales Globales', icon: 'server', component: MaterialsScreen, initialParams: { projectId: 'central' }, hidden: false },
    { title: 'Equipos', icon: 'tool', component: EquipmentScreen, initialParams: { projectId: 'central' }, hidden: false },
    { title: 'Logística Total', icon: 'truck', component: WebLogisticsScreen, hidden: false },
    { title: 'Usuarios', icon: 'users', component: UserManagementScreen, hidden: false },
    { title: 'Proveedores', icon: 'shopping-cart', component: SuppliersScreen, hidden: false },
    { title: 'Actividad', icon: 'activity', component: ActivityHistoryScreen, hidden: false },
    { title: 'ProjectDashboard', icon: 'folder', component: require('../projects/screens/ProjectDashboardScreen').default, hidden: true }, // hidden route
];

export default function WebDashboardNavigator({ navigation: rootNavigation }: any) {
    const { height, width } = useWindowDimensions();
    // Sidebar width scales with screen: narrow on small tablets, wider on large screens
    const sidebarWidth = width < 700 ? 180 : width < 900 ? 220 : 280;
    const logout = useAppStore(s => s.logout);
    const user = useAppStore(s => s.user);
    const C = useColors();
    const styles = React.useMemo(() => makeStyles(C), [C]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [activeParams, setActiveParams] = useState<any>({});

    const ActiveComponent = routes[activeIndex].component;
    const initialParams = (routes[activeIndex] as any).initialParams || {};
    const mergedParams = { ...initialParams, ...activeParams };

    const handleNavigate = (screenName: string, params?: any) => {
        const routeMap: Record<string, number> = {
            'Dashboard': 0,
            'Proyectos': 1,
            'Materiales': 2,
            'Equipos': 3,
            'Envíos': 4,
            'UserManagement': 5,
            'Proveedores': 6,
            'ActivityHistory': 7,
            'ProjectDashboard': 8,
            'Personal': 5, // Fallback to UserManagement on Web
            'Reportes': 1, // Fallback to Proyectos for Reports on Web
        };
        if (routeMap[screenName] !== undefined) {
             setActiveIndex(routeMap[screenName]);
             setActiveParams(params || {});
        } else {
             // Pass to parent stack (Subscription, Notifications, etc)
             rootNavigation?.navigate(screenName, params);
        }
    };

    // In compact mode (narrow tablet) hide labels, show icons only
    const compact = width < 700;

    return (
        <View style={styles.container}>
            {/* Sidebar */}
            <View style={[styles.sidebar, { height, width: sidebarWidth }]}>
                {/* Logo */}
                <View style={[styles.sidebarHeader, compact && { justifyContent: 'center', paddingHorizontal: 12 }]}>
                    <Image source={require('../../../assets/logo-symbol-transparent.png')}
                        style={{ width: 36, height: 36, resizeMode: 'contain' }} />
                    {!compact && (
                        <Text style={[styles.sidebarTitle, { marginLeft: 8 }]}>OBRA<Text style={{ color: C.primary }}>TRACK</Text></Text>
                    )}
                </View>

                {/* User info */}
                <View style={[styles.userInfo, compact && { justifyContent: 'center', paddingHorizontal: 8 }]}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{user?.nombre?.charAt(0) || 'A'}</Text>
                    </View>
                    {!compact && (
                        <View style={{ flex: 1 }}>
                            <Text style={styles.userName} numberOfLines={1}>{user?.nombre}</Text>
                            <Text style={styles.userRole}>{user?.role}</Text>
                        </View>
                    )}
                </View>

                <ScrollView style={styles.navLinks}>
                    {routes.map((r, index) => {
                        if (r.hidden) return null;
                        const isActive = index === activeIndex;
                        return (
                            <TouchableOpacity
                                key={r.title}
                                style={[styles.navItem, isActive && styles.navItemActive,
                                    compact && { justifyContent: 'center', paddingHorizontal: 0, marginHorizontal: 8 }]}
                                onPress={() => { setActiveIndex(index); setActiveParams({}); }}
                            >
                                <Icon name={r.icon as any} size={20} color={isActive ? C.primary : C.textSecondary} />
                                {!compact && (
                                    <Text style={[styles.navText, isActive && styles.navTextActive]}>{r.title}</Text>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                {user?.role === 'admin' && user?.plan !== 'enterprise' && (
                    <TouchableOpacity
                        style={[styles.navItem, { backgroundColor: C.warning + '12', borderColor: C.warning, borderWidth: 1, marginBottom: 12 },
                            compact && { justifyContent: 'center', marginHorizontal: 8 }]}
                        onPress={() => rootNavigation?.navigate('Subscription')}
                    >
                        <Icon name="star" size={20} color={C.warning} />
                        {!compact && <Text style={[styles.navText, { color: C.warning, fontWeight: 'bold' }]}>Mejorar Plan</Text>}
                    </TouchableOpacity>
                )}

                <TouchableOpacity
                    style={[styles.logoutBtn, compact && { justifyContent: 'center', paddingHorizontal: 0 }]}
                    onPress={() => logout()}>
                    <Icon name="log-out" size={20} color={C.danger} />
                    {!compact && <Text style={styles.logoutText}>Cerrar Sesión</Text>}
                </TouchableOpacity>
            </View>

            {/* Main Content Area */}
            <View style={styles.mainContent}>
                <ActiveComponent route={{ params: mergedParams }} navigation={{ navigate: handleNavigate, goBack: () => setActiveIndex(0), setOptions: () => { } } as any} />
            </View>
        </View>
    ); // end return
}

function makeStyles(C: ThemeColors) {
    return StyleSheet.create({
        container: {
            flex: 1,
            flexDirection: 'row',
            backgroundColor: C.background,
        },
        sidebar: {
            // width is set dynamically via inline style (sidebarWidth)
            backgroundColor: C.surface,
            borderRightWidth: 1,
            borderRightColor: C.border,
            flexDirection: 'column',
        },
        sidebarHeader: {
            padding: 24,
            flexDirection: 'row',
            alignItems: 'center',
            borderBottomWidth: 1,
            borderBottomColor: C.border,
        },
        sidebarTitle: {
            fontSize: 20,
            fontWeight: 'bold',
            color: C.textPrimary,
            marginLeft: 12,
        },
        userInfo: {
            flexDirection: 'row',
            padding: 20,
            alignItems: 'center',
            borderBottomWidth: 1,
            borderBottomColor: C.border,
        },
        avatar: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: C.primary + '30',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 12,
        },
        avatarText: {
            color: C.primary,
            fontWeight: 'bold',
            fontSize: 18,
        },
        userName: {
            color: C.textPrimary,
            fontWeight: 'bold',
            fontSize: 16,
        },
        userRole: {
            color: C.textSecondary,
            fontSize: 12,
            textTransform: 'capitalize',
        },
        navLinks: {
            flex: 1,
            paddingVertical: 12,
        },
        navItem: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 16,
            paddingHorizontal: 24,
            marginHorizontal: 12,
            borderRadius: 8,
            marginBottom: 4,
        },
        navItemActive: {
            backgroundColor: C.primary + '15',
        },
        navText: {
            color: C.textSecondary,
            marginLeft: 16,
            fontSize: 15,
            fontWeight: '500',
        },
        navTextActive: {
            color: C.primary,
            fontWeight: 'bold',
        },
        logoutBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: 24,
            borderTopWidth: 1,
            borderTopColor: C.border,
        },
        logoutText: {
            color: C.danger,
            marginLeft: 16,
            fontWeight: 'bold',
        },
        mainContent: {
            flex: 1,
            backgroundColor: C.background,
            overflow: 'hidden', // important for web
        },
    });
}

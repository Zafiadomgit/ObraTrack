import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@expo/vector-icons/Feather';
import { Platform, View, ActivityIndicator, Text, TouchableOpacity, useWindowDimensions } from 'react-native';

// Firebase
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './src/config/firebase';

import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://f4fccf23793bb3c4355e9446a07b678a@o4511107048996864.ingest.us.sentry.io/4511107141795840',
  tracesSampleRate: 0.1,
});

// Screens
import LoginScreen from './src/features/auth/screens/LoginScreen';
import RegisterScreen from './src/features/auth/screens/RegisterScreen';
import WebLandingScreen from './src/features/auth/screens/WebLandingScreen';
import OnboardingScreen from './src/features/auth/screens/OnboardingScreen';
import DashboardScreen from './src/features/dashboard/screens/DashboardScreen';
import HomeScreen from './src/features/projects/screens/HomeScreen';
import DailyLogScreen from './src/features/projects/screens/DailyLogScreen';
import PersonnelScreen from './src/features/personnel/screens/PersonnelScreen';
import MaterialsScreen from './src/features/materials/screens/MaterialsScreen';
import ReportsScreen from './src/features/reports/screens/ReportsScreen';
import SuppliersScreen from './src/features/dashboard/screens/SuppliersScreen';
import ActivityHistoryScreen from './src/features/dashboard/screens/ActivityHistoryScreen';
import NotificationsScreen from './src/features/notifications/screens/NotificationsScreen';
import LogisticsScreen from './src/features/logistics/screens/LogisticsScreen';
import UserManagementScreen from './src/features/auth/screens/UserManagementScreen';
import ForgotPasswordScreen from './src/features/auth/screens/ForgotPasswordScreen';
import PrivacyPolicyScreen from './src/features/auth/screens/PrivacyPolicyScreen';
import EquipmentScreen from './src/features/equipment/screens/EquipmentScreen';
import ConductorScreen from './src/features/logistics/screens/ConductorScreen';
import ProjectDashboardScreen from './src/features/projects/screens/ProjectDashboardScreen';
import SubscriptionScreen from './src/features/auth/screens/SubscriptionScreen';
import ProfileScreen from './src/features/profile/screens/ProfileScreen';

import { COLORS } from './src/core/theme';
import { ThemeProvider, useColors, DARK_COLORS, LIGHT_COLORS } from './src/core/theme/ThemeContext';
import { useThemeStore } from './src/core/theme/themeStore';
import { useLangStore, useT } from './src/core/i18n';
import { useAppStore, User } from './src/store/appStore';
import { useProjectStore } from './src/features/projects/store/projectStore';
import { useMaterialStore } from './src/features/materials/store/materialStore';
import { useLogisticsStore } from './src/features/logistics/store/logisticsStore';
import { useEquipmentStore } from './src/features/equipment/store/equipmentStore';
import { useNotificationStore } from './src/features/notifications/store/notificationStore';
import OfflineBanner from './src/components/OfflineBanner';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Removed inner tabs function (ProjectTabs)

// ─── Root app tabs (Dashboard + Projects) ─────────────────────────────────────
function AppTabs() {
  const insets = useSafeAreaInsets();
  const C = useColors();
  const t = useT();
  return (
    <Tab.Navigator
      screenOptions={({ route: r }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName: keyof typeof Icon.glyphMap = 'home';
          if (r.name === 'Dashboard') iconName = 'home';
          else if (r.name === 'Proyectos') iconName = 'briefcase';
          else if (r.name === 'Proveedores') iconName = 'truck';
          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.textMuted,
        tabBarStyle: {
          backgroundColor: C.surface,
          borderTopColor: C.border,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          paddingTop: 6
        },
        headerStyle: { backgroundColor: C.surface },
        headerTintColor: C.white,
        headerTitleStyle: { fontWeight: 'bold' },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: t.tabDashboard, headerShown: false }} />
      <Tab.Screen name="Proyectos" component={HomeScreen} options={{ title: t.tabProjects }} />
      <Tab.Screen name="Proveedores" component={SuppliersScreen} options={{ title: t.tabSuppliers }} />
    </Tab.Navigator>
  );
}


import WebDashboard from './src/features/web/WebDashboardNavigator';

// ─── Root stack ────────────────────────────────────────────────────────────────
function App() {
  const { width: screenWidth } = useWindowDimensions();   // reactive — updates on rotation
  const user = useAppStore((state) => state.user);
  const setUser = useAppStore((state) => state.setUser);
  const [isInitializing, setIsInitializing] = useState(true);

  // Data loading
  const { loadProjects, clearProjects } = useProjectStore();
  const { loadMaterials, clearMaterials } = useMaterialStore();
  const { subscribeToShipments, unsubscribeFromShipments } = useLogisticsStore();
  const { subscribeToEquipment, unsubscribeFromEquipment } = useEquipmentStore();
  const { subscribeToNotifications, unsubscribeFromNotifications } = useNotificationStore();

  const loadTheme = useThemeStore(s => s.loadTheme);
  const isDark = useThemeStore(s => s.isDark);
  const C = isDark ? DARK_COLORS : LIGHT_COLORS;
  const loadLanguage = useLangStore(s => s.loadLanguage);

  useEffect(() => {
    loadTheme();
    loadLanguage();
  }, []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Fetch user document from Firestore directly using getDoc
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data() as User;
              // Admin user is auto-created locally during login, but we rely on Firestore state
            if (userData.status === 'approved') {
              setUser(userData);
              const compId = userData.companyId || 'default-company';
              // Load data stores according to role
              loadProjects(userData.id, compId, userData.role);
              loadMaterials(userData.id, compId, userData.role);
              subscribeToShipments(userData.id, compId, userData.role);
              subscribeToEquipment(userData.id, compId, userData.role);
              subscribeToNotifications(userData.id, compId);
            } else {
              setUser(null);
            }
          }
        } catch (error) {
          console.error("Error verifying access", error);
          setUser(null);
        }
      } else {
        setUser(null);
        clearProjects();
        clearMaterials();
        unsubscribeFromShipments();
        unsubscribeFromEquipment();
        unsubscribeFromNotifications();
      }
      setIsInitializing(false);
    });

    return () => unsubscribeAuth();
  }, []);

  if (isInitializing) {
    return (
      <View style={{ flex: 1, backgroundColor: C.surface, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  // Large-screen: web >768px  OR  tablet/phone ≥600dp (portrait tablets, landscape phones)
  const isWebLarge = Platform.OS === 'web'
    ? (typeof window !== 'undefined' ? window.innerWidth > 768 : screenWidth >= 768)
    : false;
  const isLargeScreen = isWebLarge || screenWidth >= 600;

  return (
    <ThemeProvider>
    <SafeAreaProvider>
        <OfflineBanner />
        <NavigationContainer>
          <StatusBar style={isDark ? 'light' : 'dark'} />
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: C.surface },
            headerTintColor: C.white,
            headerTitleStyle: { fontWeight: 'bold' },
          }}
        >
          {!user ? (
            isLargeScreen && Platform.OS === 'web' ? (
              // Web large screen → landing page
              <>
                <Stack.Screen name="WebLanding" component={WebLandingScreen} options={{ headerShown: false }} />
                <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
                <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ headerShown: false }} />
                <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} options={{ headerShown: false }} />
              </>
            ) : (
              // Mobile & tablet → standard login
              <>
                <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
                <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
                <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ headerShown: false }} />
                <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} options={{ headerShown: false }} />
              </>
            )
          ) : !user.hasCompletedOnboarding ? (
            <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} />
          ) : isLargeScreen && (user.role === 'admin' || user.role === 'coordinador') ? (
            // Inject WebDashboard
            <>
              <Stack.Screen name="WebDashboard" component={WebDashboard} options={{ headerShown: false }} />
              <Stack.Screen name="Subscription" component={SubscriptionScreen} options={{ headerShown: false }} />
              <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ headerShown: false }} />
            </>
          ) : user.role === 'conductor' ? (
            // ── Conductor: only sees their assigned trips ───────────────────────
            <>
              <Stack.Screen name="ConductorHome" component={ConductorScreen} options={{ headerShown: false }} />
              <Stack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
            </>
          ) : (
            <>
              <Stack.Screen name="AppTabs" component={AppTabs} options={{ headerShown: false }} />
              <Stack.Screen
                name="ProjectDashboard"
                component={ProjectDashboardScreen}
                options={({ route }: any) => ({
                  title: route.params?.projectName || 'Dashboard de Proyecto',
                  headerBackTitle: 'Volver',
                })}
              />
              <Stack.Screen
                name="Bitácora"
                component={DailyLogScreen}
                options={{ title: 'Bitácora', headerBackTitle: 'Atrás' }}
              />
              <Stack.Screen
                name="Personal"
                component={PersonnelScreen}
                options={{ title: 'Personal', headerBackTitle: 'Atrás' }}
              />
              <Stack.Screen
                name="Materiales"
                component={MaterialsScreen}
                options={{ title: 'Materiales', headerBackTitle: 'Atrás' }}
              />
              <Stack.Screen
                name="Equipos"
                component={EquipmentScreen}
                options={{ title: 'Equipos', headerBackTitle: 'Atrás' }}
              />
              <Stack.Screen
                name="Envíos"
                component={LogisticsScreen}
                options={{ title: 'Envíos', headerBackTitle: 'Atrás', headerShown: false }}
              />
              <Stack.Screen
                name="Reportes"
                component={ReportsScreen}
                options={{ title: 'Reportes', headerBackTitle: 'Atrás' }}
              />
              <Stack.Screen
                name="UserManagement"
                component={UserManagementScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="ActivityHistory"
                component={ActivityHistoryScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="Notifications"
                component={NotificationsScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="Subscription"
                component={SubscriptionScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="Profile"
                component={ProfileScreen}
                options={{ headerShown: false }}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
    </ThemeProvider>
  );
}

export default Sentry.wrap(App);

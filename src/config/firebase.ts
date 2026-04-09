import { initializeApp, getApp, getApps } from 'firebase/app';
// @ts-ignore
import { initializeAuth, getAuth, setPersistence, inMemoryPersistence, getReactNativePersistence, browserLocalPersistence } from 'firebase/auth';
import { initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { Platform } from 'react-native';

// Only import AsyncStorage on native — it throws on web
const ReactNativeAsyncStorage = Platform.OS !== 'web'
    ? require('@react-native-async-storage/async-storage').default
    : null;

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDmf0VP25w5Xl5AwKy4LoHra5YrxFQIEO0",
    authDomain: "obratrack-2ab24.firebaseapp.com",
    projectId: "obratrack-2ab24",
    storageBucket: "obratrack-2ab24.firebasestorage.app",
    messagingSenderId: "730159906862",
    appId: "1:730159906862:web:1979815d88a983ddad5fbf",
    measurementId: "G-LTH7X4YQB4"
};

// Initialize Firebase
let app;
if (!getApps().length) {
    app = initializeApp(firebaseConfig);
} else {
    app = getApp();
}

// Initialize secondary app for background user creation (so Admin isn't logged out)
const secondaryApp = getApps().find(a => a.name === 'Secondary') || initializeApp(firebaseConfig, 'Secondary');

// Initialize Auth — use getAuth as fallback if already initialized (e.g. hot reload)
let auth: ReturnType<typeof getAuth>;
try {
    auth = initializeAuth(app, {
        persistence: Platform.OS === 'web'
            ? browserLocalPersistence
            : getReactNativePersistence(ReactNativeAsyncStorage)
    });
} catch {
    auth = getAuth(app);
}
export { auth };

export const secondaryAuth = getAuth(secondaryApp);
// Ensure this secondary auth doesn't touch local storage/indexedDB
setPersistence(secondaryAuth, inMemoryPersistence).catch(console.error);

// Use persistent cache on native, memory cache on web (persistentMultipleTabManager can hang on Expo web)
let db: ReturnType<typeof getFirestore>;
try {
    db = initializeFirestore(app, {
        localCache: Platform.OS === 'web'
            ? memoryLocalCache()
            : persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    });
} catch {
    db = getFirestore(app);
}
export { db };
export const storage = getStorage(app);

export default app;


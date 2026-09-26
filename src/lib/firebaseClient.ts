import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';

const env = (import.meta as any).env || {};

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: env.VITE_FIREBASE_APP_ID || '',
};

export const VAPID_KEY = env.VITE_FIREBASE_VAPID_KEY || '';

export const isFirebaseConfigured = (): boolean => {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.apiKey.length > 10 &&
    firebaseConfig.projectId &&
    !firebaseConfig.projectId.includes('placeholder') &&
    firebaseConfig.messagingSenderId
  );
};

let appInstance: FirebaseApp | null = null;
let messagingInstance: Messaging | null = null;

export const getFirebaseApp = (): FirebaseApp | null => {
  if (!isFirebaseConfigured()) return null;

  if (!appInstance) {
    try {
      appInstance = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    } catch (err) {
      console.warn('[RoadRisk AI] Firebase App initialization failed:', err);
      return null;
    }
  }
  return appInstance;
};

export const getFirebaseMessaging = async (): Promise<Messaging | null> => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  const app = getFirebaseApp();
  if (!app) return null;

  if (!messagingInstance) {
    try {
      messagingInstance = getMessaging(app);
    } catch (err) {
      console.warn('[RoadRisk AI] Firebase Messaging unsupported or blocked:', err);
      return null;
    }
  }
  return messagingInstance;
};

export const getMessagingToken = async (): Promise<string | null> => {
  const msg = await getFirebaseMessaging();
  if (!msg) return null;
  try {
    const swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    return await getToken(msg, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });
  } catch (err) {
    console.warn('[Firebase] Token retrieval error:', err);
    return null;
  }
};

export const onForegroundMessage = async (callback: (payload: any) => void): Promise<(() => void) | null> => {
  const msg = await getFirebaseMessaging();
  if (!msg) return null;
  return onMessage(msg, callback);
};

export const messaging = messagingInstance;


import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
  type Auth,
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

type FirebaseClient = {
  app: FirebaseApp;
  auth: Auth;
  database: Firestore;
};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let cachedClient: FirebaseClient | null | undefined;

export const householdId = import.meta.env.VITE_FIREBASE_HOUSEHOLD_ID || "main";

export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.appId,
  );
}

export function getFirebaseClient(): FirebaseClient | null {
  if (cachedClient !== undefined) return cachedClient;
  if (!isFirebaseConfigured()) {
    cachedClient = null;
    return cachedClient;
  }

  const app = getApps()[0] ?? initializeApp(firebaseConfig);
  const auth = getAuth(app);
  void setPersistence(auth, browserLocalPersistence);

  cachedClient = {
    app,
    auth,
    database: getFirestore(app),
  };
  return cachedClient;
}

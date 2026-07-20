import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, Firestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

// Configuración de Firebase desde variables de entorno
// Las variables NEXT_PUBLIC_ deben accederse directamente para que Next.js las incluya en el bundle
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  // `GCLOUD_PROJECT` (seteada por `firebase emulators:exec --project ...`)
  // tiene prioridad cuando corremos contra el emulador: tanto el emulador de
  // Auth (emite tokens con el `aud` de SU proyecto) como el de Firestore
  // (namespacea los datos por projectId) usan ese valor — si el cliente
  // inicializa con un projectId distinto, termina hablándole a un "proyecto"
  // vacío o con tokens que Admin SDK rechaza (ver lib/firebase/admin.ts).
  projectId: process.env.GCLOUD_PROJECT || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
};

// Validar configuración en desarrollo
if (process.env.NODE_ENV === 'development') {
  const missingVars = Object.entries(firebaseConfig)
    .filter(([_, value]) => !value)
    .map(([key]) => key);
  
  if (missingVars.length > 0) {
    console.warn('⚠️ Variables de Firebase no configuradas:', missingVars);
  }
}

// Inicializar Firebase una sola vez
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

try {
  const yaExistia = getApps().length > 0;
  app = !yaExistia ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);

  // Conectar a los emuladores locales SOLO si están explícitamente
  // indicados por variable de entorno (usado por los tests de integración en
  // __tests__/integration/ vía `npm run test:emulator`). Nunca se activa en
  // desarrollo/producción normales, así que no hay riesgo de que un typo
  // desvíe tráfico real hacia un emulador por accidente.
  if (!yaExistia && process.env.FIRESTORE_EMULATOR_HOST) {
    const [host, portStr] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
    connectFirestoreEmulator(db, host, Number(portStr));
    if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
      connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, {
        disableWarnings: true,
      });
    }
    console.info('🧪 Firebase conectado a emuladores locales:', process.env.FIRESTORE_EMULATOR_HOST);
  }
} catch (error) {
  console.error('❌ Error al inicializar Firebase:', error);
  throw new Error('No se pudo inicializar Firebase. Verifica las variables de entorno.');
}

export { app, auth, db, storage };

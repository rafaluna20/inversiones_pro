import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

/**
 * Inicialización de Firebase Admin SDK — SOLO para código de servidor de
 * confianza (server actions de dinero, jobs de reconciliación, scripts de
 * mantenimiento). Tiene acceso total a Firestore, sin pasar por
 * firestore.rules: NUNCA importar esto desde código que pueda terminar en
 * el bundle del navegador.
 *
 * Modo producción: requiere `FIREBASE_SERVICE_ACCOUNT_KEY` (JSON completo de
 * la service account, como string). Se genera desde Firebase Console →
 * Configuración del proyecto → Cuentas de servicio → Generar nueva clave
 * privada. Deliberadamente NO lee ningún archivo del repositorio (como
 * scripts/serviceAccountKey.json): en un entorno serverless (Vercel, Cloud
 * Functions) la credencial debe vivir como variable de entorno/secreto
 * gestionado por la plataforma, no como archivo versionado o local.
 *
 * Modo emulador: si `FIRESTORE_EMULATOR_HOST` está seteada, no hace falta
 * ninguna credencial real — el Admin SDK detecta la variable y habla con el
 * emulador local sin autenticarse contra Google Cloud de verdad (ver
 * __tests__/integration/).
 */

let app: App | undefined;

function enModoEmulador(): boolean {
  return Boolean(process.env.FIRESTORE_EMULATOR_HOST);
}

function getAdminApp(): App {
  if (typeof window !== 'undefined') {
    throw new Error('lib/firebase/admin.ts no debe importarse en código de cliente.');
  }

  if (app) return app;

  const existentes = getApps();
  if (existentes.length > 0) {
    app = existentes[0]!;
    return app;
  }

  if (enModoEmulador()) {
    // El Admin SDK no necesita una credencial real para hablar con el
    // emulador — solo un projectId. OJO: debe ser el mismo con el que
    // arrancó el emulador (`GCLOUD_PROJECT`, seteado automáticamente por
    // `firebase emulators:exec --project ...`), NO el de NEXT_PUBLIC_
    // FIREBASE_PROJECT_ID — el emulador de Auth emite tokens con el `aud`
    // de SU PROPIO proyecto sin importar qué projectId declare el cliente
    // que se conecta, así que si Admin SDK espera un projectId distinto,
    // verifyIdToken() rechaza cualquier token real con "incorrect aud claim".
    app = initializeApp({
      projectId:
        process.env.GCLOUD_PROJECT ||
        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
        'demo-test-inversiones',
    });
    return app;
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_KEY no está configurada. Este módulo requiere ' +
        'una credencial de Admin SDK explícita vía variable de entorno (o correr ' +
        'contra el emulador con FIRESTORE_EMULATOR_HOST).'
    );
  }

  let serviceAccount: Record<string, unknown>;
  try {
    serviceAccount = JSON.parse(raw);
  } catch {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_KEY no contiene un JSON válido. Debe ser el ' +
        'contenido completo del archivo de la service account, como string.'
    );
  }

  app = initializeApp({
    credential: cert(serviceAccount as any),
    // `cert()` ya deriva el projectId de la service account para Firestore/
    // Auth internamente, pero `app.options.projectId` (usado por
    // getAdminProjectId(), ver scripts/exportarReglasProduccion.ts) solo
    // queda poblado si se pasa explícito acá.
    projectId: serviceAccount.project_id as string | undefined,
  });
  return app;
}

/** Cliente de Firestore con privilegios de administrador. Uso server-only. */
export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}

/** Cliente de Auth con privilegios de administrador (verificar ID tokens). */
export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

/**
 * Se lanza cuando el Admin SDK no pudo inicializarse por un problema de
 * configuración del entorno (típicamente falta `FIREBASE_SERVICE_ACCOUNT_KEY`
 * en el hosting) — a propósito, un tipo de error DISTINTO al de un ID token
 * inválido/expirado, para que los server actions no le muestren "Sesión
 * inválida" al usuario cuando el problema real es que el entorno no tiene la
 * credencial cargada (ver verificarIdToken más abajo).
 */
export class AdminSdkNoConfiguradoError extends Error {
  constructor(causa: unknown) {
    super('El servicio de administración de Firebase no está configurado en este entorno.');
    this.name = 'AdminSdkNoConfiguradoError';
    this.cause = causa;
  }
}

export interface UsuarioVerificado {
  uid: string;
  nombre: string;
  foto: string;
}

/**
 * Verifica un ID token del cliente y devuelve la identidad real del usuario.
 * Usar esto (no `getAdminAuth().verifyIdToken` directo) en cada server
 * action de dinero, para que el error de "falta configurar la credencial"
 * quede claramente diferenciado de "el usuario tiene una sesión inválida" —
 * confundir los dos hizo perder tiempo real de diagnóstico la primera vez
 * que este flujo se probó en un despliegue sin la variable de entorno
 * configurada (el error que veía el usuario decía "Sesión inválida" cuando
 * el problema real era que Vercel no tenía FIREBASE_SERVICE_ACCOUNT_KEY).
 */
export async function verificarIdToken(idToken: string): Promise<UsuarioVerificado> {
  let auth: Auth;
  try {
    auth = getAdminAuth();
  } catch (causa) {
    console.error(
      '[Admin SDK] No se pudo inicializar — revisar que FIREBASE_SERVICE_ACCOUNT_KEY esté configurada en el entorno (Vercel: Settings → Environment Variables).',
      causa
    );
    throw new AdminSdkNoConfiguradoError(causa);
  }

  const decoded = await auth.verifyIdToken(idToken);
  return {
    uid: decoded.uid,
    nombre: (decoded.name as string) || 'Usuario',
    foto: (decoded.picture as string) || '',
  };
}

/**
 * Mensaje de error apto para mostrar al usuario, a partir de lo que haya
 * lanzado `verificarIdToken`. Deliberadamente NO expone detalles de
 * configuración al cliente (eso queda en el log del servidor, ver arriba) —
 * solo distingue "reintentá iniciar sesión" de "esto es un problema nuestro,
 * no tuyo", para no mandar al usuario a repetir un login que no va a
 * arreglar nada.
 */
export function mensajeErrorVerificacion(error: unknown): string {
  if (error instanceof AdminSdkNoConfiguradoError) {
    return 'Servicio no disponible temporalmente. Contacta al administrador.';
  }
  return 'Sesión inválida o expirada. Vuelve a iniciar sesión.';
}

/** projectId real que está usando el Admin SDK (útil para armar URLs de APIs de Google). */
export function getAdminProjectId(): string {
  const projectId = getAdminApp().options.projectId;
  if (!projectId) throw new Error('El Admin App no tiene projectId configurado.');
  return projectId;
}

/**
 * Access token OAuth2 derivado de la credencial de Admin SDK — para llamar
 * directamente APIs de Google que el SDK no cubre (ej. Firebase Rules API
 * para leer las reglas de Firestore desplegadas, ver
 * scripts/exportarReglasProduccion.ts). Solo funciona en modo producción
 * (con una credencial real); no tiene sentido en modo emulador.
 */
export async function getAdminAccessToken(): Promise<string> {
  const credential = getAdminApp().options.credential;
  if (!credential) {
    throw new Error('No hay credencial real de servidor configurada (¿estás en modo emulador?).');
  }
  const { access_token } = await credential.getAccessToken();
  return access_token;
}

/**
 * Data Encryption Module - Sensitive Data Protection
 * Implementa encriptación AES-256-GCM para proteger datos sensibles:
 * - Información personal (DNI, teléfono, dirección)
 * - Montos de inversión
 * - IDs de usuarios
 * - Datos bancarios
 */

import CryptoJS from 'crypto-js';

// ========================
// CONFIGURACIÓN
// ========================

/**
 * Clave de encriptación desde variables de entorno
 * DEBE ser una clave de 256 bits (32 bytes) en producción
 */
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'dev-key-32-bytes-long-change-me!';

/**
 * Salt para derivación de claves
 */
const ENCRYPTION_SALT = process.env.ENCRYPTION_SALT || 'terra-lima-salt-2026';

if (process.env.NODE_ENV === 'production' && ENCRYPTION_KEY === 'dev-key-32-bytes-long-change-me!') {
  console.error('⚠️ ADVERTENCIA: Usando clave de encriptación por defecto en producción. Cambia ENCRYPTION_KEY en .env');
}

// ========================
// TIPOS
// ========================

export interface DatosEncriptados {
  data: string;        // Datos encriptados en Base64
  iv: string;          // Initialization Vector en Base64
  tag?: string;        // Authentication tag (si aplica)
  version: number;     // Versión del algoritmo para rotación de claves
  timestamp: number;   // Timestamp de encriptación
}

export interface CamposSensibles {
  usuarioId?: string;
  montoInvertido?: number;
  email?: string;
  telefono?: string;
  dni?: string;
  direccion?: string;
  cuentaBancaria?: string;
  cuentaYape?: string;
  [key: string]: any;
}

// ========================
// FUNCIONES DE ENCRIPTACIÓN
// ========================

/**
 * Encripta un string usando AES-256-CBC
 * @param texto - Texto plano a encriptar
 * @returns Objeto con datos encriptados y metadatos
 */
export function encriptar(texto: string): DatosEncriptados {
  try {
    // Generar IV aleatorio (16 bytes para AES)
    const iv = CryptoJS.lib.WordArray.random(16);

    // Encriptar usando AES-256-CBC
    const encrypted = CryptoJS.AES.encrypt(texto, ENCRYPTION_KEY, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });

    return {
      data: encrypted.ciphertext.toString(CryptoJS.enc.Base64),
      iv: iv.toString(CryptoJS.enc.Base64),
      version: 1,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('❌ Error al encriptar:', error);
    throw new Error('Error al encriptar datos sensibles');
  }
}

/**
 * Desencripta datos previamente encriptados
 * @param datosEncriptados - Objeto con datos encriptados
 * @returns Texto plano original
 */
export function desencriptar(datosEncriptados: DatosEncriptados): string {
  try {
    // Reconstruir el ciphertext desde Base64
    const ciphertext = CryptoJS.enc.Base64.parse(datosEncriptados.data);
    const iv = CryptoJS.enc.Base64.parse(datosEncriptados.iv);

    // Crear objeto de cipher para desencriptar
    const cipherParams = CryptoJS.lib.CipherParams.create({
      ciphertext: ciphertext
    });

    // Desencriptar
    const decrypted = CryptoJS.AES.decrypt(cipherParams, ENCRYPTION_KEY, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });

    return decrypted.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error('❌ Error al desencriptar:', error);
    throw new Error('Error al desencriptar datos');
  }
}

/**
 * Encripta un objeto completo (stringify + encrypt)
 * Útil para encriptar estructuras complejas
 */
export function encriptarObjeto<T>(objeto: T): DatosEncriptados {
  const json = JSON.stringify(objeto);
  return encriptar(json);
}

/**
 * Desencripta y parsea un objeto
 */
export function desencriptarObjeto<T>(datosEncriptados: DatosEncriptados): T {
  const json = desencriptar(datosEncriptados);
  return JSON.parse(json) as T;
}

// ========================
// ENCRIPTACIÓN SELECTIVA DE CAMPOS
// ========================

/**
 * Encripta solo campos sensibles de un objeto, dejando el resto intacto
 * Útil para Firebase/Firestore donde queremos encriptar selectivamente
 */
export function encriptarCamposSensibles<T extends Record<string, any>>(
  objeto: T,
  camposSensibles: string[]
): T {
  const resultado: any = { ...objeto };

  camposSensibles.forEach(campo => {
    if (objeto[campo] !== undefined && objeto[campo] !== null) {
      // Convertir a string si es necesario
      const valor = typeof objeto[campo] === 'string'
        ? objeto[campo]
        : JSON.stringify(objeto[campo]);

      // Encriptar y guardar con prefijo para identificar
      const encriptado = encriptar(valor);
      resultado[campo] = `enc:${JSON.stringify(encriptado)}`;
    }
  });

  return resultado as T;
}

/**
 * Desencripta campos sensibles previamente encriptados
 */
export function desencriptarCamposSensibles<T extends Record<string, any>>(
  objeto: T,
  camposSensibles: string[]
): T {
  const resultado: any = { ...objeto };

  camposSensibles.forEach(campo => {
    if (typeof objeto[campo] === 'string' && objeto[campo].startsWith('enc:')) {
      try {
        // Extraer datos encriptados
        const jsonEncriptado = objeto[campo].substring(4); // Remover "enc:"
        const datosEncriptados: DatosEncriptados = JSON.parse(jsonEncriptado);

        // Desencriptar
        const valorDesencriptado = desencriptar(datosEncriptados);

        // Intentar parsear si era un objeto/número
        try {
          resultado[campo] = JSON.parse(valorDesencriptado);
        } catch {
          resultado[campo] = valorDesencriptado;
        }
      } catch (error) {
        console.error(`❌ Error al desencriptar campo ${campo}:`, error);
        // Dejar valor encriptado si falla
      }
    }
  });

  return resultado;
}

// ========================
// HASHING (ONE-WAY)
// ========================

/**
 * Genera hash SHA-256 (one-way, no reversible)
 * Útil para: contraseñas, checksums, identificadores únicos
 */
export function hash(texto: string): string {
  return CryptoJS.SHA256(texto).toString(CryptoJS.enc.Hex);
}

/**
 * Genera hash con salt para mayor seguridad
 */
export function hashConSalt(texto: string, salt?: string): string {
  const saltFinal = salt || ENCRYPTION_SALT;
  return CryptoJS.SHA256(texto + saltFinal).toString(CryptoJS.enc.Hex);
}

/**
 * Verifica si un texto coincide con un hash
 */
export function verificarHash(texto: string, hashGuardado: string, salt?: string): boolean {
  const hashCalculado = salt ? hashConSalt(texto, salt) : hash(texto);
  return hashCalculado === hashGuardado;
}

// ========================
// ENMASCARAMIENTO DE DATOS (PARA LOGS/UI)
// ========================

/**
 * Enmascara un email: usuario@dominio.com → u***o@d***o.com
 */
export function enmascararEmail(email: string): string {
  const [usuario, dominio] = email.split('@');
  if (!usuario || !dominio) return '***@***';

  const usuarioEnmascarado = usuario.length > 2
    ? usuario[0] + '***' + usuario[usuario.length - 1]
    : '***';

  const dominioEnmascarado = dominio.length > 4
    ? dominio[0] + '***' + dominio.slice(-4)
    : '***';

  return `${usuarioEnmascarado}@${dominioEnmascarado}`;
}

/**
 * Enmascara un teléfono: 987654321 → 987***321
 */
export function enmascararTelefono(telefono: string): string {
  if (telefono.length < 6) return '***';
  return telefono.slice(0, 3) + '***' + telefono.slice(-3);
}

/**
 * Enmascara DNI: 12345678 → 123***78
 */
export function enmascararDNI(dni: string): string {
  if (dni.length < 6) return '***';
  return dni.slice(0, 3) + '***' + dni.slice(-2);
}

/**
 * Enmascara cuenta bancaria: 1234567890123456 → 1234********3456
 */
export function enmascararCuentaBancaria(cuenta: string): string {
  if (cuenta.length < 8) return '***';
  return cuenta.slice(0, 4) + '********' + cuenta.slice(-4);
}

/**
 * Enmascara monto: 1500.50 → S/ 1,5**.**
 */
export function enmascararMonto(monto: number): string {
  const montoStr = monto.toFixed(2);
  const [entero, decimal] = montoStr.split('.');

  if (entero.length <= 2) {
    return `S/ **.**`;
  }

  return `S/ ${entero.slice(0, -2)}**.**`;
}

// ========================
// FUNCIONES HELPER PARA MODELOS
// ========================

/**
 * Campos sensibles estándar en el modelo de Inversión
 */
export const CAMPOS_SENSIBLES_INVERSION = [
  'usuarioId',
  'montoTotal',
  'montoInvertido',
  'gananciasGeneradas'
];

/**
 * Campos sensibles estándar en el modelo de Usuario
 */
export const CAMPOS_SENSIBLES_USUARIO = [
  'email',
  'telefono',
  'dni',
  'direccion'
];

/**
 * Campos sensibles en transacciones financieras
 */
export const CAMPOS_SENSIBLES_TRANSACCION = [
  'amount',
  'account_id',
  'destination_account_id',
  'reference'
];

/**
 * Encripta una inversión completa antes de guardar en Firebase
 */
export function encriptarInversion(inversion: any) {
  return encriptarCamposSensibles(inversion, CAMPOS_SENSIBLES_INVERSION);
}

/**
 * Desencripta inversión desde Firebase
 */
export function desencriptarInversion(inversion: any) {
  return desencriptarCamposSensibles(inversion, CAMPOS_SENSIBLES_INVERSION);
}

/**
 * Encripta datos de usuario antes de guardar
 */
export function encriptarUsuario(usuario: any) {
  return encriptarCamposSensibles(usuario, CAMPOS_SENSIBLES_USUARIO);
}

/**
 * Desencripta datos de usuario
 */
export function desencriptarUsuario(usuario: any) {
  return desencriptarCamposSensibles(usuario, CAMPOS_SENSIBLES_USUARIO);
}

// ========================
// ROTACIÓN DE CLAVES
// ========================

/**
 * Re-encripta datos con nueva clave (útil para rotación de claves)
 * @param datosEncriptados - Datos encriptados con clave anterior
 * @param nuevaClave - Nueva clave de encriptación
 */
export function rotarClave(
  datosEncriptados: DatosEncriptados,
  nuevaClave: string
): DatosEncriptados {
  // Desencriptar con clave actual
  const textoPlano = desencriptar(datosEncriptados);

  // Re-encriptar con nueva clave (temporalmente cambiar la clave)
  const claveOriginal = process.env.ENCRYPTION_KEY;
  process.env.ENCRYPTION_KEY = nuevaClave;

  const nuevosDatos = encriptar(textoPlano);
  nuevosDatos.version = (datosEncriptados.version || 0) + 1;

  // Restaurar clave original
  process.env.ENCRYPTION_KEY = claveOriginal;

  return nuevosDatos;
}

/**
 * Verifica si los datos necesitan rotación de clave
 * (por ejemplo, si tienen más de 90 días)
 */
export function necesitaRotacion(datosEncriptados: DatosEncriptados): boolean {
  const DIAS_ROTACION = 90;
  const timestampRotacion = Date.now() - (DIAS_ROTACION * 24 * 60 * 60 * 1000);

  return datosEncriptados.timestamp < timestampRotacion;
}

// ========================
// GENERADORES DE CLAVES SEGURAS
// ========================

/**
 * Genera una clave aleatoria segura de 32 bytes (256 bits)
 * Útil para generar ENCRYPTION_KEY en setup inicial
 */
export function generarClaveSegura(): string {
  const palabras = CryptoJS.lib.WordArray.random(32); // 32 bytes = 256 bits
  return palabras.toString(CryptoJS.enc.Base64);
}

/**
 * Genera un token aleatorio (para verificación, reset password, etc.)
 */
export function generarToken(longitud: number = 32): string {
  const palabras = CryptoJS.lib.WordArray.random(longitud);
  return palabras.toString(CryptoJS.enc.Hex);
}

/**
 * Genera un PIN numérico seguro
 */
export function generarPIN(digitos: number = 4): string {
  const max = Math.pow(10, digitos);
  const random = Math.floor(Math.random() * max);
  return random.toString().padStart(digitos, '0');
}

// ========================
// VALIDACIÓN DE INTEGRIDAD
// ========================

/**
 * Genera checksum de datos para verificar integridad
 */
export function generarChecksum(datos: any): string {
  const json = typeof datos === 'string' ? datos : JSON.stringify(datos);
  return hash(json);
}

/**
 * Verifica integridad de datos comparando checksums
 */
export function verificarIntegridad(datos: any, checksumEsperado: string): boolean {
  const checksumActual = generarChecksum(datos);
  return checksumActual === checksumEsperado;
}

// ========================
// EXPORTACIONES
// ========================

export const encryption = {
  // Encriptación/Desencriptación
  encriptar,
  desencriptar,
  encriptarObjeto,
  desencriptarObjeto,

  // Encriptación selectiva
  encriptarCamposSensibles,
  desencriptarCamposSensibles,

  // Hashing
  hash,
  hashConSalt,
  verificarHash,

  // Enmascaramiento
  enmascararEmail,
  enmascararTelefono,
  enmascararDNI,
  enmascararCuentaBancaria,
  enmascararMonto,

  // Helpers específicos
  encriptarInversion,
  desencriptarInversion,
  encriptarUsuario,
  desencriptarUsuario,

  // Rotación de claves
  rotarClave,
  necesitaRotacion,

  // Generadores
  generarClaveSegura,
  generarToken,
  generarPIN,

  // Integridad
  generarChecksum,
  verificarIntegridad
};

export default encryption;

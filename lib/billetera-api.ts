/**
 * @deprecated
 * Funciones utilitarias para interactuar con la API de Billetera.
 * NOTA DE SEGURIDAD: Estas funciones exponen lógica en el cliente.
 * Se han migrado a Server Actions en @/app/actions/wallet.ts y auth.ts
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_WALLET_API_URL || 'http://localhost:8069';

export interface WalletTransaction {
  id: number;
  reference: string;
  date: string;
  amount: number;
  fee: number;
  total_amount: number;
  state: 'draft' | 'pending' | 'done' | 'cancel';
  transaction_type: string;
  description: string;
}

export interface WalletAccount {
  id: number;
  number: string;
  balance: number;
  state: string;
  daily_limit: number;
  transaction_limit: number;
}

export interface WalletData {
  cash: number;
  WalletHistrial: WalletTransaction[]; // Mantiene nombre legacy para compatibilidad
  account?: WalletAccount;
}

export interface UserBilleteraData {
  id: number;
  names: string;
  email: string;
}

/**
 * @deprecated Use Server Actions instead
 */
async function odooCall(endpoint: string, params: any = {}, token?: string): Promise<any> {
  console.warn('Deprecated odooCall used');
  return { success: false, error: 'Deprecated' };
}

/**
 * @deprecated Use loginAction from @/app/actions/auth.ts
 */
export async function crearTokenBilletera(
  email: string,
  pass: string
): Promise<string | null> {
  console.error('crearTokenBilletera is deprecated and insecure. Use server actions.');
  return null;
}

/**
 * @deprecated Use getWalletDataAction from @/app/actions/wallet.ts
 */
export async function obtenerDatosBilletera(
  token: string
): Promise<WalletData | null> {
  console.error('obtenerDatosBilletera is deprecated. Use server actions.');
  return null;
}

/**
 * @deprecated Use transferMoneyAction from @/app/actions/wallet.ts
 */
export async function transferirDinero(
  token: string,
  destination_input: string,
  amount: number,
  type: 'email' | 'account_number' | 'user_id' = 'email'
): Promise<{ success: boolean; message?: string }> {
  console.error('transferirDinero is deprecated. Use server actions.');
  return { success: false, message: 'Función obsoleta' };
}

/**
 * Recargar billetera (No implementado en API pública Odoo)
 */
export async function recargarBilletera(
  token: string,
  userId: string,
  amount: number
): Promise<{ success: boolean; message?: string }> {
  console.warn('Recarga directa no soportada por API Odoo actualmente');
  return { success: false, message: 'Recarga online no disponible momentáneamente. Contacte a soporte.' };
}

/**
 * Crear usuario en billetera (Registro stub)
 */
export async function crearUsuarioBilletera(data: {
  names: string;
  lastname: string;
  email: string;
  password: string;
  phone: string;
}): Promise<{ success: boolean; error?: string }> {
  return { success: false, error: 'Registro de billetera debe hacerse desde el panel administrativo.' };
}

export async function convertirUsuarioBilletera(
  token: string
): Promise<boolean> {
  return true;
}

export async function obtenerDatosUsuario(
  userId: string,
  token: string
): Promise<UserBilleteraData | null> {
  return null;
}


/**
 * Helpers de Formato
 */

export function formatearFecha(fechaInput: string | Date): string {
  const fecha = typeof fechaInput === 'string' ? new Date(fechaInput) : fechaInput;

  if (isNaN(fecha.getTime())) return 'Fecha inválida';

  const hoy = new Date();
  const ayer = new Date(hoy);
  ayer.setDate(hoy.getDate() - 1);

  const esHoy = fecha.toDateString() === hoy.toDateString();
  const esAyer = fecha.toDateString() === ayer.toDateString();

  let fechaFormateada = '';

  if (esHoy) {
    fechaFormateada = 'hoy';
  } else if (esAyer) {
    fechaFormateada = 'ayer';
  } else {
    fechaFormateada = fecha.toLocaleDateString('es-PE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  const horas = fecha.getHours();
  const minutos = fecha.getMinutes();
  const horaFormateada = `${horas}:${minutos < 10 ? '0' + minutos : minutos}`;

  return `${fechaFormateada} ${horaFormateada}`;
}

export function formatearPresupuesto(cantidad: number): string {
  return cantidad.toLocaleString('es-PE', {
    style: 'currency',
    currency: 'PEN',
  });
}

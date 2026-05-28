'use server';

import { cookies } from 'next/headers';
import { LoginSchema } from '@/lib/schemas';

const API_BASE_URL = process.env.NEXT_PUBLIC_WALLET_API_URL || 'http://localhost:8069';
const ODOO_DB = process.env.NEXT_PUBLIC_ODOO_DB || 'odoo_akallpav1';
const COOKIE_NAME = 'billetera_session';

interface OdooResponse {
    result?: any;
    error?: {
        message: string;
        data?: {
            message: string;
        };
    };
}

async function odooCall(endpoint: string, params: any = {}, token?: string) {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`; // Adjust if Odoo uses a different header
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}?db=${ODOO_DB}`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'call',
                params,
                id: Math.floor(Math.random() * 1000),
            }),
            cache: 'no-store',
        });

        const data: OdooResponse = await response.json();
        return data;
    } catch (error) {
        console.error(`Odoo Call Error [${endpoint}]:`, error);
        return { error: { message: 'Error de conexión con el servidor bancario' } };
    }
}

export async function loginAction(formData: FormData) {
    const rawData = {
        email: formData.get('email'),
        password: formData.get('password'),
    };

    // 1. Validate input using Zod
    const validation = LoginSchema.safeParse(rawData);

    if (!validation.success) {
        return {
            success: false,
            message: 'Datos inválidos',
            errors: validation.error.flatten().fieldErrors,
        };
    }

    const { email, password } = validation.data;

    const response = await odooCall('/api/wallet/auth/login', {
        username: email,
        password,
        db: ODOO_DB, // Corrected from Odoo_DB to ODOO_DB
    });

    if (response.result && response.result.success && response.result.token) {
        const token = response.result.token;

        // Set HttpOnly Cookie
        cookies().set(COOKIE_NAME, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 24, // 24 hours
            path: '/',
        });

        return { success: true };
    }

    return {
        success: false,
        message: response.error?.data?.message || response.error?.message || 'Credenciales inválidas'
    };
}

export async function logoutAction() {
    cookies().delete(COOKIE_NAME);
    return { success: true };
}

export async function checkSessionAction() {
    const token = cookies().get(COOKIE_NAME)?.value;
    
    if (!token) {
        return { isAuthenticated: false };
    }
    
    // Validar token activamente contra el servidor de Odoo
    const response = await odooCall('/api/wallet/auth/validate', {}, token);
    
    if (response.result && response.result.valid) {
        return { isAuthenticated: true, userId: response.result.user_id };
    }
    
    // Si el token es inválido o expiró, limpiar la cookie inmediatamente
    cookies().delete(COOKIE_NAME);
    return { isAuthenticated: false };
}

export async function registerWalletFullAction(data: any) {
    try {
        const response = await odooCall('/api/wallet/auth/register', {
            email: data.email,
            password: data.password,
            names: data.names,
            lastname: data.lastname,
            phone: data.phone,
            db: ODOO_DB
        });

        if (response.result && response.result.success) {
            // Registro exitoso — hacer auto-login con FormData real
            const formData = new FormData();
            formData.append('email', data.email);
            formData.append('password', data.password);
            return await loginAction(formData);
        }

        return { 
            success: false, 
            error: response.error?.data?.message || response.result?.error || response.error?.message || 'Error al crear la cuenta en Odoo' 
        };
    } catch (err: any) {
      console.error('Server action network error:', err);
      return { success: false, error: err.message || 'Error de red en el servidor' };
    }
}

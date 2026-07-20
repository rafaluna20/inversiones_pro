import { z, ZodError } from 'zod';

export const LoginSchema = z.object({
    email: z.string().email({ message: "Email inválido" }),
    password: z.string().min(1, { message: "Contraseña requerida" }),
});

export const TransferSchema = z.object({
    amount: z.number().positive({ message: "El monto debe ser positivo" }),
    destination: z.string().min(1, { message: "Destino requerido" }),
    type: z.enum(['email', 'account_number', 'user_id']).optional(),
});

// ========================================================================
// SCHEMAS DE FORMULARIOS (Validacion/validarX.ts)
// ========================================================================
// Centralizados acá para que la validación de negocio no quede duplicada
// entre lib/schemas.ts (Zod) y validadores manuales con `any` — los
// archivos en Validacion/ ahora son wrappers finos sobre estos schemas que
// traducen el resultado al formato {campo: mensaje} que usan los
// formularios vía Hooks/useValidacion.ts.

const telefonoPeru = z
    .string()
    .min(1, 'El telefono es obligatorio')
    .regex(/^9\d{8}$/, 'Número de celular no válido. Debe empezar con 9 / Tener 9 dígitos');

export const RegistroSchema = z.object({
    nombre: z.string().min(1, 'El nombre es obligatorio'),
    email: z
        .string()
        .min(1, 'El email es obligatorio')
        .regex(/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i, 'Email no válido'),
    password: z
        .string()
        .min(1, 'El password es obligatorio')
        .min(6, 'El password debe tener al menos 6 caracteres'),
    telefono: telefonoPeru,
    department: z.string().min(1, 'El departamento es obligatorio'),
    province: z.string().min(1, 'El provincia es obligatorio'),
    district: z.string().min(1, 'El distrito es obligatorio'),
});

export const IniciarSesionSchema = z.object({
    email: z
        .string()
        .min(1, 'El email es obligatorio')
        .regex(/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i, 'Email no válido'),
    password: z
        .string()
        .min(1, 'El password es obligatorio')
        .min(6, 'El password debe tener al menos 6 caracteres'),
});

export const RegistroWalletSchema = z.object({
    // Nota: a diferencia de RegistroSchema, nombre/email no se exigen acá —
    // así estaba el validador original (comentado explícitamente), se
    // preserva el comportamiento tal cual.
    apellido: z.string().min(1, 'El apellido es obligatorio'),
    password: z
        .string()
        .min(1, 'El password es obligatorio')
        .min(6, 'El password debe tener 6 caracteres'),
    telefono: z
        .string()
        .min(1, 'El telefono es obligatorio')
        .regex(/^9\d{8}$/, 'Número de celular no válido, debe empezar con 9 '),
});

export const RecargarBilleteraSchema = z.object({
    monto: z.any().refine((v) => Boolean(v), { message: 'El monto es obligatorio' }),
    password: z
        .string()
        .min(1, 'El password es obligatorio')
        .min(6, 'El password debe tener 6 caracteres'),
});

export const CrearProductoSchema = z
    .object({
        nombre: z.string().min(1, 'El nombre es obligatorio'),
        empresa: z.string().min(1, 'El Nombre de la empresa es obligatoria'),
        url: z
            .string()
            .min(1, 'La url del producto es obligatoria')
            .regex(/^(ftp|http|https):\/\/[^ "]+$/, 'url mal formateada o no valida'),
        descripcion: z.string().min(1, 'Agrega una descripcion de tu producto'),
        categoria: z.string().min(1, 'Seleccione una categoria de su producto'),
        precio: z.any().refine((v) => Boolean(v), { message: 'Agrega un precio a tu producto' }),
        fechaLimite: z.any().refine((v) => Boolean(v), { message: 'La fecha límite es obligatoria' }),
    })
    .superRefine((datos, ctx) => {
        if (!datos.fechaLimite) return;
        const seleccionada = new Date(datos.fechaLimite as any).getTime();
        if (seleccionada <= Date.now()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['fechaLimite'],
                message: 'La fecha límite debe ser en el futuro',
            });
        }
    });

/**
 * Convierte los `issues` de un ZodError en el formato plano {campo: mensaje}
 * que esperan los formularios legacy (uno por campo, el primer error de
 * cada uno). `keyMap` renombra el path del schema al nombre de campo que
 * espera la UI cuando difieren — ej. el input se llama "department" pero el
 * mensaje se muestra bajo `errores.departamento`.
 */
export function zodErroresPorCampo(
    error: ZodError,
    keyMap: Record<string, string> = {}
): Record<string, string> {
    const errores: Record<string, string> = {};
    for (const issue of error.issues) {
        const campo = String(issue.path[0] ?? '_');
        const key = keyMap[campo] || campo;
        if (!errores[key]) errores[key] = issue.message;
    }
    return errores;
}

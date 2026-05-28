import { z } from 'zod';

export const LoginSchema = z.object({
    email: z.string().email({ message: "Email inválido" }),
    password: z.string().min(1, { message: "Contraseña requerida" }),
});

export const TransferSchema = z.object({
    amount: z.number().positive({ message: "El monto debe ser positivo" }),
    destination: z.string().min(1, { message: "Destino requerido" }),
    type: z.enum(['email', 'account_number', 'user_id']).optional(),
});

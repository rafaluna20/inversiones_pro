import { IniciarSesionSchema, zodErroresPorCampo } from '@/lib/schemas';

export interface ValidationErrors {
    [key: string]: string;
}

const validarIniciarSesion = (valores: any): ValidationErrors => {
    const resultado = IniciarSesionSchema.safeParse(valores);
    if (resultado.success) return {};
    return zodErroresPorCampo(resultado.error);
};

export default validarIniciarSesion;

import { RegistroWalletSchema, zodErroresPorCampo } from '@/lib/schemas';

export interface ValidationErrors {
  [key: string]: string;
}

const validarCrearUsuarioBilletera = (valores: any): ValidationErrors => {
  const resultado = RegistroWalletSchema.safeParse(valores);
  if (resultado.success) return {};
  return zodErroresPorCampo(resultado.error);
};

export default validarCrearUsuarioBilletera;

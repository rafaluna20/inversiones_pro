import { RecargarBilleteraSchema, zodErroresPorCampo } from '@/lib/schemas';

export interface ValidationErrors {
  [key: string]: string;
}

const validarRecargarBilletera = (valores: any): ValidationErrors => {
  const resultado = RecargarBilleteraSchema.safeParse(valores);
  if (resultado.success) return {};
  return zodErroresPorCampo(resultado.error);
};

export default validarRecargarBilletera;

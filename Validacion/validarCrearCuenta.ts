import { RegistroSchema, zodErroresPorCampo } from '@/lib/schemas';

export interface ValidationErrors {
  [key: string]: string;
}

/** El input HTML se llama "department"/"province"/"district" (name=...),
 *  pero el mensaje de error se muestra bajo la clave en español. */
const CAMPO_A_CLAVE_ERROR: Record<string, string> = {
  department: 'departamento',
  province: 'provincia',
  district: 'distrito',
};

const validarCrearCuenta = (valores: any): ValidationErrors => {
  const resultado = RegistroSchema.safeParse(valores);
  if (resultado.success) return {};
  return zodErroresPorCampo(resultado.error, CAMPO_A_CLAVE_ERROR);
};

export default validarCrearCuenta;

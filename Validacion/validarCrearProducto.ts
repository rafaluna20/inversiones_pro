import { CrearProductoSchema, zodErroresPorCampo } from '@/lib/schemas';

export interface ValidationErrors {
  [key: string]: string;
}

const validarCrearProducto = (valores: any): ValidationErrors => {
  const resultado = CrearProductoSchema.safeParse(valores);
  if (resultado.success) return {};
  return zodErroresPorCampo(resultado.error);
};

export default validarCrearProducto;

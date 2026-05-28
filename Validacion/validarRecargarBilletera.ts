export interface ValidationErrors {
  [key: string]: string;
}

const validarRecargarBilletera = (valores: any): ValidationErrors => {
  let errores: ValidationErrors = {};
  const regex = /^9\d{8}$/;

  if (!valores.monto) {
    errores.monto = "El monto es obligatorio";
  }

  //validar el password
  if (!valores.password) {
    errores.password = "El password es obligatorio";
  } else if (valores.password.length < 6) {
    errores.password = "El password debe tener 6 caracteres";
  }
  // validar el telefono
  // if (!valores.telefono) {
  //   errores.telefono = "El telefono es obligatorio";
  // } else if (!regex.test(valores.telefono)) {
  //   errores.telefono = "Número de celular no válido, debe empezar con 9 ";
  // }
  return errores;
};

export default validarRecargarBilletera;

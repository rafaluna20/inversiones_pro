export interface ValidationErrors {
  [key: string]: string;
}

const validarCrearUsuarioBilletera = (valores: any): ValidationErrors => {
  let errores: ValidationErrors = {};
  const regex = /^9\d{8}$/;

  //validar nombre del usuario
  // if (!valores.nombre) {
  //   errores.nombre = "El nombre es obligatorio";
  // }
  //validar apellido del usuario
  if (!valores.apellido) {
    errores.apellido = "El apellido es obligatorio";
  }
  //validar email
  // if (!valores.email) {
  //   errores.email = "El email es obligatorio";
  // } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(valores.email)) {
  //   errores.email = "Email no válido";
  // }

  //validar el password
  if (!valores.password) {
    errores.password = "El password es obligatorio";
  } else if (valores.password.length < 6) {
    errores.password = "El password debe tener 6 caracteres";
  }
  // validar el telefono
  if (!valores.telefono) {
    errores.telefono = "El telefono es obligatorio";
  } else if (!regex.test(valores.telefono)) {
    errores.telefono = "Número de celular no válido, debe empezar con 9 ";
  }
  return errores;
};

export default validarCrearUsuarioBilletera;

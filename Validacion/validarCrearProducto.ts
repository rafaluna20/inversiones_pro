export interface ValidationErrors {
  [key: string]: string;
}

const validarCrearProducto = (valores: any): ValidationErrors => {
  let errores: ValidationErrors = {};
  //validar nombre del usuario
  if (!valores.nombre) {
    errores.nombre = "El nombre es obligatorio";
  }

  //validar empresa
  if (!valores.empresa) {
    errores.empresa = "El Nombre de la empresa es obligatoria";
  }

  //validar la url

  if (!valores.url) {
    errores.url = "La url del producto es obligatoria";
  } else if (!/^(ftp|http|https):\/\/[^ "]+$/.test(valores.url)) {
    errores.url = "url mal formateada o no valida";
  }

  //validar descripcion

  if (!valores.descripcion) {
    errores.descripcion = "Agrega una descripcion de tu producto";
  }

  //validar categoria

  if (!valores.categoria) {
    errores.categoria = "Seleccione una categoria de su producto";
  }

  if (!valores.precio) {
    errores.precio = "Agrega un precio a tu producto";
  }

  // validar fechaLimite
  if (!valores.fechaLimite) {
    errores.fechaLimite = "La fecha límite es obligatoria";
  } else {
    const selectedDate = new Date(valores.fechaLimite).getTime();
    const now = Date.now();
    if (selectedDate <= now) {
      errores.fechaLimite = "La fecha límite debe ser en el futuro";
    }
  }

  return errores;
};

export default validarCrearProducto;

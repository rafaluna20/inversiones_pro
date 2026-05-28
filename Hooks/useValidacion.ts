'use client';

import { useState, useEffect, ChangeEvent, FormEvent } from 'react';

interface ValidationErrors {
  [key: string]: string;
}

export default function useValidacion<T extends Record<string, any>>(
  stateInicial: T,
  validar: (valores: T) => ValidationErrors,
  fn: () => void | Promise<void>
) {
  const [valores, setValores] = useState<T>(stateInicial);
  const [errores, setErrores] = useState<ValidationErrors>({});
  const [submitForm, setSubmitForm] = useState(false);

  useEffect(() => {
    if (submitForm) {
      const noErrores = Object.keys(errores).length === 0;
      if (noErrores) {
        fn();
      }
      setSubmitForm(false);
    }
  }, [errores, submitForm, fn]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setValores({
      ...valores,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const erroresValidacion = validar(valores);
    setErrores(erroresValidacion);
    setSubmitForm(true);
  };

  const handleBlur = () => {
    const erroresValidacion = validar(valores);
    setErrores(erroresValidacion);
  };

  return {
    valores,
    errores,
    handleSubmit,
    handleChange,
    handleBlur,
  };
}

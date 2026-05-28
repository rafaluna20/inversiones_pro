'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '@/lib/firebase/config';
import useValidacion from '@/Hooks/useValidacion';
import validarCrearCuenta from '@/Validacion/validarCrearCuenta';
import { RegisterForm } from '@/types';
import departamentos from '@/data/departamentos.json';
import provincias from '@/data/provincias.json';
import distritos from '@/data/distritos.json';

const STATE_INICIAL: RegisterForm = {
  nombre: '',
  email: '',
  password: '',
  telefono: '',
  department: '',
  province: '',
  district: '',
  imagen: null,
};

export default function CrearCuentaPage() {
  const router = useRouter();
  const [error, setError] = useState<string | false>(false);
  const [loading, setLoading] = useState(false);
  const [imagen, setImagen] = useState<File | null>(null);

  // Estados para ubicación
  const [distritosPeru, setDistritos] = useState<any[]>([]);
  const [provinciasPeru, setProvincias] = useState<any[]>([]);
  const [departamento, setDepartamento] = useState<{ name?: string; id?: string }>({});
  const [provincia, setProvincia] = useState<{ name?: string; id?: string }>({});

  const crearCuenta = async () => {
    try {
      setLoading(true);
      setError(false);

      const nuevoUsuario = await createUserWithEmailAndPassword(auth, email, password);

      let imagenPerfilURL = '';
      if (imagen) {
        const storageRef = ref(storage, `profile_images/${nuevoUsuario.user.uid}`);
        await uploadBytesResumable(storageRef, imagen);
        imagenPerfilURL = await getDownloadURL(storageRef);
      }

      await updateProfile(nuevoUsuario.user, {
        displayName: nombre,
        photoURL: imagenPerfilURL,
      });

      const usuarioDocRef = doc(db, 'usuarios', nuevoUsuario.user.uid);
      await setDoc(usuarioDocRef, {
        saldo: 0,
        like: 0,
        phone: telefono,
        departamento: department,
        provincia: province,
        distrito: district,
        ganancia: 0,
        inversionesCompletadas: 0,
        nombre: nombre,
        email: email,
        photoURL: imagenPerfilURL,
        votantes: [],
        saldoRecaudado: [],
        createdAt: Date.now(),
      });

      router.push('/');
    } catch (error: any) {
      console.error('Error al crear el usuario:', error.message);
      setError(error.message || 'Error al crear la cuenta');
    } finally {
      setLoading(false);
    }
  };

  const { valores, errores, handleSubmit, handleChange, handleBlur } =
    useValidacion(STATE_INICIAL, validarCrearCuenta, crearCuenta);

  const { nombre, email, password, telefono, department, province, district } = valores;

  const obtenerProvincias = async (idDepartamento: string) => {
    const provinciasFiltradas = provincias.filter(
      (provincia: any) => provincia.department_id === idDepartamento
    );
    setProvincias(provinciasFiltradas);
  };

  const obtenerDistritos = async (idProvincia: string) => {
    const distritosFiltrados = distritos.filter(
      (distrito: any) => distrito.province_id === idProvincia
    );
    setDistritos(distritosFiltrados);
  };

  useEffect(() => {
    if (departamento.id) {
      obtenerProvincias(departamento.id);
    }
  }, [departamento]);

  const handleChangeDepartamento = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value;
    if (selectedValue === '') {
      setDepartamento({});
      return;
    }
    const selectedDepartamento = departamentos.find(
      (dep: any) => dep.name === selectedValue
    );
    setDepartamento({
      name: selectedValue,
      id: selectedDepartamento?.id,
    });
  };

  const handleChangeProvincia = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value;
    if (selectedValue === '') {
      setProvincia({});
      return;
    }
    const selectedProvincia = provinciasPeru.find(
      (provincia: any) => provincia.name === selectedValue
    );
    setProvincia({
      name: selectedValue,
      id: selectedProvincia?.id,
    });
    obtenerDistritos(selectedProvincia?.id);
  };

  const inputClass = "w-full px-4 py-3 bg-slate-950/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition";
  const errorClass = "border-red-500";
  const labelClass = "block text-sm font-medium text-gray-300 mb-2";

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-12 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 via-transparent to-purple-600/5"></div>
      <div className="absolute top-1/4 -left-48 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-1/4 -right-48 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl"></div>

      <div className="max-w-2xl mx-auto relative z-10">
        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <div className="inline-block mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center">
                <i className="bx bx-user-plus text-3xl text-white"></i>
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2 font-roboto-slab">
              Crear Cuenta
            </h1>
            <p className="text-gray-400">
              Únete a nuestra plataforma de inversiones
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label htmlFor="nombre" className={labelClass}>Nombre Completo</label>
                <input type="text" id="nombre" name="nombre" placeholder="Juan Pérez" value={nombre} onChange={handleChange} onBlur={handleBlur} className={`${inputClass} ${errores.nombre ? errorClass : ''}`} />
                {errores.nombre && <p className="text-red-400 text-sm mt-1.5 flex items-center gap-1"><i className="bx bx-error-circle"></i>{errores.nombre}</p>}
              </div>

              <div>
                <label htmlFor="email" className={labelClass}>Email</label>
                <input type="email" id="email" name="email" placeholder="tu@email.com" value={email} onChange={handleChange} onBlur={handleBlur} className={`${inputClass} ${errores.email ? errorClass : ''}`} />
                {errores.email && <p className="text-red-400 text-sm mt-1.5 flex items-center gap-1"><i className="bx bx-error-circle"></i>{errores.email}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label htmlFor="password" className={labelClass}>Contraseña</label>
                <input type="password" id="password" name="password" placeholder="Mínimo 6 caracteres" value={password} onChange={handleChange} onBlur={handleBlur} className={`${inputClass} ${errores.password ? errorClass : ''}`} />
                {errores.password && <p className="text-red-400 text-sm mt-1.5 flex items-center gap-1"><i className="bx bx-error-circle"></i>{errores.password}</p>}
              </div>

              <div>
                <label htmlFor="telefono" className={labelClass}>Teléfono</label>
                <input type="text" id="telefono" name="telefono" placeholder="999999999" value={telefono} onChange={handleChange} onBlur={handleBlur} maxLength={9} className={`${inputClass} ${errores.telefono ? errorClass : ''}`} />
                {errores.telefono && <p className="text-red-400 text-sm mt-1.5 flex items-center gap-1"><i className="bx bx-error-circle"></i>{errores.telefono}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="department" className={labelClass}>Departamento</label>
              <select value={department} onChange={(e) => { handleChange(e); handleChangeDepartamento(e); }} onBlur={handleBlur} name="department" className={`${inputClass} ${errores.departamento ? errorClass : ''}`}>
                <option value="">-- Seleccione --</option>
                {departamentos.map((dep: any) => (<option key={dep.id} value={dep.name}>{dep.name}</option>))}
              </select>
              {errores.departamento && <p className="text-red-400 text-sm mt-1.5 flex items-center gap-1"><i className="bx bx-error-circle"></i>{errores.departamento}</p>}
            </div>

            {departamento.id && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="province" className={labelClass}>Provincia</label>
                  <select value={province} onChange={(e) => { handleChange(e); handleChangeProvincia(e); }} onBlur={handleBlur} name="province" className={`${inputClass} ${errores.provincia ? errorClass : ''}`}>
                    <option value="">-- Seleccione --</option>
                    {provinciasPeru.map((prov: any) => (<option key={prov.id} value={prov.name}>{prov.name}</option>))}
                  </select>
                  {errores.provincia && <p className="text-red-400 text-sm mt-1.5 flex items-center gap-1"><i className="bx bx-error-circle"></i>{errores.provincia}</p>}
                </div>

                {provincia.id && (
                  <div>
                    <label htmlFor="district" className={labelClass}>Distrito</label>
                    <select value={district} onChange={handleChange} onBlur={handleBlur} name="district" className={`${inputClass} ${errores.distrito ? errorClass : ''}`}>
                      <option value="">-- Seleccione --</option>
                      {distritosPeru.map((dist: any) => (<option key={dist.id} value={dist.name}>{dist.name}</option>))}
                    </select>
                    {errores.distrito && <p className="text-red-400 text-sm mt-1.5 flex items-center gap-1"><i className="bx bx-error-circle"></i>{errores.distrito}</p>}
                  </div>
                )}
              </div>
            )}

            <div>
              <label htmlFor="imagen" className={labelClass}>Foto de Perfil (opcional)</label>
              <input type="file" id="imagen" name="imagen" accept="image/*" onChange={(e) => { if (e.target.files && e.target.files[0]) { setImagen(e.target.files[0]); } }} className={inputClass} />
              {errores.imagen && <p className="text-red-400 text-sm mt-1.5 flex items-center gap-1"><i className="bx bx-error-circle"></i>{errores.imagen}</p>}
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl flex items-start gap-2">
                <i className="bx bx-error-circle text-xl mt-0.5"></i>
                <span className="text-sm">{error}</span>
              </div>
            )}

            <button type="submit" disabled={loading} className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-bold shadow-lg shadow-blue-600/25 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Creando cuenta...
                </span>
              ) : (
                'Crear Cuenta'
              )}
            </button>
          </form>

          <div className="mt-8 text-center space-y-4">
            <p className="text-gray-400 text-sm">
              ¿Ya tienes cuenta?{' '}
              <Link href="/login" className="text-blue-400 hover:text-blue-300 font-semibold transition">
                Iniciar sesión
              </Link>
            </p>
            <Link href="/" className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-300 text-sm transition">
              <i className="bx bx-arrow-back"></i>
              Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, addDoc } from 'firebase/firestore';
import { ref, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import { db, storage } from '@/lib/firebase/config';
import useAutenticacion from '@/Hooks/useAutenticacion';
import useValidacion from '@/Hooks/useValidacion';
import validarCrearProducto from '@/Validacion/validarCrearProducto';
import { showToast } from '@/lib/toast';
import { fileValidators, sanitizeHTML } from '@/lib/validators';
import OptimizedImage from '@/components/common/OptimizedImage';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const LocationPicker = dynamic(() => import('@/components/common/LocationPicker'), {
  ssr: false,
  loading: () => (
    <div className="bg-slate-950/50 rounded-xl h-80 flex items-center justify-center border-2 border-dashed border-white/10">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-gray-400">Cargando mapa...</p>
      </div>
    </div>
  ),
});
import { FaCloudUploadAlt, FaInfoCircle, FaMapMarkerAlt, FaFileAlt, FaDollarSign, FaBuilding, FaTag } from 'react-icons/fa';

const STATE_INICIAL = {
  nombre: '',
  empresa: '',
  url: '',
  descripcion: '',
  categoria: '',
  precio: '',
  fechaLimite: '',
};

export default function NuevoProductoPage() {
  const router = useRouter();
  const { usuario, loading } = useAutenticacion();
  const [uploading, setUploading] = useState(false);
  const [urlimagen, setURLImage] = useState<string[]>([]);
  const [error, setError] = useState<string | false>(false);
  const [comisionGestor, setComisionGestor] = useState(10); // 5%–20%, default 10%
  const [coordenadas, setCoordenadas] = useState<{ lat: number; lng: number }>({
    lat: -12.0464,
    lng: -77.0428
  });

  const crearProducto = async () => {
    if (!usuario) {
      showToast.error('Debes iniciar sesión para crear un producto');
      return router.push('/login');
    }

    if (urlimagen.length === 0) {
      setError('Debes subir al menos una imagen');
      showToast.error('Debes subir al menos una imagen');
      return;
    }

    try {
      // Sanitizar descripción
      const descripcionSanitizada = sanitizeHTML(valores.descripcion);

      const producto = {
        nombre: valores.nombre,
        empresa: valores.empresa,
        url: valores.url,
        urlimagen,
        descripcion: descripcionSanitizada,
        votos: 0,
        comentarios: [],
        creado: Date.now(),
        creador: {
          id: usuario.uid,
          nombre: usuario.displayName,
        },
        haVotado: [],
        categoria: valores.categoria,
        precio: parseInt(valores.precio),
        coordenadas: coordenadas,
        inversores: [],
        estado: true,
        monto: 0,
        depositoRecaudado: false,
        fechaLimite: new Date(valores.fechaLimite).getTime(),
        // ⭐ CAMPOS ENTERPRISE
        gestorId: usuario.uid,
        comisionGestor: comisionGestor,
        distribucionEjecutada: false,
      };

      const toastId = showToast.loading('Creando producto...');
      await addDoc(collection(db, 'productos'), producto);
      showToast.dismiss(toastId);
      showToast.success('¡Producto creado exitosamente!');
      router.push('/');
    } catch (error: any) {
      console.error('Error al crear producto:', error);
      showToast.dismiss();
      const errorMsg = error.message || 'Error al crear el producto';
      setError(errorMsg);
      showToast.error(errorMsg);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // Validar archivos antes de subir
    const validationErrors: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const validation = fileValidators.validateImage(file);
      if (!validation.valid) {
        validationErrors.push(`${file.name}: ${validation.error}`);
      }
    }

    if (validationErrors.length > 0) {
      setError(validationErrors.join(', '));
      showToast.error(validationErrors[0]);
      return;
    }

    const uploadPromises: Promise<string>[] = [];
    setUploading(true);
    setError(false);

    const toastId = showToast.loading('Subiendo imágenes...');

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const imageRef = ref(storage, 'productos/' + Date.now() + '_' + file.name);
      const uploadTask = uploadBytesResumable(imageRef, file);

      const uploadPromise = new Promise<string>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log(`Subiendo ${file.name}: ${progress.toFixed(0)}%`);
          },
          (error) => {
            console.error('Error al subir imagen:', error);
            reject(error);
          },
          () => {
            getDownloadURL(uploadTask.snapshot.ref).then((url) => {
              resolve(url);
            });
          }
        );
      });

      uploadPromises.push(uploadPromise);
    }

    Promise.all(uploadPromises)
      .then((urls) => {
        setUploading(false);
        setURLImage(urls);
        showToast.dismiss(toastId);
        showToast.success(`${urls.length} imagen(es) subida(s) correctamente`);
      })
      .catch((error) => {
        setUploading(false);
        showToast.dismiss(toastId);
        setError('Error al subir las imágenes');
        showToast.error('Error al subir las imágenes');
        console.error(error);
      });
  };

  const { valores, errores, handleSubmit, handleChange, handleBlur } = useValidacion<typeof STATE_INICIAL>(
    STATE_INICIAL,
    validarCrearProducto as any,
    crearProducto
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin blur-[1px]"></div>
      </div>
    );
  }

  if (!usuario) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
          <div className="absolute top-[20%] left-[20%] w-96 h-96 bg-blue-600/10 rounded-full blur-[100px]"></div>
        </div>

        <div className="relative z-10 bg-slate-900/50 backdrop-blur-xl border border-white/10 p-8 rounded-3xl max-w-md w-full text-center shadow-2xl">
          <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/5">
            <FaInfoCircle className="text-3xl text-blue-400" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-4 font-roboto-slab">Acceso Restringido</h2>
          <p className="text-gray-400 mb-8">Debes iniciar sesión para publicar un nuevo proyecto.</p>
          <Link
            href="/login"
            className="inline-flex w-full justify-center py-3 px-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-semibold transition-all shadow-lg shadow-blue-600/20"
          >
            Iniciar Sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 py-12 px-4 relative overflow-hidden">
      {/* Background Elements */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-purple-600/5 rounded-full blur-[120px]"></div>
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-white mb-2 font-roboto-slab bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
            Nuevo Proyecto
          </h1>
          <p className="text-gray-400 text-lg">Publica tu oportunidad de inversión</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Información General */}
          <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-[24px] p-8">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3 pb-4 border-b border-white/5">
              <FaBuilding className="text-blue-400" /> Información General
            </h2>

            <div className="space-y-6">
              {/* Nombre */}
              <div>
                <label htmlFor="nombre" className="text-gray-300 font-medium mb-2 block">
                  Nombre del Proyecto <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  id="nombre"
                  name="nombre"
                  placeholder="Ej: Condominio Las Palmeras"
                  value={valores.nombre}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`w-full bg-slate-950/50 border ${errores.nombre ? 'border-red-500/50' : 'border-white/10'} rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors`}
                />
                {errores.nombre && <p className="text-red-400 text-sm mt-1 flex items-center gap-1"><FaInfoCircle /> {errores.nombre}</p>}
              </div>

              {/* Empresa */}
              <div>
                <label htmlFor="empresa" className="text-gray-300 font-medium mb-2 block">
                  Empresa o Compañía <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  id="empresa"
                  name="empresa"
                  placeholder="Ej: Constructora ABC S.A.C."
                  value={valores.empresa}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`w-full bg-slate-950/50 border ${errores.empresa ? 'border-red-500/50' : 'border-white/10'} rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors`}
                />
                {errores.empresa && <p className="text-red-400 text-sm mt-1">{errores.empresa}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Categoría */}
                <div>
                  <label htmlFor="categoria" className="text-gray-300 font-medium mb-2 block flex items-center gap-2">
                    <FaTag className="text-blue-400 text-sm" /> Categoría <span className="text-red-400">*</span>
                  </label>
                  <select
                    id="categoria"
                    name="categoria"
                    value={valores.categoria}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={`w-full bg-slate-950/50 border ${errores.categoria ? 'border-red-500/50' : 'border-white/10'} rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none`}
                  >
                    <option value="" className="bg-slate-900 text-gray-400">-- Seleccione --</option>
                    <option value="departamento" className="bg-slate-900">Departamento</option>
                    <option value="terreno" className="bg-slate-900">Terreno</option>
                    <option value="casa" className="bg-slate-900">Casa</option>
                    <option value="oficina" className="bg-slate-900">Oficina</option>
                    <option value="localComercial" className="bg-slate-900">Local Comercial</option>
                    <option value="habilitacionUrbana" className="bg-slate-900">Habilitación Urbana</option>
                  </select>
                  {errores.categoria && <p className="text-red-400 text-sm mt-1">{errores.categoria}</p>}
                </div>

                {/* Precio */}
                <div>
                  <label htmlFor="precio" className="text-gray-300 font-medium mb-2 block flex items-center gap-2">
                    <FaDollarSign className="text-green-400 text-sm" /> Meta de Financiamiento <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    id="precio"
                    name="precio"
                    placeholder="Ej: 250000"
                    min={0}
                    value={valores.precio}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={`w-full bg-slate-950/50 border ${errores.precio ? 'border-red-500/50' : 'border-white/10'} rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors`}
                  />
                  {errores.precio && <p className="text-red-400 text-sm mt-1">{errores.precio}</p>}
                </div>
              </div>

              {/* Fecha Límite */}
              <div>
                <label htmlFor="fechaLimite" className="text-gray-300 font-medium mb-2 block">
                  Fecha límite de recaudación <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  id="fechaLimite"
                  name="fechaLimite"
                  value={valores.fechaLimite}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`w-full bg-slate-950/50 border ${errores.fechaLimite ? 'border-red-500/50' : 'border-white/10'} rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors`}
                />
                {errores.fechaLimite && <p className="text-red-400 text-sm mt-1">{errores.fechaLimite}</p>}
                <p className="text-xs text-gray-500 mt-1">Si no se alcanza el 100% para esta fecha, se bloquearán las inversiones.</p>
              </div>

              {/* ⭐ COMISIÓN DEL GESTOR */}
              <div className="bg-slate-950/50 border border-amber-500/20 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <label className="text-amber-300 font-bold text-base block mb-1">
                      💼 Comisión del Gestor
                    </label>
                    <p className="text-gray-500 text-xs">Porcentaje sobre la utilidad neta que percibirás al liquidar el proyecto</p>
                  </div>
                  <div className="text-right">
                    <span className="text-3xl font-black text-amber-400 font-mono">{comisionGestor}%</span>
                    <p className="text-xs text-gray-500 mt-1">rango: 5% – 20%</p>
                  </div>
                </div>

                {/* Slider */}
                <input
                  type="range"
                  min={5}
                  max={20}
                  step={1}
                  value={comisionGestor}
                  onChange={(e) => setComisionGestor(Number(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-full appearance-none cursor-pointer accent-amber-400 mb-5"
                />
                <div className="flex justify-between text-xs text-gray-600 -mt-4 mb-5">
                  <span>5% (mínimo)</span>
                  <span>10% (estándar)</span>
                  <span>20% (máximo)</span>
                </div>

                {/* Preview de distribución en tiempo real */}
                <div className="bg-slate-900/80 rounded-xl p-4 border border-white/5">
                  <p className="text-xs text-gray-400 mb-3 font-semibold uppercase tracking-wider">Vista previa — Ejemplo con utilidad neta de S/ 100,000</p>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">Utilidad Neta del Proyecto</span>
                      <span className="font-mono text-white font-bold">S/ 100,000</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-amber-400 text-sm">Tu Fee de Gestor ({comisionGestor}%)</span>
                      <span className="font-mono text-amber-400 font-bold">S/ {(100000 * comisionGestor / 100).toLocaleString('es-PE')}</span>
                    </div>
                    <div className="border-t border-white/10 pt-2 flex justify-between items-center">
                      <span className="text-emerald-400 text-sm font-bold">Pool para Socios ({100 - comisionGestor}%)</span>
                      <span className="font-mono text-emerald-400 font-bold text-lg">S/ {(100000 * (100 - comisionGestor) / 100).toLocaleString('es-PE')}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* URL */}
              <div>
                <label htmlFor="url" className="text-gray-300 font-medium mb-2 block">
                  URL del Proyecto (Web o Drive) <span className="text-red-400">*</span>
                </label>
                <input
                  type="url"
                  id="url"
                  name="url"
                  placeholder="https://ejemplo.com/proyecto"
                  value={valores.url}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`w-full bg-slate-950/50 border ${errores.url ? 'border-red-500/50' : 'border-white/10'} rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors`}
                />
                {errores.url && <p className="text-red-400 text-sm mt-1">{errores.url}</p>}
              </div>

              {/* Imágenes Drag & Drop Visual */}
              <div>
                <label className="text-gray-300 font-medium mb-2 block">
                  Imágenes del Proyecto <span className="text-red-400">*</span>
                </label>

                <div className="relative border-2 border-dashed border-white/10 rounded-2xl p-8 text-center hover:border-blue-500/50 transition-colors bg-slate-950/30">
                  <input
                    type="file"
                    id="imagen"
                    name="imagen"
                    onChange={handleImageUpload}
                    multiple
                    accept={fileValidators.allowedImageTypes.join(',')}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    disabled={uploading}
                  />

                  <div className="flex flex-col items-center justify-center">
                    <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                      <FaCloudUploadAlt className="text-3xl text-blue-400" />
                    </div>
                    <p className="text-lg font-medium text-white mb-2">Arrastra imágenes o haz clic para subir</p>
                    <p className="text-sm text-gray-500">JPG, PNG, WebP (Máx 5MB)</p>
                  </div>
                </div>

                {uploading && (
                  <div className="mt-4 flex items-center gap-3 text-blue-400 bg-blue-500/10 px-4 py-3 rounded-xl border border-blue-500/20">
                    <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                    <span className="font-medium">Subiendo imágenes... Por favor espera.</span>
                  </div>
                )}

                {urlimagen.length > 0 && (
                  <div className="mt-6">
                    <p className="text-green-400 text-sm mb-3 flex items-center gap-2 font-medium">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                      {urlimagen.length} imagen(es) cargada(s)
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {urlimagen.map((url, index) => (
                        <div key={index} className="relative aspect-video rounded-lg overflow-hidden border border-white/10 group">
                          <OptimizedImage
                            src={url}
                            alt={`Preview ${index + 1}`}
                            className="w-full h-full object-cover transition-transform group-hover:scale-110"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-white text-xs font-medium">Cover</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Descripción */}
          <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-[24px] p-8">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3 pb-4 border-b border-white/5">
              <FaFileAlt className="text-purple-400" /> Descripción Detallada
            </h2>

            <div>
              <label htmlFor="descripcion" className="text-gray-300 font-medium mb-2 block">
                Cuenta la historia de tu proyecto <span className="text-red-400">*</span>
              </label>
              <textarea
                id="descripcion"
                name="descripcion"
                rows={8}
                maxLength={2000}
                placeholder="Describe las características, ubicación, rentabilidad esperada y cualquier detalle que atraiga inversores..."
                value={valores.descripcion}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`w-full bg-slate-950/50 border ${errores.descripcion ? 'border-red-500/50' : 'border-white/10'} rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors resize-none`}
              />
              <div className="flex justify-between items-center mt-2">
                {errores.descripcion ? (
                  <p className="text-red-400 text-sm">{errores.descripcion}</p>
                ) : <span></span>}
                <p className="text-xs text-gray-500 bg-slate-900 px-2 py-1 rounded">
                  {valores.descripcion.length}/2000
                </p>
              </div>
            </div>
          </div>

          {/* Ubicación con Mapa Interactivo */}
          <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-[24px] p-8">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3 pb-4 border-b border-white/5">
              <FaMapMarkerAlt className="text-red-400" /> Ubicación del Proyecto
            </h2>

            <div className="space-y-4">
              <p className="text-gray-400 text-sm">
                Haz clic en el mapa para seleccionar la ubicación exacta de tu proyecto
              </p>

              <LocationPicker
                initialPosition={coordenadas}
                onLocationChange={(newCoords) => setCoordenadas(newCoords)}
              />

              <div className="flex items-center gap-4 p-4 bg-slate-950/50 rounded-xl border border-white/5">
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1">Latitud</p>
                  <p className="text-white font-mono font-semibold">{coordenadas.lat.toFixed(6)}</p>
                </div>
                <div className="w-px h-10 bg-white/10"></div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1">Longitud</p>
                  <p className="text-white font-mono font-semibold">{coordenadas.lng.toFixed(6)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Error General */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-200 px-6 py-4 rounded-xl flex items-center gap-3">
              <FaInfoCircle className="text-xl shrink-0" />
              {error}
            </div>
          )}

          {/* Botones */}
          <div className="flex flex-col md:flex-row gap-4 pt-4">
            <button
              type="submit"
              disabled={uploading}
              className="flex-1 py-4 text-lg font-bold text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-xl shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Procesando...' : 'Publicar Proyecto'}
            </button>
            <Link
              href="/"
              className="flex-1 py-4 text-lg font-medium text-gray-300 bg-slate-800/50 hover:bg-slate-800 hover:text-white rounded-xl border border-white/5 text-center transition-all"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

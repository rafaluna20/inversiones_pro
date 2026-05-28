'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import { db, storage } from '@/lib/firebase/config';
import useAutenticacion from '@/Hooks/useAutenticacion';
import { showToast } from '@/lib/toast';
import { fileValidators, sanitizeHTML } from '@/lib/validators';
import OptimizedImage from '@/components/common/OptimizedImage';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  FaCloudUploadAlt,
  FaInfoCircle,
  FaMapMarkerAlt,
  FaFileAlt,
  FaDollarSign,
  FaBuilding,
  FaTag,
  FaLock,
  FaArrowLeft,
  FaSave,
  FaExclamationTriangle,
} from 'react-icons/fa';

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

interface ProductoData {
  nombre: string;
  empresa: string;
  url: string;
  descripcion: string;
  categoria: string;
  precio: number;
  urlimagen: string | string[];
  coordenadas?: { lat: number; lng: number };
  inversores?: any[];
  creador?: { id: string; nombre: string };
}

export default function EditarProductoPage() {
  const params = useParams();
  const router = useRouter();
  const { usuario, loading: authLoading } = useAutenticacion();

  // Page state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | false>(false);
  const [tieneInversores, setTieneInversores] = useState(false);
  const [estaCompleto, setEstaCompleto] = useState(false);

  // Form fields
  const [nombre, setNombre] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [url, setUrl] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [categoria, setCategoria] = useState('');
  const [precio, setPrecio] = useState('');
  const [urlimagen, setURLImage] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [coordenadas, setCoordenadas] = useState<{ lat: number; lng: number }>({
    lat: -12.0464,
    lng: -77.0428,
  });

  // Load product data
  useEffect(() => {
    if (!params.id) return;

    const loadProducto = async () => {
      try {
        const docRef = doc(db, 'productos', params.id as string);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          showToast.error('Proyecto no encontrado');
          router.push('/');
          return;
        }

        const data = docSnap.data() as ProductoData;

        // Check if user is the creator
        if (data.creador?.id !== usuario?.uid) {
          showToast.error('No tienes permiso para editar este proyecto');
          router.push(`/productos/${params.id}`);
          return;
        }

        // Populate form
        setNombre(data.nombre || '');
        setEmpresa(data.empresa || '');
        setUrl(data.url || '');
        setDescripcion(data.descripcion || '');
        setCategoria(data.categoria || '');
        setPrecio(String(data.precio || ''));

        // Handle images
        const imgs = Array.isArray(data.urlimagen)
          ? data.urlimagen
          : data.urlimagen
          ? [data.urlimagen]
          : [];
        setExistingImages(imgs);
        setURLImage(imgs);

        if (data.coordenadas) {
          setCoordenadas(data.coordenadas);
        }

        // Regla de Oro: check if investors exist
        const inversoresList = data.inversores || [];
        setTieneInversores(inversoresList.length > 0);
        
        // Regla de Platino: block all edits if 100% funded
        const totalCubos = inversoresList.reduce((sum, inv) => sum + (inv.cubos || 0), 0);
        setEstaCompleto(totalCubos >= 100);
      } catch (err) {
        console.error('Error al cargar proyecto:', err);
        showToast.error('Error al cargar el proyecto');
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading && usuario) {
      loadProducto();
    } else if (!authLoading && !usuario) {
      router.push('/login');
    }
  }, [params.id, usuario, authLoading, router]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

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
          null,
          (error) => reject(error),
          () => getDownloadURL(uploadTask.snapshot.ref).then(resolve)
        );
      });

      uploadPromises.push(uploadPromise);
    }

    Promise.all(uploadPromises)
      .then((urls) => {
        setUploading(false);
        // Merge new images with existing ones
        setURLImage((prev) => [...prev, ...urls]);
        showToast.dismiss(toastId);
        showToast.success(`${urls.length} imagen(es) añadida(s)`);
      })
      .catch(() => {
        setUploading(false);
        showToast.dismiss(toastId);
        setError('Error al subir las imágenes');
        showToast.error('Error al subir las imágenes');
      });
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setURLImage((prev) => prev.filter((_, i) => i !== indexToRemove));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!usuario || !params.id) return;

    if (estaCompleto) {
      setError('El proyecto está 100% financiado. La edición está bloqueada por seguridad de los inversores.');
      showToast.error('Edición bloqueada');
      return;
    }

    // Validations
    if (!nombre.trim()) { setError('El nombre del proyecto es requerido'); return; }
    if (!empresa.trim()) { setError('La empresa es requerida'); return; }
    if (!descripcion.trim() || descripcion.length < 20) { setError('La descripción debe tener al menos 20 caracteres'); return; }
    if (!categoria) { setError('La categoría es requerida'); return; }
    if (!tieneInversores && (!precio || parseInt(precio) <= 0)) {
      setError('El precio debe ser mayor a 0');
      return;
    }
    if (urlimagen.length === 0) { setError('Debes tener al menos una imagen'); return; }

    setSaving(true);
    setError(false);

    try {
      const updateData: any = {
        nombre: nombre.trim(),
        empresa: empresa.trim(),
        url: url.trim(),
        descripcion: sanitizeHTML(descripcion),
        categoria,
        urlimagen,
        coordenadas,
      };

      // Only update price if no investors (Regla de Oro)
      if (!tieneInversores) {
        updateData.precio = parseInt(precio);
      }

      const docRef = doc(db, 'productos', params.id as string);
      await updateDoc(docRef, updateData);

      showToast.success('¡Proyecto actualizado exitosamente!');
      router.push(`/productos/${params.id}`);
    } catch (err: any) {
      console.error('Error al actualizar:', err);
      const errorMsg = err.message || 'Error al actualizar el proyecto';
      setError(errorMsg);
      showToast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  // Loading states
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Cargando proyecto...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 py-12 px-4 relative overflow-hidden">
      {/* Background Elements */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-amber-600/5 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-purple-600/5 rounded-full blur-[120px]"></div>
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/productos/${params.id}`}
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition group mb-6"
          >
            <FaArrowLeft className="group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium">Volver al Proyecto</span>
          </Link>

          <div className="text-center">
            <h1 className="text-4xl font-bold text-white mb-2 font-roboto-slab bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-orange-400">
              Editar Proyecto
            </h1>
            <p className="text-gray-400 text-lg">Actualiza la información de tu proyecto</p>
          </div>
        </div>

        {/* Golden Rule Banner */}
        {tieneInversores && !estaCompleto && (
          <div className="mb-8 p-5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-4">
            <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center shrink-0 mt-0.5">
              <FaExclamationTriangle className="text-amber-400 text-lg" />
            </div>
            <div>
              <h3 className="text-amber-400 font-bold text-lg mb-1">Regla de Oro Activa</h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                Este proyecto ya tiene inversores. Por eso, el <strong className="text-amber-300">precio está bloqueado</strong> y 
                no puede modificarse para proteger a quienes ya invirtieron. 
                Puedes actualizar libremente la descripción, imágenes, URL y otros datos.
              </p>
            </div>
          </div>
        )}

        {/* Platinum Rule Banner (100% Funded) */}
        {estaCompleto && (
          <div className="mb-8 p-5 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-start gap-4 shadow-lg shadow-red-500/10">
            <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center shrink-0 mt-0.5">
              <FaLock className="text-red-400 text-lg" />
            </div>
            <div>
              <h3 className="text-red-400 font-bold text-lg mb-1">Edición Bloqueada (100% Financiado)</h3>
              <p className="text-red-200/80 text-sm leading-relaxed">
                El proyecto ha alcanzado su meta de recaudación. Para proteger la inversión y evitar el fraude por cambio de condiciones (Bait & Switch), <strong>no se puede modificar ningún detalle del proyecto</strong>.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-8">
          {/* Información General */}
          <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-[24px] p-8">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3 pb-4 border-b border-white/5">
              <FaBuilding className="text-amber-400" /> Información General
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
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Condominio Las Palmeras"
                  className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              {/* Empresa */}
              <div>
                <label htmlFor="empresa" className="text-gray-300 font-medium mb-2 block">
                  Empresa o Compañía <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  id="empresa"
                  value={empresa}
                  onChange={(e) => setEmpresa(e.target.value)}
                  placeholder="Ej: Constructora ABC S.A.C."
                  className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Categoría */}
                <div>
                  <label htmlFor="categoria" className="text-gray-300 font-medium mb-2 flex items-center gap-2">
                    <FaTag className="text-amber-400 text-sm" /> Categoría <span className="text-red-400">*</span>
                  </label>
                  <select
                    id="categoria"
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500 transition-colors appearance-none"
                  >
                    <option value="" className="bg-slate-900 text-gray-400">-- Seleccione --</option>
                    <option value="departamento" className="bg-slate-900">Departamento</option>
                    <option value="terreno" className="bg-slate-900">Terreno</option>
                    <option value="casa" className="bg-slate-900">Casa</option>
                    <option value="oficina" className="bg-slate-900">Oficina</option>
                    <option value="localComercial" className="bg-slate-900">Local Comercial</option>
                    <option value="habilitacionUrbana" className="bg-slate-900">Habilitación Urbana</option>
                  </select>
                </div>

                {/* Precio - Regla de Oro */}
                <div>
                  <label htmlFor="precio" className="text-gray-300 font-medium mb-2 flex items-center gap-2">
                    {tieneInversores ? (
                      <FaLock className="text-gray-500 text-sm" />
                    ) : (
                      <FaDollarSign className="text-green-400 text-sm" />
                    )}
                    Meta de Financiamiento
                    {!tieneInversores && <span className="text-red-400">*</span>}
                    {tieneInversores && (
                      <span className="ml-auto text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <FaLock className="text-[10px]" /> Bloqueado
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      id="precio"
                      value={precio}
                      onChange={(e) => setPrecio(e.target.value)}
                      placeholder="Ej: 250000"
                      min={0}
                      disabled={tieneInversores}
                      className={`w-full rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none transition-colors ${
                        tieneInversores
                          ? 'bg-slate-800/30 border border-white/5 text-gray-500 cursor-not-allowed'
                          : 'bg-slate-950/50 border border-white/10 focus:border-amber-500'
                      }`}
                    />
                    {tieneInversores && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600">
                        <FaLock />
                      </div>
                    )}
                  </div>
                  {tieneInversores && (
                    <p className="text-amber-500/80 text-xs mt-2 flex items-center gap-1">
                      <FaLock className="text-[10px]" />
                      No modificable: hay inversores activos en este proyecto
                    </p>
                  )}
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
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://ejemplo.com/proyecto"
                  className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              {/* Images */}
              <div>
                <label className="text-gray-300 font-medium mb-2 block">
                  Imágenes del Proyecto
                </label>

                {/* Current Images */}
                {urlimagen.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm text-gray-400 mb-3">
                      Imágenes actuales ({urlimagen.length}) — Haz clic en ✕ para eliminar
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {urlimagen.map((imgUrl, index) => (
                        <div key={index} className="relative aspect-video rounded-lg overflow-hidden border border-white/10 group">
                          <OptimizedImage
                            src={imgUrl}
                            alt={`Imagen ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(index)}
                            className="absolute top-1 right-1 w-6 h-6 bg-red-600/90 hover:bg-red-600 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                            title="Eliminar imagen"
                          >
                            ✕
                          </button>
                          {index === 0 && (
                            <div className="absolute bottom-1 left-1 bg-amber-500/90 text-white text-[10px] px-2 py-0.5 rounded font-semibold">
                              PORTADA
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Upload Area */}
                <div className="relative border-2 border-dashed border-white/10 rounded-2xl p-8 text-center hover:border-amber-500/50 transition-colors bg-slate-950/30">
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
                      <FaCloudUploadAlt className="text-3xl text-amber-400" />
                    </div>
                    <p className="text-lg font-medium text-white mb-2">
                      {urlimagen.length > 0 ? 'Añadir más imágenes' : 'Arrastra imágenes o haz clic para subir'}
                    </p>
                    <p className="text-sm text-gray-500">JPG, PNG, WebP (Máx 5MB)</p>
                  </div>
                </div>

                {uploading && (
                  <div className="mt-4 flex items-center gap-3 text-amber-400 bg-amber-500/10 px-4 py-3 rounded-xl border border-amber-500/20">
                    <div className="w-5 h-5 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin"></div>
                    <span className="font-medium">Subiendo imágenes... Por favor espera.</span>
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
                rows={8}
                maxLength={2000}
                placeholder="Describe las características, ubicación, rentabilidad esperada..."
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors resize-none"
              />
              <p className="text-xs text-gray-500 mt-2 text-right bg-slate-900 inline-block px-2 py-1 rounded float-right">
                {descripcion.length}/2000
              </p>
            </div>
          </div>

          {/* Ubicación */}
          <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-[24px] p-8">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3 pb-4 border-b border-white/5">
              <FaMapMarkerAlt className="text-red-400" /> Ubicación del Proyecto
            </h2>

            <div className="space-y-4">
              <p className="text-gray-400 text-sm">
                Haz clic en el mapa para actualizar la ubicación de tu proyecto
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

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-200 px-6 py-4 rounded-xl flex items-center gap-3">
              <FaInfoCircle className="text-xl shrink-0" />
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex flex-col md:flex-row gap-4 pt-4">
            <button
              type="submit"
              disabled={uploading || saving || estaCompleto}
              className={`flex-1 py-4 text-lg font-bold text-white rounded-xl transition-all flex items-center justify-center gap-3 ${
                estaCompleto 
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-white/5'
                  : 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-lg shadow-amber-900/20 active:scale-[0.98]'
              }`}
            >
              {estaCompleto ? (
                <>
                  <FaLock />
                  Edición Bloqueada
                </>
              ) : saving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Guardando...
                </>
              ) : (
                <>
                  <FaSave />
                  Guardar Cambios
                </>
              )}
            </button>
            <Link
              href={`/productos/${params.id}`}
              className="flex-1 py-4 text-lg font-medium text-gray-300 bg-slate-800/50 hover:bg-slate-800 hover:text-white rounded-xl border border-white/5 text-center transition-all flex items-center justify-center gap-2"
            >
              <FaArrowLeft className="text-sm" />
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

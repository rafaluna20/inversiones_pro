/**
 * Componente de Gestión de Gastos de Proyectos
 * Permite registrar, visualizar y gestionar gastos del proyecto
 * Solo accesible para creador y socios del proyecto
 */

'use client';

import { useState, useMemo } from 'react';
import type { CategoriaGasto } from '@/types';
import useGastos from '@/Hooks/useGastos';
import {
  Plus,
  X,
  Trash2,
  Pencil,
  FileCheck,
  Filter,
  BarChart3,
  AlertTriangle,
  Upload,
  Loader2
} from 'lucide-react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase/config';

interface GastosProyectoProps {
  proyectoId: string;
  usuarioId?: string;
  esCreadorOSocio?: boolean;
}

// Mapeo de categorías a nombres legibles y colores
const CATEGORIAS: Record<CategoriaGasto, { nombre: string; color: string; icon: string }> = {
  notaria: { nombre: 'Notaría', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: '📄' },
  impuestos: { nombre: 'Impuestos', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20', icon: '💰' },
  remodelacion: { nombre: 'Remodelación', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20', icon: '🔨' },
  construccion: { nombre: 'Construcción', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20', icon: '🏗️' },
  legal: { nombre: 'Legal', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20', icon: '⚖️' },
  marketing: { nombre: 'Marketing', color: 'bg-pink-500/10 text-pink-400 border-pink-500/20', icon: '📢' },
  mantenimiento: { nombre: 'Mantenimiento', color: 'bg-green-500/10 text-green-400 border-green-500/20', icon: '🔧' },
  visitas: { nombre: 'Visitas', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20', icon: '🚗' },
  servicios: { nombre: 'Servicios', color: 'bg-teal-500/10 text-teal-400 border-teal-500/20', icon: '⚡' },
  otros: { nombre: 'Otros', color: 'bg-gray-500/10 text-gray-400 border-gray-500/20', icon: '📦' },
};

const ESTADOS_GASTO = {
  pendiente: { nombre: 'Pendiente', color: 'bg-yellow-500/20 text-yellow-300', icon: '⏳' },
  aprobado: { nombre: 'Aprobado', color: 'bg-green-500/20 text-green-300', icon: '✅' },
  rechazado: { nombre: 'Rechazado', color: 'bg-red-500/20 text-red-300', icon: '❌' },
};

export default function GastosProyecto({ proyectoId, usuarioId, esCreadorOSocio = false }: GastosProyectoProps) {
  const {
    gastos,
    loading,
    error,
    totalGastos,
    resumenPorCategoria,
    tienePermisos,
    validandoPermisos,
    agregar,
    actualizar,
    eliminar,
    recargar,
    filtrarPorCategoria
  } = useGastos(proyectoId, usuarioId);

  const [mostrarModal, setMostrarModal] = useState(false);
  const [gastoEditando, setGastoEditando] = useState<string | null>(null);
  const [filtroCategoria, setFiltroCategoria] = useState<CategoriaGasto | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'pendiente' | 'aprobado' | 'rechazado'>('todos');
  const [vistaActual, setVistaActual] = useState<'lista' | 'resumen'>('lista');
  const [submitting, setSubmitting] = useState(false);

  // Formulario
  const [formData, setFormData] = useState({
    concepto: '',
    categoria: 'otros' as CategoriaGasto,
    monto: '',
    fecha: new Date().toISOString().split('T')[0],
    descripcion: '',
    proveedor: '',
    estado: 'aprobado' as 'pendiente' | 'aprobado' | 'rechazado',
    comprobante: ''
  });

  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Filtrar gastos
  const gastosFiltrados = useMemo(() => {
    let resultado = filtroCategoria ? filtrarPorCategoria(filtroCategoria) : gastos;
    
    if (filtroEstado !== 'todos') {
      resultado = resultado.filter(g => g.estado === filtroEstado);
    }

    return resultado.sort((a, b) => b.fecha - a.fecha);
  }, [gastos, filtroCategoria, filtroEstado, filtrarPorCategoria]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevenir doble submit
    if (submitting) return;

    const monto = parseFloat(formData.monto);
    
    if (!formData.concepto || monto <= 0) {
      return;
    }

    if (monto > 1000 && !formData.comprobante) {
      alert('Es obligatorio adjuntar un comprobante para gastos mayores a S/ 1000');
      return;
    }

    try {
      setSubmitting(true);
      
      const gastoData = {
        concepto: formData.concepto,
        categoria: formData.categoria,
        monto,
        fecha: new Date(formData.fecha).getTime(),
        descripcion: formData.descripcion || undefined,
        proveedor: formData.proveedor || undefined,
        registradoPor: usuarioId || '',
        estado: formData.estado,
        comprobante: formData.comprobante || undefined
      };

      if (gastoEditando) {
        await actualizar(gastoEditando, gastoData);
      } else {
        await agregar(gastoData);
      }

      // Resetear formulario
      setFormData({
        concepto: '',
        categoria: 'otros',
        monto: '',
        fecha: new Date().toISOString().split('T')[0],
        descripcion: '',
        proveedor: '',
        estado: 'aprobado',
        comprobante: ''
      });
      setMostrarModal(false);
      setGastoEditando(null);
    } catch (err) {
      console.error('Error al guardar gasto:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditar = (gastoId: string) => {
    const gasto = gastos.find(g => g.id === gastoId);
    if (gasto) {
      setFormData({
        concepto: gasto.concepto,
        categoria: gasto.categoria,
        monto: gasto.monto.toString(),
        fecha: new Date(gasto.fecha).toISOString().split('T')[0],
        descripcion: gasto.descripcion || '',
        proveedor: gasto.proveedor || '',
        estado: gasto.estado || 'aprobado',
        comprobante: gasto.comprobante || ''
      });
      setGastoEditando(gastoId);
      setMostrarModal(true);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingFile(true);
      setUploadProgress(0);
      
      const fileExtension = file.name.split('.').pop();
      const fileName = `gasto_${Date.now()}.${fileExtension}`;
      const storageRef = ref(storage, `proyectos/${proyectoId}/gastos/${fileName}`);
      
      const uploadTask = uploadBytesResumable(storageRef, file);
      
      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => {
          console.error('Error al subir el comprobante:', error);
          setUploadingFile(false);
          alert('Error al subir el comprobante');
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setFormData({ ...formData, comprobante: downloadURL });
          setUploadingFile(false);
        }
      );
    } catch (err) {
      console.error('Upload error:', err);
      setUploadingFile(false);
    }
  };

  const handleEliminar = async (gastoId: string) => {
    if (!confirm('¿Estás seguro de eliminar este gasto?')) return;

    try {
      await eliminar(gastoId, 'Eliminado por usuario');
    } catch (err) {
      console.error('Error al eliminar gasto:', err);
    }
  };

  if (validandoPermisos) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!tienePermisos && !esCreadorOSocio) {
    return (
      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
        <p className="text-yellow-300 font-medium">No tienes permisos para ver los gastos de este proyecto</p>
        <p className="text-gray-400 text-sm mt-2">Solo el creador y socios pueden acceder a esta información</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con stats */}
      <div className="bg-gradient-to-r from-slate-800/50 to-slate-900/50 rounded-xl p-6 border border-white/5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-2xl font-bold text-white flex items-center gap-3">
              <FileCheck className="w-8 h-8 text-emerald-400" />
              Gastos del Proyecto
            </h3>
            <p className="text-gray-400 mt-1">
              {gastosFiltrados.length} gasto{gastosFiltrados.length !== 1 ? 's' : ''} registrado{gastosFiltrados.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Total de gastos */}
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-6 py-3">
              <p className="text-gray-400 text-sm">Total Gastos</p>
              <p className="text-2xl font-bold text-emerald-400">
                S/ {totalGastos.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </p>
            </div>

            {/* Botón agregar */}
            {tienePermisos && (
              <button
                onClick={() => {
                  setGastoEditando(null);
                  setMostrarModal(true);
                }}
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
              >
                <Plus className="w-5 h-5" />
                Agregar Gasto
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filtros y vista */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          {/* Toggle vista */}
          <div className="bg-slate-800/50 border border-white/10 rounded-lg p-1 flex gap-1">
            <button
              onClick={() => setVistaActual('lista')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                vistaActual === 'lista'
                  ? 'bg-emerald-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              📋 Lista
            </button>
            <button
              onClick={() => setVistaActual('resumen')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                vistaActual === 'resumen'
                  ? 'bg-emerald-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-4 h-4 inline mr-1" />
              Resumen
            </button>
          </div>

          {/* Filtro categoría */}
          <select
            value={filtroCategoria || ''}
            onChange={(e) => setFiltroCategoria(e.target.value as CategoriaGasto || null)}
            className="bg-slate-800 border border-white/10 text-white rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Todas las categorías</option>
            {Object.entries(CATEGORIAS).map(([key, cat]) => (
              <option key={key} value={key}>
                {cat.icon} {cat.nombre}
              </option>
            ))}
          </select>

          {/* Filtro estado */}
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as any)}
            className="bg-slate-800 border border-white/10 text-white rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="todos">Todos los estados</option>
            <option value="aprobado">✅ Aprobados</option>
            <option value="pendiente">⏳ Pendientes</option>
            <option value="rechazado">❌ Rechazados</option>
          </select>
        </div>

        <button
          onClick={recargar}
          className="text-gray-400 hover:text-white text-sm flex items-center gap-2 transition-colors"
        >
          🔄 Actualizar
        </button>
      </div>

      {/* Contenido principal */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
          <p className="text-red-300">{error}</p>
        </div>
      ) : vistaActual === 'lista' ? (
        // Vista de lista
        <div className="bg-slate-800/30 border border-white/5 rounded-xl overflow-hidden">
          {gastosFiltrados.length === 0 ? (
            <div className="text-center py-20">
                <FileCheck className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">No hay gastos registrados</p>
              {tienePermisos && (
                <button
                  onClick={() => setMostrarModal(true)}
                  className="mt-4 text-emerald-400 hover:text-emerald-300 text-sm"
                >
                  + Agregar el primer gasto
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-900/80 border-b border-white/10">
                  <tr className="text-left text-gray-400 text-xs uppercase tracking-wider">
                    <th className="px-6 py-4">Fecha</th>
                    <th className="px-6 py-4">Concepto</th>
                    <th className="px-6 py-4">Categoría</th>
                    <th className="px-6 py-4">Proveedor</th>
                    <th className="px-6 py-4 text-right">Monto</th>
                    <th className="px-6 py-4">Estado</th>
                    <th className="px-6 py-4">Comprobante</th>
                    {tienePermisos && <th className="px-6 py-4 text-right">Acciones</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {gastosFiltrados.map((gasto) => {
                    const cat = CATEGORIAS[gasto.categoria];
                    const estado = ESTADOS_GASTO[gasto.estado || 'aprobado'];

                    return (
                      <tr key={gasto.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4 text-sm text-gray-300">
                          {new Date(gasto.fecha).toLocaleDateString('es-PE')}
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-white font-medium">{gasto.concepto}</p>
                          {gasto.descripcion && (
                            <p className="text-gray-400 text-xs mt-1">{gasto.descripcion}</p>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${cat.color}`}>
                            {cat.icon} {cat.nombre}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-300">
                          {gasto.proveedor || '-'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="text-emerald-400 font-mono font-bold">
                            S/ {gasto.monto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${estado.color}`}>
                            {estado.icon} {estado.nombre}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {gasto.comprobante ? (
                            <a
                              href={gasto.comprobante}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-400 hover:text-emerald-300 underline"
                            >
                              Ver
                            </a>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </td>
                        {tienePermisos && (
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleEditar(gasto.id)}
                                className="text-blue-400 hover:text-blue-300 p-1 transition-colors"
                                title="Editar"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleEliminar(gasto.id)}
                                className="text-red-400 hover:text-red-300 p-1 transition-colors"
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        // Vista de resumen por categoría
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(resumenPorCategoria).map(([categoria, total]) => {
            const cat = CATEGORIAS[categoria as CategoriaGasto];
            const porcentaje = totalGastos > 0 ? (total / totalGastos) * 100 : 0;

            return (
              <div
                key={categoria}
                className="bg-slate-800/50 border border-white/5 rounded-xl p-6 hover:border-emerald-500/30 transition-all"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-sm font-medium border ${cat.color}`}>
                    <span className="text-lg">{cat.icon}</span>
                    {cat.nombre}
                  </span>
                </div>

                <p className="text-3xl font-bold text-white mb-2">
                  S/ {total.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </p>

                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <div className="flex-1 bg-slate-700 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-500"
                      style={{ width: `${porcentaje}%` }}
                    />
                  </div>
                  <span className="font-mono">{porcentaje.toFixed(1)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de formulario */}
      {mostrarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h3 className="text-2xl font-bold text-white">
                {gastoEditando ? 'Editar Gasto' : 'Agregar Nuevo Gasto'}
              </h3>
              <button
                onClick={() => {
                  setMostrarModal(false);
                  setGastoEditando(null);
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Concepto */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Concepto del gasto *
                </label>
                <input
                  type="text"
                  value={formData.concepto}
                  onChange={(e) => setFormData({ ...formData, concepto: e.target.value })}
                  className="w-full bg-slate-800 border border-white/10 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Ej: Gastos de notaría para escritura pública"
                  required
                />
              </div>

              {/* Categoría y Monto */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Categoría *
                  </label>
                  <select
                    value={formData.categoria}
                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value as CategoriaGasto })}
                    className="w-full bg-slate-800 border border-white/10 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  >
                    {Object.entries(CATEGORIAS).map(([key, cat]) => (
                      <option key={key} value={key}>
                        {cat.icon} {cat.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Monto (S/) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.monto}
                    onChange={(e) => setFormData({ ...formData, monto: e.target.value })}
                    className="w-full bg-slate-800 border border-white/10 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="0.00"
                    required
                  />
                  {parseFloat(formData.monto) > 500 && (
                    <p className="text-yellow-400 text-xs mt-1">
                      ⚠️ Requiere comprobante (monto &gt; S/500)
                    </p>
                  )}
                </div>
              </div>

              {/* Fecha y Proveedor */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Fecha *
                  </label>
                  <input
                    type="date"
                    value={formData.fecha}
                    onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                    className="w-full bg-slate-800 border border-white/10 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Proveedor
                  </label>
                  <input
                    type="text"
                    value={formData.proveedor}
                    onChange={(e) => setFormData({ ...formData, proveedor: e.target.value })}
                    className="w-full bg-slate-800 border border-white/10 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Nombre del proveedor"
                  />
                </div>
              </div>

              {/* Comprobante */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Comprobante {parseFloat(formData.monto) > 1000 ? '*' : '(opcional)'}
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="file"
                    id="comprobante-upload"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={uploadingFile}
                  />
                  <label
                    htmlFor="comprobante-upload"
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-white/10 hover:border-emerald-500/50 rounded-lg cursor-pointer transition-colors text-sm text-gray-300"
                  >
                    {uploadingFile ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    {uploadingFile ? `Subiendo ${Math.round(uploadProgress)}%` : 'Seleccionar Archivo'}
                  </label>
                  
                  {formData.comprobante && (
                    <a
                      href={formData.comprobante}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 text-sm hover:underline flex items-center gap-1"
                    >
                      <FileCheck className="w-4 h-4" />
                      Archivo adjunto
                    </a>
                  )}
                </div>
                {parseFloat(formData.monto) > 1000 && !formData.comprobante && (
                  <p className="text-yellow-400 text-xs mt-2">
                    ⚠️ Obligatorio adjuntar imagen o PDF para gastos mayores a S/ 1000.
                  </p>
                )}
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Descripción (opcional)
                </label>
                <textarea
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  className="w-full bg-slate-800 border border-white/10 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[100px]"
                  placeholder="Detalles adicionales sobre el gasto..."
                />
              </div>

              {/* Estado */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Estado
                </label>
                <select
                  value={formData.estado}
                  onChange={(e) => setFormData({ ...formData, estado: e.target.value as any })}
                  className="w-full bg-slate-800 border border-white/10 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="aprobado">✅ Aprobado</option>
                  <option value="pendiente">⏳ Pendiente</option>
                  <option value="rechazado">❌ Rechazado</option>
                </select>
              </div>

              {/* Botones */}
              <div className="flex items-center justify-end gap-4 pt-4 border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setMostrarModal(false);
                    setGastoEditando(null);
                  }}
                  disabled={submitting}
                  className="px-6 py-3 text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-3 rounded-lg font-medium transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {submitting ? 'Guardando...' : (gastoEditando ? 'Actualizar' : 'Guardar') + ' Gasto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

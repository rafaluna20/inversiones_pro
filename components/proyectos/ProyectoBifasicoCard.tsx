/**
 * COMPONENTE - CARD DE PROYECTO BIFÁSICO
 * 
 * Muestra un proyecto bifásico con información de ambas etapas
 * Indica visualmente la etapa actual y progreso
 * 
 * @version 2.0 Enterprise
 * @date 09/02/2026
 */

'use client';

import Link from 'next/link';
import type { Producto } from '@/types';

interface ProyectoBifasicoCardProps {
  proyecto: Producto;
}

export default function ProyectoBifasicoCard({ proyecto }: ProyectoBifasicoCardProps) {
  if (!proyecto.modeloBifasico || !proyecto.etapas) {
    return null; // No es proyecto bifásico
  }

  const { tierra, construccion } = proyecto.etapas;
  
  // Calcular porcentajes
  const porcentajeTierra = (tierra.montoRecaudado / tierra.montoObjetivo) * 100;
  const porcentajeConstruccion = (construccion.montoRecaudado / construccion.montoObjetivo) * 100;
  
  const etapaActiva = proyecto.etapaActual || 'tierra';
  
  // Determinar color según etapa
  const colorEtapa = {
    tierra: 'from-emerald-500 to-green-600',
    construccion: 'from-blue-500 to-indigo-600',
    finalizado: 'from-purple-500 to-pink-600'
  };

  return (
    <div
      className="relative group hover:-translate-y-1.5 transition-transform duration-300"
    >
      <Link href={`/proyectos/${proyecto.id}`}>
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-700 hover:shadow-2xl transition-shadow">
          {/* Imagen */}
          <div className="relative h-56">
            <img
              src={Array.isArray(proyecto.urlimagen) ? proyecto.urlimagen[0] : proyecto.urlimagen}
              alt={proyecto.nombre}
              className="w-full h-full object-cover"
            />
            
            {/* Badge de Etapa */}
            <div className={`absolute top-4 right-4 px-4 py-2 rounded-full bg-gradient-to-r ${colorEtapa[etapaActiva]} text-white font-bold shadow-lg`}>
              {etapaActiva === 'tierra' && '🌱 Etapa Tierra'}
              {etapaActiva === 'construccion' && '🏗️ Etapa Construcción'}
              {etapaActiva === 'finalizado' && '✅ Finalizado'}
            </div>
            
            {/* Badge Bifásico */}
            <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-black/70 text-white text-xs font-semibold">
              BIFÁSICO
            </div>
          </div>

          {/* Contenido */}
          <div className="p-6">
            {/* Título y Categoría */}
            <div className="mb-4">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                {proyecto.nombre}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                📍 {proyecto.direccion || 'Sin dirección'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Categoría: {proyecto.categoria}
              </p>
            </div>

            {/* Descripción */}
            <p className="text-sm text-slate-700 dark:text-slate-300 mb-6 line-clamp-2">
              {proyecto.descripcion}
            </p>

            {/* Etapas */}
            <div className="space-y-4 mb-6">
              {/* Etapa Tierra */}
              <div className={`p-4 rounded-xl ${etapaActiva === 'tierra' ? 'bg-emerald-50 dark:bg-emerald-950 border-2 border-emerald-500' : 'bg-slate-50 dark:bg-slate-800'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    🌱 TIERRA
                    {tierra.activa && <span className="px-2 py-0.5 bg-emerald-500 text-white text-xs rounded-full">Activa</span>}
                    {tierra.completada && <span className="text-xl">✅</span>}
                  </span>
                  <span className="text-xl font-bold text-emerald-600">
                    {porcentajeTierra.toFixed(0)}%
                  </span>
                </div>
                
                {/* Barra de progreso */}
                <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${Math.min(porcentajeTierra, 100)}%` }}
                    className="h-full bg-gradient-to-r from-emerald-500 to-green-600 transition-all duration-1000 ease-out"
                  />
                </div>
                
                <div className="flex justify-between mt-2 text-xs text-slate-600 dark:text-slate-400">
                  <span>S/ {tierra.montoRecaudado.toLocaleString()}</span>
                  <span>Meta: S/ {tierra.montoObjetivo.toLocaleString()}</span>
                </div>
                
                <div className="flex gap-4 mt-2 text-xs text-slate-600 dark:text-slate-400">
                  <span>👥 {tierra.numeroSociosActuales}/{tierra.numeroSociosObjetivo} socios</span>
                  <span>📦 {tierra.cubos.disponibles} cubos libres</span>
                </div>
              </div>

              {/* Etapa Construcción */}
              <div className={`p-4 rounded-xl ${etapaActiva === 'construccion' ? 'bg-blue-50 dark:bg-blue-950 border-2 border-blue-500' : 'bg-slate-50 dark:bg-slate-800 opacity-60'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    🏗️ CONSTRUCCIÓN
                    {construccion.activa && <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">Activa</span>}
                    {construccion.completada && <span className="text-xl">✅</span>}
                    {!construccion.activa && !construccion.completada && <span className="px-2 py-0.5 bg-slate-400 text-white text-xs rounded-full">Próximamente</span>}
                  </span>
                  <span className="text-xl font-bold text-blue-600">
                    {porcentajeConstruccion.toFixed(0)}%
                  </span>
                </div>
                
                {/* Barra de progreso */}
                <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${Math.min(porcentajeConstruccion, 100)}%` }}
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-1000 ease-out"
                  />
                </div>
                
                <div className="flex justify-between mt-2 text-xs text-slate-600 dark:text-slate-400">
                  <span>S/ {construccion.montoRecaudado.toLocaleString()}</span>
                  <span>Meta: S/ {construccion.montoObjetivo.toLocaleString()}</span>
                </div>
                
                <div className="flex gap-4 mt-2 text-xs text-slate-600 dark:text-slate-400">
                  <span>👥 {construccion.numeroSociosActuales}/{construccion.numeroSociosObjetivo} socios</span>
                  <span>📦 {construccion.cubos.disponibles} cubos libres</span>
                </div>
              </div>
            </div>

            {/* Aporte de Suelo */}
            {proyecto.aporteSuelo && (
              <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
                <div className="text-xs font-semibold text-purple-700 dark:text-purple-300 mb-2">
                  💎 APORTE DE SUELO
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-400">
                    Tierra: {proyecto.aporteSuelo.porcentajeTierra}%
                  </span>
                  <span className="text-slate-600 dark:text-slate-400">
                    Capital: {proyecto.aporteSuelo.porcentajeCapital}%
                  </span>
                </div>
              </div>
            )}

            {/* CTA */}
            <button className="w-full py-3 px-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold rounded-xl shadow-lg transition-all transform hover:scale-105">
              Ver Detalles del Proyecto
            </button>
          </div>
        </div>
      </Link>
    </div>
  );
}

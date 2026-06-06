'use client';

/**
 * MapaInteractivo.tsx
 * Este archivo NUNCA debe ser importado con SSR.
 * Siempre usar: dynamic(() => import('./MapaInteractivo'), { ssr: false })
 */

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Icon } from 'leaflet';
import Link from 'next/link';
import { FaMapMarkerAlt, FaExternalLinkAlt, FaLock, FaUnlock } from 'react-icons/fa';
import 'leaflet/dist/leaflet.css';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Coordenadas { lat: number; lng: number; }

interface ProyectoMapa {
  id: string;
  nombre: string;
  empresa: string;
  categoria: string;
  estado: boolean;
  distribucionEjecutada?: boolean;
  coordenadas?: Coordenadas;
  cordenadas?: Coordenadas;
  precio?: number;
  monto?: number;
  roiReal?: number;
  gananciaNeta?: number;
  urlimagen?: string | string[];
  direccion?: string;
  inversores?: string[];
}

interface MapaInteractivoProps {
  proyectos: ProyectoMapa[];
  seleccionado: ProyectoMapa | null;
  onSeleccionar: (p: ProyectoMapa) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatSoles = (v: number) =>
  `S/ ${v.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function getCoordenadas(p: ProyectoMapa): Coordenadas | null {
  return p.coordenadas || p.cordenadas || null;
}

function getImagen(p: ProyectoMapa): string {
  const img = p.urlimagen;
  if (!img) return '';
  return Array.isArray(img) ? img[0] : img;
}

// ─── Íconos personalizados ────────────────────────────────────────────────────
const iconoActivo = new Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const iconoLiquidado = new Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const iconoSeleccionado = new Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [30, 48],
  iconAnchor: [15, 48],
  popupAnchor: [1, -40],
  shadowSize: [41, 41],
});

// ─── FlyTo Controller ─────────────────────────────────────────────────────────
// Componente hijo que usa useMap() DENTRO del MapContainer
function FlyToController({ seleccionado }: { seleccionado: ProyectoMapa | null }) {
  const map = useMap();

  useEffect(() => {
    if (!seleccionado) return;
    const coords = getCoordenadas(seleccionado);
    if (!coords) return;
    map.flyTo([coords.lat, coords.lng], 16, { duration: 1.2 });
  }, [seleccionado, map]);

  return null;
}

// ─── Estilos del Popup ────────────────────────────────────────────────────────
const popupStyles = `
  .leaflet-popup-content-wrapper {
    background: rgb(15 23 42) !important;
    border: 1px solid rgba(255,255,255,0.1) !important;
    border-radius: 16px !important;
    box-shadow: 0 25px 50px rgba(0,0,0,0.8) !important;
    color: white !important;
    padding: 0 !important;
    overflow: hidden !important;
  }
  .leaflet-popup-content {
    margin: 0 !important;
    width: 280px !important;
  }
  .leaflet-popup-tip-container { display: none !important; }
  .leaflet-popup-close-button {
    color: rgb(100 116 139) !important;
    top: 8px !important;
    right: 8px !important;
    font-size: 20px !important;
    width: 24px !important;
    height: 24px !important;
    z-index: 10 !important;
  }
  .leaflet-popup-close-button:hover { color: white !important; }
  .leaflet-container { background: rgb(2 6 23) !important; font-family: inherit !important; }
  .leaflet-tile { filter: brightness(0.82) saturate(0.6) hue-rotate(200deg) !important; }
`;

// ─── Componente principal ─────────────────────────────────────────────────────
export default function MapaInteractivo({ proyectos, seleccionado, onSeleccionar }: MapaInteractivoProps) {
  const centerDefault: [number, number] = [-9.19, -75.0152]; // Centro de Perú

  return (
    <>
      <style>{popupStyles}</style>
      <MapContainer
        center={centerDefault}
        zoom={6}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Controlador de vuelo: usa useMap dentro del MapContainer */}
        <FlyToController seleccionado={seleccionado} />

        {/* Pins de proyectos */}
        {proyectos.map((p) => {
          const coords = getCoordenadas(p);
          if (!coords) return null;

          const estaLiquidado = p.estado === false || p.distribucionEjecutada === true;
          const isSelected = seleccionado?.id === p.id;
          const capital = p.monto || (typeof p.precio === 'number' ? p.precio : 0);
          const imagen = getImagen(p);

          const icono = isSelected ? iconoSeleccionado : estaLiquidado ? iconoLiquidado : iconoActivo;

          return (
            <Marker
              key={p.id}
              position={[coords.lat, coords.lng]}
              icon={icono}
              eventHandlers={{
                click: () => onSeleccionar(p),
              }}
            >
              <Popup minWidth={280} maxWidth={280} closeButton={true}>
                <div style={{ borderRadius: 16, overflow: 'hidden', background: 'rgb(15 23 42)' }}>
                  {/* Imagen */}
                  {imagen && (
                    <div style={{ width: '100%', height: 130, overflow: 'hidden', position: 'relative' }}>
                      <img
                        src={imagen}
                        alt={p.nombre}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      {/* Overlay degradado */}
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, background: 'linear-gradient(to top, rgba(15,23,42,1), transparent)' }} />
                    </div>
                  )}

                  <div style={{ padding: '12px 14px 14px' }}>
                    {/* Badges */}
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: 20,
                        fontSize: 10,
                        fontWeight: 700,
                        background: estaLiquidado ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)',
                        color: estaLiquidado ? '#fbbf24' : '#34d399',
                        border: `1px solid ${estaLiquidado ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)'}`,
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                        {estaLiquidado ? '🔒' : '🟢'} {estaLiquidado ? 'Liquidado' : 'Activo'}
                      </span>
                      {p.categoria && (
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: 20,
                          fontSize: 10,
                          fontWeight: 600,
                          background: 'rgba(99,102,241,0.15)',
                          color: '#a5b4fc',
                          border: '1px solid rgba(99,102,241,0.3)',
                          textTransform: 'capitalize',
                        }}>
                          {p.categoria}
                        </span>
                      )}
                    </div>

                    {/* Nombre */}
                    <p style={{ color: 'white', fontWeight: 700, fontSize: 14, lineHeight: 1.3, marginBottom: 2 }}>
                      {p.nombre}
                    </p>
                    <p style={{ color: 'rgb(100,116,139)', fontSize: 11, marginBottom: 10 }}>{p.empresa}</p>

                    {/* Métricas */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                      {capital > 0 && (
                        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '8px 10px' }}>
                          <p style={{ color: 'rgb(100,116,139)', fontSize: 9, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>Capital</p>
                          <p style={{ color: '#34d399', fontFamily: 'monospace', fontWeight: 700, fontSize: 11 }}>{formatSoles(capital)}</p>
                        </div>
                      )}
                      {p.roiReal !== undefined && p.roiReal !== null && (
                        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '8px 10px' }}>
                          <p style={{ color: 'rgb(100,116,139)', fontSize: 9, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>ROI Real</p>
                          <p style={{ color: p.roiReal >= 0 ? '#60a5fa' : '#f87171', fontFamily: 'monospace', fontWeight: 700, fontSize: 11 }}>
                            {p.roiReal > 0 ? '+' : ''}{p.roiReal.toFixed(2)}%
                          </p>
                        </div>
                      )}
                      {p.gananciaNeta !== undefined && p.gananciaNeta !== null && (
                        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '8px 10px' }}>
                          <p style={{ color: 'rgb(100,116,139)', fontSize: 9, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>Gan. Neta</p>
                          <p style={{ color: p.gananciaNeta >= 0 ? '#34d399' : '#f87171', fontFamily: 'monospace', fontWeight: 700, fontSize: 11 }}>
                            {p.gananciaNeta >= 0 ? '+' : ''}{formatSoles(p.gananciaNeta)}
                          </p>
                        </div>
                      )}
                      {p.inversores && p.inversores.length > 0 && (
                        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '8px 10px' }}>
                          <p style={{ color: 'rgb(100,116,139)', fontSize: 9, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>Socios</p>
                          <p style={{ color: 'white', fontWeight: 700, fontSize: 13 }}>{p.inversores.length}</p>
                        </div>
                      )}
                    </div>

                    {/* Dirección */}
                    {p.direccion && (
                      <p style={{ color: 'rgb(100,116,139)', fontSize: 10, marginBottom: 10, display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                        <span style={{ color: '#34d399', marginTop: 1 }}>📍</span>
                        {p.direccion}
                      </p>
                    )}

                    {/* Botón Ver Proyecto */}
                    <Link
                      href={`/productos/${p.id}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        width: '100%',
                        padding: '8px 0',
                        background: 'linear-gradient(135deg, #10b981, #0d9488)',
                        color: 'white',
                        borderRadius: 10,
                        fontSize: 12,
                        fontWeight: 700,
                        textDecoration: 'none',
                        transition: 'opacity 0.15s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                    >
                      <FaExternalLinkAlt style={{ fontSize: 9 }} />
                      Ver Proyecto
                    </Link>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </>
  );
}

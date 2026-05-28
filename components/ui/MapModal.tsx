'use client';

import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';
import { FaTimes, FaExternalLinkAlt } from 'react-icons/fa';
import { useEffect } from 'react';

interface MapModalProps {
    isOpen: boolean;
    onClose: () => void;
    coordinates: {
        lat: number;
        lng: number;
    };
    projectName?: string;
    address?: string;
}

const mapContainerStyle = {
    width: '100%',
    height: '100%',
};

const defaultCenter = {
    lat: -12.0464, // Lima, Perú por defecto
    lng: -77.0428,
};

export default function MapModal({ 
    isOpen, 
    onClose, 
    coordinates, 
    projectName = 'Proyecto',
    address 
}: MapModalProps) {
    const center = coordinates?.lat && coordinates?.lng ? coordinates : defaultCenter;
    
    // Cerrar modal con tecla ESC y manejar scroll
    useEffect(() => {
        if (!isOpen) return;

        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        
        // Prevenir scroll del body cuando el modal está abierto
        const originalStyle = window.getComputedStyle(document.body).overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleEsc);
        
        return () => {
            document.body.style.overflow = originalStyle;
            window.removeEventListener('keydown', handleEsc);
        };
    }, [isOpen, onClose]);

    const openInGoogleMaps = () => {
        const url = `https://www.google.com/maps?q=${center.lat},${center.lng}`;
        window.open(url, '_blank');
    };

    return (
        <div
            className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm transition-opacity duration-200 ${
                isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
            onClick={onClose}
        >
            <div
                className={`relative w-[95%] max-w-5xl h-[80vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 ${
                    isOpen ? 'scale-100 opacity-100' : 'scale-90 opacity-0'
                }`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-slate-900 via-slate-900/95 to-transparent p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-2xl font-bold text-white mb-1">
                                📍 Ubicación del Proyecto
                            </h3>
                            <p className="text-blue-400 font-semibold">{projectName}</p>
                            {address && (
                                <p className="text-sm text-slate-400 mt-1">{address}</p>
                            )}
                        </div>
                        
                        <div className="flex items-center gap-3">
                            <button
                                onClick={openInGoogleMaps}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-lg font-semibold transition-all hover:scale-105"
                            >
                                <FaExternalLinkAlt />
                                Abrir en Google Maps
                            </button>
                            
                            <button
                                onClick={onClose}
                                className="p-3 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-lg transition-all hover:rotate-90"
                                aria-label="Cerrar mapa"
                            >
                                <FaTimes size={20} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Map Container */}
                <div className="w-full h-full">
                    <LoadScript googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
                        <GoogleMap
                            mapContainerStyle={mapContainerStyle}
                            center={center}
                            zoom={15}
                            options={{
                                styles: [
                                    {
                                        elementType: 'geometry',
                                        stylers: [{ color: '#1e293b' }],
                                    },
                                    {
                                        elementType: 'labels.text.stroke',
                                        stylers: [{ color: '#0f172a' }],
                                    },
                                    {
                                        elementType: 'labels.text.fill',
                                        stylers: [{ color: '#cbd5e1' }],
                                    },
                                    {
                                        featureType: 'water',
                                        elementType: 'geometry',
                                        stylers: [{ color: '#3b82f6' }],
                                    },
                                    {
                                        featureType: 'road',
                                        elementType: 'geometry',
                                        stylers: [{ color: '#334155' }],
                                    },
                                ],
                                disableDefaultUI: false,
                                zoomControl: true,
                                mapTypeControl: true,
                                streetViewControl: true,
                                fullscreenControl: true,
                            }}
                        >
                            <Marker
                                position={center}
                            />
                        </GoogleMap>
                    </LoadScript>
                </div>

                {/* Footer Info */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900 via-slate-900/95 to-transparent p-6">
                    <div className="flex items-center justify-between text-sm text-slate-400">
                        <span>
                            Coordenadas: {center.lat.toFixed(6)}, {center.lng.toFixed(6)}
                        </span>
                        <span className="text-slate-500">
                            Presiona ESC para cerrar
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

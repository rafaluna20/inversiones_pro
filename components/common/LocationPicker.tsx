'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface LocationPickerProps {
    initialPosition: { lat: number; lng: number };
    onLocationChange: (coordinates: { lat: number; lng: number }) => void;
}

export default function LocationPicker({ initialPosition, onLocationChange }: LocationPickerProps) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<L.Map | null>(null);
    const markerRef = useRef<L.Marker | null>(null);
    const [mounted, setMounted] = useState(false);

    // Initialize map
    useEffect(() => {
        setMounted(true);

        // Fix for default icons
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
            iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
            iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        });

        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, []);

    // Initialize and update map
    useEffect(() => {
        if (!mounted || !mapContainerRef.current) return;

        // Create map if it doesn't exist
        if (!mapInstanceRef.current) {
            const map = L.map(mapContainerRef.current).setView(
                [initialPosition.lat, initialPosition.lng],
                13
            );

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(map);

            // Add click handler
            map.on('click', (e: L.LeafletMouseEvent) => {
                const { lat, lng } = e.latlng;
                onLocationChange({ lat, lng });

                // Update marker position
                if (markerRef.current) {
                    markerRef.current.setLatLng([lat, lng]);
                } else {
                    markerRef.current = L.marker([lat, lng]).addTo(map);
                }

                // Animate fly to
                map.flyTo([lat, lng], map.getZoom());
            });

            // Initialize marker
            markerRef.current = L.marker([initialPosition.lat, initialPosition.lng]).addTo(map);

            mapInstanceRef.current = map;
        }

        // Note: We don't update map center on prop change to avoid jumping 
        // if the user is panning, unless it's a significant external change
        // For now, we trust the map's internal state for view

    }, [mounted, onLocationChange]); // initialPosition excluded from dependency to prevent re-init loops

    if (!mounted) {
        return (
            <div className="bg-slate-950/50 rounded-xl h-80 flex items-center justify-center border-2 border-dashed border-white/10">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-3"></div>
                    <p className="text-gray-400">Cargando mapa...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="relative rounded-xl overflow-hidden border border-white/10 group">
            <div
                ref={mapContainerRef}
                style={{ height: '320px', width: '100%', zIndex: 0 }}
            />

            <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none z-[1000]">
                <div className="bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-xl px-4 py-2 shadow-lg pointer-events-auto">
                    <p className="text-white text-sm font-medium flex items-center gap-2">
                        <i className="bx bx-map-pin text-blue-400"></i>
                        Selecciona la ubicación
                    </p>
                </div>
            </div>
        </div>
    );
}

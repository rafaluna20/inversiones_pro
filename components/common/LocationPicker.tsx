'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface LocationPickerProps {
    initialPosition: { lat: number; lng: number };
    onLocationChange: (coordinates: { lat: number; lng: number }, address?: string) => void;
}

interface NominatimResult {
    place_id: number;
    display_name: string;
    lat: string;
    lon: string;
    type: string;
    address?: {
        road?: string;
        suburb?: string;
        city?: string;
        state?: string;
        country?: string;
    };
}

export default function LocationPicker({ initialPosition, onLocationChange }: LocationPickerProps) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<L.Map | null>(null);
    const markerRef = useRef<L.Marker | null>(null);
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [mounted, setMounted] = useState(false);
    const [busqueda, setBusqueda] = useState('');
    const [resultados, setResultados] = useState<NominatimResult[]>([]);
    const [buscando, setBuscando] = useState(false);
    const [mostrarResultados, setMostrarResultados] = useState(false);
    const [coordActual, setCoordActual] = useState(initialPosition);
    const [direccionSeleccionada, setDireccionSeleccionada] = useState('');

    // ─── Init Leaflet ───────────────────────────────────────────────────────
    useEffect(() => {
        setMounted(true);
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

    // ─── Init Map ───────────────────────────────────────────────────────────
    useEffect(() => {
        if (!mounted || !mapContainerRef.current || mapInstanceRef.current) return;

        const map = L.map(mapContainerRef.current).setView(
            [initialPosition.lat, initialPosition.lng],
            13
        );

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        markerRef.current = L.marker([initialPosition.lat, initialPosition.lng]).addTo(map);

        map.on('click', (e: L.LeafletMouseEvent) => {
            const { lat, lng } = e.latlng;
            setCoordActual({ lat, lng });
            onLocationChange({ lat, lng });
            if (markerRef.current) {
                markerRef.current.setLatLng([lat, lng]);
            } else {
                markerRef.current = L.marker([lat, lng]).addTo(map);
            }
            map.flyTo([lat, lng], map.getZoom());
            // Reverse geocoding al hacer clic
            reverseGeocode(lat, lng);
        });

        mapInstanceRef.current = map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mounted]);

    // ─── Reverse Geocode ────────────────────────────────────────────────────
    const reverseGeocode = useCallback(async (lat: number, lng: number) => {
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=es`,
                { headers: { 'Accept-Language': 'es' } }
            );
            const data = await res.json();
            if (data?.display_name) {
                const short = data.display_name.split(',').slice(0, 3).join(',').trim();
                setDireccionSeleccionada(short);
                onLocationChange({ lat, lng }, data.display_name);
            }
        } catch { /* silent */ }
    }, [onLocationChange]);

    // ─── Geocode Search (Nominatim) ─────────────────────────────────────────
    const buscarDireccion = useCallback(async (query: string) => {
        if (query.trim().length < 3) {
            setResultados([]);
            setMostrarResultados(false);
            return;
        }
        setBuscando(true);
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=6&countrycodes=pe&accept-language=es`,
                { headers: { 'Accept-Language': 'es' } }
            );
            const data: NominatimResult[] = await res.json();
            setResultados(data);
            setMostrarResultados(data.length > 0);
        } catch {
            setResultados([]);
        } finally {
            setBuscando(false);
        }
    }, []);

    // Debounce búsqueda
    const handleBusquedaChange = (value: string) => {
        setBusqueda(value);
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(() => buscarDireccion(value), 400);
    };

    // ─── Seleccionar resultado ──────────────────────────────────────────────
    const seleccionarResultado = useCallback((resultado: NominatimResult) => {
        const lat = parseFloat(resultado.lat);
        const lng = parseFloat(resultado.lon);
        const coords = { lat, lng };

        setCoordActual(coords);
        setDireccionSeleccionada(resultado.display_name.split(',').slice(0, 3).join(',').trim());
        setBusqueda('');
        setMostrarResultados(false);
        setResultados([]);

        onLocationChange(coords, resultado.display_name);

        if (mapInstanceRef.current) {
            if (markerRef.current) {
                markerRef.current.setLatLng([lat, lng]);
            } else {
                markerRef.current = L.marker([lat, lng]).addTo(mapInstanceRef.current);
            }
            mapInstanceRef.current.flyTo([lat, lng], 17, { duration: 1.2 });
        }
    }, [onLocationChange]);

    // ─── Obtener ubicación actual del navegador ─────────────────────────────
    const usarMiUbicacion = useCallback(() => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                setCoordActual({ lat, lng });
                onLocationChange({ lat, lng });
                if (mapInstanceRef.current) {
                    if (markerRef.current) {
                        markerRef.current.setLatLng([lat, lng]);
                    } else {
                        markerRef.current = L.marker([lat, lng]).addTo(mapInstanceRef.current!);
                    }
                    mapInstanceRef.current.flyTo([lat, lng], 17, { duration: 1.2 });
                    reverseGeocode(lat, lng);
                }
            },
            () => { /* permisos denegados, ignorar */ }
        );
    }, [onLocationChange, reverseGeocode]);

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
        <div className="space-y-3">
            {/* ── Buscador de dirección ── */}
            <div className="relative">
                <div className="flex gap-2">
                    {/* Input de búsqueda */}
                    <div className="relative flex-1">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                            {buscando ? (
                                <div className="w-4 h-4 border-2 border-blue-500/40 border-t-blue-500 rounded-full animate-spin" />
                            ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            )}
                        </div>
                        <input
                            type="text"
                            value={busqueda}
                            onChange={(e) => handleBusquedaChange(e.target.value)}
                            onFocus={() => resultados.length > 0 && setMostrarResultados(true)}
                            placeholder="Buscar dirección, urbanización, distrito..."
                            className="w-full bg-slate-800 border border-white/10 text-white rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500 transition-all"
                            autoComplete="off"
                        />
                        {busqueda && (
                            <button
                                type="button"
                                onClick={() => { setBusqueda(''); setResultados([]); setMostrarResultados(false); }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>

                    {/* Botón mi ubicación */}
                    <button
                        type="button"
                        onClick={usarMiUbicacion}
                        title="Usar mi ubicación actual"
                        className="flex items-center gap-2 px-4 py-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 hover:border-blue-500/40 text-blue-400 rounded-xl text-sm font-medium transition-all whitespace-nowrap"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="hidden sm:inline">Mi ubicación</span>
                    </button>
                </div>

                {/* Dropdown de resultados */}
                {mostrarResultados && resultados.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-white/10 rounded-xl shadow-2xl shadow-black/50 z-[2000] overflow-hidden">
                        <p className="px-4 py-2 text-xs text-gray-500 uppercase tracking-wider font-medium border-b border-white/5">
                            {resultados.length} resultado{resultados.length !== 1 ? 's' : ''} encontrado{resultados.length !== 1 ? 's' : ''}
                        </p>
                        {resultados.map((r) => {
                            // Separar nombre principal del resto de la dirección
                            const partes = r.display_name.split(',');
                            const principal = partes.slice(0, 2).join(',').trim();
                            const secundario = partes.slice(2, 5).join(',').trim();

                            return (
                                <button
                                    key={r.place_id}
                                    type="button"
                                    onClick={() => seleccionarResultado(r)}
                                    className="w-full text-left px-4 py-3 hover:bg-slate-700/60 transition-colors border-b border-white/5 last:border-0 flex items-start gap-3 group"
                                >
                                    <div className="w-7 h-7 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-blue-500/20 transition-colors">
                                        <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white text-sm font-medium leading-snug truncate">{principal}</p>
                                        {secundario && (
                                            <p className="text-gray-400 text-xs mt-0.5 truncate">{secundario}</p>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Hint texto */}
            <p className="text-gray-500 text-xs flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Busca una dirección o haz clic directamente en el mapa para colocar el pin
            </p>

            {/* ── Mapa ── */}
            <div className="relative rounded-xl overflow-hidden border border-white/10 group">
                <div
                    ref={mapContainerRef}
                    style={{ height: '360px', width: '100%', zIndex: 0 }}
                />

                {/* Badge de instrucción flotante */}
                <div className="absolute top-3 left-3 right-3 flex justify-between items-start pointer-events-none z-[1000]">
                    <div className="bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2 shadow-lg">
                        <p className="text-white text-xs font-medium flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                            Clic en el mapa para ajustar el pin
                        </p>
                    </div>
                </div>

                {/* Coordenadas actuales flotantes */}
                <div className="absolute bottom-3 left-3 pointer-events-none z-[1000]">
                    <div className="bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-lg px-3 py-1.5">
                        <p className="text-gray-400 text-xs font-mono">
                            {coordActual.lat.toFixed(5)}, {coordActual.lng.toFixed(5)}
                        </p>
                    </div>
                </div>
            </div>

            {/* Dirección detectada */}
            {direccionSeleccionada && (
                <div className="flex items-start gap-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                    <div className="w-6 h-6 bg-emerald-500/20 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                        <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-emerald-400 text-xs font-semibold mb-0.5">Ubicación seleccionada</p>
                        <p className="text-gray-300 text-xs leading-relaxed">{direccionSeleccionada}</p>
                    </div>
                </div>
            )}
        </div>
    );
}

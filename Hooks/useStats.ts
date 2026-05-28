'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

interface Stats {
    totalInvertido: number;
    totalInversores: number;
    totalProyectos: number;
}

interface UseStatsReturn {
    stats: Stats;
    loading: boolean;
    error: string | null;
}

export default function useStats(): UseStatsReturn {
    const [stats, setStats] = useState<Stats>({
        totalInvertido: 0,
        totalInversores: 0,
        totalProyectos: 0,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                setLoading(true);
                setError(null);

                const productosRef = collection(db, 'productos');
                const productosSnapshot = await getDocs(productosRef);
                
                let totalProyectosActivos = 0;
                let capitalInvertidoReal = 0;
                const uniqueInversores = new Set<string>();

                productosSnapshot.forEach((doc) => {
                    const data = doc.data();
                    
                    // Contar solo proyectos activos
                    if (data.estado !== false) {
                        totalProyectosActivos++;
                    }

                    const precioFijado = typeof data.precio === 'string' ? parseFloat(data.precio) : (data.precio || 0);

                    // Iterar sobre todos los inversores del proyecto para sacar el capital real
                    if (data.inversores && Array.isArray(data.inversores)) {
                        data.inversores.forEach((inv: any) => {
                            if (inv.usuarioId) {
                                uniqueInversores.add(inv.usuarioId);
                            }
                            if (inv.cubos) {
                                // Capital invertido = (cubos * precio) / 100
                                const inversionIndividual = (inv.cubos * precioFijado) / 100;
                                capitalInvertidoReal += inversionIndividual;
                            }
                        });
                    }
                });

                setStats({
                    totalInvertido: capitalInvertidoReal,
                    totalInversores: uniqueInversores.size, // Opcional: si prefieres mostrar todos los usuarios registrados, cambia esto por el total de doc en 'usuarios'
                    totalProyectos: totalProyectosActivos,
                });
            } catch (err) {
                console.error('Error al obtener stats:', err);
                setError('Error al cargar estadísticas');
            } finally {
                setLoading(false);
            }
        };

        fetchStats();

        // Escuchar cambios en tiempo real
        const productosRef = collection(db, 'productos');
        const unsubscribe = onSnapshot(productosRef, () => {
            fetchStats();
        });

        return () => unsubscribe();
    }, []);

    return { stats, loading, error };
}

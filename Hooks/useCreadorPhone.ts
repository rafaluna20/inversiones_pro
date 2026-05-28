'use client';

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

interface UseCreadorPhoneReturn {
    phone: string | null;
    loading: boolean;
    error: string | null;
}

/**
 * Hook para obtener el teléfono del creador en tiempo real
 * @param creadorId - ID del usuario creador del producto
 * @returns {phone, loading, error}
 */
export default function useCreadorPhone(creadorId: string | undefined): UseCreadorPhoneReturn {
    const [phone, setPhone] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!creadorId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        const usuarioDocRef = doc(db, 'usuarios', creadorId);

        const unsubscribe = onSnapshot(
            usuarioDocRef,
            (docSnapshot) => {
                if (docSnapshot.exists()) {
                    const data = docSnapshot.data();
                    if (data.phone) {
                        setPhone(data.phone);
                    } else {
                        setPhone(null);
                    }
                } else {
                    setError('Usuario no encontrado');
                    setPhone(null);
                }
                setLoading(false);
            },
            (err) => {
                console.error('Error al obtener teléfono:', err);
                setError('Error al cargar teléfono');
                setPhone(null);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [creadorId]);

    return { phone, loading, error };
}

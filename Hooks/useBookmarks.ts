'use client';

import { useState, useEffect, useCallback } from 'react';
import { doc, setDoc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import useAutenticacion from './useAutenticacion';

interface BookmarkData {
  userId: string;
  productos: string[];
  timestamp: number;
}

interface UseBookmarksReturn {
  bookmarks: string[];
  isBookmarked: (productoId: string) => boolean;
  toggleBookmark: (productoId: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

export default function useBookmarks(): UseBookmarksReturn {
  const { usuario } = useAutenticacion();
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar bookmarks desde localStorage y Firebase
  useEffect(() => {
    const loadBookmarks = async () => {
      try {
        // Primero cargar desde localStorage (rápido)
        const localBookmarks = localStorage.getItem('bookmarks');
        if (localBookmarks) {
          setBookmarks(JSON.parse(localBookmarks));
        }

        // Si hay usuario, sincronizar con Firebase
        if (usuario?.uid) {
          const bookmarkRef = doc(db, 'bookmarks', usuario.uid);
          const bookmarkSnap = await getDoc(bookmarkRef);

          if (bookmarkSnap.exists()) {
            const data = bookmarkSnap.data() as BookmarkData;
            setBookmarks(data.productos || []);
            // Sincronizar con localStorage
            localStorage.setItem('bookmarks', JSON.stringify(data.productos || []));
          }
        }
      } catch (err) {
        console.error('Error cargando bookmarks:', err);
        setError('Error al cargar favoritos');
      } finally {
        setLoading(false);
      }
    };

    loadBookmarks();
  }, [usuario]);

  // Verificar si un producto está en bookmarks
  const isBookmarked = useCallback(
    (productoId: string): boolean => {
      return bookmarks.includes(productoId);
    },
    [bookmarks]
  );

  // Toggle bookmark
  const toggleBookmark = useCallback(
    async (productoId: string) => {
      try {
        const isCurrentlyBookmarked = isBookmarked(productoId);
        const newBookmarks = isCurrentlyBookmarked
          ? bookmarks.filter(id => id !== productoId)
          : [...bookmarks, productoId];

        // Actualizar estado local inmediatamente (optimistic update)
        setBookmarks(newBookmarks);
        localStorage.setItem('bookmarks', JSON.stringify(newBookmarks));

        // Si hay usuario, sincronizar con Firebase
        if (usuario?.uid) {
          const bookmarkRef = doc(db, 'bookmarks', usuario.uid);
          const bookmarkSnap = await getDoc(bookmarkRef);

          if (bookmarkSnap.exists()) {
            // Documento existe, actualizar array
            await updateDoc(bookmarkRef, {
              productos: isCurrentlyBookmarked
                ? arrayRemove(productoId)
                : arrayUnion(productoId),
              timestamp: Date.now(),
            });
          } else {
            // Documento no existe, crear nuevo
            await setDoc(bookmarkRef, {
              userId: usuario.uid,
              productos: [productoId],
              timestamp: Date.now(),
            });
          }
        }
      } catch (err) {
        console.error('Error toggle bookmark:', err);
        setError('Error al guardar favorito');
        // Revertir cambio en caso de error
        const localBookmarks = localStorage.getItem('bookmarks');
        if (localBookmarks) {
          setBookmarks(JSON.parse(localBookmarks));
        }
      }
    },
    [bookmarks, isBookmarked, usuario]
  );

  return {
    bookmarks,
    isBookmarked,
    toggleBookmark,
    loading,
    error,
  };
}

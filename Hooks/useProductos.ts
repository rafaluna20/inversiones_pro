import { useState, useEffect } from 'react';
import { collection, getDocs, orderBy, query, limit, startAfter, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Producto } from '@/types';

const PRODUCTOS_POR_PAGINA = 9;

export default function useProductos(orden: 'creado' | 'votos' = 'creado') {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ultimoDoc, setUltimoDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);

  useEffect(() => {
    const obtenerProductos = async () => {
      try {
        setLoading(true);
        const productosRef = collection(db, 'productos');
        const q = query(productosRef, orderBy(orden, 'desc'), limit(PRODUCTOS_POR_PAGINA));
        const snapshot = await getDocs(q);

        const productosData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Producto[];

        setProductos(productosData);
        setUltimoDoc(snapshot.docs[snapshot.docs.length - 1] || null);
        setHasMore(snapshot.docs.length === PRODUCTOS_POR_PAGINA);
      } catch (err) {
        console.error('Error al obtener productos:', err);
        setError('Error al cargar productos');
      } finally {
        setLoading(false);
      }
    };

    obtenerProductos();
  }, [orden]);

  const cargarMas = async () => {
    if (!ultimoDoc || cargandoMas) return;

    try {
      setCargandoMas(true);
      const productosRef = collection(db, 'productos');
      const q = query(
        productosRef,
        orderBy(orden, 'desc'),
        startAfter(ultimoDoc),
        limit(PRODUCTOS_POR_PAGINA)
      );
      const snapshot = await getDocs(q);

      const nuevosProductos = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Producto[];

      setProductos((prev) => [...prev, ...nuevosProductos]);
      setUltimoDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMore(snapshot.docs.length === PRODUCTOS_POR_PAGINA);
    } catch (err) {
      console.error('Error al cargar más productos:', err);
      setError('Error al cargar más productos');
    } finally {
      setCargandoMas(false);
    }
  };

  return { productos, loading, error, cargarMas, hasMore, cargandoMas };
}

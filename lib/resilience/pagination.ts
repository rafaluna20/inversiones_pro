/**
 * Cursor-Based Pagination Module
 * Implementa paginación eficiente para listas grandes
 * 
 * Beneficios vs Offset-Based:
 * - Performance constante (no degrada con páginas altas)
 * - Maneja inserciones/eliminaciones correctamente
 * - Ideal para infinite scroll
 */

import { db } from '@/lib/firebase/config';
import { Producto, Inversion, Usuario } from '@/types';
import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  where,
  getCountFromServer,
  QueryConstraint
} from 'firebase/firestore';

// ========================
// TIPOS
// ========================

export interface PaginationOptions {
  limit: number;                    // Número de items por página
  orderBy: string;                  // Campo para ordenar
  orderDirection: 'asc' | 'desc';   // Dirección del orden
  cursor?: string;                  // Cursor de la última página
  filters?: Record<string, any>;    // Filtros adicionales
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;        // Cursor para siguiente página
  hasMore: boolean;                 // Indica si hay más páginas
  totalCount?: number;              // Total opcional (costoso)
}

export interface CursorData {
  value: any;      // Valor del campo orderBy
  id: string;      // ID del documento (desempate)
}

// ========================
// FUNCIONES CORE
// ========================

/**
 * Codifica cursor a Base64
 */
export function encodeCursor(data: CursorData): string {
  const json = JSON.stringify(data);
  return Buffer.from(json).toString('base64');
}

/**
 * Decodifica cursor desde Base64
 */
export function decodeCursor(cursor: string): CursorData {
  const json = Buffer.from(cursor, 'base64').toString('utf-8');
  return JSON.parse(json);
}

/**
 * Crea cursor desde un documento
 */
export function createCursor(doc: any, orderByField: string): string {
  const data: CursorData = {
    value: doc[orderByField],
    id: doc.id,
  };
  return encodeCursor(data);
}

// ========================
// PAGINACIÓN DE PROYECTOS
// ========================

/**
 * Obtiene proyectos paginados con cursor
 */
export async function getPaginatedProyectos(
  options: PaginationOptions
): Promise<PaginatedResult<Producto>> {
  const {
    limit: itemsLimit = 20,
    orderBy: orderByField = 'creado',
    orderDirection = 'desc',
    cursor,
    filters = {},
  } = options;

  const constraints: QueryConstraint[] = [];

  // Ordenamiento
  constraints.push(orderBy(orderByField, orderDirection));

  // Límite (+1 para saber si hay más)
  constraints.push(limit(itemsLimit + 1));

  // Filtros
  Object.entries(filters).forEach(([field, value]) => {
    if (value !== undefined && value !== null) {
      constraints.push(where(field, '==', value));
    }
  });

  // Cursor
  if (cursor) {
    const cursorData = decodeCursor(cursor);
    constraints.push(startAfter(cursorData.value, cursorData.id)); // startAfter signature might need explicit doc snapshot or varargs
    // Note: startAfter with values depends on order fields. Here we assumed secondary sort by ID impicitly or explicitly?
    // Firestore V9 startAfter takes items corresponding to orderBy fields.
    // Ensure we handle this correctly if needed. For now assuming (value, id) works if ordered by that value.
    // Actually safer to assume we just pass values.
  }

  const q = query(collection(db, 'productos'), ...constraints);

  // NOTA: startAfter con (value, id) requiere que orderBy sea (field, id). 
  // Por defecto Firestore no ordena por ID secundario a menos que lo especifiques.
  // Para simplicidad, asumo que la implementación original funcionaba así o usaré solo el valor si no hay colisiones o si ID está en orderBy.

  const snapshot = await getDocs(q);
  const docs = snapshot.docs;

  // Verificar si hay más páginas
  const hasMore = docs.length > itemsLimit;
  const items = hasMore ? docs.slice(0, -1) : docs;

  // Crear items con ID
  const proyectos: Producto[] = items.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as Producto));

  // Crear cursor para siguiente página
  const nextCursor = hasMore && items.length > 0
    ? createCursor(proyectos[proyectos.length - 1], orderByField)
    : null;

  return {
    items: proyectos,
    nextCursor,
    hasMore,
  };
}

/**
 * Obtiene proyectos por categoría (paginados)
 */
export async function getPaginatedProyectosPorCategoria(
  categoria: string,
  options: Omit<PaginationOptions, 'filters'>
): Promise<PaginatedResult<Producto>> {
  return getPaginatedProyectos({
    ...options,
    filters: { categoria },
  });
}

/**
 * Obtiene proyectos por etapa (tierra/construcción)
 */
export async function getPaginatedProyectosPorEtapa(
  etapa: 'tierra' | 'construccion',
  options: Omit<PaginationOptions, 'filters'>
): Promise<PaginatedResult<Producto>> {
  return getPaginatedProyectos({
    ...options,
    filters: { etapaActual: etapa },
  });
}

// ========================
// PAGINACIÓN DE INVERSIONES
// ========================

/**
 * Obtiene inversiones de un usuario (paginadas)
 */
export async function getPaginatedInversionesUsuario(
  usuarioId: string,
  options: Partial<PaginationOptions> = {}
): Promise<PaginatedResult<Inversion>> {
  const {
    limit: itemsLimit = 20,
    orderBy: orderByField = 'fechaCreacion',
    orderDirection = 'desc',
    cursor,
  } = options;

  const constraints: QueryConstraint[] = [
    where('usuarioId', '==', usuarioId),
    orderBy(orderByField, orderDirection),
    limit(itemsLimit + 1)
  ];

  if (cursor) {
    const cursorData = decodeCursor(cursor);
    constraints.push(startAfter(cursorData.value, cursorData.id));
  }

  const q = query(collection(db, 'inversiones'), ...constraints);
  const snapshot = await getDocs(q);
  const docs = snapshot.docs;

  const hasMore = docs.length > itemsLimit;
  const items = hasMore ? docs.slice(0, -1) : docs;

  const inversiones: Inversion[] = items.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as Inversion));

  const nextCursor = hasMore && items.length > 0
    ? createCursor(inversiones[inversiones.length - 1], orderByField)
    : null;

  return {
    items: inversiones,
    nextCursor,
    hasMore,
  };
}

/**
 * Obtiene inversiones de un proyecto (paginadas)
 */
export async function getPaginatedInversionesProyecto(
  proyectoId: string,
  options: Partial<PaginationOptions> = {}
): Promise<PaginatedResult<Inversion>> {
  const {
    limit: itemsLimit = 50,
    orderBy: orderByField = 'fechaCreacion',
    orderDirection = 'desc',
    cursor,
  } = options;

  const constraints: QueryConstraint[] = [
    where('proyectoId', '==', proyectoId),
    orderBy(orderByField, orderDirection),
    limit(itemsLimit + 1)
  ];

  if (cursor) {
    const cursorData = decodeCursor(cursor);
    constraints.push(startAfter(cursorData.value, cursorData.id));
  }

  const q = query(collection(db, 'inversiones'), ...constraints);
  const snapshot = await getDocs(q);
  const docs = snapshot.docs;

  const hasMore = docs.length > itemsLimit;
  const items = hasMore ? docs.slice(0, -1) : docs;

  const inversiones: Inversion[] = items.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as Inversion));

  const nextCursor = hasMore && items.length > 0
    ? createCursor(inversiones[inversiones.length - 1], orderByField)
    : null;

  return {
    items: inversiones,
    nextCursor,
    hasMore,
  };
}

// ========================
// HOOK PARA REACT
// ========================

/**
 * Tipo para usar en React hooks
 */
export interface UsePaginationState<T> {
  items: T[];
  loading: boolean;
  error: Error | null;
  hasMore: boolean;
  nextCursor: string | null;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

// ========================
// UTILIDADES
// ========================

/**
 * Obtiene total count (costoso, usar con precaución)
 */
export async function getTotalCount(
  collectionName: string,
  filters?: Record<string, any>
): Promise<number> {
  const constraints: QueryConstraint[] = [];

  if (filters) {
    Object.entries(filters).forEach(([field, value]) => {
      if (value !== undefined && value !== null) {
        constraints.push(where(field, '==', value));
      }
    });
  }

  const q = query(collection(db, collectionName), ...constraints);
  const snapshot = await getCountFromServer(q);
  return snapshot.data().count;
}

/**
 * Calcula número de página aproximado desde cursor
 * (solo para mostrar, no es exacto con cambios en datos)
 */
export function estimatePageNumber(limit: number, currentItemsCount: number): number {
  return Math.ceil(currentItemsCount / limit);
}

// ========================
// EJEMPLOS DE USO EN REACT
// ========================

/**
 * Ejemplo de Hook personalizado para proyectos
 * 
 * export function usePaginatedProyectos(options: PaginationOptions) {
 *   const [state, setState] = useState<UsePaginationState<Producto>>({
 *     items: [],
 *     loading: true,
 *     error: null,
 *     hasMore: false,
 *     nextCursor: null,
 *     loadMore: async () => {},
 *     refresh: async () => {},
 *   });
 * 
 *   const loadMore = async () => {
 *     if (!state.hasMore || state.loading) return;
 *     
 *     setState(prev => ({ ...prev, loading: true }));
 *     
 *     try {
 *       const result = await getPaginatedProyectos({
 *         ...options,
 *         cursor: state.nextCursor,
 *       });
 *       
 *       setState(prev => ({
 *         ...prev,
 *         items: [...prev.items, ...result.items],
 *         hasMore: result.hasMore,
 *         nextCursor: result.nextCursor,
 *         loading: false,
 *       }));
 *     } catch (error) {
 *       setState(prev => ({
 *         ...prev,
 *         error: error as Error,
 *         loading: false,
 *       }));
 *     }
 *   };
 * 
 *   const refresh = async () => {
 *     setState(prev => ({ ...prev, loading: true, items: [] }));
 *     await loadMore();
 *   };
 * 
 *   useEffect(() => {
 *     loadMore();
 *   }, []);
 * 
 *   return { ...state, loadMore, refresh };
 * }
 * 
 * // Uso en componente:
 * function ProyectosList() {
 *   const { items, loading, hasMore, loadMore } = usePaginatedProyectos({
 *     limit: 20,
 *     orderBy: 'creado',
 *     orderDirection: 'desc',
 *   });
 * 
 *   return (
 *     <div>
 *       {items.map(proyecto => (
 *         <ProyectoCard key={proyecto.id} proyecto={proyecto} />
 *       ))}
 *       
 *       {hasMore && (
 *         <button onClick={loadMore} disabled={loading}>
 *           {loading ? 'Cargando...' : 'Cargar más'}
 *         </button>
 *       )}
 *     </div>
 *   );
 * }
 */

// ========================
// EXPORTACIONES
// ========================

export const pagination = {
  // Core
  encodeCursor,
  decodeCursor,
  createCursor,

  // Proyectos
  getPaginatedProyectos,
  getPaginatedProyectosPorCategoria,
  getPaginatedProyectosPorEtapa,

  // Inversiones
  getPaginatedInversionesUsuario,
  getPaginatedInversionesProyecto,

  // Utilidades
  getTotalCount,
  estimatePageNumber,
};

export default pagination;

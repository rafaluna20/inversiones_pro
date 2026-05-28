'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { doc, getDoc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import useAutenticacion from '@/Hooks/useAutenticacion';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { FaHeart, FaRegHeart, FaMapMarkerAlt, FaWhatsapp } from 'react-icons/fa';
import { formatCurrency } from '@/lib/utils';
import { showToast } from '@/lib/toast';
import { rateLimiter, sanitizeHTML } from '@/lib/validators';
import OptimizedImage from '@/components/common/OptimizedImage';
import Tabs from '@/components/common/Tabs';
import InvestmentCard from '@/components/productos/InvestmentCard';
import StatsBar from '@/components/productos/StatsBar';
import CommentsSection from '@/components/productos/CommentsSection';
import InvestmentModal, { InversionData } from '@/components/productos/InvestmentModal';
import InvestorList from '@/components/productos/InvestorList';
import ProfitDistributionModal from '@/components/productos/ProfitDistributionModal';
import ProjectClosureReport from '@/components/productos/ProjectClosureReport';
import PriceEditModal from '@/components/productos/PriceEditModal';
import MobileInvestmentCTA from '@/components/productos/MobileInvestmentCTA';
import restarSaldo from '@/Validacion/restarSaldo';
import sumarSaldo from '@/Validacion/sumarSaldo';
import sumarSaldoAcumulado from '@/Validacion/sumarSaldoAcumulado';
import restarSaldoAcumulado from '@/Validacion/restarSaldoAcumulado';
import enviarGanancia from '@/Validacion/enviarGanancia';
import restarSaldoGanancia from '@/Validacion/restarSaldoGanancia';

interface Inversor {
  usuarioId: string;
  usuarioNombre: string;
  cubos: number;
  descripcion: string;
  categoria: string;
  fecha: number;
  icono?: string;
}

interface Comentario {
  usuarioId: string;
  usuarioNombre: string;
  icono?: string;
  mensaje: string;
  fecha: number;
  reacciones?: {
    [emoji: string]: string[]; // emoji -> array of userIds
  };
}

export default function ProductoDetallesPage() {
  const params = useParams();
  const router = useRouter();
  const { usuario } = useAutenticacion();
  const [producto, setProducto] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [comentario, setComentario] = useState('');
  const [showMap, setShowMap] = useState(false);
  const [processingVote, setProcessingVote] = useState(false);

  // Normalizar imágenes a array para soportar strings y arrays
  const images = useMemo(() => {
    if (!producto?.urlimagen) return [];
    if (Array.isArray(producto.urlimagen)) return producto.urlimagen;
    return [producto.urlimagen];
  }, [producto?.urlimagen]);

  // Investment states
  const [showInvestModal, setShowInvestModal] = useState(false);
  const [showProfitModal, setShowProfitModal] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [isEditingInvestment, setIsEditingInvestment] = useState(false);
  const [editingInvestor, setEditingInvestor] = useState<Inversor | null>(null);
  const [saldoUsuario, setSaldoUsuario] = useState<number>(0);
  const [montoRecaudado, setMontoRecaudado] = useState<number>(0);

  useEffect(() => {
    if (!params.id) return;

    const docRef = doc(db, 'productos', params.id as string);

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setProducto({ id: docSnap.id, ...docSnap.data() });
        setLoading(false);
      } else {
        setError(true);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [params.id]);

  useEffect(() => {
    if (!usuario) return;

    const userDocRef = doc(db, 'usuarios', usuario.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setSaldoUsuario(docSnap.data().saldo || 0);

        const saldoRecaudado = docSnap.data().saldoRecaudado || [];
        const saldoProducto = saldoRecaudado.find(
          (item: any) => item.idProducto === params.id
        );
        setMontoRecaudado(saldoProducto?.monto || 0);
      }
    });

    return () => unsubscribe();
  }, [usuario, params.id]);

  const votarProducto = async () => {
    if (!usuario || !producto) return;

    if (producto.haVotado?.includes(usuario.uid)) {
      showToast.error('Ya has votado por este producto');
      return;
    }

    if (!rateLimiter.canProceed(`vote-${usuario.uid}`, 10, 60000)) {
      showToast.error('Demasiados votos. Espera un momento.');
      return;
    }

    setProcessingVote(true);

    try {
      const docRef = doc(db, 'productos', params.id as string);
      const nuevoHaVotado = [...(producto.haVotado || []), usuario.uid];
      const nuevoTotal = (producto.votos || 0) + 1;

      await updateDoc(docRef, {
        votos: nuevoTotal,
        haVotado: nuevoHaVotado,
      });

      showToast.success('¡Voto registrado!');
    } catch (err: any) {
      console.error('Error al votar:', err);
      showToast.error('Error al registrar voto');
    } finally {
      setProcessingVote(false);
    }
  };

  const handleSubmitComment = async (message: string) => {
    if (!usuario || !producto) return;

    if (!rateLimiter.canProceed(`comment-${usuario.uid}`, 5, 60000)) {
      throw new Error('Demasiados comentarios. Espera un momento.');
    }

    const comentarioLimpio = sanitizeHTML(message);

    if (comentarioLimpio.length < 10) {
      throw new Error('El comentario debe tener al menos 10 caracteres');
    }

    const nuevoComentario = {
      usuarioId: usuario.uid,
      usuarioNombre: usuario.displayName || 'Usuario',
      mensaje: comentarioLimpio,
      fecha: Date.now(),
      icono: usuario.photoURL,
    };

    const docRef = doc(db, 'productos', params.id as string);
    const nuevosComentarios = [...(producto.comentarios || []), nuevoComentario];

    await updateDoc(docRef, {
      comentarios: nuevosComentarios,
    });

    showToast.success('Comentario añadido');
  };

  const handleEditComment = async (index: number, newMessage: string) => {
    if (!usuario || !producto) return;

    const comentarios = [...(producto.comentarios || [])];
    if (!comentarios[index] || comentarios[index].usuarioId !== usuario.uid) {
      throw new Error('No tienes permiso para editar este comentario');
    }

    comentarios[index] = {
      ...comentarios[index],
      mensaje: sanitizeHTML(newMessage),
      fecha: Date.now(),
    };

    const docRef = doc(db, 'productos', params.id as string);
    await updateDoc(docRef, { comentarios });

    showToast.success('Comentario actualizado');
  };

  const handleDeleteComment = async (index: number) => {
    if (!usuario || !producto) return;

    const comentarios = [...(producto.comentarios || [])];
    if (!comentarios[index] || comentarios[index].usuarioId !== usuario.uid) {
      throw new Error('No tienes permiso para eliminar este comentario');
    }

    comentarios.splice(index, 1);

    const docRef = doc(db, 'productos', params.id as string);
    await updateDoc(docRef, { comentarios });

    showToast.success('Comentario eliminado');
  };

  const handleToggleReaction = async (index: number, emoji: string) => {
    if (!usuario || !producto) return;

    const comentarios = [...(producto.comentarios || [])];
    if (!comentarios[index]) return;

    // Initialize reactions if not exists
    if (!comentarios[index].reacciones) {
      comentarios[index].reacciones = {};
    }

    const reacciones = comentarios[index].reacciones!;

    // Initialize emoji array if not exists
    if (!reacciones[emoji]) {
      reacciones[emoji] = [];
    }

    // Toggle user's reaction
    const userIndex = reacciones[emoji].indexOf(usuario.uid);
    if (userIndex > -1) {
      // Remove reaction
      reacciones[emoji].splice(userIndex, 1);
      // Clean up empty arrays
      if (reacciones[emoji].length === 0) {
        delete reacciones[emoji];
      }
    } else {
      // Add reaction
      reacciones[emoji].push(usuario.uid);
    }

    comentarios[index] = {
      ...comentarios[index],
      reacciones,
    };

    const docRef = doc(db, 'productos', params.id as string);
    await updateDoc(docRef, { comentarios });
  };

  const handleInvestmentSubmit = async (data: InversionData) => {
    if (!usuario || !producto) return;

    const docRef = doc(db, 'productos', params.id as string);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      showToast.error('Producto no encontrado');
      return;
    }

    const inversores = producto.inversores || [];
    const totalCubosActual = inversores.reduce((sum: number, inv: any) => sum + inv.cubos, 0);
    const cubosLibres = 100 - totalCubosActual;

    // Bloqueo por fecha límite (expirado)
    if (producto.fechaLimite && Date.now() > producto.fechaLimite) {
      showToast.error('El plazo de recaudación para este proyecto ha expirado.');
      setShowInvestModal(false);
      return;
    }

    // Bloqueo definitivo: no se puede invertir si no hay cubos disponibles
    if (cubosLibres <= 0) {
      showToast.error('Este proyecto ya alcanzó el 100% de financiamiento. No hay cubos disponibles.');
      setShowInvestModal(false);
      return;
    }

    // Si la cantidad pedida supera los cubos libres, ajustar
    if (data.cubos > cubosLibres) {
      showToast.error(`Solo quedan ${cubosLibres} cubos disponibles. Ajusta tu inversión.`);
      return;
    }

    const precioPorCubo = producto.precio / 100;
    const costoTotal = data.cubos * precioPorCubo;

    try {
      if (isEditingInvestment && editingInvestor) {
        const index = inversores.findIndex((inv: Inversor) => inv.usuarioId === usuario.uid);

        if (index !== -1) {
          const valorViejo = (inversores[index].cubos * producto.precio) / 100;

          await sumarSaldo(usuario.uid, valorViejo);
          await restarSaldoAcumulado(producto.creador.id, params.id as string, valorViejo);

          const nuevoCosto = (data.cubos * producto.precio) / 100;
          const error = await restarSaldo(usuario.uid, producto.creador.id, nuevoCosto);

          if (error) {
            showToast.error(error);
            return;
          }

          await sumarSaldoAcumulado(producto.creador.id, params.id as string, nuevoCosto);

          inversores[index] = {
            ...inversores[index],
            descripcion: data.descripcion,
            cubos: data.cubos,
            categoria: data.categoria,
            fecha: Date.now(),
          };

          await updateDoc(docRef, { inversores });
          showToast.success('Inversión actualizada');
        }
      } else {
        const error = await restarSaldo(usuario.uid, producto.creador.id, costoTotal);

        if (error) {
          showToast.error(error);
          return;
        }

        await sumarSaldoAcumulado(producto.creador.id, params.id as string, costoTotal);

        const nuevaInversion: Inversor = {
          usuarioId: usuario.uid,
          usuarioNombre: usuario.displayName || 'Usuario',
          icono: usuario.photoURL || '',
          fecha: Date.now(),
          ...data,
        };

        const nuevosInversores = [...inversores, nuevaInversion];
        await updateDoc(docRef, { inversores: nuevosInversores });
        showToast.success('¡Inversión realizada con éxito!');
      }

      setShowInvestModal(false);
      setIsEditingInvestment(false);
      setEditingInvestor(null);
    } catch (err: any) {
      console.error('Error al invertir:', err);
      showToast.error('Error al procesar la inversión');
    }
  };

  const handleDeleteInvestment = async (inversor: Inversor) => {
    if (!usuario || !producto) return;

    try {
      const docRef = doc(db, 'productos', params.id as string);
      const inversores = producto.inversores || [];

      const nuevosInversores = inversores.filter(
        (inv: Inversor) => inv.usuarioId !== usuario.uid
      );

      const montoDevolucion = (inversor.cubos * producto.precio) / 100;

      await sumarSaldo(usuario.uid, montoDevolucion);
      await restarSaldoAcumulado(producto.creador.id, params.id as string, montoDevolucion);
      await updateDoc(docRef, { inversores: nuevosInversores });

      showToast.success('Inversión eliminada y saldo devuelto');
    } catch (err: any) {
      console.error('Error al eliminar inversión:', err);
      showToast.error('Error al eliminar inversión');
    }
  };

  const handleDistributeProfit = async (gananciaTotal: number, aportarGanancia: boolean) => {
    if (!usuario || !producto || !esCreador) return;

    // Protección de Capital: El creador no puede distribuir menos del total recaudado (precio del proyecto)
    if (gananciaTotal < producto.precio) {
      showToast.error(`La distribución debe ser mayor o igual al capital invertido (${formatCurrency(producto.precio)})`);
      return;
    }

    try {
      const inversores = producto.inversores || [];

      // Si el creador aporta la ganancia física obtenida en el mundo real,
      // se la sumamos primero a su saldo virtual para evitar descuadres.
      if (aportarGanancia) {
        const gananciaNeta = gananciaTotal - producto.precio;
        if (gananciaNeta > 0) {
          await sumarSaldo(usuario.uid, gananciaNeta);
        }
      }

      const error = await restarSaldoGanancia(usuario.uid, producto.creador.id, gananciaTotal);
      if (error) {
        showToast.error(error);
        return;
      }

      await enviarGanancia(inversores, gananciaTotal, producto.precio);

      const docRef = doc(db, 'productos', params.id as string);
      await updateDoc(docRef, {
        estado: false,
        monto: gananciaTotal,
      });

      showToast.success('Ganancias distribuidas exitosamente');
      setShowProfitModal(false);
    } catch (err: any) {
      console.error('Error al distribuir ganancias:', err);
      showToast.error('Error al distribuir ganancias');
    }
  };

  const handleDepositRecaudado = async () => {
    if (!usuario || !producto || !esCreador) return;

    // Verificación inicial optimista
    if (producto.depositoRecaudado) {
      showToast.error('Los fondos ya han sido depositados.');
      return;
    }

    try {
      // Verificación en tiempo real contra la base de datos para evitar Race Conditions (Doble click)
      const docRef = doc(db, 'productos', params.id as string);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists() || docSnap.data().depositoRecaudado) {
        showToast.error('Los fondos ya fueron retirados en otra transacción. Acción denegada.');
        return;
      }

      await sumarSaldo(producto.creador.id, montoRecaudado);
      await restarSaldoAcumulado(producto.creador.id, params.id as string, montoRecaudado);

      await updateDoc(docRef, { depositoRecaudado: true });

      showToast.success('Fondos depositados a tu saldo');
    } catch (err: any) {
      console.error('Error al depositar:', err);
      showToast.error('Error al depositar fondos');
    }
  };

  const handleModifyPrice = async (nuevoPrecio: number) => {
    if (!usuario || !producto || !esCreador) return;

    // Regla de Oro: No se puede cambiar el precio si ya hay inversores
    const inversores = producto.inversores || [];
    if (inversores.length > 0) {
      showToast.error('No puedes modificar el precio porque ya existen inversores en el proyecto.');
      return;
    }

    try {
      const docRef = doc(db, 'productos', params.id as string);
      await updateDoc(docRef, { precio: nuevoPrecio });

      showToast.success('Precio actualizado');
      setShowPriceModal(false);
    } catch (err: any) {
      console.error('Error al actualizar precio:', err);
      showToast.error('Error al actualizar precio');
    }
  };

  const eliminarProducto = async () => {
    if (!usuario || !producto) return;
    if (producto.creador.id !== usuario.uid) return;

    // Regla Estricta: No se puede eliminar si hay inversores
    if (producto.inversores && producto.inversores.length > 0) {
      showToast.error('No puedes eliminar el proyecto porque ya tiene inversores. Debes devolver los fondos primero.');
      return;
    }

    if (confirm('¿Estás seguro de eliminar este producto?')) {
      try {
        await deleteDoc(doc(db, 'productos', params.id as string));
        showToast.success('Producto eliminado');
        router.push('/');
      } catch (err: any) {
        console.error('Error al eliminar:', err);
        showToast.error('Error al eliminar producto');
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !producto) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-12">
          <i className="bx bx-error-circle text-6xl text-red-400 mb-4"></i>
          <h2 className="text-3xl font-bold text-white mb-4">Producto no encontrado</h2>
          <p className="text-gray-400 mb-6">Lo sentimos, este proyecto ya no existe o fue eliminado.</p>
          <Link href="/" className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition">
            <i className="bx bx-home"></i>
            Volver al Inicio
          </Link>
        </div>
      </div>
    );
  }

  const hasVoted = producto.haVotado?.includes(usuario?.uid) || false;
  const esCreador = usuario?.uid === producto.creador?.id;
  const inversores = producto.inversores || [];
  const totalCubos = inversores.reduce((sum: number, inv: Inversor) => sum + inv.cubos, 0);
  const cubosDisponibles = 100 - totalCubos;
  const precioPorCubo = producto.precio / 100;
  const porcentajeVendido = (totalCubos / 100) * 100;
  const recaudado = (totalCubos * producto.precio) / 100;
  const yaInvirtio = inversores.some((inv: Inversor) => inv.usuarioId === usuario?.uid);

  return (
    <div className="min-h-screen bg-slate-950 py-8 px-4">
      {/* Modales */}
      {showMap && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setShowMap(false)}
        >
          <button
            className="absolute top-8 right-8 text-white text-4xl hover:text-gray-300"
            onClick={() => setShowMap(false)}
          >
            ×
          </button>
          <div className="w-full max-w-4xl h-3/5 bg-white rounded-2xl overflow-hidden">
            {producto.coordenadas && (
              <iframe
                width="100%"
                height="100%"
                frameBorder="0"
                src={`https://www.google.com/maps?q=${producto.coordenadas.lat},${producto.coordenadas.lng}&z=15&output=embed`}
              />
            )}
          </div>
        </div>
      )}

      <InvestmentModal
        isOpen={showInvestModal}
        onClose={() => {
          setShowInvestModal(false);
          setIsEditingInvestment(false);
          setEditingInvestor(null);
        }}
        onSubmit={handleInvestmentSubmit}
        isEditing={isEditingInvestment}
        initialData={editingInvestor ? {
          descripcion: editingInvestor.descripcion,
          cubos: editingInvestor.cubos,
          categoria: editingInvestor.categoria,
        } : undefined}
        cubosDisponibles={isEditingInvestment ? cubosDisponibles + (editingInvestor?.cubos || 0) : cubosDisponibles}
        precioPorCubo={precioPorCubo}
        saldoUsuario={saldoUsuario}
      />

      <ProfitDistributionModal
        isOpen={showProfitModal}
        onClose={() => setShowProfitModal(false)}
        onSubmit={handleDistributeProfit}
        numInversores={inversores.length}
        saldoCreador={saldoUsuario}
        precioProyecto={producto.precio}
      />

      <PriceEditModal
        isOpen={showPriceModal}
        onClose={() => setShowPriceModal(false)}
        onSubmit={handleModifyPrice}
        precioActual={producto.precio}
      />

      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb Navigation */}
        <nav className="mb-6">
          <Link href="/" className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition group">
            <i className="bx bx-arrow-back text-xl group-hover:-translate-x-1 transition-transform"></i>
            <span className="font-medium">Volver al Inicio</span>
          </Link>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Hero Section */}
            <section className="space-y-6">
              {/* Image Gallery */}
              <div className="relative w-full h-96 rounded-2xl overflow-hidden shadow-2xl">
                <OptimizedImage
                  src={images[0] || '/static/img/casa.jpg'}
                  alt={`Imagen principal de ${producto.nombre}`}
                  fill
                  priority
                  sizes="(max-width: 768px) 100vw, 66vw"
                  className="w-full h-full"
                />
              </div>

              {/* Title & Company */}
              <div>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <h1 className="text-3xl lg:text-5xl font-bold text-white mb-3 font-roboto-slab leading-tight">
                      {producto.nombre}
                    </h1>
                    <p className="text-lg text-gray-400 flex items-center gap-2">
                      <i className="bx bx-buildings text-xl"></i>
                      {producto.empresa}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {producto.coordenadas && (
                      <button
                        onClick={() => setShowMap(true)}
                        className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl hover:bg-red-500/20 transition"
                        title="Ver ubicación"
                      >
                        <FaMapMarkerAlt />
                      </button>
                    )}
                    {usuario && (
                      <button
                        onClick={votarProducto}
                        disabled={hasVoted || processingVote}
                        className={`p-3 rounded-xl transition disabled:opacity-50 ${hasVoted
                          ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                          : 'bg-gray-800 border border-white/10 text-gray-400 hover:bg-gray-700'
                          }`}
                        title={hasVoted ? 'Ya votaste' : 'Votar'}
                      >
                        {hasVoted ? <FaHeart /> : <FaRegHeart />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Stats Bar */}
                <StatsBar
                  votos={producto.votos || 0}
                  comentarios={producto.comentarios?.length || 0}
                  inversores={inversores.length}
                  ubicacion={producto.coordenadas ? 'Lima, Perú' : undefined}
                />

                {/* Created Date */}
                <p className="text-sm text-gray-500 mt-3 flex items-center gap-1.5">
                  <i className="bx bx-time-five"></i>
                  Publicado hace {formatDistanceToNow(new Date(producto.creado), { locale: es })}
                </p>
              </div>
            </section>

            {/* Banner 100% financiado — visible para el creador */}
            {esCreador && cubosDisponibles === 0 && producto.estado && (
              <section className="mb-6">
                <div className="relative overflow-hidden rounded-2xl border border-yellow-500/40 bg-gradient-to-r from-yellow-500/10 via-amber-500/10 to-orange-500/10 p-6">
                  {/* Glow decorativo */}
                  <div className="absolute -top-10 -right-10 w-40 h-40 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />
                  <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="text-4xl">🎉</div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-yellow-300 mb-1">¡Tu proyecto está 100% financiado!</h3>
                      <p className="text-sm text-yellow-400/80">
                        Has recaudado <span className="font-bold text-white">{formatCurrency(recaudado)}</span>. Ve al panel de <strong>Admin</strong> para depositar los fondos a tu billetera y luego liquidar el proyecto distribuyendo el capital y las ganancias.
                      </p>
                    </div>
                    <button
                      onClick={() => handleDepositRecaudado()}
                      disabled={producto.depositoRecaudado}
                      className="shrink-0 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all \
                        bg-yellow-500 hover:bg-yellow-400 text-slate-900 shadow-lg shadow-yellow-500/30 \
                        disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                      {producto.depositoRecaudado ? '✓ Fondos depositados' : 'Depositar fondos ahora'}
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* Tabbed Content */}
            <section className="card">
              <Tabs
                tabs={[
                  {
                    id: 'descripcion',
                    label: 'Descripción',
                    icon: 'bx-file-blank',
                    content: (
                      <div className="prose max-w-none">
                        <p className="text-gray-300 text-base leading-relaxed whitespace-pre-line">
                          {producto.descripcion}
                        </p>
                      </div>
                    ),
                  },
                  {
                    id: 'inversores',
                    label: 'Inversores',
                    icon: 'bx-group',
                    badge: inversores.length,
                    content: inversores.length > 0 ? (
                      <InvestorList
                        inversores={inversores}
                        currentUserId={usuario?.uid}
                        onEdit={(inversor) => {
                          setEditingInvestor(inversor);
                          setIsEditingInvestment(true);
                          setShowInvestModal(true);
                        }}
                        onDelete={handleDeleteInvestment}
                        totalCubos={totalCubos}
                        precio={producto.precio}
                      />
                    ) : (
                      <div className="text-center py-12">
                        <i className="bx bx-user-x text-6xl text-gray-600 mb-3"></i>
                        <p className="text-gray-500">Aún no hay inversores en este proyecto</p>
                        <p className="text-sm text-gray-600 mt-2">¡Sé el primero en invertir!</p>
                      </div>
                    ),
                  },
                  {
                    id: 'detalles',
                    label: 'Detalles',
                    icon: 'bx-info-circle',
                    content: (
                      <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 bg-slate-800/50 rounded-xl border border-white/5">
                            <p className="text-sm text-gray-400 mb-1">Categoría</p>
                            <p className="text-lg font-semibold text-white capitalize">{producto.categoria}</p>
                          </div>
                          <div className="p-4 bg-slate-800/50 rounded-xl border border-white/5">
                            <p className="text-sm text-gray-400 mb-1">Estado</p>
                            <p className="text-lg font-semibold">
                              {producto.estado ? (
                                <span className="text-green-400">✓ Activo</span>
                              ) : (
                                <span className="text-gray-400">○ Finalizado</span>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="p-4 bg-slate-800/50 rounded-xl border border-white/5">
                          <p className="text-sm text-gray-400 mb-2">Creador</p>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                              {producto.creador?.nombre?.charAt(0) || 'U'}
                            </div>
                            <p className="text-lg font-semibold text-white">{producto.creador?.nombre}</p>
                          </div>
                        </div>

                        {producto.url && (
                          <div className="p-4 bg-slate-800/50 rounded-xl border border-white/5">
                            <p className="text-sm text-gray-400 mb-2">Sitio Web</p>
                            <a
                              href={producto.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300 break-all flex items-center gap-2"
                            >
                              <i className="bx bx-link-external"></i>
                              Visitar sitio web
                            </a>
                          </div>
                        )}
                      </div>
                    ),
                  },
                  ...(esCreador ? [{
                    id: 'admin',
                    label: 'Admin',
                    icon: 'bx-cog',
                    content: (
                      <div className="space-y-4">
                        <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl mb-4">
                          <div className="flex items-center gap-2 text-purple-400 mb-2">
                            <i className="bx bx-crown text-xl"></i>
                            <h3 className="font-bold">Panel de Administrador</h3>
                          </div>
                          <p className="text-sm text-gray-400">Gestiona tu proyecto desde aquí</p>
                        </div>

                        {producto.estado && (
                          <button
                            onClick={() => router.push(`/productos/editar/${params.id}`)}
                            className="w-full p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition flex items-center justify-center gap-2 font-semibold"
                          >
                            <i className="bx bx-edit-alt text-xl"></i>
                            Editar Proyecto
                          </button>
                        )}

                        <button
                          onClick={() => {
                            if (inversores.length > 0) {
                              showToast.error('El precio está bloqueado porque ya existen inversores.');
                              return;
                            }
                            setShowPriceModal(true);
                          }}
                          disabled={inversores.length > 0}
                          className={`w-full p-4 rounded-xl transition flex items-center justify-center gap-2 font-semibold ${
                            inversores.length > 0 
                              ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-white/5' 
                              : 'bg-purple-600 hover:bg-purple-700 text-white'
                          }`}
                          title={inversores.length > 0 ? "No puedes cambiar el precio si ya hay inversores" : "Modificar Precio del Proyecto"}
                        >
                          <i className="bx bx-edit text-xl"></i>
                          {inversores.length > 0 ? "Precio Bloqueado (Tiene inversores)" : "Modificar Precio del Proyecto"}
                        </button>

                        {montoRecaudado > 0 && !producto.depositoRecaudado && (
                          <button
                            onClick={handleDepositRecaudado}
                            className="w-full p-4 bg-green-600 hover:bg-green-700 text-white rounded-xl transition flex items-center justify-center gap-2 font-semibold"
                          >
                            <i className="bx bx-download text-xl"></i>
                            Depositar Recaudado: {formatCurrency(montoRecaudado)}
                          </button>
                        )}

                        {inversores.length > 0 && producto.estado && (
                          <button
                            onClick={() => setShowProfitModal(true)}
                            className="w-full p-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition flex items-center justify-center gap-2 font-semibold shadow-lg shadow-emerald-900/20"
                          >
                            <i className="bx bx-dollar-circle text-xl"></i>
                            Liquidar Proyecto (Capital + Ganancias)
                          </button>
                        )}

                        <button
                          onClick={() => {
                            if (inversores.length > 0) {
                              showToast.error('No puedes eliminar el proyecto porque tiene inversores activos.');
                              return;
                            }
                            eliminarProducto();
                          }}
                          disabled={inversores.length > 0}
                          className={`w-full p-4 rounded-xl transition flex items-center justify-center gap-2 font-semibold ${
                            inversores.length > 0
                              ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-white/5'
                              : 'bg-red-600 hover:bg-red-700 text-white'
                          }`}
                          title={inversores.length > 0 ? "No puedes eliminar un proyecto con inversores" : "Eliminar Proyecto"}
                        >
                          <i className="bx bx-trash text-xl"></i>
                          {inversores.length > 0 ? "Eliminar (Bloqueado)" : "Eliminar Proyecto"}
                        </button>
                      </div>
                    ),
                  }] : []),
                ]}
              />
            </section>

            {/* Comentarios - Enterprise Component */}
            <CommentsSection
              comments={producto.comentarios || []}
              currentUserId={usuario?.uid}
              creatorId={producto.creador?.id}
              onSubmitComment={handleSubmitComment}
              onEditComment={handleEditComment}
              onDeleteComment={handleDeleteComment}
              onToggleReaction={handleToggleReaction}
              userAvatar={usuario?.photoURL || undefined}
              userName={usuario?.displayName || undefined}
            />

            {/* Reporte de Cierre - visible solo cuando el proyecto está finalizado */}
            {!producto.estado && (
              <ProjectClosureReport
                producto={{
                  id: params.id as string,
                  nombre: producto.nombre,
                  empresa: producto.empresa,
                  precio: producto.precio,
                  monto: producto.monto,
                  creado: producto.creado,
                  inversores: inversores,
                  creador: producto.creador,
                  categoria: producto.categoria,
                }}
                esCreador={esCreador}
                usuarioId={usuario?.uid}
              />
            )}
          </div>

          {/* Sidebar - Investment Card (Sticky on Desktop) */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <InvestmentCard
              precio={producto.precio}
              recaudado={recaudado}
              porcentajeVendido={porcentajeVendido}
              cubosDisponibles={cubosDisponibles}
              numInversores={inversores.length}
              precioPorCubo={precioPorCubo}
              onInvertir={() => setShowInvestModal(true)}
              yaInvirtio={yaInvirtio}
              esCreador={esCreador}
              estado={producto.estado}
              fechaLimite={producto.fechaLimite}
            />
          </aside>
        </div>
      </div>

      {producto && (
        <MobileInvestmentCTA
          precio={producto.precio}
          precioPorCubo={precioPorCubo}
          cubosDisponibles={cubosDisponibles}
          onInvertir={() => setShowInvestModal(true)}
          yaInvirtio={yaInvirtio}
          esCreador={esCreador}
          estado={producto.estado}
          show={true}
          fechaLimite={producto.fechaLimite}
        />
      )}
    </div>
  );
}

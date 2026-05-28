'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import useAutenticacion from '@/Hooks/useAutenticacion';

interface UserData {
  names: string;
  lastname: string;
  phone: string;
  email: string;
}

interface YapearPageProps {
  params: {
    id: string;
  };
}

export default function YapearPage({ params }: YapearPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { usuario } = useAutenticacion();
  
  const token = searchParams.get('token');
  const tipo = searchParams.get('tipo') || 'transferencia';
  const { id } = params;

  const [mostrarSaldo, setMostrarSaldo] = useState(false);
  const [datosUser, setDatosUser] = useState<UserData | null>(null);
  const [saldo, setSaldo] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [valor, setValor] = useState('');
  const [respuesta, setRespuesta] = useState('');
  const [estado, setEstado] = useState(false);

  const formatearPresupuesto = (cantidad: number) => {
    return cantidad.toLocaleString('es-PE', {
      style: 'currency',
      currency: 'PEN',
    });
  };

  // Obtener datos de la billetera
  useEffect(() => {
    const fetchWalletData = async () => {
      if (!token) {
        setError('Token de autenticación no encontrado');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          'https://billapp-57e4b0e7460c.herokuapp.com/api/wallet',
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Error de servidor');
        }

        setSaldo(data['data']['cash']);
        setLoading(false);
      } catch (error: any) {
        console.error('Error al obtener datos:', error.message);
        if (error.message.length === 29) {
          setError(error.message);
        }
        setLoading(false);
      }
    };

    fetchWalletData();
  }, [token]);

  // Obtener datos del usuario destinatario
  useEffect(() => {
    const fetchUserData = async () => {
      if (!id || !token) return;

      try {
        const response = await fetch(
          `https://billapp-57e4b0e7460c.herokuapp.com/api/user/${id}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        const data = await response.json();
        if (response.ok && data.data) {
          setDatosUser(data.data);
        }
        setLoading(false);
      } catch (error) {
        console.error('Error al obtener datos de usuario:', error);
        setLoading(false);
      }
    };

    fetchUserData();
  }, [id, token]);

  const formatoMoneda = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valorNumerico = e.target.value.replace(/[^0-9]/g, '');
    setValor(valorNumerico === '' ? '' : `S/ ${valorNumerico}`);
  };

  const transferirDinero = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      setError('Token de autenticación requerido');
      return;
    }

    const numeroExtraido = valor.replace(/\D/g, '');
    const numero = parseInt(numeroExtraido, 10);

    if (isNaN(numero) || numero <= 0) {
      setError('Ingrese un monto válido');
      setEstado(true);
      setTimeout(() => {
        setError('');
        setEstado(false);
      }, 1000);
      return;
    }

    try {
      if (tipo === 'transferencia') {
        if (numero > saldo) {
          setError('Saldo Insuficiente');
          setEstado(true);
          setTimeout(() => {
            setError('');
            setEstado(false);
          }, 1000);
          return;
        }

        // Transferir dinero (Yapear)
        const response = await fetch(
          'https://billapp-57e4b0e7460c.herokuapp.com/api/wallet/send',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              depositUserID: id,
              amount: numero,
            }),
          }
        );

        const data = await response.json();

        if (response.ok) {
          setRespuesta(data.message || 'Transferencia exitosa');
        } else {
          throw new Error(data.message || 'Error en la transferencia');
        }
      } else {
        // Recarga propia
        const response = await fetch(
          'https://billapp-57e4b0e7460c.herokuapp.com/api/wallet/deposit',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              amount: numero,
              userId: id,
            }),
          }
        );

        const data = await response.json();

        if (response.ok) {
          setRespuesta(data.data?.message || 'Recarga exitosa');
        } else {
          throw new Error(data.message || 'Error en la recarga');
        }
      }
    } catch (error: any) {
      console.error('Error en la transacción:', error);
      setError(error.message || 'Error en la transacción');
      setEstado(true);
      setTimeout(() => {
        setError('');
        setEstado(false);
      }, 1000);
    }
  };

  if (!usuario && !token) {
    return (
      <div className="min-h-screen bg-[#1a1c21] flex items-center justify-center text-white">
        <div className="text-center">
          <h2 className="text-2xl mb-4">Debes iniciar sesión</h2>
          <button
            onClick={() => router.push('/billetera')}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg transition"
          >
            Ir a Billetera
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1c21] flex items-center justify-center p-4">
      <div className="relative bg-[#2a2d35] w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl">
        {/* Modal de Error */}
        {error && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50 rounded-2xl">
            <div className="text-center p-6">
              <span className="text-red-500 font-bold text-xl block mb-4">
                {error}
              </span>
              {!estado && (
                <Link
                  href="/billetera"
                  className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition"
                >
                  Iniciar Sesión
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Modal de Respuesta Exitosa */}
        {respuesta && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50 rounded-2xl">
            <div className="text-center p-6">
              <span className="text-green-500 font-bold text-xl block mb-4">
                {respuesta}
              </span>
              <Link
                href="/billetera"
                className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition"
              >
                Regresar a la Página Principal
              </Link>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="bg-purple-600 h-12 flex items-center px-4 gap-3">
          <Link
            href="/billetera"
            className="text-white text-3xl font-bold hover:text-gray-200 transition"
          >
            ×
          </Link>
          <p className="text-white font-bold text-lg">Yapear a</p>
        </div>

        {/* Contenido */}
        <div className="p-6">
          {loading && (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500"></div>
            </div>
          )}

          {!loading && datosUser && (
            <>
              {/* Datos del destinatario */}
              <div className="text-center text-white mb-6">
                <span className="text-2xl font-bold block mb-2">
                  {datosUser.names} {datosUser.lastname}
                </span>
                <p className="text-xl text-gray-300">{datosUser.phone}</p>
              </div>

              {/* Formulario */}
              <form onSubmit={transferirDinero} className="space-y-6">
                {/* Input de monto */}
                <div className="py-8">
                  <input
                    type="text"
                    id="monto"
                    value={valor}
                    onChange={formatoMoneda}
                    placeholder="S/ 0"
                    className="w-full bg-transparent border-none text-white text-6xl text-center focus:outline-none placeholder:text-white/50"
                  />
                </div>

                {/* Mostrar saldo disponible */}
                <div className="bg-purple-600 rounded-lg p-3">
                  <div className="flex items-center justify-between text-white font-bold text-sm">
                    <span>Saldo disponible:</span>
                    <span>{formatearPresupuesto(saldo)}</span>
                  </div>
                </div>

                {/* Botón */}
                <button
                  type="submit"
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 rounded-xl transition duration-200 text-xl"
                >
                  {tipo === 'transferencia' ? 'Yapear' : 'Recargar'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

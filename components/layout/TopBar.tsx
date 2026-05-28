'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { FaBell, FaUser, FaSearch, FaCog, FaSignOutAlt, FaWallet, FaChartLine } from 'react-icons/fa';
import { MdClose } from 'react-icons/md';
import useAutenticacion from '@/Hooks/useAutenticacion';
import { useNotifications, getRelativeTime } from '@/Hooks/useNotifications';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import CommandPalette from '@/components/ui/CommandPalette';
import headerAnalytics from '@/lib/analytics';

// Keys específicas del localStorage de la app
const APP_STORAGE_KEYS = {
    SEARCH_HISTORY: 'inversiones_search_history',
    FILTERS: 'inversiones_filters',
    USER_PREFS: 'inversiones_user_prefs'
};

export default function TopBar() {
    const { usuario, cerrarSesion } = useAutenticacion();
    const router = useRouter();

    // Estados
    const [showNotifications, setShowNotifications] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [saldo, setSaldo] = useState<number>(0);
    const [saldoLoading, setSaldoLoading] = useState(true);

    // Hook de notificaciones real
    const {
        notifications,
        loading: notifLoading,
        unreadCount,
        markAsRead,
        markAllAsRead
    } = useNotifications(usuario?.uid || null);

    // Refs
    const notificationRef = useRef<HTMLDivElement>(null);
    const userMenuRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLDivElement>(null);

    // Memoización: Formato de saldo
    const formattedSaldo = useMemo(
        () => saldo.toLocaleString('es-PE', {
            style: 'currency',
            currency: 'PEN',
        }),
        [saldo]
    );

    // Memoización: Saldo compacto para mobile (badge)
    const compactSaldo = useMemo(() => {
        if (saldo >= 1000) {
            return `${(saldo / 1000).toFixed(1)}k`;
        }
        return Math.floor(saldo).toString();
    }, [saldo]);

    // Escuchar cambios en el saldo del usuario en tiempo real
    useEffect(() => {
        if (usuario) {
            setSaldoLoading(true);
            const usuarioDocRef = doc(db, 'usuarios', usuario.uid);

            const unsubscribe = onSnapshot(usuarioDocRef, (docSnapshot) => {
                if (docSnapshot.exists()) {
                    const data = docSnapshot.data();
                    if (data.saldo !== undefined) {
                        setSaldo(parseFloat(data.saldo) || 0);
                    }
                }
                setSaldoLoading(false);
            }, (error) => {
                console.error('Error al obtener saldo:', error);
                setSaldoLoading(false);
            });

            return () => unsubscribe();
        } else {
            setSaldo(0);
            setSaldoLoading(false);
        }
    }, [usuario]);

    // Cerrar dropdowns con ESC y click fuera
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
                setShowNotifications(false);
            }
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setShowUserMenu(false);
            }
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowSearch(false);
            }
        }

        function handleEscKey(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                setShowNotifications(false);
                setShowUserMenu(false);
                setShowSearch(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscKey);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscKey);
        };
    }, []);

    // Manejar búsqueda con analytics
    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            headerAnalytics.searchPerformed(searchQuery, usuario?.uid);
            router.push(`/buscar?q=${encodeURIComponent(searchQuery)}`);
            setShowSearch(false);
            setSearchQuery('');
        }
    };

    // Cerrar sesión con analytics
    const handleLogout = async () => {
        headerAnalytics.logoutClicked(usuario?.uid);
        await cerrarSesion();
        router.push('/Login');
    };

    // Limpiar solo localStorage específico de la app
    const handleLogoClick = () => {
        Object.values(APP_STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
    };

    // Manejar click en notificaciones
    const handleNotificationClick = (notification: any) => {
        headerAnalytics.notificationClicked(notification.id, notification.type, usuario?.uid);
        markAsRead(notification.id);

        if (notification.actionUrl) {
            router.push(notification.actionUrl);
            setShowNotifications(false);
        }
    };

    // Iconos por tipo de notificación
    const getNotificationIcon = (type: string) => {
        const baseClasses = "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0";
        switch (type) {
            case 'success':
                return <div className={`${baseClasses} bg-green-500/20 text-green-400`}>✓</div>;
            case 'warning':
                return <div className={`${baseClasses} bg-yellow-500/20 text-yellow-400`}>!</div>;
            case 'error':
                return <div className={`${baseClasses} bg-red-500/20 text-red-400`}>×</div>;
            default:
                return <div className={`${baseClasses} bg-blue-500/20 text-blue-400`}>i</div>;
        }
    };

    // CSS classes for dropdowns
    const dropdownBase = "absolute right-0 top-full mt-2 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 overflow-hidden z-50";
    const dropdownAnim = "transition-all duration-200 origin-top-right";

    return (
        <>
            {/* Command Palette */}
            <CommandPalette />

            <header className="fixed top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-xl border-b border-white/10 shadow-2xl">
                <div className="flex items-center justify-between px-4 lg:px-8 h-20">

                    {/* Logo y Búsqueda */}
                    <div className="flex items-center gap-6 flex-1">
                        <Link href="/" onClick={handleLogoClick} className="flex items-center gap-3 group flex-shrink-0">
                            {/* Logo Mobile */}
                            <div className="md:hidden relative w-10 h-10 hover:scale-110 active:scale-95 transition-transform">
                                <Image
                                    src="/static/img/logo.png"
                                    alt="InversionesPro"
                                    width={50}
                                    height={50}
                                    className="object-contain"
                                />
                            </div>

                            {/* Logo Desktop */}
                            <div className="hidden md:block relative w-48 h-14 hover:scale-105 active:scale-98 transition-transform">
                                <Image
                                    src="/static/img/future.png"
                                    alt="InversionesPro"
                                    width={192}
                                    height={56}
                                    className="object-contain"
                                />
                            </div>
                        </Link>

                        {/* Búsqueda - Desktop */}
                        <div className="hidden md:flex flex-1 max-w-xl">
                            <form onSubmit={handleSearch} className="w-full relative group">
                                <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-400 transition-colors" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Buscar Productos"
                                    className="w-full pl-12 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-base"
                                    aria-label="Búsqueda de productos"
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearchQuery('');
                                            headerAnalytics.searchCleared(usuario?.uid);
                                        }}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                                        aria-label="Limpiar búsqueda"
                                    >
                                        <MdClose className="w-5 h-5" />
                                    </button>
                                )}
                            </form>
                        </div>
                    </div>

                    {/* Acciones del Header */}
                    <div className="flex items-center gap-4">

                        {/* Búsqueda Mobile */}
                        <div className="md:hidden relative" ref={searchRef}>
                            <button
                                onClick={() => setShowSearch(!showSearch)}
                                className="p-3 rounded-xl hover:bg-white/5 active:scale-95 transition-all"
                                aria-label="Abrir búsqueda"
                                aria-expanded={showSearch}
                            >
                                <FaSearch className="w-6 h-6 text-slate-400" />
                            </button>

                            {showSearch && (
                                <div className={`${dropdownBase} ${dropdownAnim} w-80`}>
                                    <form onSubmit={handleSearch} className="p-3">
                                        <div className="relative">
                                            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <input
                                                type="text"
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                placeholder="Buscar Productos"
                                                className="w-full pl-10 pr-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                                autoFocus
                                            />
                                        </div>
                                    </form>
                                </div>
                            )}
                        </div>

                        {usuario ? (
                            <>
                                {/* Saldo y Botones de Billetera - Solo Tablet+ */}
                                {saldo >= 0 && (
                                    <div className="hidden lg:flex flex-col items-end">
                                        {saldoLoading ? (
                                            <>
                                                <div className="h-3 w-24 bg-slate-700 rounded animate-pulse mb-1"></div>
                                                <div className="h-6 w-32 bg-slate-700 rounded animate-pulse"></div>
                                            </>
                                        ) : (
                                            <>
                                                <span className="text-base text-slate-300 font-medium mb-1">
                                                    Saldo: {formattedSaldo}
                                                </span>
                                                <div className="flex gap-2">
                                                    <Link
                                                        href="/billetera/recargar"
                                                        onClick={() => headerAnalytics.recargarSaldoClicked(saldo, usuario.uid)}
                                                        className="px-5 py-2 text-sm font-bold bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 rounded-xl transition-all active:scale-95 hover:shadow-lg hover:shadow-green-500/10"
                                                    >
                                                        Recargar
                                                    </Link>
                                                    <Link
                                                        href="/billetera/retirar"
                                                        onClick={() => headerAnalytics.retirarSaldoClicked(saldo, usuario.uid)}
                                                        className="px-5 py-2 text-sm font-bold bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-xl transition-all active:scale-95 hover:shadow-lg hover:shadow-blue-500/10"
                                                    >
                                                        Enviar a Billetera
                                                    </Link>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}

                                {/* Notificaciones */}
                                <div className="relative" ref={notificationRef}>
                                    <button
                                        onClick={() => {
                                            setShowNotifications(!showNotifications);
                                            if (!showNotifications) {
                                                headerAnalytics.notificationsOpened(unreadCount, usuario.uid);
                                            }
                                        }}
                                        className="relative p-3 rounded-xl hover:bg-white/5 active:scale-95 transition-all"
                                        aria-label={`Notificaciones${unreadCount > 0 ? `, ${unreadCount} sin leer` : ''}`}
                                        aria-expanded={showNotifications}
                                    >
                                        <FaBell className="w-6 h-6 text-slate-400 hover:text-white transition-colors" />
                                        {unreadCount > 0 && (
                                            <span className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center">
                                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                                                <span className="relative inline-flex items-center justify-center rounded-full h-5 w-5 bg-red-500 text-[10px] font-bold text-white">
                                                    {unreadCount > 9 ? '9+' : unreadCount}
                                                </span>
                                            </span>
                                        )}
                                    </button>

                                    {showNotifications && (
                                        <div className={`${dropdownBase} ${dropdownAnim} w-96 max-w-[calc(100vw-2rem)]`}>
                                            <div className="flex items-center justify-between p-4 border-b border-slate-700">
                                                <h3 className="text-sm font-semibold text-white">Notificaciones</h3>
                                                {unreadCount > 0 && (
                                                    <button
                                                        onClick={() => {
                                                            markAllAsRead();
                                                            headerAnalytics.allNotificationsMarkedRead(unreadCount, usuario.uid);
                                                        }}
                                                        className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
                                                    >
                                                        Marcar todas como leídas
                                                    </button>
                                                )}
                                            </div>

                                            <div className="max-h-[60vh] overflow-y-auto">
                                                {notifLoading ? (
                                                    <div className="p-8 space-y-4">
                                                        {[1, 2, 3].map(i => (
                                                            <div key={i} className="flex gap-3">
                                                                <div className="w-10 h-10 bg-slate-700 rounded-full animate-pulse"></div>
                                                                <div className="flex-1 space-y-2">
                                                                    <div className="h-4 w-3/4 bg-slate-700 rounded animate-pulse"></div>
                                                                    <div className="h-3 w-full bg-slate-700 rounded animate-pulse"></div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : notifications.length > 0 ? (
                                                    notifications.map(notification => (
                                                        <div
                                                            key={notification.id}
                                                            onClick={() => handleNotificationClick(notification)}
                                                            className={`p-4 border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors cursor-pointer ${!notification.read ? 'bg-blue-500/5' : ''}`}
                                                        >
                                                            <div className="flex gap-3">
                                                                {getNotificationIcon(notification.type)}
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-start justify-between gap-2">
                                                                        <h4 className="text-sm font-medium text-white truncate">
                                                                            {notification.title}
                                                                        </h4>
                                                                        {!notification.read && (
                                                                            <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5"></div>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                                                                        {notification.message}
                                                                    </p>
                                                                    <span className="text-xs text-slate-500 mt-1 block">
                                                                        {getRelativeTime(notification.createdAt)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="p-12 text-center">
                                                        <FaBell className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                                                        <p className="text-sm font-medium text-slate-400 mb-1">
                                                            No tienes notificaciones
                                                        </p>
                                                        <p className="text-xs text-slate-500">
                                                            Te avisaremos cuando haya novedades
                                                        </p>
                                                    </div>
                                                )}
                                            </div>

                                            {notifications.length > 0 && (
                                                <div className="p-3 border-t border-slate-700 bg-slate-800/50">
                                                    <Link
                                                        href="/notificaciones"
                                                        className="block text-center text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors"
                                                        onClick={() => setShowNotifications(false)}
                                                    >
                                                        Ver todas las notificaciones
                                                    </Link>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Menú de Usuario con Dropdown y Badge de Saldo en Mobile */}
                                <div className="relative" ref={userMenuRef}>
                                    <button
                                        onClick={() => {
                                            setShowUserMenu(!showUserMenu);
                                            if (!showUserMenu) {
                                                headerAnalytics.userMenuOpened(usuario.uid);
                                            }
                                        }}
                                        className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 active:scale-95 transition-all"
                                        aria-label="Menú de usuario"
                                        aria-expanded={showUserMenu}
                                    >
                                        <div className="relative">
                                            {usuario.photoURL ? (
                                                <img
                                                    src={usuario.photoURL}
                                                    alt={usuario.displayName || 'Usuario'}
                                                    className="w-14 h-14 rounded-full ring-2 ring-slate-700 hover:ring-blue-500 transition-all object-cover"
                                                />
                                            ) : (
                                                <img
                                                    src="/static/img/imagenPerfil.png"
                                                    alt="Perfil"
                                                    className="w-14 h-14 rounded-full ring-2 ring-slate-700 hover:ring-blue-500 transition-all object-cover"
                                                />
                                            )}

                                            {/* Badge de saldo en mobile/tablet */}
                                            {saldo >= 0 && !saldoLoading && (
                                                <div
                                                    className="absolute -bottom-1 -right-1 lg:hidden bg-gradient-to-r from-green-500 to-green-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-lg border border-slate-900 min-w-[28px] text-center cursor-pointer hover:scale-110 transition-transform"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        headerAnalytics.saldoBadgeClicked(saldo, usuario.uid);
                                                    }}
                                                >
                                                    {compactSaldo}
                                                </div>
                                            )}
                                        </div>

                                        <span className="text-lg font-medium text-white hidden xl:block max-w-40 truncate">
                                            {usuario.displayName || usuario.email?.split('@')[0]}
                                        </span>
                                    </button>

                                    {showUserMenu && (
                                        <div className={`${dropdownBase} ${dropdownAnim} w-72`}>
                                            {/* Info del usuario */}
                                            <div className="p-4 border-b border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900">
                                                <div className="flex items-center gap-3">
                                                    {usuario.photoURL ? (
                                                        <img
                                                            src={usuario.photoURL}
                                                            alt={usuario.displayName || 'Usuario'}
                                                            className="w-12 h-12 rounded-full object-cover"
                                                        />
                                                    ) : (
                                                        <img
                                                            src="/static/img/imagenPerfil.png"
                                                            alt="Perfil"
                                                            className="w-12 h-12 rounded-full object-cover"
                                                        />
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-lg font-semibold text-white truncate">
                                                            {usuario.displayName || 'Usuario'}
                                                        </p>
                                                        <p className="text-xs text-slate-400 truncate">
                                                            {usuario.email}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Saldo en dropdown para mobile/tablet */}
                                                {saldo >= 0 && (
                                                    <div className="mt-3 pt-3 border-t border-slate-700/50 lg:hidden">
                                                        {saldoLoading ? (
                                                            <div className="h-6 w-full bg-slate-700 rounded animate-pulse"></div>
                                                        ) : (
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-xs text-slate-400">Saldo disponible:</span>
                                                                <span className="text-sm font-bold text-green-400">{formattedSaldo}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Opciones del menú */}
                                            <div className="py-2">
                                                {[
                                                    { href: '/perfil', icon: <FaUser className="w-4 h-4" />, label: 'Mi Perfil', color: 'blue' },
                                                    { href: '/mis-inversiones', icon: <FaChartLine className="w-4 h-4" />, label: 'Mis Inversiones', color: 'green' },
                                                    { href: '/billetera', icon: <FaWallet className="w-4 h-4" />, label: 'Mi Billetera', color: 'purple' },
                                                    { href: '/configuracion', icon: <FaCog className="w-4 h-4" />, label: 'Configuración', color: 'blue' }
                                                ].map((item, idx) => (
                                                    <Link
                                                        key={item.href}
                                                        href={item.href}
                                                        onClick={() => {
                                                            setShowUserMenu(false);
                                                            headerAnalytics.userMenuOptionClicked(item.label, usuario.uid);
                                                        }}
                                                        className="flex items-center gap-3 px-4 py-3 hover:bg-slate-700/50 transition-colors group"
                                                    >
                                                        <div className={`text-slate-400 group-hover:text-${item.color}-400 transition-colors`}>
                                                            {item.icon}
                                                        </div>
                                                        <span className="text-sm text-white">{item.label}</span>
                                                    </Link>
                                                ))}

                                                {/* Botones Recargar/Retirar en mobile/tablet */}
                                                <div className="lg:hidden px-4 py-2 space-y-2">
                                                    <Link
                                                        href="/billetera/recargar"
                                                        onClick={() => {
                                                            setShowUserMenu(false);
                                                            headerAnalytics.recargarSaldoClicked(saldo, usuario.uid);
                                                        }}
                                                        className="flex items-center justify-center gap-2 w-full px-3 py-2 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all active:scale-95"
                                                    >
                                                        + Recargar Saldo
                                                    </Link>
                                                    <Link
                                                        href="/billetera/retirar"
                                                        onClick={() => {
                                                            setShowUserMenu(false);
                                                            headerAnalytics.retirarSaldoClicked(saldo, usuario.uid);
                                                        }}
                                                        className="flex items-center justify-center gap-2 w-full px-3 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all active:scale-95"
                                                    >
                                                        - Enviar a Billetera
                                                    </Link>
                                                </div>
                                            </div>

                                            {/* Cerrar sesión */}
                                            <div className="border-t border-slate-700 py-2">
                                                <button
                                                    onClick={handleLogout}
                                                    className="flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 transition-colors group w-full hover:translate-x-1"
                                                >
                                                    <FaSignOutAlt className="w-4 h-4 text-slate-400 group-hover:text-red-400 transition-colors" />
                                                    <span className="text-sm text-white group-hover:text-red-400 transition-colors">
                                                        Cerrar Sesión
                                                    </span>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Link
                                    href="/Login"
                                    onClick={() => headerAnalytics.loginClicked()}
                                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white text-sm font-medium hover:from-blue-600 hover:to-purple-600 transition-all hover:shadow-lg hover:shadow-blue-500/25 active:scale-95"
                                >
                                    Login
                                </Link>
                                <Link
                                    href="/crear-cuenta"
                                    onClick={() => headerAnalytics.signupClicked()}
                                    className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-all active:scale-95"
                                >
                                    Crear Cuenta
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </header>
        </>
    );
}

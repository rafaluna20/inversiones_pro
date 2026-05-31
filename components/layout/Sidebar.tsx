'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    FaHome, FaFire, FaSearch, FaUsers, FaWallet, FaUser, FaPlus,
    FaChartLine, FaFileInvoice, FaMap, FaCog, FaQuestionCircle,
    FaChevronLeft, FaChevronRight, FaStar, FaBell, FaShieldAlt,
    FaUserFriends, FaTrophy, FaBriefcase
} from 'react-icons/fa';
import useAutenticacion from '@/Hooks/useAutenticacion';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useEffect } from 'react';
import headerAnalytics from '@/lib/analytics';
import { useSidebar } from '@/context/SidebarContext';

interface NavItem {
    name: string;
    href: string;
    icon: any;
    badge?: string | number;
    badgeColor?: 'green' | 'blue' | 'red' | 'yellow' | 'purple';
}

interface NavGroup {
    title: string;
    items: NavItem[];
}

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { usuario } = useAutenticacion();

    // Usar el contexto global
    const { isCollapsed, toggleSidebar } = useSidebar();

    const [saldo, setSaldo] = useState<number>(0);
    const [saldoLoading, setSaldoLoading] = useState(true);
    const [activeInvestments, setActiveInvestments] = useState(3);
    const [roi, setRoi] = useState(15);

    // Escuchar saldo del usuario
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

    // Formato de saldo
    const formattedSaldo = useMemo(
        () => saldo.toLocaleString('es-PE', {
            style: 'currency',
            currency: 'PEN',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }),
        [saldo]
    );

    // Navegación agrupada
    const navigationGroups: NavGroup[] = [
        {
            title: 'INVERSIONES',
            items: [
                { name: 'Dashboard', href: '/', icon: FaHome },
                { name: 'Mis Inversiones', href: '/mis-inversiones', icon: FaChartLine, badge: activeInvestments, badgeColor: 'green' },
                { name: 'Panel del Gestor', href: '/gestor', icon: FaBriefcase, badge: 'GESTOR', badgeColor: 'yellow' },
                { name: 'Oportunidades', href: '/populares', icon: FaStar, badge: 'HOT', badgeColor: 'red' }
            ]
        },
        {
            title: 'FINANZAS',
            items: [
                { name: 'Billetera', href: '/billetera', icon: FaWallet, badge: 2, badgeColor: 'blue' },
                { name: 'Transacciones', href: '/transacciones', icon: FaFileInvoice },
            ]
        },
        {
            title: 'DESCUBRIR',
            items: [
                { name: 'Buscar', href: '/buscar', icon: FaSearch },
                { name: 'Populares', href: '/populares', icon: FaFire },
                { name: 'Mapa', href: '/mapa', icon: FaMap }
            ]
        },
        {
            title: 'COMUNIDAD',
            items: [
                { name: 'Usuarios', href: '/usuarios', icon: FaUsers },
                { name: 'Agentes', href: '/agentes', icon: FaUserFriends }
            ]
        }
    ];

    const getBadgeColor = (color?: string) => {
        switch (color) {
            case 'green': return 'bg-green-500/20 text-green-400 border-green-500/30';
            case 'blue': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            case 'red': return 'bg-red-500/20 text-red-400 border-red-500/30';
            case 'yellow': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            case 'purple': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
            default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
        }
    };

    return (
        <aside
            style={{ width: isCollapsed ? '80px' : '256px' }}
            className="hidden lg:sticky top-[calc(5rem+2px)] lg:flex flex-col h-[calc(100vh-5rem-2px)] bg-slate-900/50 backdrop-blur-xl border-r border-white/10 overflow-hidden shrink-0 z-30 transition-all duration-300"
        >
            {/* Toggle Button */}
            <button
                onClick={() => {
                    toggleSidebar();
                    headerAnalytics.sidebarToggle(!isCollapsed, usuario?.uid);
                }}
                className="absolute right-2 top-20 z-10 w-6 h-6 bg-slate-800 hover:bg-slate-700 active:scale-90 rounded-full flex items-center justify-center border border-slate-700 shadow-lg transition-all"
                aria-label={isCollapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
            >
                {isCollapsed ? (
                    <FaChevronRight className="w-3 h-3 text-slate-400" />
                ) : (
                    <FaChevronLeft className="w-3 h-3 text-slate-400" />
                )}
            </button>

            {/* Header con Logo */}
            <div className="p-6 border-b border-white/5">
                {!isCollapsed ? (
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                        Inversiones Pro
                    </h1>
                ) : (
                    <div className="text-3xl text-center">
                        💰
                    </div>
                )}
            </div>

            {/* User Context Card */}
            {!isCollapsed && usuario && (
                <div className="px-4 pt-4">
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 border border-slate-700/50">
                        {/* User Info */}
                        <div className="flex items-center gap-3 mb-3">
                            <div className="relative">
                                {usuario.photoURL ? (
                                    <img
                                        src={usuario.photoURL}
                                        alt={usuario.displayName || 'Usuario'}
                                        className="w-12 h-12 rounded-full object-cover ring-2 ring-blue-500/30"
                                    />
                                ) : (
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center ring-2 ring-blue-500/30">
                                        <FaUser className="w-6 h-6 text-white" />
                                    </div>
                                )}
                                {/* Status indicator */}
                                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-slate-900"></div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-white truncate">
                                    {usuario.displayName || 'Usuario'}
                                </p>
                                <p className="text-xs text-slate-400 truncate">
                                    {usuario.email}
                                </p>
                            </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-slate-800/70 backdrop-blur-sm p-2 rounded-lg border border-slate-700/50">
                                {saldoLoading ? (
                                    <div className="h-4 bg-slate-700 rounded animate-pulse"></div>
                                ) : (
                                    <>
                                        <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Saldo</p>
                                        <p className="text-sm font-bold text-green-400">{formattedSaldo}</p>
                                    </>
                                )}
                            </div>
                            <div className="bg-slate-800/70 backdrop-blur-sm p-2 rounded-lg border border-slate-700/50">
                                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">ROI</p>
                                <p className="text-sm font-bold text-blue-400">+{roi}%</p>
                            </div>
                        </div>

                        {/* Progress Bar (gamificación) */}
                        <div className="mt-3 pt-3 border-t border-slate-700/50">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[10px] text-slate-400 uppercase tracking-wider">Perfil</span>
                                <span className="text-xs font-semibold text-blue-400">75%</span>
                            </div>
                            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                <div
                                    style={{ width: '75%' }}
                                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-1000"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CTA Section */}
            <div className="px-4 py-4">
                {!isCollapsed ? (
                    <div className="space-y-2">
                        <button
                            onClick={() => {
                                router.push('/productos/nuevo');
                                headerAnalytics.ctaNuevoProyectoClicked(usuario?.uid);
                            }}
                            className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl font-semibold text-white shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
                        >
                            <FaPlus className="w-4 h-4" />
                            <span>Nuevo Proyecto</span>
                        </button>

                        <button
                            onClick={() => {
                                router.push('/populares');
                                headerAnalytics.ctaInvertirClicked(usuario?.uid);
                            }}
                            className="w-full py-2 px-4 bg-slate-800 hover:bg-slate-700 active:scale-[0.98] rounded-xl text-sm font-medium text-white flex items-center justify-center gap-2 transition-all"
                        >
                            <FaChartLine className="w-3.5 h-3.5" />
                            <span>Invertir Ahora</span>
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => router.push('/productos/nuevo')}
                        className="w-full aspect-square bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg hover:scale-110 active:scale-90 transition-transform"
                        title="Nuevo Proyecto"
                    >
                        <FaPlus className="w-6 h-6 text-white" />
                    </button>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 space-y-6 overflow-y-auto scrollbar-hide">
                {navigationGroups.map((group, groupIndex) => (
                    <div key={group.title}>
                        {!isCollapsed && (
                            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-2">
                                {group.title}
                            </h3>
                        )}

                        <div className="space-y-1">
                            {group.items.map((item, itemIndex) => {
                                const Icon = item.icon;
                                const isActive = pathname === item.href;

                                return (
                                    <div key={item.name}>
                                        <Link
                                            href={item.href}
                                            prefetch={false}
                                            onClick={() => headerAnalytics.sidebarNavClick(item.name, usuario?.uid)}
                                            className={`
                                                flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative
                                                ${isCollapsed ? 'justify-center' : ''}
                                                ${isActive
                                                    ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-400 border border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.2)]'
                                                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50 hover:shadow-lg hover:translate-x-1'
                                                }
                                            `}
                                            title={isCollapsed ? item.name : ''}
                                        >
                                            <Icon className={`w-5 h-5 ${isActive ? '' : 'group-hover:scale-110 transition-transform'}`} />

                                            {!isCollapsed && (
                                                <>
                                                    <span className="font-medium flex-1">
                                                        {item.name}
                                                    </span>

                                                    {item.badge && (
                                                        <span
                                                            className={`
                                                                text-[10px] font-bold px-2 py-0.5 rounded-full border
                                                                ${getBadgeColor(item.badgeColor)}
                                                            `}
                                                        >
                                                            {item.badge}
                                                        </span>
                                                    )}
                                                </>
                                            )}

                                            {/* Badge indicator for collapsed mode */}
                                            {isCollapsed && item.badge && (
                                                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-900" />
                                            )}
                                        </Link>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-white/5 space-y-2">
                {!isCollapsed ? (
                    <div className="space-y-2">
                        {/* Help Link */}
                        <Link
                            href="/soporte"
                            prefetch={false}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors"
                        >
                            <FaQuestionCircle className="w-4 h-4" />
                            <span>Centro de Ayuda</span>
                        </Link>

                        {/* Status */}
                        <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            <span>Sistemas operando</span>
                        </div>

                        {/* Version & Copyright */}
                        <div className="px-3 py-1 text-[10px] text-slate-600 flex items-center justify-between">
                            <span>v2.0.0</span>
                            <span>© 2026</span>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-3">
                        <button
                            onClick={() => router.push('/soporte')}
                            className="text-slate-400 hover:text-white hover:scale-110 active:scale-90 transition-all"
                            title="Centro de Ayuda"
                        >
                            <FaQuestionCircle className="w-5 h-5" />
                        </button>

                        <div
                            className="w-2 h-2 bg-green-500 rounded-full animate-pulse"
                            title="Sistemas operando"
                        />
                    </div>
                )}
            </div>
        </aside>
    );
}

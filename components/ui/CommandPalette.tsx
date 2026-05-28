'use client';

import { useState, useEffect } from 'react';
import { Command } from 'cmdk';
import { useRouter } from 'next/navigation';
import { FaHome, FaChartLine, FaWallet, FaUser, FaCog, FaSearch, FaPlus, FaSignOutAlt } from 'react-icons/fa';
import useAutenticacion from '@/Hooks/useAutenticacion';

interface CommandAction {
    icon: React.ReactNode;
    label: string;
    action: () => void;
    keywords?: string[];
    category: string;
}

export default function CommandPalette() {
    const [open, setOpen] = useState(false);
    const router = useRouter();
    const { usuario, cerrarSesion } = useAutenticacion();

    // Abrir con Cmd+K o Ctrl+K
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((open) => !open);
            }
        };

        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, []);

    const commands: CommandAction[] = [
        // Navegación
        {
            icon: <FaHome className="w-4 h-4" />,
            label: 'Ir a Inicio',
            action: () => {
                router.push('/');
                setOpen(false);
            },
            keywords: ['home', 'inicio', 'principal'],
            category: 'Navegación'
        },
        {
            icon: <FaChartLine className="w-4 h-4" />,
            label: 'Mis Inversiones',
            action: () => {
                router.push('/mis-inversiones');
                setOpen(false);
            },
            keywords: ['inversiones', 'portfolio', 'proyectos'],
            category: 'Navegación'
        },
        {
            icon: <FaWallet className="w-4 h-4" />,
            label: 'Mi Billetera',
            action: () => {
                router.push('/billetera');
                setOpen(false);
            },
            keywords: ['billetera', 'saldo', 'dinero', 'wallet'],
            category: 'Navegación'
        },
        {
            icon: <FaUser className="w-4 h-4" />,
            label: 'Mi Perfil',
            action: () => {
                router.push('/perfil');
                setOpen(false);
            },
            keywords: ['perfil', 'cuenta', 'usuario', 'profile'],
            category: 'Navegación'
        },
        {
            icon: <FaCog className="w-4 h-4" />,
            label: 'Configuración',
            action: () => {
                router.push('/configuracion');
                setOpen(false);
            },
            keywords: ['configuracion', 'ajustes', 'settings'],
            category: 'Navegación'
        },
        {
            icon: <FaSearch className="w-4 h-4" />,
            label: 'Buscar Productos',
            action: () => {
                router.push('/buscar');
                setOpen(false);
            },
            keywords: ['buscar', 'search', 'productos', 'proyectos'],
            category: 'Navegación'
        },
        // Acciones
        {
            icon: <FaPlus className="w-4 h-4 text-green-400" />,
            label: 'Recargar Saldo',
            action: () => {
                router.push('/recargarBilletera');
                setOpen(false);
            },
            keywords: ['recargar', 'añadir', 'depositar', 'agregar'],
            category: 'Acciones'
        },
        {
            icon: <FaPlus className="w-4 h-4 text-red-400" />,
            label: 'Retirar Fondos',
            action: () => {
                router.push('/retirarBilletera');
                setOpen(false);
            },
            keywords: ['retirar', 'sacar', 'withdraw'],
            category: 'Acciones'
        },
        {
            icon: <FaPlus className="w-4 h-4 text-blue-400" />,
            label: 'Nuevo Producto',
            action: () => {
                router.push('/productos/nuevo');
                setOpen(false);
            },
            keywords: ['nuevo', 'crear', 'producto', 'proyecto'],
            category: 'Acciones'
        }
    ];

    // Agregar cerrar sesión si hay usuario
    if (usuario) {
        commands.push({
            icon: <FaSignOutAlt className="w-4 h-4 text-red-400" />,
            label: 'Cerrar Sesión',
            action: async () => {
                await cerrarSesion();
                router.push('/Login');
                setOpen(false);
            },
            keywords: ['cerrar', 'salir', 'logout', 'exit'],
            category: 'Cuenta'
        });
    }

    // Agrupar por categoría
    const categories = Array.from(new Set(commands.map(cmd => cmd.category)));

    return (
        <Command.Dialog 
            open={open} 
            onOpenChange={setOpen}
            className="fixed top-[20%] left-1/2 -translate-x-1/2 z-[100] w-full max-w-2xl"
        >
            <div className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden">
                {/* Input */}
                <div className="border-b border-slate-700 p-4">
                    <Command.Input 
                        placeholder="Buscar acciones... (Presiona ESC para cerrar)"
                        className="w-full bg-transparent text-white placeholder-slate-400 outline-none text-lg"
                    />
                </div>

                {/* Lista de comandos */}
                <Command.List className="max-h-96 overflow-y-auto p-2">
                    <Command.Empty className="p-8 text-center text-slate-400">
                        <p className="text-sm">No se encontraron resultados</p>
                        <p className="text-xs mt-1">Intenta con otro término</p>
                    </Command.Empty>

                    {categories.map(category => (
                        <Command.Group 
                            key={category} 
                            heading={category}
                            className="mb-4"
                        >
                            <div className="text-xs font-semibold text-slate-500 px-3 py-2 uppercase tracking-wider">
                                {category}
                            </div>
                            {commands
                                .filter(cmd => cmd.category === category)
                                .map((cmd, idx) => (
                                    <Command.Item
                                        key={`${category}-${idx}`}
                                        onSelect={cmd.action}
                                        className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-slate-700/50 cursor-pointer transition-colors group mb-1"
                                    >
                                        <div className="text-slate-400 group-hover:text-white transition-colors">
                                            {cmd.icon}
                                        </div>
                                        <span className="text-sm text-white flex-1">{cmd.label}</span>
                                        <kbd className="hidden group-hover:block text-xs bg-slate-700 px-2 py-1 rounded text-slate-400">
                                            Enter
                                        </kbd>
                                    </Command.Item>
                                ))}
                        </Command.Group>
                    ))}
                </Command.List>

                {/* Footer con ayuda */}
                <div className="border-t border-slate-700 p-3 bg-slate-900/50">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                        <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1">
                                <kbd className="bg-slate-700 px-1.5 py-0.5 rounded">↑↓</kbd>
                                Navegar
                            </span>
                            <span className="flex items-center gap-1">
                                <kbd className="bg-slate-700 px-1.5 py-0.5 rounded">Enter</kbd>
                                Seleccionar
                            </span>
                            <span className="flex items-center gap-1">
                                <kbd className="bg-slate-700 px-1.5 py-0.5 rounded">ESC</kbd>
                                Cerrar
                            </span>
                        </div>
                        <span className="text-slate-600">
                            <kbd className="bg-slate-700 px-1.5 py-0.5 rounded">⌘K</kbd> o <kbd className="bg-slate-700 px-1.5 py-0.5 rounded">Ctrl+K</kbd>
                        </span>
                    </div>
                </div>
            </div>
        </Command.Dialog>
    );
}

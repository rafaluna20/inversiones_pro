'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FaHome, FaFire, FaSearch, FaWallet } from 'react-icons/fa';

export default function BottomNav() {
    const pathname = usePathname();

    const navigation = [
        { name: 'Inicio', href: '/', icon: FaHome },
        { name: 'Populares', href: '/populares', icon: FaFire },
        { name: 'Buscar', href: '/buscar', icon: FaSearch },
        { name: 'Billetera', href: '/billetera', icon: FaWallet },
    ];

    return (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-xl border-t border-white/10">
            <div className="flex items-center justify-around px-4 py-3">
                {navigation.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;

                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-300 ${isActive
                                    ? 'text-blue-400'
                                    : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            <Icon className="w-6 h-6" />
                            <span className="text-xs font-medium">{item.name}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}

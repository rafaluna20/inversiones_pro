'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import BottomNav from './BottomNav';
import CategorySlider from '../ui/CategorySlider';
import { SidebarProvider, useSidebar } from '@/context/SidebarContext';

interface AppLayoutProps {
    children: ReactNode;
}

function AppLayoutContent({ children }: AppLayoutProps) {
    const pathname = usePathname();
    const { isCollapsed } = useSidebar();

    // Mostrar CategorySlider solo en la home page
    const showCategorySlider = pathname === '/';

    return (
        <div className="flex flex-col min-h-screen bg-slate-950 lg:gap-6">
            {/* TopBar primero - ANCHO 100% */}
            <TopBar />

            {/* Separación de 2px */}
            <div className="h-0.5" />

            {/* Debajo: Sidebar + Content con padding para TopBar */}
            <div className="flex flex-1 pt-[calc(5rem+2px)]">
                {/* Spacer invisible para crear espacio del sidebar en el layout flow */}
                {/* Spacer removed as Sidebar is now sticky key='sidebar-spacer' */}

                {/* Sidebar fijo que se posiciona encima del spacer */}
                <Sidebar />

                {/* Gap de 5px */}
                <div className="hidden lg:block w-[5px] shrink-0" />

                <main className="flex-1 flex flex-col min-w-0">
                    {showCategorySlider && <CategorySlider />}
                    <div className="flex-1 p-4 lg:p-8 overflow-x-hidden">
                        {children}
                    </div>
                </main>
            </div>

            <BottomNav />
        </div>
    );
}

export default function AppLayout({ children }: AppLayoutProps) {
    return (
        <SidebarProvider>
            <AppLayoutContent>{children}</AppLayoutContent>
        </SidebarProvider>
    );
}

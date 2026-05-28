// Sistema de Analytics para tracking de interacciones del header

interface AnalyticsEvent {
    event: string;
    component: string;
    timestamp: string;
    userId?: string;
    metadata?: Record<string, any>;
}

class HeaderAnalytics {
    private events: AnalyticsEvent[] = [];
    private maxEvents = 100; // Guardar últimos 100 eventos en memoria

    private logEvent(eventName: string, metadata?: Record<string, any>, userId?: string) {
        const event: AnalyticsEvent = {
            event: eventName,
            component: 'header',
            timestamp: new Date().toISOString(),
            userId,
            metadata
        };

        // Guardar en memoria
        this.events.push(event);
        if (this.events.length > this.maxEvents) {
            this.events.shift();
        }

        // Log en consola (desarrollo)
        if (process.env.NODE_ENV === 'development') {
            console.log('📊 Analytics:', eventName, metadata);
        }

        // Aquí se podría enviar a Firebase Analytics, Google Analytics, etc.
        // Ejemplo con Firebase:
        // import { logEvent as firebaseLogEvent, analytics } from '@/lib/firebase/config';
        // if (typeof window !== 'undefined' && analytics) {
        //     firebaseLogEvent(analytics, eventName, event);
        // }
    }

    // Eventos de búsqueda
    searchPerformed(query: string, userId?: string) {
        this.logEvent('header_search_performed', {
            query,
            queryLength: query.length
        }, userId);
    }

    searchCleared(userId?: string) {
        this.logEvent('header_search_cleared', {}, userId);
    }

    // Eventos de notificaciones
    notificationsOpened(unreadCount: number, userId?: string) {
        this.logEvent('header_notifications_opened', {
            unreadCount
        }, userId);
    }

    notificationClicked(notificationId: string, type: string, userId?: string) {
        this.logEvent('header_notification_clicked', {
            notificationId,
            type
        }, userId);
    }

    allNotificationsMarkedRead(count: number, userId?: string) {
        this.logEvent('header_notifications_marked_all_read', {
            count
        }, userId);
    }

    // Eventos de menú de usuario
    userMenuOpened(userId?: string) {
        this.logEvent('header_user_menu_opened', {}, userId);
    }

    userMenuOptionClicked(option: string, userId?: string) {
        this.logEvent('header_user_menu_option_clicked', {
            option
        }, userId);
    }

    // Eventos de saldo
    saldoBadgeClicked(saldo: number, userId?: string) {
        this.logEvent('header_saldo_badge_clicked', {
            saldo
        }, userId);
    }

    recargarSaldoClicked(currentSaldo: number, userId?: string) {
        this.logEvent('header_recargar_clicked', {
            currentSaldo
        }, userId);
    }

    retirarSaldoClicked(currentSaldo: number, userId?: string) {
        this.logEvent('header_retirar_clicked', {
            currentSaldo
        }, userId);
    }

    // Eventos de Command Palette
    commandPaletteOpened(userId?: string) {
        this.logEvent('header_command_palette_opened', {}, userId);
    }

    commandExecuted(command: string, userId?: string) {
        this.logEvent('header_command_executed', {
            command
        }, userId);
    }

    // Eventos de sesión
    logoutClicked(userId?: string) {
        this.logEvent('header_logout_clicked', {}, userId);
    }

    loginClicked() {
        this.logEvent('header_login_clicked', {});
    }

    signupClicked() {
        this.logEvent('header_signup_clicked', {});
    }

    // Utilidades
    getRecentEvents(limit: number = 10): AnalyticsEvent[] {
        return this.events.slice(-limit);
    }

    getEventsByType(eventName: string): AnalyticsEvent[] {
        return this.events.filter(e => e.event === eventName);
    }

    clearEvents() {
        this.events = [];
    }

    // Estadísticas rápidas
    getStats() {
        const eventCounts: Record<string, number> = {};
        this.events.forEach(event => {
            eventCounts[event.event] = (eventCounts[event.event] || 0) + 1;
        });

        return {
            totalEvents: this.events.length,
            eventCounts,
            mostFrequent: Object.entries(eventCounts)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
        };
    }

    // Eventos del Sidebar
    sidebarToggle(collapsed: boolean, userId?: string) {
        this.logEvent('sidebar_toggle', { collapsed }, userId);
    }

    sidebarNavClick(itemName: string, userId?: string) {
        this.logEvent('sidebar_nav_click', { item: itemName }, userId);
    }

    ctaNuevoProyectoClicked(userId?: string) {
        this.logEvent('cta_nuevo_proyecto', {}, userId);
    }

    ctaInvertirClicked(userId?: string) {
        this.logEvent('cta_invertir', {}, userId);
    }

    // Eventos de ProductCard
    productLiked(productId: string, userId?: string) {
        this.logEvent('product_liked', { product_id: productId }, userId);
    }

    productUnliked(productId: string, userId?: string) {
        this.logEvent('product_unliked', { product_id: productId }, userId);
    }

    whatsappClicked(productId: string, userId?: string) {
        this.logEvent('whatsapp_clicked', { product_id: productId }, userId);
    }

    mapOpened(productId: string, userId?: string) {
        this.logEvent('map_opened', { product_id: productId }, userId);
    }

    productImageChanged(productId: string, imageIndex: number, userId?: string) {
        this.logEvent('product_image_changed', { product_id: productId, image_index: imageIndex }, userId);
    }
}

// Singleton instance
export const headerAnalytics = new HeaderAnalytics();

// Export para usar en componentes
export default headerAnalytics;

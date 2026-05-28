'use client';

import { useState, useEffect, useMemo } from 'react';

export interface Notification {
    id: string;
    userId: string;
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    actionUrl?: string;
    read: boolean;
    createdAt: Date;
}

// Datos estáticos de notificaciones (simulación hasta tener backend real)
const STATIC_NOTIFICATIONS: Omit<Notification, 'userId'>[] = [
    {
        id: '1',
        type: 'success',
        title: 'Inversión Exitosa',
        message: 'Tu inversión de S/ 5,000 en "Proyecto Lima Norte" ha sido confirmada exitosamente.',
        actionUrl: '/mis-inversiones',
        read: false,
        createdAt: new Date(Date.now() - 5 * 60 * 1000) // Hace 5 minutos
    },
    {
        id: '2',
        type: 'info',
        title: 'Nueva Oportunidad de Inversión',
        message: 'Hay un nuevo proyecto disponible en San Isidro con retorno estimado del 15% anual.',
        actionUrl: '/productos/nuevo-proyecto-123',
        read: false,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) // Hace 2 horas
    },
    {
        id: '3',
        type: 'success',
        title: 'Pago Recibido',
        message: 'Has recibido un pago de S/ 1,200 por rendimientos de tu inversión en "Proyecto Miraflores".',
        actionUrl: '/billetera',
        read: false,
        createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000) // Hace 6 horas
    },
    {
        id: '4',
        type: 'warning',
        title: 'Actualización de Perfil Requerida',
        message: 'Por favor actualiza tu información de contacto para seguir recibiendo notificaciones importantes.',
        actionUrl: '/perfil',
        read: true,
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // Hace 1 día
    },
    {
        id: '5',
        type: 'info',
        title: 'Reporte Mensual Disponible',
        message: 'Tu reporte de inversiones de enero ya está disponible para descargar.',
        actionUrl: '/reportes',
        read: true,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // Hace 2 días
    },
    {
        id: '6',
        type: 'success',
        title: 'Verificación Completada',
        message: 'Tu cuenta ha sido verificada exitosamente. Ya puedes invertir sin límites.',
        actionUrl: '/perfil',
        read: true,
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Hace 1 semana
    }
];

interface UseNotificationsReturn {
    notifications: Notification[];
    loading: boolean;
    error: Error | null;
    unreadCount: number;
    markAsRead: (notificationId: string) => void;
    markAllAsRead: () => void;
    refetch: () => void;
}

export function useNotifications(userId: string | null): UseNotificationsReturn {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    // Cargar notificaciones (simula una llamada async)
    useEffect(() => {
        if (!userId) {
            setNotifications([]);
            setLoading(false);
            return;
        }

        setLoading(true);

        // Simular delay de red
        const timeout = setTimeout(() => {
            try {
                // Agregar userId a las notificaciones estáticas
                const userNotifications = STATIC_NOTIFICATIONS.map(notif => ({
                    ...notif,
                    userId
                }));

                setNotifications(userNotifications);
                setError(null);
            } catch (err) {
                setError(err as Error);
            } finally {
                setLoading(false);
            }
        }, 500);

        return () => clearTimeout(timeout);
    }, [userId]);

    // Contador de no leídas (memoizado)
    const unreadCount = useMemo(
        () => notifications.filter(n => !n.read).length,
        [notifications]
    );

    // Marcar notificación como leída
    const markAsRead = (notificationId: string) => {
        setNotifications(prev =>
            prev.map(notif =>
                notif.id === notificationId ? { ...notif, read: true } : notif
            )
        );

        // Simular actualización en backend
        if (process.env.NODE_ENV === 'development') {
            console.log('📧 Notificación marcada como leída:', notificationId);
        }
    };

    // Marcar todas como leídas
    const markAllAsRead = () => {
        setNotifications(prev =>
            prev.map(notif => ({ ...notif, read: true }))
        );

        // Simular actualización en backend
        if (process.env.NODE_ENV === 'development') {
            console.log('📧 Todas las notificaciones marcadas como leídas');
        }
    };

    // Refetch (para cuando se implemente el backend real)
    const refetch = () => {
        if (userId) {
            setLoading(true);
            setTimeout(() => {
                setLoading(false);
            }, 300);
        }
    };

    return {
        notifications,
        loading,
        error,
        unreadCount,
        markAsRead,
        markAllAsRead,
        refetch
    };
}

// Helper para formatear tiempo relativo
export function getRelativeTime(date: Date): string {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
        return 'Hace unos segundos';
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
        return `Hace ${diffInMinutes} ${diffInMinutes === 1 ? 'minuto' : 'minutos'}`;
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
        return `Hace ${diffInHours} ${diffInHours === 1 ? 'hora' : 'horas'}`;
    }

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
        return `Hace ${diffInDays} ${diffInDays === 1 ? 'día' : 'días'}`;
    }

    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) {
        return `Hace ${diffInWeeks} ${diffInWeeks === 1 ? 'semana' : 'semanas'}`;
    }

    return date.toLocaleDateString('es-PE');
}

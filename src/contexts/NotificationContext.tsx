import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { toast } from "sonner";
import { useWebSocket } from "./WebSocketContext";
import { apiClient } from "@/lib/api-client";

export interface Notification {
    id: string;
    type: string;
    title: string;
    message: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
    timestamp: Date;
    read: boolean;
    data?: unknown;
}

interface NotificationApiItem {
    id: string;
    type: string;
    title: string;
    message: string;
    priority?: string;
    createdAt: string;
    isRead: boolean;
    data?: unknown;
}

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    addNotification: (notification: Omit<Notification, "id" | "timestamp" | "read">) => void;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
    clearNotifications: () => void;
    fetchNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const { socket } = useWebSocket();

    const fetchNotifications = async () => {
        try {
            const { data } = await apiClient.get<{ notifications: NotificationApiItem[]; unreadCount: number }>(
                '/api/notifications', { take: 50 }
            );
            setNotifications(data.notifications.map((n) => ({
                ...n,
                timestamp: new Date(n.createdAt),
                read: n.isRead,
                priority: (n.priority as Notification['priority']) || 'INFO',
            })));
            setUnreadCount(data.unreadCount);
        } catch {
            // Silently ignore — notifications are non-critical; will retry on next mount
        }
    };

    useEffect(() => {
        fetchNotifications();
    }, []);

    useEffect(() => {
        if (!socket) return;

        const handleNotification = (notification: NotificationApiItem) => {
            const newNotif: Notification = {
                ...notification,
                timestamp: new Date(notification.createdAt),
                read: notification.isRead,
                priority: (notification.priority as Notification['priority']) || 'INFO',
            };

            setNotifications((prev) => [newNotif, ...prev]);
            setUnreadCount((prev) => prev + 1);

            toast.info(notification.title, {
                description: notification.message,
            });
        };

        // Gamification: badge earned notification
        const handleBadgeEarned = (data: { badge: { name: string; tier: string; icon: string }; message: string }) => {
            toast.success(`Badge Earned: ${data.badge.name}`, {
                description: data.message,
                duration: 8000,
            });
        };

        // Gamification: zen points update notification
        const handleZenPointsUpdate = (data: { points: number; earned: number; action: string; level: { name: string }; streak: number }) => {
            toast.info(`+${data.earned} Zen Points`, {
                description: `Total: ${data.points} | Level: ${data.level.name}${data.streak >= 7 ? ` | Streak: ${data.streak}d` : ''}`,
                duration: 4000,
            });
        };

        socket.on('notification', handleNotification);
        socket.on('badge_earned', handleBadgeEarned);
        socket.on('zen_points_update', handleZenPointsUpdate);
        return () => {
            socket.off('notification', handleNotification);
            socket.off('badge_earned', handleBadgeEarned);
            socket.off('zen_points_update', handleZenPointsUpdate);
        };
    }, [socket]);

    const addNotification = (notification: Omit<Notification, "id" | "timestamp" | "read">) => {
        const newNotification: Notification = {
            ...notification,
            id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date(),
            read: false,
        };

        setNotifications((prev) => [newNotification, ...prev]);
        setUnreadCount((prev) => prev + 1);

        toast.info(notification.title, { description: notification.message });
    };

    const markAsRead = async (id: string) => {
        try {
            await apiClient.put(`/api/notifications/${id}/read`, {});
            setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
            setUnreadCount((prev) => Math.max(0, prev - 1));
        } catch {
            // Best-effort: update UI state anyway
            setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
            setUnreadCount((prev) => Math.max(0, prev - 1));
        }
    };

    const markAllAsRead = async () => {
        try {
            await apiClient.put('/api/notifications/read-all', {});
        } catch {
            // Best-effort
        }
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
    };

    const clearNotifications = () => {
        setNotifications([]);
        setUnreadCount(0);
    };

    return (
        <NotificationContext.Provider
            value={{
                notifications,
                unreadCount,
                addNotification,
                markAsRead,
                markAllAsRead,
                clearNotifications,
                fetchNotifications,
            }}
        >
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotifications() {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error("useNotifications must be used within NotificationProvider");
    }
    return context;
}

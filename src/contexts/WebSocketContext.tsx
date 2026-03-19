import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/hooks/useAuth';

interface WebSocketContextType {
    socket: Socket | null;
    isConnected: boolean;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export function WebSocketProvider({ children }: { children: ReactNode }) {
    // socket is also tracked in state so consumers re-render when it first becomes available
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    // socketRef holds the canonical singleton — never re-created just because of a
    // React render; only replaced when the authenticated user identity changes.
    const socketRef = useRef<Socket | null>(null);

    const { user } = useAuth();

    // Use the primitive user ID as the effect dependency, NOT the user object.
    // useAuth rebuilds the user object on every fetchProfile call (setUser({...})),
    // so depending on [user] would trigger a disconnect/reconnect on every profile
    // refresh.  Depending on [userId] instead means the effect only re-runs when
    // the logged-in identity actually changes (login → logout, or account switch).
    const userId = user?.id ?? null;

    useEffect(() => {
        const token = localStorage.getItem('accessToken');

        // ── Logout / no auth — tear down if a socket exists ──────────────────
        if (!token || !userId) {
            if (socketRef.current) {
                socketRef.current.removeAllListeners();
                socketRef.current.disconnect();
                socketRef.current = null;
                setSocket(null);
                setIsConnected(false);
            }
            return;
        }

        // ── Same user, socket already initialised — guard against double init ─
        // This handles: strict-mode double-invoke, refreshProfile, minor re-renders.
        if (socketRef.current) {
            // Keep the auth token current (defensive: token may have refreshed)
            (socketRef.current.auth as { token: string }).token =
                localStorage.getItem('accessToken') ?? token;

            // If the socket was disconnected (e.g. server restart while the user
            // was still logged in), kick off a reconnect without creating a new instance.
            if (!socketRef.current.connected) {
                socketRef.current.connect();
            }
            return;
        }

        // ── First connection for this user — create the singleton ─────────────

        const sock = io(API_BASE_URL, {
            auth: { token },
            transports: ['websocket', 'polling'],
            reconnection: true,
            // Infinite retries — the socket should keep trying as long as the user
            // is authenticated.  The connection is torn down explicitly on logout.
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 10000,
        });

        sock.on('connect', () => {
            setIsConnected(true);
        });

        sock.on('disconnect', () => {
            setIsConnected(false);
        });

        // Refresh the JWT on every reconnect attempt so a stale token does not
        // permanently block re-authentication after a brief server outage.
        sock.on('reconnect_attempt', () => {
            const latestToken = localStorage.getItem('accessToken');
            if (latestToken) sock.auth = { token: latestToken };
        });

        sock.on('reconnect', () => {
            setIsConnected(true);
        });

        sock.on('connect_error', async (err) => {
            setIsConnected(false);
            // M-1: If the error is JWT-related, silently refresh the access token
            //      and reconnect so users are not dropped mid-session.
            if (err.message.includes('Authentication error') || err.message.includes('jwt expired')) {
                const refreshToken = localStorage.getItem('refreshToken');
                if (refreshToken) {
                    try {
                        const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ refreshToken }),
                        });
                        if (res.ok) {
                            const data = await res.json();
                            localStorage.setItem('accessToken', data.accessToken);
                            if (socketRef.current) {
                                (socketRef.current.auth as { token: string }).token = data.accessToken;
                                socketRef.current.connect();
                            }
                        }
                    } catch { /* ignore refresh failure — socket will retry via its own backoff */ }
                }
            }
        });

        socketRef.current = sock;
        setSocket(sock);

        // ── Cleanup — only runs when userId changes (login ↔ logout) ──────────
        // Route navigation never reaches this because userId stays stable.
        // The socket is NOT closed on unmount of individual pages; it lives for
        // the lifetime of the authenticated session.
        return () => {
            if (socketRef.current) {
                socketRef.current.removeAllListeners();
                socketRef.current.disconnect();
                socketRef.current = null;
                setSocket(null);
                setIsConnected(false);
            }
        };
    }, [userId]); // ← primitive string: stable across renders, changes only on login/logout

    return (
        <WebSocketContext.Provider value={{ socket, isConnected }}>
            {children}
        </WebSocketContext.Provider>
    );
}

export function useWebSocket() {
    const context = useContext(WebSocketContext);
    if (context === undefined) {
        throw new Error('useWebSocket must be used within WebSocketProvider');
    }
    return context;
}

import { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNotifications } from '@/contexts/NotificationContext';
import { NotificationPanel } from '@/components/notifications/NotificationPanel';
import { cn } from '@/lib/utils';

export function NotificationBell() {
    const [isOpen, setIsOpen] = useState(false);
    const { unreadCount, notifications } = useNotifications();
    const bellRef = useRef<HTMLDivElement>(null);

    const hasHighPriority = notifications.some(n => !n.read && n.priority === 'HIGH');

    // Only ring + ripple while there are unseen notifications AND the panel
    // is closed. Once the user opens the panel they've acknowledged the
    // signal, so the animations go quiet.
    const isRinging = unreadCount > 0 && !isOpen;

    // Close panel when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (bellRef.current && !bellRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div className="relative" ref={bellRef}>
            <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    'relative transition-all duration-300',
                    isOpen && 'bg-accent',
                    hasHighPriority && unreadCount > 0 && 'text-destructive'
                )}
            >
                {/* Animated bell wrapper — fixed 36x36 box so the swinging
                    rotation and the ripple rings have a stable container
                    that doesn't cause any layout shift in the navbar. */}
                <span
                    style={{
                        position: 'relative',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 36,
                        height: 36,
                    }}
                >
                    {/* Ripple ring 1 */}
                    {isRinging && (
                        <span
                            aria-hidden="true"
                            style={{
                                position: 'absolute',
                                inset: 0,
                                borderRadius: '50%',
                                border: '1.5px solid #EF4444',
                                animation: 'bellRipple 1.6s ease-out infinite',
                                pointerEvents: 'none',
                            }}
                        />
                    )}
                    {/* Ripple ring 2 — offset by 0.55s so the rings alternate */}
                    {isRinging && (
                        <span
                            aria-hidden="true"
                            style={{
                                position: 'absolute',
                                inset: 0,
                                borderRadius: '50%',
                                border: '1.5px solid #EF4444',
                                animation: 'bellRipple 1.6s 0.55s ease-out infinite',
                                pointerEvents: 'none',
                            }}
                        />
                    )}

                    {/* Bell icon — swings when ringing. We keep the existing
                        fill-destructive/10 class for high-priority unread but
                        drop animate-pulse since the swing replaces it. */}
                    <Bell
                        className={cn(
                            'h-5 w-5',
                            hasHighPriority && unreadCount > 0 && 'fill-destructive/10',
                        )}
                        style={{
                            color: unreadCount > 0 ? '#EF4444' : undefined,
                            animation: isRinging ? 'bellSwing 1.4s ease-in-out infinite' : 'none',
                            transformOrigin: 'top center',
                            display: 'block',
                        }}
                    />

                    {/* Subtle breathing dot — sits on top of the bell, sized
                        small so it complements the numeric badge rather than
                        replacing it. Aria-hidden because the numeric badge
                        already announces the unread count to screen readers. */}
                    {isRinging && (
                        <span
                            aria-hidden="true"
                            style={{
                                position: 'absolute',
                                top: 6,
                                right: 6,
                                width: 8,
                                height: 8,
                                background: '#EF4444',
                                borderRadius: '50%',
                                border: '1.5px solid hsl(var(--background))',
                                animation: 'dotBreathe 1.4s ease-in-out infinite',
                                pointerEvents: 'none',
                                boxSizing: 'border-box',
                            }}
                        />
                    )}
                </span>

                {/* Existing numeric badge — kept verbatim so the visible
                    count (1, 2, … 9+) is unchanged. */}
                {unreadCount > 0 && (
                    <Badge
                        variant={hasHighPriority ? 'destructive' : 'default'}
                        className={cn(
                            'absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px] font-bold ring-2 ring-background',
                            hasHighPriority && 'bg-destructive animate-bounce'
                        )}
                    >
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </Badge>
                )}
            </Button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 z-50 animate-in fade-in zoom-in duration-200 origin-top-right">
                    <NotificationPanel onClose={() => setIsOpen(false)} />
                </div>
            )}
        </div>
    );
}

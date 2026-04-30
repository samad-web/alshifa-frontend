import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { useAuth } from "@/hooks/useAuth";
import {
    User,
    Search,
    MoreVertical,
    ChevronLeft,
    Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { AppLayout } from "@/components/layout/app-layout";
import { apiClient } from "@/lib/api-client";
import { MessagesTabs } from "@/components/chat/MessagesTabs";

interface Message {
    id: string;
    conversationId: string;
    content: string;
    senderId: string;
    createdAt: string;
    sender: {
        role: string;
        doctor?: { fullName: string };
        patient?: { fullName: string };
        therapist?: { fullName: string };
        pharmacist?: { fullName: string };
    };
}

interface ConversationUpdate {
    conversationId: string;
    lastMessage: Message;
}

interface Conversation {
    id: string;
    patient: { fullName: string; userId: string };
    doctor?: { fullName: string; userId: string; profilePhoto?: string };
    therapist?: { fullName: string; userId: string; profilePhoto?: string };
    pharmacist?: { fullName: string; userId: string; profilePhoto?: string };
    messages: Message[];
}

interface ConsultationDoctor {
    id: string;
    name: string | null;
    specialization: string | null;
    profilePhoto: string | null;
}

export default function Chat() {
    const { t } = useTranslation();
    const { isConnected, socket } = useWebSocket();
    const { role } = useAuth();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
    const [loading, setLoading] = useState(true);
    // Patient-only: the assigned consultation doctor (if any) drives the
    // entire chat experience for patients — no conversation picker, just
    // a single thread with this doctor.
    const [consultationDoctor, setConsultationDoctor] = useState<ConsultationDoctor | null>(null);
    const [doctorResolved, setDoctorResolved] = useState(false);

    useEffect(() => {
        const init = async () => {
            // Patient-specific path: resolve the consultation doctor first;
            // auto-create the conversation; auto-select it. There is no other
            // chat surface for patients — therapists and pharmacists are out
            // of scope per the chat-scoping rule.
            if (role === 'PATIENT') {
                try {
                    const { data } = await apiClient.get<{ doctor: ConsultationDoctor | null }>(
                        '/api/chat/my-doctor',
                    );
                    setConsultationDoctor(data.doctor);
                    if (data.doctor) {
                        // Best-effort ensure the conversation row exists, then
                        // load the (single-row) conversation list and select it.
                        try {
                            await apiClient.post('/api/chat/conversation', { doctorId: data.doctor.id });
                        } catch { /* getOrCreate is idempotent; backend may report it already exists */ }
                        const list = await fetchConversations();
                        if (list && list.length > 0) setSelectedConv(list[0]);
                    } else {
                        setLoading(false);
                    }
                } catch {
                    setLoading(false);
                } finally {
                    setDoctorResolved(true);
                }
                return;
            }

            // Clinician / staff path — existing behaviour preserved.
            const conversations = await fetchConversations();

            const params = new URLSearchParams(window.location.search);
            const partnerId = params.get('partner');

            if (partnerId && conversations) {
                const existing = conversations.find(c =>
                    c.patient.userId === partnerId ||
                    c.doctor?.userId === partnerId ||
                    c.therapist?.userId === partnerId ||
                    c.pharmacist?.userId === partnerId
                );
                if (existing) {
                    setSelectedConv(existing);
                } else {
                    try {
                        const { data: newConv } = await apiClient.post<any>('/api/chat/initiate', { partnerId });
                        {
                            // Refresh conversations and select the new one
                            const updatedList = await fetchConversations();
                            if (updatedList) {
                                const found = updatedList.find(c => c.id === newConv.id);
                                if (found) setSelectedConv(found);
                            }
                        }
                    } catch (err) {
                        console.error("Failed to auto-initiate chat:", err);
                    }
                }
            }
        };
        init();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [role]);

    useEffect(() => {
        if (!socket) return;

        // new_message fires when the user is inside the conversation room (ChatWindow open).
        // conversation_updated fires via the user-room for ALL participants, even when
        // they haven't opened that specific chat — keeps the sidebar preview current.
        const updateConversationPreview = (message: Message) => {
            setConversations((prev) =>
                prev.map((c) =>
                    c.id === message.conversationId ? { ...c, messages: [message] } : c
                ).sort((a, b) => {
                    const dateA = a.messages[0]?.createdAt || '';
                    const dateB = b.messages[0]?.createdAt || '';
                    return dateB.localeCompare(dateA);
                })
            );
        };

        const handleNewMessage = (message: Message) => {
            updateConversationPreview(message);
        };

        const handleConversationUpdated = (update: ConversationUpdate) => {
            updateConversationPreview(update.lastMessage);
        };

        socket.on('new_message', handleNewMessage);
        socket.on('conversation_updated', handleConversationUpdated);

        return () => {
            socket.off('new_message', handleNewMessage);
            socket.off('conversation_updated', handleConversationUpdated);
        };
    }, [socket]);

    const fetchConversations = async () => {
        try {
            const { data } = await apiClient.get<Conversation[]>('/api/chat/conversations');
            setConversations(data);
            return data;
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
        return null;
    };

    const getPartnerName = (conv: Conversation) => {
        if (role === 'PATIENT') {
            return conv.doctor?.fullName || conv.therapist?.fullName || conv.pharmacist?.fullName || "Medical Professional";
        }
        return conv.patient.fullName || "Patient";
    };

    // ── Patient layout: single-thread, banner-led, no provider picker ──────
    if (role === 'PATIENT') {
        return (
            <AppLayout>
                <div className="flex h-[calc(100vh-4rem)] bg-background overflow-hidden">
                    <div className="flex-1 flex flex-col bg-secondary/5 text-foreground">
                        {!doctorResolved || loading ? (
                            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                                Loading your chat…
                            </div>
                        ) : !consultationDoctor ? (
                            <div className="flex-1 flex items-center justify-center p-8 text-center">
                                <div className="space-y-6 max-w-sm">
                                    <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary/5 border border-primary/10">
                                        <Activity className="h-12 w-12 text-primary/40" />
                                    </div>
                                    <div className="space-y-2">
                                        <h2 className="text-xl font-bold">No active consultation yet</h2>
                                        <p className="text-sm text-muted-foreground">
                                            You don't have an active consultation assigned yet. Book an appointment to chat with your doctor.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : selectedConv ? (
                            <ChatWindow
                                conversationId={selectedConv.id}
                                header={
                                    <div className="h-16 border-b bg-card/50 backdrop-blur-md px-4 flex items-center gap-3 z-10 shrink-0">
                                        <Avatar className="h-10 w-10">
                                            {consultationDoctor.profilePhoto && (
                                                <AvatarImage src={consultationDoctor.profilePhoto} />
                                            )}
                                            <AvatarFallback className="bg-primary/5 text-primary"><User /></AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <h2 className="font-bold text-sm leading-tight">
                                                Chat with Dr. {consultationDoctor.name || 'your doctor'}
                                            </h2>
                                            {consultationDoctor.specialization && (
                                                <span className="text-[11px] text-muted-foreground">
                                                    {consultationDoctor.specialization}
                                                </span>
                                            )}
                                        </div>
                                        <span className="ml-auto text-[10px] text-wellness font-bold">
                                            {isConnected ? 'Online' : 'Offline'}
                                        </span>
                                    </div>
                                }
                            />
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                                Setting up your conversation…
                            </div>
                        )}
                    </div>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <MessagesTabs />
            {/* Account for the 44px MessagesTabs strip in the inner height calc
                so the chat layout still fills the viewport without scrolling. */}
            <div className="flex h-[calc(100vh-4rem-44px)] md:h-[calc(100vh-4rem-44px)] bg-background overflow-hidden">
                {/* Sidebar */}
                <div className={cn(
                    "w-full md:w-80 border-r flex flex-col transition-all",
                    selectedConv ? "hidden md:flex" : "flex"
                )}>
                    <div className="p-4 border-b space-y-4">
                        <div className="flex items-center justify-between">
                            <h1 className="text-xl font-bold tracking-tight">{t('chat.title')}</h1>
                            {!isConnected && <span className="text-[10px] text-destructive font-bold animate-pulse uppercase">Offline</span>}
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input className="pl-9 bg-secondary/30 border-none rounded-xl" placeholder="Search chats..." />
                        </div>
                    </div>

                    <ScrollArea className="flex-1">
                        {loading ? (
                            <div className="p-4 text-center text-sm text-muted-foreground">Loading chats...</div>
                        ) : conversations.length === 0 ? (
                            <div className="p-8 text-center text-sm text-muted-foreground italic">No conversations found.</div>
                        ) : (
                            <div className="p-2 space-y-1">
                                {conversations.map((conv) => {
                                    const partnerName = getPartnerName(conv);
                                    const lastMsg = conv.messages[0];
                                    return (
                                        <button
                                            key={conv.id}
                                            onClick={() => setSelectedConv(conv)}
                                            className={cn(
                                                "w-full flex items-center gap-3 p-3 rounded-2xl transition-all",
                                                selectedConv?.id === conv.id
                                                    ? "bg-primary/10 text-primary shadow-sm"
                                                    : "hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                                                {(conv.doctor?.profilePhoto || conv.therapist?.profilePhoto || conv.pharmacist?.profilePhoto) && (
                                                    <AvatarImage src={conv.doctor?.profilePhoto || conv.therapist?.profilePhoto || conv.pharmacist?.profilePhoto} />
                                                )}
                                                <AvatarFallback className="bg-primary/5 text-primary">
                                                    <User className="h-6 w-6" />
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 text-left overflow-hidden">
                                                <div className="flex justify-between items-baseline">
                                                    <span className="font-bold text-sm truncate text-foreground">{partnerName}</span>
                                                    {lastMsg && <span className="text-[10px] opacity-70">{new Date(lastMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                                                </div>
                                                <p className="text-xs truncate opacity-70">
                                                    {lastMsg ? lastMsg.content : "No messages yet"}
                                                </p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </ScrollArea>
                </div>

                {/* Main Chat Area */}
                <div className={cn(
                    "flex-1 flex flex-col bg-secondary/5 transition-all text-foreground",
                    !selectedConv && "hidden md:flex items-center justify-center p-8 text-center"
                )}>
                    {selectedConv ? (
                        <ChatWindow
                            conversationId={selectedConv.id}
                            header={
                                <div className="h-16 border-b bg-card/50 backdrop-blur-md px-4 flex items-center justify-between z-10 shrink-0">
                                    <div className="flex items-center gap-3">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            aria-label="Back to conversations"
                                            className="md:hidden"
                                            onClick={() => setSelectedConv(null)}
                                        >
                                            <ChevronLeft className="h-6 w-6" />
                                        </Button>
                                        <Avatar className="h-10 w-10">
                                            {(selectedConv.doctor?.profilePhoto || selectedConv.therapist?.profilePhoto || selectedConv.pharmacist?.profilePhoto) && (
                                                <AvatarImage src={selectedConv.doctor?.profilePhoto || selectedConv.therapist?.profilePhoto || selectedConv.pharmacist?.profilePhoto} />
                                            )}
                                            <AvatarFallback><User /></AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <h2 className="font-bold text-sm leading-none">{getPartnerName(selectedConv)}</h2>
                                            <span className="text-[10px] text-wellness font-bold">Online</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button variant="ghost" size="icon" aria-label="Conversation menu" className="text-muted-foreground"><MoreVertical className="h-4 w-4" /></Button>
                                    </div>
                                </div>
                            }
                        />
                    ) : (
                        <div className="space-y-6">
                            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary/5 border border-primary/10">
                                <Activity className="h-12 w-12 text-primary/40" />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-2xl font-black tracking-tight">Your Health Connection</h2>
                                <p className="text-muted-foreground max-w-xs mx-auto">
                                    Select a conversation to start chatting securely with your medical team.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}

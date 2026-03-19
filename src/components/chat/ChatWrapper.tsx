import { useState, useEffect } from "react";
import { ChatWindow } from "./ChatWindow";
import { apiClient } from "@/lib/api-client";

interface ChatWrapperProps {
    patientId: string;
    doctorId?: string;
    therapistId?: string;
    pharmacistId?: string;
    className?: string;
    header?: React.ReactNode;
}

export function ChatWrapper({ patientId, doctorId, therapistId, pharmacistId, className, header }: ChatWrapperProps) {
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (patientId && (doctorId || therapistId || pharmacistId)) {
            getOrCreateConversation();
        }
    }, [patientId, doctorId, therapistId, pharmacistId]);

    const getOrCreateConversation = async () => {
        try {
            console.log("[ChatWrapper] Initiating conversation for:", { patientId, doctorId, therapistId, pharmacistId });
            const { data } = await apiClient.post<any>('/api/chat/conversation', { patientId, doctorId, therapistId, pharmacistId });
            setConversationId(data.id);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground animate-pulse">Initializing chat...</div>;
    }

    if (!conversationId) {
        return <div className="flex-1 flex items-center justify-center text-xs text-destructive italic">Failed to initialize chat.</div>;
    }

    return <ChatWindow conversationId={conversationId} className={className} header={header} />;
}

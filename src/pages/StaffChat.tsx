/**
 * StaffChat — secure staff-to-staff DMs and branch group chats.
 *
 * Layout: two-column (thread list left, message pane right).
 * Real-time: subscribes to `staff_chat_message` and `staff_chat_thread_updated`
 * Socket.IO events on the user's personal room.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { PageTransition } from "@/components/ui/page-transition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { MessagesTabs } from "@/components/chat/MessagesTabs";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { branchesApi } from "@/services/branches.service";
import {
  staffChatApi,
  StaffThreadSummary,
  StaffThreadDetail,
  StaffMessage,
  AddressableUser,
} from "@/services/staffChat.service";
import {
  MessageSquare,
  Plus,
  Users,
  UserPlus,
  Send,
  Search,
  Trash2,
  Shield,
  Lock,
  X,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/common/ConfirmDialog";

const MANAGE_ROLES = new Set(["ADMIN", "ADMIN_DOCTOR"]);

function shortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function fullStamp(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} · ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export default function StaffChat() {
  const { profile, role } = useAuth();
  const { socket } = useWebSocket();
  const { toast } = useToast();

  const myUserId = profile?.id || "";
  const isManager = role ? MANAGE_ROLES.has(role) : false;

  const [threads, setThreads] = useState<StaffThreadSummary[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<StaffThreadDetail | null>(null);
  const [messages, setMessages] = useState<StaffMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [composer, setComposer] = useState("");
  const [sending, setSending] = useState(false);

  const [newDmOpen, setNewDmOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Loaders ───────────────────────────────────────────────────────────

  const loadThreads = useCallback(async () => {
    try {
      const list = await staffChatApi.threads();
      setThreads(list);
    } catch (err) {
      toast({
        title: "Failed to load conversations",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    } finally {
      setLoadingThreads(false);
    }
  }, [toast]);

  const loadDetail = useCallback(async (id: string) => {
    try {
      const d = await staffChatApi.detail(id);
      setDetail(d);
    } catch (err) {
      toast({
        title: "Couldn't open conversation",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
      setActiveId(null);
    }
  }, [toast]);

  const loadMessages = useCallback(async (id: string) => {
    setLoadingMessages(true);
    try {
      const r = await staffChatApi.messages(id, { limit: 50 });
      setMessages(r.messages);
      // Mark as read on open — best effort.
      staffChatApi.markRead(id).catch(() => undefined);
    } catch (err) {
      toast({
        title: "Couldn't load messages",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    } finally {
      setLoadingMessages(false);
    }
  }, [toast]);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  useEffect(() => {
    if (!activeId) {
      setDetail(null);
      setMessages([]);
      return;
    }
    loadDetail(activeId);
    loadMessages(activeId);
  }, [activeId, loadDetail, loadMessages]);

  // Auto-scroll to bottom on new message.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, activeId]);

  // ── Real-time wiring ─────────────────────────────────────────────────

  useEffect(() => {
    if (!socket) return;
    const onMessage = (payload: { threadId: string; message: StaffMessage }) => {
      if (payload.threadId === activeId) {
        setMessages((prev) => [...prev, payload.message]);
        staffChatApi.markRead(activeId).catch(() => undefined);
      }
    };
    const onThreadUpdated = () => {
      loadThreads();
    };
    socket.on("staff_chat_message", onMessage);
    socket.on("staff_chat_thread_updated", onThreadUpdated);
    return () => {
      socket.off("staff_chat_message", onMessage);
      socket.off("staff_chat_thread_updated", onThreadUpdated);
    };
  }, [socket, activeId, loadThreads]);

  // ── Send ─────────────────────────────────────────────────────────────

  async function handleSend() {
    const content = composer.trim();
    if (!content || !activeId) return;
    setSending(true);
    try {
      const m = await staffChatApi.send(activeId, content);
      setMessages((prev) => [...prev, m]);
      setComposer("");
      // Bump thread to top — the socket fan-out will refetch threads, but
      // keep an optimistic local update for snappier UX.
      setThreads((prev) => prev.map((t) => t.id === activeId
        ? { ...t, lastMessage: { id: m.id, content: m.content, createdAt: m.createdAt, sender: { id: m.senderId || "" } }, updatedAt: m.createdAt }
        : t));
    } catch (err) {
      toast({
        title: "Failed to send",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  }

  function handleComposerKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // ── Filtered threads ──────────────────────────────────────────────────

  const [filter, setFilter] = useState("");
  const filteredThreads = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return threads;
    return threads.filter((t) =>
      t.title.toLowerCase().includes(f)
      || (t.partner?.name || "").toLowerCase().includes(f),
    );
  }, [threads, filter]);

  return (
    <AppLayout>
      <MessagesTabs />
      <PageTransition className="container max-w-7xl mx-auto px-4 py-6">
        <PageHeader
          title="Team Messages"
          subtitle="Direct messages with colleagues and branch group chats. Admin doctors are auto-included in groups for oversight."
        />

        <div className="mt-6 grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4 h-[calc(100vh-220px)] min-h-[500px]">
          {/* ── Left: thread list ─────────────────────────────────────── */}
          <aside className={cn(
            "rounded-xl border bg-card shadow-card overflow-hidden flex flex-col",
            activeId && "hidden md:flex",
          )}>
            <div className="p-3 border-b space-y-2">
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setNewDmOpen(true)}>
                  <UserPlus className="w-4 h-4 mr-1" /> New DM
                </Button>
                <Button size="sm" className="flex-1" onClick={() => setNewGroupOpen(true)}>
                  <Plus className="w-4 h-4 mr-1" /> New Group
                </Button>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-8 text-sm pl-8"
                  placeholder="Search conversations…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto divide-y">
              {loadingThreads && <div className="p-6 text-center text-xs text-muted-foreground">Loading…</div>}
              {!loadingThreads && filteredThreads.length === 0 && (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  No conversations yet. Start a DM or create a group above.
                </div>
              )}
              {filteredThreads.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveId(t.id)}
                  className={cn(
                    "w-full text-left px-3 py-3 flex items-start gap-2 hover:bg-muted/40 transition-colors",
                    activeId === t.id && "bg-primary/10",
                  )}
                >
                  <div className={cn(
                    "h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0",
                    t.kind === "GROUP" ? "bg-primary/15 text-primary" : "bg-muted text-foreground",
                  )}>
                    {t.kind === "GROUP" ? <Users className="w-4 h-4" /> : (t.title?.[0]?.toUpperCase() || "?")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-sm truncate">{t.title}</div>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {shortDate(t.lastMessage?.createdAt || t.updatedAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {t.kind === "GROUP" && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1">
                          {t.memberCount} members
                        </Badge>
                      )}
                      {t.branch && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1">
                          {t.branch.name}
                        </Badge>
                      )}
                      {t.myIsAutoIncluded && (
                        <Badge className="text-[9px] h-4 px-1 bg-amber-500 text-white">Oversight</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {t.lastMessage?.content || <span className="italic">No messages yet</span>}
                    </div>
                  </div>
                  {t.unreadCount > 0 && (
                    <Badge className="bg-red-500 text-white text-[10px] h-5 px-1.5 shrink-0">
                      {t.unreadCount}
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </aside>

          {/* ── Right: message pane ──────────────────────────────────── */}
          <main className={cn(
            "rounded-xl border bg-card shadow-card overflow-hidden flex flex-col",
            !activeId && "hidden md:flex",
          )}>
            {!activeId && (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                <div className="text-center space-y-2">
                  <MessageSquare className="w-10 h-10 mx-auto text-muted-foreground/40" />
                  <div>Select a conversation to start messaging.</div>
                </div>
              </div>
            )}
            {activeId && detail && (
              <>
                {/* Header */}
                <div className="px-4 py-3 border-b flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="md:hidden"
                      onClick={() => setActiveId(null)}
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div className={cn(
                      "h-9 w-9 rounded-full flex items-center justify-center shrink-0",
                      detail.kind === "GROUP" ? "bg-primary/15 text-primary" : "bg-muted",
                    )}>
                      {detail.kind === "GROUP" ? <Users className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">
                        {detail.title || (detail.kind === "DIRECT"
                          ? detail.members.find((m) => !m.isSelf)?.name || "Direct message"
                          : "Group")}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {detail.kind === "GROUP" ? `${detail.members.length} members` : "Direct message"}
                        {detail.branch ? ` · ${detail.branch.name}` : ""}
                        {detail.archivedAt ? " · Archived" : ""}
                      </div>
                    </div>
                  </div>
                  {detail.kind === "GROUP" && (
                    <div className="flex items-center gap-2">
                      {detail.canManage && (
                        <Button size="sm" variant="outline" onClick={() => setManageOpen(true)}>
                          <Shield className="w-4 h-4 mr-1" /> Manage
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {loadingMessages && (
                    <div className="text-center text-xs text-muted-foreground py-6">Loading messages…</div>
                  )}
                  {!loadingMessages && messages.length === 0 && (
                    <div className="text-center text-xs text-muted-foreground py-6">
                      No messages yet. Say hi!
                    </div>
                  )}
                  {messages.map((m) => {
                    if (m.kind === "SYSTEM") {
                      return (
                        <div key={m.id} className="text-center text-[11px] text-muted-foreground italic py-1">
                          {m.content} · {shortDate(m.createdAt)}
                        </div>
                      );
                    }
                    const isMine = m.senderId === myUserId;
                    return (
                      <div key={m.id} className={cn("flex flex-col", isMine ? "items-end" : "items-start")}>
                        <div className="text-[10px] text-muted-foreground mb-0.5 px-1">
                          {isMine ? "You" : (m.senderName || "Staff")} · {shortDate(m.createdAt)}
                        </div>
                        <div className={cn(
                          "max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words",
                          isMine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm",
                          m.deletedAt && "italic opacity-60",
                        )}>
                          {m.deletedAt ? "Message removed" : m.content}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Composer */}
                <div className="border-t p-3">
                  {detail.archivedAt ? (
                    <div className="text-xs text-muted-foreground text-center py-2 flex items-center justify-center gap-1">
                      <Lock className="w-3.5 h-3.5" /> This group is archived. New messages are disabled.
                    </div>
                  ) : (
                    <div className="flex items-end gap-2">
                      <Textarea
                        value={composer}
                        onChange={(e) => setComposer(e.target.value)}
                        onKeyDown={handleComposerKey}
                        placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
                        rows={2}
                        className="resize-none text-sm"
                        disabled={sending}
                      />
                      <Button onClick={handleSend} disabled={sending || !composer.trim()} className="shrink-0">
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </main>
        </div>
      </PageTransition>

      {/* Dialogs */}
      <NewDmDialog
        open={newDmOpen}
        onOpenChange={setNewDmOpen}
        onCreated={(id) => {
          setNewDmOpen(false);
          loadThreads().then(() => setActiveId(id));
        }}
      />
      <NewGroupDialog
        open={newGroupOpen}
        onOpenChange={setNewGroupOpen}
        onCreated={(id) => {
          setNewGroupOpen(false);
          loadThreads().then(() => setActiveId(id));
        }}
      />
      {detail && detail.kind === "GROUP" && (
        <ManageMembersDialog
          open={manageOpen}
          onOpenChange={setManageOpen}
          detail={detail}
          isManager={isManager}
          onChanged={() => {
            if (activeId) {
              loadDetail(activeId);
              loadThreads();
            }
          }}
        />
      )}
    </AppLayout>
  );
}

/* ── New DM dialog ────────────────────────────────────────────────────── */

function NewDmDialog({
  open, onOpenChange, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (threadId: string) => void;
}) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<AddressableUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    staffChatApi.users({ search })
      .then(setUsers)
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, [open, search]);

  async function pick(u: AddressableUser) {
    setCreating(true);
    try {
      const { id } = await staffChatApi.openDirect(u.id);
      onCreated(id);
    } catch (err) {
      toast({
        title: "Couldn't open DM",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New direct message</DialogTitle>
          <DialogDescription>Pick a colleague to start a 1-on-1 conversation.</DialogDescription>
        </DialogHeader>
        <Input
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="max-h-[320px] overflow-y-auto border rounded-md divide-y">
          {loading && <div className="p-4 text-center text-xs text-muted-foreground">Searching…</div>}
          {!loading && users.length === 0 && (
            <div className="p-4 text-center text-xs text-muted-foreground">No matching staff.</div>
          )}
          {users.map((u) => (
            <button
              key={u.id}
              disabled={creating}
              onClick={() => pick(u)}
              className="w-full text-left px-3 py-2 hover:bg-muted/40 flex items-center gap-2"
            >
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                {u.name[0]?.toUpperCase() || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{u.name}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {u.role}{u.branch ? ` · ${u.branch.name}` : ""} · {u.email}
                </div>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── New Group dialog ─────────────────────────────────────────────────── */

function NewGroupDialog({
  open, onOpenChange, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (threadId: string) => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [branchId, setBranchId] = useState<string>("__none__");
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<AddressableUser[]>([]);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setBranchId("__none__");
    setPicked(new Set());
    setSearch("");
    branchesApi.list().then((res) => {
      const items = Array.isArray(res) ? res : (res as { items?: { id: string; name: string }[] }).items || [];
      setBranches(items);
    }).catch(() => setBranches([]));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    staffChatApi.users({
      branchId: branchId !== "__none__" ? branchId : undefined,
      search: search || undefined,
    }).then(setUsers).catch(() => setUsers([]));
  }, [open, branchId, search]);

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (title.trim().length < 2) {
      toast({ title: "Group name required", description: "At least 2 characters.", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const { id } = await staffChatApi.createGroup({
        title: title.trim(),
        branchId: branchId !== "__none__" ? branchId : null,
        memberUserIds: Array.from(picked),
      });
      onCreated(id);
    } catch (err) {
      toast({
        title: "Couldn't create group",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New group chat</DialogTitle>
          <DialogDescription>
            Admin doctors are added automatically for oversight. Pick additional members below.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Group name</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="e.g. Branch A — Care Team" />
          </div>
          <div>
            <Label>Branch (optional)</Label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger><SelectValue placeholder="Cross-branch" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Cross-branch (no branch scope)</SelectItem>
                {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Add members</Label>
            <Input
              className="mt-1"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="mt-2 border rounded-md divide-y max-h-[260px] overflow-y-auto">
              {users.length === 0 && (
                <div className="p-4 text-center text-xs text-muted-foreground">No staff match.</div>
              )}
              {users.map((u) => (
                <label key={u.id} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/40 cursor-pointer">
                  <Checkbox checked={picked.has(u.id)} onCheckedChange={() => toggle(u.id)} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{u.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {u.role}{u.branch ? ` · ${u.branch.name}` : ""} · {u.email}
                    </div>
                  </div>
                </label>
              ))}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              {picked.size} additional member{picked.size === 1 ? "" : "s"} selected.
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={creating}>Cancel</Button>
          <Button onClick={submit} disabled={creating || title.trim().length < 2}>
            {creating ? "Creating…" : "Create group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Manage Members dialog ───────────────────────────────────────────── */

function ManageMembersDialog({
  open, onOpenChange, detail, isManager, onChanged,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  detail: StaffThreadDetail;
  isManager: boolean;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [users, setUsers] = useState<AddressableUser[]>([]);
  const [search, setSearch] = useState("");
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();

  useEffect(() => {
    if (!open) return;
    staffChatApi.users({
      branchId: detail.branch?.id,
      search: search || undefined,
    }).then((all) => {
      const memberIds = new Set(detail.members.map((m) => m.userId));
      setUsers(all.filter((u) => !memberIds.has(u.id)));
    }).catch(() => setUsers([]));
  }, [open, search, detail]);

  async function add(userId: string) {
    setBusyUserId(userId);
    try {
      await staffChatApi.addMember(detail.id, userId);
      toast({ title: "Member added" });
      onChanged();
    } catch (err) {
      toast({
        title: "Couldn't add member",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    } finally {
      setBusyUserId(null);
    }
  }

  async function remove(userId: string, name: string, isAuto: boolean) {
    if (isAuto) {
      const ok = await confirm({
        title: `Remove ${name}?`,
        description: `${name} is an auto-included admin doctor for oversight. Removing them disables that oversight for this group.`,
        confirmLabel: "Remove anyway",
        tone: "danger",
      });
      if (!ok) return;
    }
    setBusyUserId(userId);
    try {
      await staffChatApi.removeMember(detail.id, userId);
      toast({ title: "Member removed" });
      onChanged();
    } catch (err) {
      toast({
        title: "Couldn't remove member",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    } finally {
      setBusyUserId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage members — {detail.title}</DialogTitle>
          <DialogDescription>
            {isManager
              ? "As an admin you can add or remove anyone, including auto-included admin doctors."
              : "Group owners and admins can add or remove non-oversight members."}
          </DialogDescription>
        </DialogHeader>

        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Current members</Label>
          <div className="mt-1 border rounded-md divide-y max-h-[260px] overflow-y-auto">
            {detail.members.map((m) => (
              <div key={m.id} className="flex items-center gap-2 px-3 py-2">
                <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                  {m.name[0]?.toUpperCase() || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate flex items-center gap-1.5">
                    {m.name}
                    {m.threadRole === "OWNER" && <Badge variant="outline" className="text-[9px] h-4 px-1">Owner</Badge>}
                    {m.threadRole === "ADMIN" && <Badge variant="outline" className="text-[9px] h-4 px-1">Admin</Badge>}
                    {m.isAutoIncluded && <Badge className="text-[9px] h-4 px-1 bg-amber-500 text-white">Oversight</Badge>}
                    {m.isSelf && <Badge variant="outline" className="text-[9px] h-4 px-1">You</Badge>}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {m.role}{m.branch ? ` · ${m.branch.name}` : ""} · joined {fullStamp(m.joinedAt)}
                  </div>
                </div>
                {(detail.canManage || m.isSelf) && m.threadRole !== "OWNER" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-red-600"
                    disabled={busyUserId === m.userId}
                    onClick={() => remove(m.userId, m.name, m.isAutoIncluded)}
                  >
                    <X className="w-3 h-3 mr-1" /> {m.isSelf ? "Leave" : "Remove"}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        {detail.canManage && (
          <div className="mt-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Add members</Label>
            <Input
              className="mt-1"
              placeholder="Search staff…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="mt-1 border rounded-md divide-y max-h-[200px] overflow-y-auto">
              {users.length === 0 && (
                <div className="p-3 text-center text-xs text-muted-foreground">No more staff to add.</div>
              )}
              {users.map((u) => (
                <div key={u.id} className="flex items-center gap-2 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{u.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {u.role}{u.branch ? ` · ${u.branch.name}` : ""}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={busyUserId === u.id}
                    onClick={() => add(u.id)}
                  >
                    <Plus className="w-3 h-3 mr-1" /> Add
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {detail.canManage && (
          <DialogFooter className="border-t pt-3">
            <Button
              variant="outline"
              className="text-red-600"
              onClick={async () => {
                const ok = await confirm({
                  title: "Archive this group?",
                  description: "Existing messages remain visible to members, but no new messages can be sent. This can be reversed by an admin from the database.",
                  confirmLabel: "Archive",
                  tone: "danger",
                });
                if (!ok) return;
                try {
                  await staffChatApi.archive(detail.id);
                  toast({ title: "Group archived" });
                  onOpenChange(false);
                  onChanged();
                } catch (err) {
                  toast({
                    title: "Couldn't archive",
                    description: err instanceof Error ? err.message : "",
                    variant: "destructive",
                  });
                }
              }}
            >
              <Trash2 className="w-4 h-4 mr-1" /> Archive group
            </Button>
          </DialogFooter>
        )}
        {confirmDialog}
      </DialogContent>
    </Dialog>
  );
}

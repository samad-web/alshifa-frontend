import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Megaphone, Pin, Plus, Clock, AlertTriangle, AlertCircle, Info, Circle,
} from "lucide-react";
import { communicationApi } from "@/services/communication.service";
import { toast } from "sonner";
import type { AnnouncementEntry, AnnouncementPriority } from "@/types";

const PRIORITY_CONFIG: Record<AnnouncementPriority, { label: string; color: string; icon: React.ElementType }> = {
  URGENT: { label: "Urgent", color: "bg-red-100 text-red-700 border-red-200", icon: AlertTriangle },
  HIGH:   { label: "High",   color: "bg-orange-100 text-orange-700 border-orange-200", icon: AlertCircle },
  NORMAL: { label: "Normal", color: "bg-blue-100 text-blue-700 border-blue-200", icon: Info },
  LOW:    { label: "Low",    color: "bg-gray-100 text-gray-600 border-gray-200", icon: Circle },
};

const ALL_ROLES = ["ADMIN", "ADMIN_DOCTOR", "DOCTOR", "THERAPIST", "PATIENT", "PHARMACIST"];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function Announcements() {
  const { role } = useAuth();
  const isAdmin = role === "ADMIN" || role === "ADMIN_DOCTOR";

  const [announcements, setAnnouncements] = useState<AnnouncementEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<AnnouncementPriority>("NORMAL");
  const [branchId, setBranchId] = useState<string>("all");
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [isPinned, setIsPinned] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const loadAnnouncements = async () => {
    try {
      setLoading(true);
      const data = await communicationApi.getAnnouncements({ limit: 50 });
      // Sort: pinned first, then by date
      const sorted = [...data.announcements].sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setAnnouncements(sorted);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load announcements");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error("Title and message are required");
      return;
    }
    try {
      setSubmitting(true);
      await communicationApi.createAnnouncement({
        title: title.trim(),
        message: message.trim(),
        priority,
        branchId: branchId === "all" ? undefined : branchId,
        targetRoles: targetRoles.length > 0 ? targetRoles : undefined,
        isPinned,
        expiresAt: expiresAt || undefined,
      });
      toast.success("Announcement created");
      resetForm();
      setFormOpen(false);
      loadAnnouncements();
    } catch (err: any) {
      toast.error(err?.message || "Failed to create announcement");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await communicationApi.markAnnouncementRead(id);
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === id ? { ...a, isRead: true } : a))
      );
    } catch {
      // silent
    }
  };

  const toggleRole = (r: string) => {
    setTargetRoles((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]
    );
  };

  const resetForm = () => {
    setTitle("");
    setMessage("");
    setPriority("NORMAL");
    setBranchId("all");
    setTargetRoles([]);
    setIsPinned(false);
    setExpiresAt("");
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <PageHeader title="Announcements" subtitle="Branch-wide announcements and updates">
          {isAdmin && (
            <Dialog open={formOpen} onOpenChange={setFormOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Announcement
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Announcement</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-2">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                      placeholder="Announcement title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Message</Label>
                    <Textarea
                      placeholder="Write your announcement..."
                      rows={4}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Select value={priority} onValueChange={(v) => setPriority(v as AnnouncementPriority)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="URGENT">Urgent</SelectItem>
                          <SelectItem value="HIGH">High</SelectItem>
                          <SelectItem value="NORMAL">Normal</SelectItem>
                          <SelectItem value="LOW">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Branch</Label>
                      <Select value={branchId} onValueChange={setBranchId}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Branches</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Target Roles</Label>
                    <div className="flex flex-wrap gap-2">
                      {ALL_ROLES.map((r) => (
                        <Badge
                          key={r}
                          variant={targetRoles.includes(r) ? "default" : "outline"}
                          className="cursor-pointer select-none"
                          onClick={() => toggleRole(r)}
                        >
                          {r.replace("_", " ")}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Leave empty to target all roles
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch checked={isPinned} onCheckedChange={setIsPinned} id="pin-toggle" />
                      <Label htmlFor="pin-toggle">Pin announcement</Label>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Expiry Date (optional)</Label>
                    <Input
                      type="date"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                    />
                  </div>
                  <Separator />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setFormOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreate} disabled={submitting}>
                      {submitting ? "Publishing..." : "Publish"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </PageHeader>

        {/* Announcement Feed */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-5 w-1/3 mb-3" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : announcements.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Megaphone className="h-12 w-12 mb-4 opacity-40" />
              <p className="text-lg font-medium">No announcements</p>
              <p className="text-sm">Check back later for updates</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {announcements.map((a) => {
              const pc = PRIORITY_CONFIG[a.priority] || PRIORITY_CONFIG.NORMAL;
              const PIcon = pc.icon;
              return (
                <Card
                  key={a.id}
                  className={`transition-colors cursor-pointer hover:shadow-md ${
                    !a.isRead ? "border-l-4 border-l-blue-500" : ""
                  }`}
                  onClick={() => handleMarkRead(a.id)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <Badge className={`${pc.color} border text-xs`}>
                            <PIcon className="h-3 w-3 mr-1" />
                            {pc.label}
                          </Badge>
                          {a.isPinned && (
                            <Badge variant="secondary" className="text-xs">
                              <Pin className="h-3 w-3 mr-1" />
                              Pinned
                            </Badge>
                          )}
                          {!a.isRead && (
                            <span className="h-2.5 w-2.5 rounded-full bg-blue-500 inline-block flex-shrink-0" />
                          )}
                        </div>
                        <h3 className="font-semibold text-base mb-1 truncate">{a.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                          {a.message}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          <span>{a.authorName || "Admin"}</span>
                          <span className="text-muted-foreground/40">|</span>
                          <span>{a.branchName || "All Branches"}</span>
                          <span className="text-muted-foreground/40">|</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {timeAgo(a.createdAt)}
                          </span>
                        </div>
                        {a.targetRoles && a.targetRoles.length > 0 && (
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {a.targetRoles.map((r) => (
                              <Badge key={r} variant="outline" className="text-[10px] py-0">
                                {r.replace("_", " ")}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

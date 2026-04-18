import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Lock,
  Unlock,
  Play,
  FileText,
  Apple,
  Dumbbell,
  Library,
  Star,
  Sparkles,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { patientGamificationApi } from "@/services/patientGamification.service";
import type { HealthContentEntry } from "@/types";
import { useToast } from "@/components/ui/use-toast";

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  Video: {
    icon: <Play className="h-4 w-4" />,
    color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    label: "Video",
  },
  Article: {
    icon: <FileText className="h-4 w-4" />,
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    label: "Article",
  },
  "Diet Plan": {
    icon: <Apple className="h-4 w-4" />,
    color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    label: "Diet Plan",
  },
  "Exercise Plan": {
    icon: <Dumbbell className="h-4 w-4" />,
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    label: "Exercise Plan",
  },
};

const CONTENT_TABS = ["All", "Video", "Article", "Diet Plan", "Exercise Plan"];

export default function HealthContentLibrary() {
  const [content, setContent] = useState<HealthContentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("All");
  const { toast } = useToast();

  useEffect(() => {
    loadContent();
  }, []);

  async function loadContent() {
    try {
      const data = await patientGamificationApi.getContentLibrary();
      setContent(data);
    } catch {
      toast({ title: "Error", description: "Failed to load content.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleUnlock(contentId: string) {
    setUnlocking(contentId);
    try {
      const result = await patientGamificationApi.unlockContent(contentId);
      if (result.unlocked) {
        toast({ title: "Content Unlocked!", description: "You can now access this content." });
        await loadContent();
      }
    } catch {
      toast({ title: "Error", description: "Failed to unlock content.", variant: "destructive" });
    } finally {
      setUnlocking(null);
    }
  }

  const filteredContent =
    activeTab === "All" ? content : content.filter((c) => c.type === activeTab);

  const unlockedCount = content.filter((c) => !c.isLocked).length;

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-5xl mx-auto p-4 flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto p-4 space-y-6">
        <PageHeader
          title="Health Content Library"
          subtitle="Unlock and explore health resources as you level up"
        >
          <Badge variant="outline" className="gap-1 text-sm">
            <Sparkles className="h-4 w-4 text-yellow-500" />
            {unlockedCount}/{content.length} Unlocked
          </Badge>
        </PageHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap h-auto gap-1">
            {CONTENT_TABS.map((tab) => {
              const cfg = TYPE_CONFIG[tab];
              return (
                <TabsTrigger key={tab} value={tab} className="gap-1">
                  {cfg?.icon || <Library className="h-4 w-4" />}
                  {tab}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {filteredContent.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Library className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No content available in this category.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredContent.map((item) => {
                  const typeConfig = TYPE_CONFIG[item.type] || {
                    icon: <FileText className="h-4 w-4" />,
                    color: "bg-gray-100 text-gray-800",
                    label: item.type,
                  };

                  return (
                    <Card
                      key={item.id}
                      className={`relative overflow-hidden transition-all ${
                        item.isLocked
                          ? "opacity-70 grayscale hover:opacity-80 hover:grayscale-[50%]"
                          : "hover:shadow-md"
                      }`}
                    >
                      {/* Thumbnail / Icon area */}
                      <div
                        className={`h-32 flex items-center justify-center ${
                          item.isLocked
                            ? "bg-muted"
                            : "bg-gradient-to-br from-primary/5 to-primary/15"
                        }`}
                      >
                        {item.isLocked ? (
                          <Lock className="h-12 w-12 text-muted-foreground/40" />
                        ) : (
                          <div className="text-5xl">
                            {item.type === "Video"
                              ? "🎬"
                              : item.type === "Article"
                              ? "📄"
                              : item.type === "Diet Plan"
                              ? "🥗"
                              : "💪"}
                          </div>
                        )}
                      </div>

                      <CardContent className="pt-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <h3
                            className={`font-semibold text-sm leading-tight ${
                              item.isLocked ? "text-muted-foreground" : ""
                            }`}
                          >
                            {item.title}
                          </h3>
                          <Badge className={typeConfig.color} variant="secondary">
                            {typeConfig.label}
                          </Badge>
                        </div>

                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {item.description}
                        </p>

                        {item.category && (
                          <Badge variant="outline" className="text-xs">
                            {item.category}
                          </Badge>
                        )}

                        {/* Action area */}
                        {item.isLocked ? (
                          <div className="space-y-2">
                            <div className="text-xs text-muted-foreground space-y-0.5">
                              {item.requiredLevel > 0 && (
                                <p className="flex items-center gap-1">
                                  <Star className="h-3 w-3" />
                                  Requires Level {item.requiredLevel}
                                </p>
                              )}
                              {item.requiredPoints > 0 && (
                                <p className="flex items-center gap-1">
                                  <Sparkles className="h-3 w-3" />
                                  Requires {item.requiredPoints} points
                                </p>
                              )}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full gap-1"
                              disabled={unlocking === item.id}
                              onClick={() => handleUnlock(item.id)}
                            >
                              {unlocking === item.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Unlock className="h-3 w-3" />
                              )}
                              Unlock
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="default"
                            size="sm"
                            className="w-full gap-1"
                            onClick={() => window.open(item.contentUrl, "_blank")}
                          >
                            <ExternalLink className="h-3 w-3" />
                            View Content
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

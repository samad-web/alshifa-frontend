import { useEffect, useState } from "react";
import { gamificationApi } from "@/services/gamification.service";
import type { BranchLeaderboardEntry, BranchCompetition } from "@/types";
import { Building2, Trophy, Timer, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export function BranchCompetitionPanel() {
  const [branchLeaderboard, setBranchLeaderboard] = useState<BranchLeaderboardEntry[]>([]);
  const [competitions, setCompetitions] = useState<BranchCompetition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      gamificationApi.getBranchLeaderboard(),
      gamificationApi.getActiveCompetitions()
    ])
      .then(([lb, comps]) => {
        setBranchLeaderboard(lb);
        setCompetitions(comps);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-8">
      <Building2 className="w-6 h-6 text-primary animate-pulse" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Branch Leaderboard */}
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                Branch Rankings
              </CardTitle>
              <CardDescription>Aggregate performance across branches</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {branchLeaderboard.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No branch data available</p>
          ) : (
            <div className="space-y-3">
              {branchLeaderboard.map((branch, idx) => (
                <div
                  key={branch.branchId}
                  className="flex items-center justify-between p-3 rounded-xl bg-secondary/5 hover:bg-secondary/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${idx === 0 ? 'bg-yellow-500/20 text-yellow-600' :
                        idx === 1 ? 'bg-slate-400/20 text-slate-500' :
                          idx === 2 ? 'bg-amber-700/20 text-amber-700' :
                            'bg-secondary/20 text-muted-foreground'
                      }`}>
                      #{branch.rank}
                    </div>
                    <div>
                      <p className="text-sm font-bold">{branch.branchName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Users className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">{branch.clinicianCount} clinicians</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-primary">{branch.avgScore}</p>
                    <p className="text-[9px] font-black text-muted-foreground uppercase">Avg Score</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Competitions */}
      {competitions.length > 0 && (
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              Active Competitions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {competitions.map(comp => {
              const daysLeft = Math.max(0, Math.ceil((new Date(comp.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
              const totalDays = Math.ceil((new Date(comp.endDate).getTime() - new Date(comp.startDate).getTime()) / (1000 * 60 * 60 * 24));
              const progress = totalDays > 0 ? ((totalDays - daysLeft) / totalDays) * 100 : 100;

              return (
                <div key={comp.id} className="p-4 rounded-xl border border-border/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm">{comp.title}</p>
                      {comp.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{comp.description}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-[9px]">
                      <Timer className="w-3 h-3 mr-1" />
                      {daysLeft}d left
                    </Badge>
                  </div>

                  <Progress value={progress} className="h-1.5" />

                  <div className="space-y-1.5">
                    {comp.entries.slice(0, 5).map(entry => (
                      <div key={entry.id} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-muted-foreground w-5">#{entry.rank}</span>
                          <span className="font-bold">{entry.branch.name}</span>
                        </div>
                        <span className="font-black text-primary">{Math.round(entry.score)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

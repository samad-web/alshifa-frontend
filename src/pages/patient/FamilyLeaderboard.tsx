import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  Plus,
  UserPlus,
  Copy,
  Check,
  Trophy,
  Flame,
  Star,
  ChevronDown,
  ChevronUp,
  Crown,
  Loader2,
} from "lucide-react";
import { patientGamificationApi } from "@/services/patientGamification.service";
import type { PatientFamilyEntry } from "@/types";
import { useToast } from "@/components/ui/use-toast";

const RANK_DISPLAY = ["🥇", "🥈", "🥉"];

export default function FamilyLeaderboard() {
  const [families, setFamilies] = useState<PatientFamilyEntry[]>([]);
  const [globalRankings, setGlobalRankings] = useState<PatientFamilyEntry[]>([]);
  const [expandedFamily, setExpandedFamily] = useState<string | null>(null);
  const [familyLeaderboard, setFamilyLeaderboard] = useState<PatientFamilyEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [newFamilyName, setNewFamilyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [fams, rankings] = await Promise.all([
        patientGamificationApi.getMyFamilies(),
        patientGamificationApi.getGlobalFamilyRankings(),
      ]);
      setFamilies(fams);
      setGlobalRankings(rankings);
    } catch {
      toast({ title: "Error", description: "Failed to load data.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateFamily() {
    if (!newFamilyName.trim()) return;
    setCreating(true);
    try {
      await patientGamificationApi.createFamily(newFamilyName.trim());
      setNewFamilyName("");
      setShowCreateForm(false);
      toast({ title: "Family Created!", description: "Share the invite code with your family." });
      await loadData();
    } catch {
      toast({ title: "Error", description: "Failed to create family.", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  async function handleJoinFamily() {
    if (!inviteCode.trim()) return;
    setJoining(true);
    try {
      await patientGamificationApi.joinFamily(inviteCode.trim());
      setInviteCode("");
      setShowJoinForm(false);
      toast({ title: "Joined Family!", description: "Welcome to the family!" });
      await loadData();
    } catch {
      toast({ title: "Error", description: "Invalid invite code.", variant: "destructive" });
    } finally {
      setJoining(false);
    }
  }

  async function toggleFamilyExpand(familyId: string) {
    if (expandedFamily === familyId) {
      setExpandedFamily(null);
      setFamilyLeaderboard(null);
      return;
    }
    setExpandedFamily(familyId);
    try {
      const lb = await patientGamificationApi.getFamilyLeaderboard(familyId);
      setFamilyLeaderboard(lb);
    } catch {
      toast({ title: "Error", description: "Failed to load leaderboard.", variant: "destructive" });
    }
  }

  function copyInviteCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

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
          title="Family Leaderboard"
          subtitle="Compete with your family for wellness greatness"
        >
          <Button
            variant="outline"
            className="gap-1"
            onClick={() => {
              setShowCreateForm(!showCreateForm);
              setShowJoinForm(false);
            }}
          >
            <Plus className="h-4 w-4" />
            Create Family
          </Button>
          <Button
            variant="outline"
            className="gap-1"
            onClick={() => {
              setShowJoinForm(!showJoinForm);
              setShowCreateForm(false);
            }}
          >
            <UserPlus className="h-4 w-4" />
            Join Family
          </Button>
        </PageHeader>

        {/* Create Family Form */}
        {showCreateForm && (
          <Card className="border-primary/30">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <Input
                  placeholder="Family name..."
                  value={newFamilyName}
                  onChange={(e) => setNewFamilyName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateFamily()}
                />
                <Button onClick={handleCreateFamily} disabled={creating || !newFamilyName.trim()}>
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Join Family Form */}
        {showJoinForm && (
          <Card className="border-primary/30">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <Input
                  placeholder="Enter invite code..."
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleJoinFamily()}
                />
                <Button onClick={handleJoinFamily} disabled={joining || !inviteCode.trim()}>
                  {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* My Families */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" />
            My Families
          </h2>

          {families.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>You haven't joined any families yet.</p>
                <p className="text-sm mt-1">Create or join a family to start competing!</p>
              </CardContent>
            </Card>
          ) : (
            families.map((family) => (
              <Card key={family.id}>
                <CardContent className="pt-4 pb-4">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => toggleFamilyExpand(family.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Crown className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{family.name}</h3>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            {family.memberCount} members
                          </span>
                          <span className="flex items-center gap-1">
                            <Star className="h-3.5 w-3.5 text-yellow-500" />
                            {family.totalZenPoints} pts
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyInviteCode(family.inviteCode);
                        }}
                      >
                        {copiedCode === family.inviteCode ? (
                          <Check className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        {family.inviteCode}
                      </Button>
                      {expandedFamily === family.id ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Leaderboard */}
                  {expandedFamily === family.id && familyLeaderboard && (
                    <div className="mt-4 border-t pt-4">
                      <h4 className="text-sm font-medium mb-3">Member Rankings</h4>
                      <div className="space-y-2">
                        {familyLeaderboard.members
                          .sort((a, b) => b.zenPoints - a.zenPoints)
                          .map((member, idx) => (
                            <div
                              key={member.patientId}
                              className={`flex items-center gap-3 p-3 rounded-lg border ${
                                idx === 0
                                  ? "bg-yellow-50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/30"
                                  : "bg-background"
                              }`}
                            >
                              <span className="text-xl w-8 text-center">
                                {idx < 3 ? RANK_DISPLAY[idx] : `#${idx + 1}`}
                              </span>
                              <div className="flex-1">
                                <span className="font-medium">{member.fullName}</span>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                                  <span className="flex items-center gap-1">
                                    <Star className="h-3 w-3 text-yellow-500" />
                                    {member.zenPoints} pts
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Flame className="h-3 w-3 text-orange-500" />
                                    {member.streak}d streak
                                  </span>
                                  <span>Lv.{member.avatarLevel}</span>
                                </div>
                              </div>
                              {member.role === "ADMIN" && (
                                <Badge variant="outline" className="text-xs">
                                  Admin
                                </Badge>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Global Rankings */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Global Family Rankings
          </h2>

          {globalRankings.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <p>No global rankings available yet.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Rank</TableHead>
                      <TableHead>Family</TableHead>
                      <TableHead className="text-center">Members</TableHead>
                      <TableHead className="text-right">Zen Points</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {globalRankings.map((family, idx) => (
                      <TableRow key={family.id}>
                        <TableCell className="text-center text-lg">
                          {idx < 3 ? RANK_DISPLAY[idx] : `#${idx + 1}`}
                        </TableCell>
                        <TableCell className="font-medium">{family.name}</TableCell>
                        <TableCell className="text-center">{family.memberCount}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {family.totalZenPoints.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

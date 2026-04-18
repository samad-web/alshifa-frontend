import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Loader2, AlertCircle, Gift, ShoppingBag, Coins, Star,
  Package, GraduationCap, Coffee, Calendar, Plus, Zap,
} from "lucide-react";
import { clinicianGamificationApi } from "@/services/clinicianGamification.service";
import type { RewardItem, RewardRedemption, ClinicianXPProfile, RedemptionStatus } from "@/types";

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Leave: <Calendar className="w-5 h-5 text-blue-500" />,
  Perk: <Coffee className="w-5 h-5 text-amber-500" />,
  Gift: <Gift className="w-5 h-5 text-pink-500" />,
  Training: <GraduationCap className="w-5 h-5 text-purple-500" />,
};

const STATUS_VARIANT: Record<RedemptionStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 border-yellow-300",
  APPROVED: "bg-blue-100 text-blue-800 border-blue-300",
  FULFILLED: "bg-green-100 text-green-800 border-green-300",
  REJECTED: "bg-red-100 text-red-800 border-red-300",
};

export default function RewardStore() {
  const { role } = useAuth();
  const isAdmin = role === "ADMIN" || role === "ADMIN_DOCTOR";

  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [redemptions, setRedemptions] = useState<RewardRedemption[]>([]);
  const [profile, setProfile] = useState<ClinicianXPProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: "", description: "", icon: "", category: "Perk",
    pointsCost: "", stock: "",
  });

  useEffect(() => {
    async function load() {
      try {
        const [r, rd, p] = await Promise.all([
          clinicianGamificationApi.getAvailableRewards(),
          clinicianGamificationApi.getMyRedemptions(),
          clinicianGamificationApi.getXPProfile(),
        ]);
        setRewards(r);
        setRedemptions(rd.redemptions);
        setProfile(p);
      } catch {
        setError("Failed to load store data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleRedeem(rewardId: string) {
    setRedeeming(rewardId);
    try {
      const redemption = await clinicianGamificationApi.redeemReward(rewardId);
      setRedemptions((prev) => [redemption, ...prev]);
      // Refresh profile balance
      const p = await clinicianGamificationApi.getXPProfile();
      setProfile(p);
    } catch {
      setError("Failed to redeem reward");
    } finally {
      setRedeeming(null);
    }
  }

  async function handleCreateReward(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const created = await clinicianGamificationApi.createReward({
        name: form.name,
        description: form.description,
        icon: form.icon || undefined,
        category: form.category,
        pointsCost: Number(form.pointsCost),
        stock: form.stock ? Number(form.stock) : undefined,
      });
      setRewards((prev) => [created, ...prev]);
      setShowForm(false);
      setForm({ name: "", description: "", icon: "", category: "Perk", pointsCost: "", stock: "" });
    } catch {
      setError("Failed to create reward");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleProcessRedemption(redemptionId: string, status: string) {
    try {
      const updated = await clinicianGamificationApi.processRedemption(redemptionId, status);
      setRedemptions((prev) => prev.map((r) => (r.id === redemptionId ? updated : r)));
    } catch {
      setError("Failed to process redemption");
    }
  }

  const filteredRewards = categoryFilter === "All" ? rewards : rewards.filter((r) => r.category === categoryFilter);

  if (loading) {
    return (
      <AppLayout>
        <div className="container max-w-7xl mx-auto px-4 py-8 flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (error && rewards.length === 0) {
    return (
      <AppLayout>
        <div className="container max-w-7xl mx-auto px-4 py-8 flex items-center justify-center min-h-[50vh]">
          <div className="flex flex-col items-center gap-2 text-destructive">
            <AlertCircle className="w-8 h-8" />
            <p>{error}</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container max-w-7xl mx-auto px-4 py-8 space-y-8">
        <PageHeader title="Reward Store" subtitle="Redeem your points for exciting rewards">
          {isAdmin && (
            <Button onClick={() => setShowForm(!showForm)} variant={showForm ? "outline" : "default"}>
              <Plus className="w-4 h-4 mr-2" />
              {showForm ? "Cancel" : "Add Reward"}
            </Button>
          )}
        </PageHeader>

        {/* ── Balance Display ────────────────────────────────────── */}
        {profile && (
          <div className="flex flex-wrap gap-4">
            <Card className="bg-gradient-to-r from-yellow-500/10 to-amber-500/5 border-yellow-500/20">
              <CardContent className="py-4 px-6 flex items-center gap-3">
                <Coins className="w-8 h-8 text-yellow-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Your Balance</p>
                  <p className="text-2xl font-extrabold text-foreground">{profile.totalXP.toLocaleString()} XP</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Admin Create Reward Form ───────────────────────────── */}
        {isAdmin && showForm && (
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle>Add New Reward</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateReward} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input placeholder="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <Input placeholder="Category (Leave, Perk, Gift, Training)" required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                <Input placeholder="Description" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="md:col-span-2" />
                <Input type="number" placeholder="Points Cost" required value={form.pointsCost} onChange={(e) => setForm({ ...form, pointsCost: e.target.value })} />
                <Input type="number" placeholder="Stock (leave empty for unlimited)" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
                <Input placeholder="Icon name" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} />
                <div className="md:col-span-2 flex justify-end">
                  <Button type="submit" disabled={submitting}>
                    {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Add Reward
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* ── Category Filter Tabs ───────────────────────────────── */}
        <Tabs value={categoryFilter} onValueChange={setCategoryFilter}>
          <TabsList>
            <TabsTrigger value="All">All</TabsTrigger>
            <TabsTrigger value="Leave">Leave</TabsTrigger>
            <TabsTrigger value="Perk">Perk</TabsTrigger>
            <TabsTrigger value="Gift">Gift</TabsTrigger>
            <TabsTrigger value="Training">Training</TabsTrigger>
          </TabsList>

          <TabsContent value={categoryFilter} className="mt-6">
            {filteredRewards.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <ShoppingBag className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No rewards in this category</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {filteredRewards.map((reward) => (
                  <Card key={reward.id} className="flex flex-col hover:shadow-md transition-shadow">
                    <CardContent className="pt-6 flex-1 flex flex-col">
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                          {CATEGORY_ICONS[reward.category] ?? <Package className="w-5 h-5 text-muted-foreground" />}
                        </div>
                        <Badge variant="outline" className="text-xs">{reward.category}</Badge>
                      </div>
                      <h3 className="font-semibold text-foreground mb-1">{reward.name}</h3>
                      <p className="text-sm text-muted-foreground mb-4 flex-1">{reward.description}</p>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1">
                          <Coins className="w-4 h-4 text-yellow-500" />
                          <span className="font-bold text-foreground">{reward.pointsCost}</span>
                          <span className="text-xs text-muted-foreground">pts</span>
                        </div>
                        {reward.stock != null && (
                          <span className="text-xs text-muted-foreground">
                            {reward.stock} left
                          </span>
                        )}
                      </div>
                      <Button
                        className="w-full"
                        disabled={redeeming === reward.id || (reward.stock != null && reward.stock <= 0)}
                        onClick={() => handleRedeem(reward.id)}
                      >
                        {redeeming === reward.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Gift className="w-4 h-4 mr-2" />
                            Redeem
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* ── My Redemptions ─────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-primary" />
              My Redemptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {redemptions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No redemptions yet</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reward</TableHead>
                      <TableHead>Points Spent</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {redemptions.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.reward.name}</TableCell>
                        <TableCell>{r.pointsSpent}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                              STATUS_VARIANT[r.status as RedemptionStatus] ?? ""
                            }`}
                          >
                            {r.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(r.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Admin: Process Redemptions ─────────────────────────── */}
        {isAdmin && redemptions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Process Redemptions (Admin)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Reward</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {redemptions
                      .filter((r) => r.status === "PENDING")
                      .map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="text-xs text-muted-foreground font-mono">{r.id.slice(0, 8)}</TableCell>
                          <TableCell className="font-medium">{r.reward.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-yellow-100 text-yellow-800">PENDING</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button size="sm" variant="default" onClick={() => handleProcessRedemption(r.id, "APPROVED")}>
                                Approve
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => handleProcessRedemption(r.id, "REJECTED")}>
                                Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

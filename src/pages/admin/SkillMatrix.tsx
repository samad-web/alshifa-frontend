import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useBranches } from "@/hooks/useBranches";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { operationsApi } from "@/services/operations.service";
import type { SkillMatrixRow, StaffSkillEntry, SkillLevel } from "@/types";
import {
  Loader2, Grid3X3, Search, Plus, AlertTriangle, Award, ShieldCheck,
} from "lucide-react";

const skillTypes = ["Certification", "Specialization", "Language", "Procedure"];

const proficiencyConfig: Record<SkillLevel, { label: string; className: string }> = {
  BEGINNER: { label: "Beginner", className: "bg-gray-100 text-gray-700 border-gray-300" },
  INTERMEDIATE: { label: "Intermediate", className: "bg-blue-100 text-blue-700 border-blue-300" },
  ADVANCED: { label: "Advanced", className: "bg-purple-100 text-purple-700 border-purple-300" },
  EXPERT: { label: "Expert", className: "bg-yellow-100 text-yellow-800 border-yellow-400" },
};

export default function SkillMatrix() {
  const { role } = useAuth();
  const { branches } = useBranches();
  const isAdmin = role === "ADMIN" || role === "ADMIN_DOCTOR";

  const [matrix, setMatrix] = useState<SkillMatrixRow[]>([]);
  const [expiring, setExpiring] = useState<StaffSkillEntry[]>([]);
  const [branchId, setBranchId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SkillMatrixRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add skill form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSkillType, setNewSkillType] = useState("Certification");
  const [newSkillName, setNewSkillName] = useState("");
  const [newProficiency, setNewProficiency] = useState<SkillLevel>("INTERMEDIATE");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (isAdmin && (branches as any[]).length > 0 && !branchId) {
      setBranchId((branches as any[])[0].id);
    }
  }, [branches, isAdmin, branchId]);

  useEffect(() => {
    if (!branchId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      operationsApi.getSkillMatrix(branchId),
      operationsApi.getExpiringCertifications({ daysAhead: 90 }),
    ])
      .then(([m, exp]) => { setMatrix(m); setExpiring(exp); })
      .catch(() => setError("Failed to load skill matrix"))
      .finally(() => setLoading(false));
  }, [branchId]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) { setSearchResults(null); return; }
    try {
      const results = await operationsApi.searchBySkill({ skillName: searchQuery, branchId: branchId || undefined });
      setSearchResults(results);
    } catch {
      alert("Search failed");
    }
  };

  const handleAddSkill = async () => {
    if (!newSkillName.trim()) return;
    setAdding(true);
    try {
      await operationsApi.addSkill({
        skillType: newSkillType,
        skillName: newSkillName,
        proficiency: newProficiency,
      });
      setNewSkillName("");
      setShowAddForm(false);
      // Refresh
      if (branchId) {
        const m = await operationsApi.getSkillMatrix(branchId);
        setMatrix(m);
      }
    } catch {
      alert("Failed to add skill");
    } finally {
      setAdding(false);
    }
  };

  const getSkillsByType = (skills: StaffSkillEntry[], type: string) =>
    skills.filter(s => s.skillType.toLowerCase() === type.toLowerCase());

  const displayData = searchResults ?? matrix;

  if (loading) {
    return (
      <AppLayout>
        <div className="container max-w-7xl mx-auto px-4 py-8 flex items-center justify-center min-h-[50vh]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Loading Skill Matrix...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container max-w-7xl mx-auto px-4 py-8 space-y-8">
        <PageHeader
          title="Staff Skill Matrix"
          subtitle="Visualize staff skills, certifications, and specializations across the organization."
        >
          <div className="flex items-center gap-3">
            {isAdmin && (
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select Branch" />
                </SelectTrigger>
                <SelectContent>
                  {(branches as any[]).map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button size="sm" variant="outline" onClick={() => setShowAddForm(!showAddForm)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Skill
            </Button>
          </div>
        </PageHeader>

        {error && (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
        )}

        {/* Add Skill Form */}
        {showAddForm && (
          <Card className="border-none shadow-sm border-l-4 border-l-primary">
            <CardContent className="py-5">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Skill Type</label>
                  <Select value={newSkillType} onValueChange={setNewSkillType}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {skillTypes.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 flex-1 min-w-[200px]">
                  <label className="text-xs font-medium text-muted-foreground">Skill Name</label>
                  <Input
                    placeholder="e.g. BLS Certification"
                    value={newSkillName}
                    onChange={e => setNewSkillName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Proficiency</label>
                  <Select value={newProficiency} onValueChange={v => setNewProficiency(v as SkillLevel)}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(proficiencyConfig) as SkillLevel[]).map(level => (
                        <SelectItem key={level} value={level}>
                          {proficiencyConfig[level].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddSkill} disabled={adding}>
                  {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by skill name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              className="pl-10"
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleSearch}>Search</Button>
          {searchResults && (
            <Button variant="ghost" size="sm" onClick={() => { setSearchResults(null); setSearchQuery(""); }}>
              Clear
            </Button>
          )}
        </div>

        {/* Expiring Certifications */}
        {expiring.length > 0 && (
          <Card className="border-none shadow-sm border-l-4 border-l-yellow-500">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                Expiring Certifications ({expiring.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {expiring.map(s => (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg bg-yellow-50 border border-yellow-200">
                    <ShieldCheck className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{s.skillName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Expires: {s.expiresAt ? new Date(s.expiresAt).toLocaleDateString() : "N/A"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Matrix Table */}
        <Card className="border-none shadow-sm overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Grid3X3 className="w-5 h-5 text-primary" />
              {searchResults ? `Search Results (${searchResults.length})` : "Skill Matrix"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {displayData.length === 0 ? (
              <div className="text-center py-12">
                <Award className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  {searchResults ? "No staff found with that skill" : "No skill data available"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[160px]">Staff Member</TableHead>
                      {skillTypes.map(type => (
                        <TableHead key={type} className="min-w-[200px]">{type}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayData.map(row => (
                      <TableRow key={row.userId}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{row.fullName}</p>
                            <p className="text-[10px] text-muted-foreground capitalize">
                              {row.role.toLowerCase().replace("_", " ")}
                            </p>
                          </div>
                        </TableCell>
                        {skillTypes.map(type => {
                          const skills = getSkillsByType(row.skills, type);
                          return (
                            <TableCell key={type}>
                              <div className="flex flex-wrap gap-1.5">
                                {skills.length === 0 ? (
                                  <span className="text-xs text-muted-foreground">--</span>
                                ) : (
                                  skills.map(s => (
                                    <Badge
                                      key={s.id}
                                      variant="outline"
                                      className={`text-[10px] ${proficiencyConfig[s.proficiency].className}`}
                                    >
                                      {s.skillName}
                                    </Badge>
                                  ))
                                )}
                              </div>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

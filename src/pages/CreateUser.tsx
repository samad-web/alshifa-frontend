import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/common/input";
import { Label } from "@/components/common/label";
import { Button } from "@/components/common/button";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { UserPlus, ShieldCheck, Mail, Lock, Loader2, ArrowLeft, Building2, Phone, Cake, Briefcase, GraduationCap, Clock, Check, X, Sparkles, BadgeCheck } from "lucide-react";
import { sanitizeName, sanitizePhone, isValidPhone, isValidEmail, checkPassword, isPasswordAcceptable, stripLeadingSpaces, stripEdgeSpaces } from "@/lib/input-validators";
import { useBranches } from "@/hooks/useBranches";
import { apiClient } from "@/lib/api-client";

type Role = "ADMIN" | "ADMIN_DOCTOR" | "DOCTOR" | "THERAPIST" | "PATIENT" | "PHARMACIST";

const roles: { value: Role; label: string }[] = [
  { value: "ADMIN", label: "System Admin" },
  { value: "ADMIN_DOCTOR", label: "Admin Doctor" },
  { value: "DOCTOR", label: "Practicing Doctor" },
  { value: "THERAPIST", label: "Clinical Therapist" },
  { value: "PATIENT", label: "Patient" },
  { value: "PHARMACIST", label: "Pharmacist" },
];

const GENDERS = [
  { value: "FEMALE", label: "Female" },
  { value: "MALE", label: "Male" },
  { value: "OTHER", label: "Other" },
  { value: "PREFER_NOT_TO_SAY", label: "Prefer not to say" },
];

// AyurvedicSkill enum values — mirrors the backend Prisma enum. The therapist's
// primary specialization must pick one of these; additional skills seed the
// TherapistSkill matrix so skill-matching works from day one.
const AYURVEDIC_SKILLS: { value: string; label: string }[] = [
  { value: "ABHYANGA",            label: "Abhyanga (oil massage)" },
  { value: "SHIRODHARA",          label: "Shirodhara" },
  { value: "PANCHAKARMA_GENERAL", label: "Panchakarma (general)" },
  { value: "BASTI",               label: "Basti" },
  { value: "VIRECHANA",           label: "Virechana" },
  { value: "NASYA",               label: "Nasya" },
  { value: "KIZHI",               label: "Kizhi" },
  { value: "NJAVARA",             label: "Njavara" },
  { value: "PIZHICHIL",           label: "Pizhichil" },
  { value: "MARMA_THERAPY",       label: "Marma Therapy" },
  { value: "YOGA_THERAPY",        label: "Yoga Therapy" },
  { value: "NATUROPATHY",         label: "Naturopathy" },
];

interface FormState {
  email: string;
  password: string;
  fullName: string;
  role: Role;
  branchId: string;
  phoneNumber: string;
  dob: string;              // YYYY-MM-DD
  gender: string;
  therapyType: string;
  specialization: string;
  qualification: string;
  yearsExperience: string;  // kept as string in the input; coerced to number on submit
  clinic: string;
  /** Medical registration / certificate number. Required for DOCTOR,
   *  ADMIN_DOCTOR, and THERAPIST. */
  registrationNumber: string;
  /** Therapist-only: additional AyurvedicSkill values beyond the primary
   *  specialization. Seeds the TherapistSkill matrix on create. */
  initialSkills: string[];
}

const EMPTY_FORM: FormState = {
  email: "", password: "", fullName: "", role: "PATIENT", branchId: "",
  phoneNumber: "", dob: "", gender: "", therapyType: "",
  specialization: "", qualification: "", yearsExperience: "", clinic: "",
  registrationNumber: "",
  initialSkills: [],
};

// Per-role field requirements — mirrors the backend superRefine so the UI
// surfaces missing fields before the request is sent.
const REQUIRED_BY_ROLE: Record<Role, (keyof FormState)[]> = {
  PATIENT:       ["dob", "gender", "phoneNumber"],
  DOCTOR:        ["specialization", "qualification", "yearsExperience", "registrationNumber"],
  ADMIN_DOCTOR:  ["specialization", "qualification", "yearsExperience", "registrationNumber"],
  THERAPIST:     ["specialization", "qualification", "yearsExperience", "registrationNumber"],
  PHARMACIST:    ["qualification", "yearsExperience"],
  ADMIN:         [],
};

export default function CreateUser() {
  const { role: viewerRole } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { branches } = useBranches();

  const requiredForRole = REQUIRED_BY_ROLE[form.role];

  const missingFields = useMemo(() => {
    const missing: string[] = [];
    if (!form.email) missing.push("email");
    if (!form.password) missing.push("password");
    if (form.fullName.trim().length < 2) missing.push("fullName");
    if (!form.branchId) missing.push("branchId");
    for (const f of requiredForRole) {
      const v = form[f];
      if (v === undefined || v === null || String(v).trim() === "") missing.push(f as string);
    }
    return missing;
  }, [form, requiredForRole]);

  if (viewerRole !== "ADMIN_DOCTOR" && viewerRole !== "ADMIN") {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
          <ShieldCheck className="w-12 h-12 text-attention/40" />
          <h2 className="text-xl font-bold">Access Denied</h2>
          <p className="text-muted-foreground">You do not have administrative privileges to create users.</p>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </AppLayout>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let next = value;
    if (name === "fullName") next = sanitizeName(value);
    else if (name === "phoneNumber") next = sanitizePhone(value);
    else if (name === "password") next = stripLeadingSpaces(value);
    else if (name === "email") next = stripLeadingSpaces(value);
    setForm({ ...form, [name]: next });
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "password" || name === "email") {
      const trimmed = stripEdgeSpaces(value);
      if (trimmed !== value) setForm(prev => ({ ...prev, [name]: trimmed }));
    }
  };

  const passwordChecks = checkPassword(form.password);
  const showPasswordChecklist = form.password.length > 0;
  const emailInvalid = form.email.length > 0 && !isValidEmail(form.email);
  const phoneInvalid = form.phoneNumber.length > 0 && !isValidPhone(form.phoneNumber);

  const buildPayload = () => {
    const p: Record<string, unknown> = {
      email: stripEdgeSpaces(form.email),
      password: stripEdgeSpaces(form.password),
      fullName: form.fullName,
      role: form.role,
      branchId: form.branchId,
    };
    if (form.phoneNumber) p.phoneNumber = form.phoneNumber;

    if (form.role === "PATIENT") {
      if (form.dob) p.dob = form.dob;
      if (form.gender) p.gender = form.gender;
      if (form.therapyType) p.therapyType = form.therapyType;
    }
    if (["DOCTOR", "ADMIN_DOCTOR", "THERAPIST"].includes(form.role)) {
      if (form.specialization) p.specialization = form.specialization;
      if (form.qualification)  p.qualification = form.qualification;
      if (form.yearsExperience !== "") p.yearsExperience = Number(form.yearsExperience);
      if (form.clinic) p.clinic = form.clinic;
      if (form.registrationNumber.trim()) p.registrationNumber = form.registrationNumber.trim();
    }
    if (form.role === "THERAPIST" && form.initialSkills.length > 0) {
      // Exclude the primary specialization — the backend auto-adds it as CERTIFIED.
      p.initialSkills = form.initialSkills.filter((s) => s !== form.specialization);
    }
    if (form.role === "PHARMACIST") {
      if (form.qualification)  p.qualification = form.qualification;
      if (form.yearsExperience !== "") p.yearsExperience = Number(form.yearsExperience);
    }
    return p;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (missingFields.length > 0) {
      setError(`Missing required fields: ${missingFields.join(", ")}`);
      return;
    }
    if (!isValidEmail(form.email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!isPasswordAcceptable(form.password)) {
      setError("Password doesn't meet the strength requirements.");
      return;
    }
    if (form.phoneNumber && !isValidPhone(form.phoneNumber)) {
      setError("Phone number must contain 7–15 digits (optionally with a leading +).");
      return;
    }
    setLoading(true);
    try {
      await apiClient.post('/api/user/create', buildPayload());
      setSuccess("User identity created successfully.");
      setForm(EMPTY_FORM);
    } catch (err: any) {
      setError(err?.message || "Failed to create user");
    }
    setLoading(false);
  };

  const isPatient = form.role === "PATIENT";
  const isClinician = form.role === "DOCTOR" || form.role === "ADMIN_DOCTOR" || form.role === "THERAPIST";
  const isPharmacist = form.role === "PHARMACIST";

  return (
    <AppLayout>
      <div className="container max-w-4xl mx-auto px-4 py-8 md:py-12">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full hover:bg-secondary">
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </Button>
          <PageHeader
            title="User Provisioning"
            subtitle="Onboard new medical staff and patient identities. All required profile details are captured at creation."
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="bg-primary/5 border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-primary" />
                  Account Security
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Every user requires a unique email and strong password (min 8 chars, mixed case, number, symbol).
                </p>
                <div className="p-3 bg-background rounded-xl border border-border/50">
                  <p className="text-[11px] font-bold text-primary uppercase tracking-widest mb-1">Required profile</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {isPatient && (<>
                      <li>• Date of birth (age derived)</li>
                      <li>• Gender</li>
                      <li>• Phone number</li>
                    </>)}
                    {isClinician && (<>
                      <li>• Certificate / registration number</li>
                      <li>• Specialization{form.role === "THERAPIST" && " (Ayurvedic therapy)"}</li>
                      <li>• Qualification</li>
                      <li>• Years of experience</li>
                      {form.role === "THERAPIST" && <li>• Additional skills (optional)</li>}
                    </>)}
                    {isPharmacist && (<>
                      <li>• Qualification</li>
                      <li>• Years of experience</li>
                    </>)}
                    {form.role === "ADMIN" && <li>• No additional profile fields</li>}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Form */}
          <div className="lg:col-span-8">
            <Card className="shadow-elevated border-border/60">
              <CardHeader className="bg-secondary/10 border-b border-border/50">
                <CardTitle>Account Identification</CardTitle>
                <CardDescription>Credentials, role, and required profile details</CardDescription>
              </CardHeader>
              <form onSubmit={handleSubmit}>
                <CardContent className="space-y-6 pt-8">
                  {/* Credentials */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-muted-foreground" /> Email Address
                      </Label>
                      <Input id="email" name="email" type="email" placeholder="user@example.com"
                        value={form.email} onChange={handleChange} onBlur={handleBlur} required
                        inputMode="email" autoComplete="email" spellCheck={false}
                        aria-invalid={emailInvalid || undefined}
                        className="h-12 bg-secondary/30 border-secondary focus:bg-background transition-all rounded-xl" />
                      {emailInvalid && <p className="text-xs text-attention ml-1">Enter a valid email address.</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password" className="flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5 text-muted-foreground" /> Initial Password
                      </Label>
                      <Input id="password" name="password" type="password" placeholder="••••••••"
                        value={form.password} onChange={handleChange} onBlur={handleBlur} required minLength={8}
                        autoComplete="new-password"
                        className="h-12 bg-secondary/30 border-secondary focus:bg-background transition-all rounded-xl" />
                      {showPasswordChecklist && (
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 pt-1">
                          {passwordChecks.map(c => (
                            <li key={c.label} className="flex items-center gap-1.5 text-xs">
                              {c.ok
                                ? <Check className="w-3.5 h-3.5 text-wellness" />
                                : <X className="w-3.5 h-3.5 text-muted-foreground" />}
                              <span className={c.ok ? "text-wellness" : "text-muted-foreground"}>{c.label}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="fullName" className="flex items-center gap-2">
                        <UserPlus className="w-3.5 h-3.5 text-muted-foreground" /> Full Name
                      </Label>
                      <Input id="fullName" name="fullName" type="text" placeholder="Dr. Sarah Smith"
                        value={form.fullName} onChange={handleChange} required minLength={2}
                        autoComplete="name" inputMode="text"
                        className="h-12 bg-secondary/30 border-secondary focus:bg-background transition-all rounded-xl" />
                      <p className="text-[11px] text-muted-foreground ml-1">Letters, spaces, hyphens and apostrophes only.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phoneNumber" className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                        Phone {isPatient && <span className="text-attention">*</span>}
                      </Label>
                      <Input id="phoneNumber" name="phoneNumber" type="tel" placeholder="+919876543210"
                        value={form.phoneNumber} onChange={handleChange}
                        inputMode="tel" autoComplete="tel" pattern="^\+?\d{7,15}$"
                        aria-invalid={phoneInvalid || undefined}
                        className="h-12 bg-secondary/30 border-secondary focus:bg-background transition-all rounded-xl" />
                      {phoneInvalid && <p className="text-xs text-attention ml-1">Phone must be 7–15 digits (optionally starting with +).</p>}
                    </div>
                  </div>

                  {/* Clinical Assignment */}
                  <div className="pt-6 mt-6 border-t border-border/50 space-y-6">
                    <div className="flex flex-col gap-1">
                      <h3 className="text-lg font-bold text-foreground">Clinical Assignment</h3>
                      <p className="text-sm text-muted-foreground">Branch and access level</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="branchId" className="flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-muted-foreground" /> Assigned Branch <span className="text-attention">*</span>
                        </Label>
                        <SearchableSelect
                          value={form.branchId}
                          onChange={(val) => setForm({ ...form, branchId: val })}
                          placeholder="Select clinical branch"
                          searchPlaceholder="Search branches…"
                          triggerClassName="h-12 bg-secondary/30 border-secondary focus:bg-background transition-all rounded-xl"
                          items={(branches as any[]).map((b: any) => ({ value: b.id, label: b.name }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="role" className="flex items-center gap-2">
                          <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" /> Access Level (Role) <span className="text-attention">*</span>
                        </Label>
                        <Select value={form.role} onValueChange={(val) => setForm({ ...form, role: val as Role })}>
                          <SelectTrigger className="h-12 bg-secondary/30 border-secondary focus:bg-background transition-all rounded-xl">
                            <SelectValue placeholder="Assign a role" />
                          </SelectTrigger>
                          <SelectContent>
                            {roles.map((r) => (
                              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Patient-specific */}
                  {isPatient && (
                    <div className="pt-6 mt-6 border-t border-border/50 space-y-6">
                      <div className="flex flex-col gap-1">
                        <h3 className="text-lg font-bold text-foreground">Patient Details</h3>
                        <p className="text-sm text-muted-foreground">Used for triage scoring (age-adjusted urgency, pregnancy context).</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="dob" className="flex items-center gap-2">
                            <Cake className="w-3.5 h-3.5 text-muted-foreground" /> Date of Birth <span className="text-attention">*</span>
                          </Label>
                          <Input id="dob" name="dob" type="date" value={form.dob} onChange={handleChange} required
                            className="h-12 bg-secondary/30 border-secondary focus:bg-background transition-all rounded-xl" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="gender">Gender <span className="text-attention">*</span></Label>
                          <Select value={form.gender} onValueChange={(val) => setForm({ ...form, gender: val })}>
                            <SelectTrigger className="h-12 bg-secondary/30 border-secondary focus:bg-background transition-all rounded-xl">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              {GENDERS.map((g) => (
                                <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="therapyType">Therapy type (optional)</Label>
                        <Input id="therapyType" name="therapyType" placeholder="e.g. Ayurveda, Physiotherapy"
                          value={form.therapyType} onChange={handleChange}
                          className="h-12 bg-secondary/30 border-secondary focus:bg-background transition-all rounded-xl" />
                      </div>
                    </div>
                  )}

                  {/* Clinician-specific (Doctor/ADMIN_DOCTOR/Therapist) */}
                  {isClinician && (
                    <div className="pt-6 mt-6 border-t border-border/50 space-y-6">
                      <div className="flex flex-col gap-1">
                        <h3 className="text-lg font-bold text-foreground">Clinical Credentials</h3>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="registrationNumber" className="flex items-center gap-2">
                          <BadgeCheck className="w-3.5 h-3.5 text-muted-foreground" /> Certificate / Registration Number <span className="text-attention">*</span>
                        </Label>
                        <Input
                          id="registrationNumber"
                          name="registrationNumber"
                          placeholder={form.role === "THERAPIST" ? "e.g. AYUSH-TH-1234" : "e.g. CCIM/2024/45678"}
                          value={form.registrationNumber}
                          onChange={handleChange}
                          required
                          className="h-12 bg-secondary/30 border-secondary focus:bg-background transition-all rounded-xl" />
                        <p className="text-[11px] text-muted-foreground ml-1">
                          Medical council / AYUSH board registration number. Used for prescription attribution and credential verification.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="specialization" className="flex items-center gap-2">
                            <Briefcase className="w-3.5 h-3.5 text-muted-foreground" /> Specialization <span className="text-attention">*</span>
                          </Label>
                          {form.role === "THERAPIST" ? (
                            <Select
                              value={form.specialization}
                              onValueChange={(val) => setForm({ ...form, specialization: val })}
                            >
                              <SelectTrigger className="h-12 bg-secondary/30 border-secondary focus:bg-background transition-all rounded-xl">
                                <SelectValue placeholder="Pick an Ayurvedic specialization" />
                              </SelectTrigger>
                              <SelectContent>
                                {AYURVEDIC_SKILLS.map((s) => (
                                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input id="specialization" name="specialization" placeholder="e.g. Orthopaedics"
                              value={form.specialization} onChange={handleChange} required
                              className="h-12 bg-secondary/30 border-secondary focus:bg-background transition-all rounded-xl" />
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="qualification" className="flex items-center gap-2">
                            <GraduationCap className="w-3.5 h-3.5 text-muted-foreground" /> Qualification <span className="text-attention">*</span>
                          </Label>
                          <Input id="qualification" name="qualification" placeholder="e.g. MBBS, MD"
                            value={form.qualification} onChange={handleChange} required
                            className="h-12 bg-secondary/30 border-secondary focus:bg-background transition-all rounded-xl" />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="yearsExperience" className="flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-muted-foreground" /> Years of Experience <span className="text-attention">*</span>
                          </Label>
                          <Input id="yearsExperience" name="yearsExperience" type="number" min={0} max={80} placeholder="e.g. 8"
                            value={form.yearsExperience} onChange={handleChange} required
                            className="h-12 bg-secondary/30 border-secondary focus:bg-background transition-all rounded-xl" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="clinic">Clinic / Practice (optional)</Label>
                          <Input id="clinic" name="clinic" placeholder="e.g. Al Shifa Main Clinic"
                            value={form.clinic} onChange={handleChange}
                            className="h-12 bg-secondary/30 border-secondary focus:bg-background transition-all rounded-xl" />
                        </div>
                      </div>

                      {/* Therapist-only — seed the skill matrix at creation so
                          therapist-skill matching works from day one. */}
                      {form.role === "THERAPIST" && (
                        <div className="space-y-3 pt-4 border-t border-border/40">
                          <div className="space-y-1">
                            <Label className="flex items-center gap-2">
                              <Sparkles className="w-3.5 h-3.5 text-muted-foreground" /> Additional Skills (optional)
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              Tap to select any additional Ayurvedic therapies this therapist can perform. Their primary specialization is registered as <span className="font-semibold">Certified</span>; extra skills default to <span className="font-semibold">Experienced</span> — you can refine proficiency later from the Skill Matrix.
                            </p>
                          </div>
                          <ToggleGroup
                            type="multiple"
                            value={form.initialSkills}
                            onValueChange={(vals) => setForm({ ...form, initialSkills: vals })}
                            className="flex flex-wrap justify-start gap-2"
                          >
                            {AYURVEDIC_SKILLS
                              .filter((s) => s.value !== form.specialization)
                              .map((s) => (
                                <ToggleGroupItem
                                  key={s.value}
                                  value={s.value}
                                  className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-full border border-border/60 px-3 h-8 text-xs"
                                >
                                  {s.label}
                                </ToggleGroupItem>
                              ))}
                          </ToggleGroup>
                          {form.initialSkills.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {form.initialSkills.length} additional skill{form.initialSkills.length === 1 ? "" : "s"} selected.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Pharmacist-specific */}
                  {isPharmacist && (
                    <div className="pt-6 mt-6 border-t border-border/50 space-y-6">
                      <div className="flex flex-col gap-1">
                        <h3 className="text-lg font-bold text-foreground">Pharmacist Credentials</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="qualification" className="flex items-center gap-2">
                            <GraduationCap className="w-3.5 h-3.5 text-muted-foreground" /> Qualification <span className="text-attention">*</span>
                          </Label>
                          <Input id="qualification" name="qualification" placeholder="e.g. B.Pharm, Pharm.D"
                            value={form.qualification} onChange={handleChange} required
                            className="h-12 bg-secondary/30 border-secondary focus:bg-background transition-all rounded-xl" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="yearsExperience" className="flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-muted-foreground" /> Years of Experience <span className="text-attention">*</span>
                          </Label>
                          <Input id="yearsExperience" name="yearsExperience" type="number" min={0} max={80} placeholder="e.g. 3"
                            value={form.yearsExperience} onChange={handleChange} required
                            className="h-12 bg-secondary/30 border-secondary focus:bg-background transition-all rounded-xl" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Status */}
                  <div className="min-h-[24px]">
                    {error && <div className="text-attention text-sm font-bold animate-shake">{error}</div>}
                    {success && <div className="text-wellness text-sm font-bold animate-fade-in">{success}</div>}
                    {!error && !success && missingFields.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        Missing: {missingFields.join(", ")}
                      </div>
                    )}
                  </div>
                </CardContent>

                <CardFooter className="bg-secondary/5 border-t border-border/50 p-6 flex justify-end">
                  <Button type="submit" disabled={loading || missingFields.length > 0}
                    className="h-12 px-8 text-lg font-bold rounded-xl shadow-lg">
                    {loading ? (<><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Provisioning...</>) : "Create Identity"}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

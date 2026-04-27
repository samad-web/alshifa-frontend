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
import { UserPlus, ShieldCheck, Mail, Lock, Loader2, ArrowLeft, Building2, Phone, Cake, Briefcase, GraduationCap, Clock, Check, X, Sparkles, BadgeCheck, History, Stethoscope, Copy } from "lucide-react";
import { sanitizeName, sanitizePhone, isValidPhone, isValidEmail, checkPassword, isPasswordAcceptable, stripLeadingSpaces, stripEdgeSpaces } from "@/lib/input-validators";
import { useBranches } from "@/hooks/useBranches";
import { apiClient } from "@/lib/api-client";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

type Role = "ADMIN" | "ADMIN_DOCTOR" | "BRANCH_ADMIN" | "DOCTOR" | "THERAPIST" | "PATIENT" | "PHARMACIST";

const roles: { value: Role; label: string }[] = [
  { value: "ADMIN", label: "System Admin" },
  { value: "ADMIN_DOCTOR", label: "Admin Doctor" },
  { value: "BRANCH_ADMIN", label: "Branch Admin" },
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

type Proficiency = "CERTIFIED" | "EXPERIENCED" | "LEARNING";

interface SkillEntry {
  skill: string;
  proficiency: Proficiency;
}

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
  /** Therapist-only: additional AyurvedicSkill values + proficiency,
   *  beyond the primary specialization (which is always CERTIFIED).
   *  Seeds the TherapistSkill matrix on create so therapist-skill matching
   *  works from day one. */
  initialSkills: SkillEntry[];
  // Patient-only intake history. New patients have no prior doctor; returning
  // patients must name the doctor previously consulted so the clinic can
  // pull continuity-of-care notes if needed.
  patientType: "" | "NEW" | "RETURNING";
  previousDoctorName: string;
  previousDoctorDetails: string;
}

const EMPTY_FORM: FormState = {
  email: "", password: "", fullName: "", role: "PATIENT", branchId: "",
  phoneNumber: "", dob: "", gender: "", therapyType: "",
  specialization: "", qualification: "", yearsExperience: "", clinic: "",
  registrationNumber: "",
  initialSkills: [],
  patientType: "", previousDoctorName: "", previousDoctorDetails: "",
};

const PROFICIENCY_LEVELS: { value: Proficiency; label: string; tone: string; tip: string }[] = [
  {
    value: "CERTIFIED",
    label: "Certified",
    tone: "data-[state=on]:bg-wellness data-[state=on]:text-white",
    tip: "Holds a formal certification from an AYUSH / Ayurvedic board.",
  },
  {
    value: "EXPERIENCED",
    label: "Experienced",
    tone: "data-[state=on]:bg-primary data-[state=on]:text-primary-foreground",
    tip: "Performs the therapy regularly without formal certification.",
  },
  {
    value: "LEARNING",
    label: "Learning",
    tone: "data-[state=on]:bg-amber-500 data-[state=on]:text-white",
    tip: "Trainee — not yet routed solo for this therapy.",
  },
];

/** Derive auto-generated patient credentials from the entered name.
 *  Format: `<FirstName>@123` — first letter capitalized, rest lower. */
function buildPatientCredentials(fullName: string): string {
  const first = (fullName || "").trim().split(/\s+/)[0] || "";
  if (!first) return "";
  const cleaned = first.replace(/[^A-Za-zÀ-ɏͰ-ϿЀ-ӿ؀-ۿऀ-ॿ஀-௿ఀ-౿]/g, "");
  if (!cleaned) return "";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase() + "@123";
}

// Per-role field requirements — mirrors the backend superRefine so the UI
// surfaces missing fields before the request is sent.
const REQUIRED_BY_ROLE: Record<Role, (keyof FormState)[]> = {
  PATIENT:       ["dob", "gender", "phoneNumber", "patientType"],
  DOCTOR:        ["specialization", "qualification", "yearsExperience", "registrationNumber"],
  ADMIN_DOCTOR:  ["specialization", "qualification", "yearsExperience", "registrationNumber"],
  THERAPIST:     ["specialization", "qualification", "yearsExperience", "registrationNumber"],
  PHARMACIST:    ["qualification", "yearsExperience"],
  ADMIN:         [],
  // BRANCH_ADMIN is a flat User pinned to a single branch — no profile
  // table to populate. branchId is already required for everyone, which
  // covers BRANCH_ADMIN's hard-pinning requirement.
  BRANCH_ADMIN:  [],
};

export default function CreateUser() {
  const { role: viewerRole } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [credentialsModal, setCredentialsModal] = useState<null | {
    email: string; patientId: string; password: string;
  }>(null);
  const { branches } = useBranches();

  const requiredForRole = REQUIRED_BY_ROLE[form.role];

  const missingFields = useMemo(() => {
    const missing: string[] = [];
    const isPatientRole = form.role === "PATIENT";
    if (!form.email) missing.push("email");
    // Patient passwords are auto-generated from the first name — don't
    // require the admin to enter one for that role.
    if (!form.password && !isPatientRole) missing.push("password");
    if (form.fullName.trim().length < 2) missing.push("fullName");
    if (!form.branchId) missing.push("branchId");
    for (const f of requiredForRole) {
      const v = form[f];
      if (v === undefined || v === null || String(v).trim() === "") missing.push(f as string);
    }
    if (isPatientRole && form.patientType === "RETURNING" && !form.previousDoctorName.trim()) {
      missing.push("previousDoctorName");
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
    const isPatientRole = form.role === "PATIENT";
    // Patients get auto-generated credentials based on their first name —
    // <FirstName>@123 is used as both the human-friendly Patient ID and
    // the initial password. The admin sees the values in a confirmation
    // modal after creation succeeds.
    const generatedCreds = isPatientRole ? buildPatientCredentials(form.fullName) : "";
    const p: Record<string, unknown> = {
      email: stripEdgeSpaces(form.email),
      password: isPatientRole ? generatedCreds : stripEdgeSpaces(form.password),
      fullName: form.fullName,
      role: form.role,
      branchId: form.branchId,
    };
    if (form.phoneNumber) p.phoneNumber = form.phoneNumber;

    if (isPatientRole) {
      if (form.dob) p.dob = form.dob;
      if (form.gender) p.gender = form.gender;
      if (form.therapyType) p.therapyType = form.therapyType;
      if (generatedCreds) p.patientId = generatedCreds;
      // Medical history captured at intake. Stored on the Patient record
      // (onboardingData) so it surfaces in triage / consultation views.
      if (form.patientType) {
        p.medicalHistory = {
          patientType: form.patientType,
          previousDoctorName: form.previousDoctorName.trim() || null,
          previousDoctorDetails: form.previousDoctorDetails.trim() || null,
        };
      }
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
      // Each entry includes the admin-chosen proficiency.
      p.initialSkills = form.initialSkills
        .filter((s) => s.skill !== form.specialization)
        .map((s) => ({ skill: s.skill, proficiency: s.proficiency }));
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
    const isPatientRole = form.role === "PATIENT";
    const generatedCreds = isPatientRole ? buildPatientCredentials(form.fullName) : "";
    if (isPatientRole) {
      if (!generatedCreds) {
        setError("Cannot generate Patient ID — first name must contain at least one letter.");
        return;
      }
    } else if (!isPasswordAcceptable(form.password)) {
      setError("Password doesn't meet the strength requirements.");
      return;
    }
    if (form.phoneNumber && !isValidPhone(form.phoneNumber)) {
      setError("Phone number must contain 7–15 digits (optionally with a leading +).");
      return;
    }
    setLoading(true);
    try {
      const payload = buildPayload();
      await apiClient.post('/api/user/create', payload);
      setSuccess("User identity created successfully.");
      if (isPatientRole) {
        setCredentialsModal({
          email: stripEdgeSpaces(form.email),
          patientId: generatedCreds,
          password: generatedCreds,
        });
      }
      setForm(EMPTY_FORM);
    } catch (err: any) {
      setError(err?.message || "Failed to create user");
    }
    setLoading(false);
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard`);
    } catch {
      toast.error("Could not copy to clipboard");
    }
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
                  {isPatient
                    ? "Patients receive an auto-generated ID and password (FirstName@123). Staff accounts require a strong password (min 8 chars, mixed case, number, symbol)."
                    : "Every user requires a unique email and strong password (min 8 chars, mixed case, number, symbol)."}
                </p>
                <div className="p-3 bg-background rounded-xl border border-border/50">
                  <p className="text-[11px] font-bold text-primary uppercase tracking-widest mb-1">Required profile</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {isPatient && (<>
                      <li>• Date of birth (age derived)</li>
                      <li>• Gender</li>
                      <li>• Phone number</li>
                      <li>• Patient type (new / returning)</li>
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
                    {form.role === "BRANCH_ADMIN" && (
                      <>
                        <li>• Pinned to the assigned branch above</li>
                        <li>• No additional profile fields</li>
                      </>
                    )}
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
                      {isPatient ? (
                        <div className="h-12 px-3 flex items-center justify-between gap-3 rounded-xl border border-dashed border-primary/30 bg-primary/5">
                          <div className="flex items-center gap-2 text-xs text-primary/90">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>
                              Auto-generated from first name:&nbsp;
                              <span className="font-mono font-bold">
                                {buildPatientCredentials(form.fullName) || "<FirstName>@123"}
                              </span>
                            </span>
                          </div>
                        </div>
                      ) : (
                        <Input id="password" name="password" type="password" placeholder="••••••••"
                          value={form.password} onChange={handleChange} onBlur={handleBlur} required minLength={8}
                          autoComplete="new-password"
                          className="h-12 bg-secondary/30 border-secondary focus:bg-background transition-all rounded-xl" />
                      )}
                      {!isPatient && showPasswordChecklist && (
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
                          <DatePicker
                            id="dob"
                            value={form.dob}
                            onChange={(iso) => setForm((prev) => ({ ...prev, dob: iso }))}
                            placeholder="Select date of birth"
                            toDate={new Date()}
                            required
                            className="h-12 bg-secondary/30 border-secondary hover:bg-background focus:bg-background transition-all rounded-xl"
                          />
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

                      {/* Medical History — captures whether the patient has
                          consulted elsewhere before so the doctor can pull
                          continuity-of-care notes. */}
                      <div className="pt-2 space-y-4">
                        <div className="flex items-center gap-2">
                          <History className="w-4 h-4 text-primary" />
                          <h4 className="text-base font-bold text-foreground">Medical History</h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label htmlFor="patientType">
                              Patient Type <span className="text-attention">*</span>
                            </Label>
                            <Select
                              value={form.patientType || undefined}
                              onValueChange={(val) =>
                                setForm({
                                  ...form,
                                  patientType: val as FormState["patientType"],
                                  // Clear previous-doctor fields if switching to NEW.
                                  ...(val === "NEW"
                                    ? { previousDoctorName: "", previousDoctorDetails: "" }
                                    : {}),
                                })
                              }
                            >
                              <SelectTrigger className="h-12 bg-secondary/30 border-secondary focus:bg-background transition-all rounded-xl">
                                <SelectValue placeholder="Is this patient new or returning?" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="NEW">New patient</SelectItem>
                                <SelectItem value="RETURNING">Returning / previously consulted elsewhere</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {form.patientType === "RETURNING" && (
                            <div className="space-y-2">
                              <Label htmlFor="previousDoctorName" className="flex items-center gap-2">
                                <Stethoscope className="w-3.5 h-3.5 text-muted-foreground" />
                                Previous Doctor Name <span className="text-attention">*</span>
                              </Label>
                              <Input
                                id="previousDoctorName"
                                name="previousDoctorName"
                                placeholder="e.g. Dr. Anita Rao"
                                value={form.previousDoctorName}
                                onChange={(e) => setForm({ ...form, previousDoctorName: sanitizeName(e.target.value) })}
                                className="h-12 bg-secondary/30 border-secondary focus:bg-background transition-all rounded-xl"
                              />
                            </div>
                          )}
                        </div>
                        {form.patientType === "RETURNING" && (
                          <div className="space-y-2">
                            <Label htmlFor="previousDoctorDetails">Previous Doctor / Clinic Details (optional)</Label>
                            <Input
                              id="previousDoctorDetails"
                              name="previousDoctorDetails"
                              placeholder="Clinic, specialization, contact details, last visit date…"
                              value={form.previousDoctorDetails}
                              onChange={(e) => setForm({ ...form, previousDoctorDetails: e.target.value })}
                              className="h-12 bg-secondary/30 border-secondary focus:bg-background transition-all rounded-xl"
                            />
                            <p className="text-[11px] text-muted-foreground ml-1">
                              Used by the treating doctor to request prior records or coordinate continuity of care.
                            </p>
                          </div>
                        )}
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
                          therapist-skill matching works from day one. The
                          admin picks both the skill and the proficiency
                          level for each row, so a therapist's record is
                          honest about what they can actually be routed to. */}
                      {form.role === "THERAPIST" && (
                        <div className="space-y-4 pt-4 border-t border-border/40">
                          <div className="space-y-1">
                            <Label className="flex items-center gap-2">
                              <Sparkles className="w-3.5 h-3.5 text-muted-foreground" /> Additional Skills & Proficiency (optional)
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              Pick each Ayurvedic therapy this therapist can perform and the proficiency level. Their primary
                              specialization (<span className="font-semibold">{AYURVEDIC_SKILLS.find((s) => s.value === form.specialization)?.label || "—"}</span>)
                              is automatically registered as <span className="font-semibold text-wellness">Certified</span>.
                            </p>
                          </div>
                          <div className="space-y-2">
                            {AYURVEDIC_SKILLS
                              .filter((s) => s.value !== form.specialization)
                              .map((s) => {
                                const entry = form.initialSkills.find((x) => x.skill === s.value);
                                const isSelected = !!entry;
                                return (
                                  <div
                                    key={s.value}
                                    className={`flex flex-wrap items-center justify-between gap-3 px-3 py-2 rounded-xl border transition-colors ${
                                      isSelected ? "border-primary/40 bg-primary/5" : "border-border/60 bg-secondary/10"
                                    }`}
                                  >
                                    <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                                      <input
                                        type="checkbox"
                                        className="w-4 h-4 accent-primary"
                                        checked={isSelected}
                                        onChange={(e) => {
                                          const next = e.target.checked
                                            ? [...form.initialSkills, { skill: s.value, proficiency: "EXPERIENCED" as Proficiency }]
                                            : form.initialSkills.filter((x) => x.skill !== s.value);
                                          setForm({ ...form, initialSkills: next });
                                        }}
                                      />
                                      <span className="text-sm">{s.label}</span>
                                    </label>
                                    {isSelected && (
                                      <ToggleGroup
                                        type="single"
                                        value={entry!.proficiency}
                                        onValueChange={(val) => {
                                          if (!val) return;
                                          setForm({
                                            ...form,
                                            initialSkills: form.initialSkills.map((x) =>
                                              x.skill === s.value ? { ...x, proficiency: val as Proficiency } : x
                                            ),
                                          });
                                        }}
                                        className="gap-1"
                                      >
                                        {PROFICIENCY_LEVELS.map((p) => (
                                          <ToggleGroupItem
                                            key={p.value}
                                            value={p.value}
                                            title={p.tip}
                                            className={`h-7 px-2.5 text-[11px] rounded-full border border-border/60 ${p.tone}`}
                                          >
                                            {p.label}
                                          </ToggleGroupItem>
                                        ))}
                                      </ToggleGroup>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
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

      {/* Auto-generated patient credentials — shown ONCE after creation
          so the admin can hand them off. We deliberately do not log or
          persist these client-side beyond this dialog. */}
      <Dialog
        open={!!credentialsModal}
        onOpenChange={(open) => { if (!open) setCredentialsModal(null); }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BadgeCheck className="w-5 h-5 text-wellness" />
              Patient credentials generated
            </DialogTitle>
            <DialogDescription>
              Share these with the patient. The password is the same as the Patient ID and can
              be changed after first sign-in.
            </DialogDescription>
          </DialogHeader>
          {credentialsModal && (
            <div className="space-y-3 pt-2">
              <CredentialRow
                label="Email"
                value={credentialsModal.email}
                onCopy={() => copyToClipboard(credentialsModal.email, "Email")}
              />
              <CredentialRow
                label="Patient ID"
                value={credentialsModal.patientId}
                onCopy={() => copyToClipboard(credentialsModal.patientId, "Patient ID")}
                mono
              />
              <CredentialRow
                label="Password"
                value={credentialsModal.password}
                onCopy={() => copyToClipboard(credentialsModal.password, "Password")}
                mono
              />
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (!credentialsModal) return;
                copyToClipboard(
                  `Patient ID: ${credentialsModal.patientId}\nPassword: ${credentialsModal.password}`,
                  "Credentials"
                );
              }}
            >
              <Copy className="w-4 h-4 mr-2" /> Copy both
            </Button>
            <Button onClick={() => setCredentialsModal(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function CredentialRow({
  label, value, onCopy, mono,
}: { label: string; value: string; onCopy: () => void; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border/60 bg-secondary/20">
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{label}</div>
        <div className={`text-sm truncate ${mono ? "font-mono" : ""}`}>{value}</div>
      </div>
      <Button type="button" size="sm" variant="ghost" onClick={onCopy} className="shrink-0">
        <Copy className="w-3.5 h-3.5 mr-1" /> Copy
      </Button>
    </div>
  );
}

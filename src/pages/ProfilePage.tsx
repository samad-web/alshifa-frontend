import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api-client";
import {
  Pencil, Save, X, Mail, Phone, Cake, User, Building2, ShieldCheck, Briefcase,
  GraduationCap, Clock, Stethoscope, Activity, Check, Camera, Loader2, Trash2,
  Languages, FileText, BadgeCheck,
} from "lucide-react";
import { sanitizeName, sanitizePhone, stripEdgeSpaces } from "@/lib/input-validators";

const MAX_PHOTO_MB = 5;
const BIO_MAX = 1000;
const LANGUAGES_MAX = 10;

type ClinicianProfile = {
  id: string;
  fullName: string | null;
  specialization: string | null;
  qualification: string | null;
  yearsExperience: number | null;
  clinic: string | null;
  profilePhoto: string | null;
  registrationNumber: string | null;
  phoneNumber: string | null;
  bio: string | null;
  languages: string[] | null;
  updatedAt?: string;
};

type PharmacistProfile = {
  id: string;
  fullName: string | null;
  qualification: string | null;
  yearsExperience: number | null;
  profilePhoto: string | null;
  phoneNumber: string | null;
  bio: string | null;
  languages: string[] | null;
  updatedAt?: string;
};

type PatientProfile = {
  id: string;
  fullName: string | null;
  dob: string | null;
  age: number | null;
  gender: string | null;
  phoneNumber: string | null;
  therapyType: string | null;
  patientId: string | null;
  zenPoints: number;
  profilePhoto: string | null;
};

type MeResponse = {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  emailVerifiedAt: string | null;
  mfaEnabled: boolean;
  branch: { id: string; name: string; address: string | null } | null;
  hospital: { id: string; name: string; slug: string; plan: string } | null;
  doctor?: ClinicianProfile | null;
  therapist?: ClinicianProfile | null;
  pharmacist?: PharmacistProfile | null;
  patient?: PatientProfile | null;
};

const GENDERS = [
  { value: "FEMALE", label: "Female" },
  { value: "MALE", label: "Male" },
  { value: "OTHER", label: "Other" },
  { value: "PREFER_NOT_TO_SAY", label: "Prefer not to say" },
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function parseLanguagesInput(raw: string): string[] {
  return Array.from(
    new Map(
      raw.split(/[,\n]/).map((s) => s.trim()).filter(Boolean)
        .map((s) => [s.toLowerCase(), s]),
    ).values(),
  ).slice(0, LANGUAGES_MAX);
}

function Row({ icon: Icon, label, value }: { icon: any; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b last:border-0 border-border/50">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-sm font-medium text-foreground mt-0.5 whitespace-pre-wrap break-words">
          {value === null || value === undefined || value === "" ? (
            <span className="text-muted-foreground italic">Not set</span>
          ) : value}
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { role } = useAuth();

  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [buf, setBuf] = useState<Record<string, any>>({});

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get<MeResponse>('/api/user/me');
      setMe(data);
    } catch (err: any) {
      toast({ title: "Failed to load profile", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const profileData = useMemo(() => {
    if (!me) return null;
    if (me.role === "DOCTOR" || me.role === "ADMIN_DOCTOR") return me.doctor;
    if (me.role === "THERAPIST") return me.therapist;
    if (me.role === "PHARMACIST") return me.pharmacist;
    if (me.role === "PATIENT") return me.patient;
    return null;
  }, [me]);

  const displayName = (profileData as any)?.fullName ?? me?.email ?? "User";
  const photoUrl = (profileData as any)?.profilePhoto ?? null;

  const openFilePicker = () => fileInputRef.current?.click();

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Not an image", description: "Please choose an image file (JPG, PNG, WEBP).", variant: "destructive" });
      return;
    }
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      toast({ title: "Image too large", description: `Max size is ${MAX_PHOTO_MB} MB.`, variant: "destructive" });
      return;
    }
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await apiClient.upload<{ url: string; user: MeResponse }>("/api/user/me/photo", fd);
      setMe(data.user);
      toast({ title: "Profile photo updated" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = async () => {
    setUploadingPhoto(true);
    try {
      const { data } = await apiClient.patch<MeResponse>("/api/user/me", { profilePhoto: null });
      setMe(data);
      toast({ title: "Profile photo removed" });
    } catch (err: any) {
      toast({ title: "Remove failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const startEdit = () => {
    if (!me) return;
    const p: any = profileData || {};
    setBuf({
      fullName: p.fullName ?? "",
      // Patient-only
      dob: me.patient?.dob ? String(me.patient.dob).slice(0, 10) : "",
      gender: me.patient?.gender ?? "",
      therapyType: me.patient?.therapyType ?? "",
      // Shared personal details (clinicians, pharmacist, patient)
      phoneNumber: p.phoneNumber ?? me.patient?.phoneNumber ?? "",
      bio: p.bio ?? "",
      languagesText: Array.isArray(p.languages) ? p.languages.join(", ") : "",
      // Clinician-only
      clinic: p.clinic ?? "",
    });
    setEditing(true);
  };

  const cancel = () => { setBuf({}); setEditing(false); };

  const save = async () => {
    if (!me) return;
    const payload: Record<string, any> = {};
    const cleanName = stripEdgeSpaces(buf.fullName ?? "");
    if (cleanName.length >= 2) payload.fullName = cleanName;

    if (me.role === "PATIENT") {
      const cleanPhone = stripEdgeSpaces(buf.phoneNumber ?? "");
      if (cleanPhone) payload.phoneNumber = cleanPhone;
      if (buf.dob) payload.dob = buf.dob;
      if (buf.gender) payload.gender = buf.gender;
      if (buf.therapyType !== undefined) payload.therapyType = stripEdgeSpaces(buf.therapyType) || null;
    }
    if (me.role === "DOCTOR" || me.role === "ADMIN_DOCTOR" || me.role === "THERAPIST") {
      if (buf.clinic !== undefined) payload.clinic = stripEdgeSpaces(buf.clinic) || null;
    }
    if (me.role === "DOCTOR" || me.role === "ADMIN_DOCTOR" || me.role === "THERAPIST" || me.role === "PHARMACIST") {
      if (buf.phoneNumber !== undefined) {
        const cleanPhone = stripEdgeSpaces(buf.phoneNumber ?? "");
        payload.phoneNumber = cleanPhone || null;
      }
      if (buf.bio !== undefined) payload.bio = stripEdgeSpaces(buf.bio) || null;
      if (buf.languagesText !== undefined) payload.languages = parseLanguagesInput(buf.languagesText ?? "");
    }

    setSaving(true);
    try {
      const { data } = await apiClient.patch<MeResponse>('/api/user/me', payload);
      setMe(data);
      setEditing(false);
      toast({ title: "Profile updated" });
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="container max-w-4xl mx-auto px-4 py-8 space-y-6">
          <Skeleton className="h-32" />
          <Skeleton className="h-64" />
        </div>
      </AppLayout>
    );
  }
  if (!me) {
    return (
      <AppLayout>
        <div className="container max-w-4xl mx-auto px-4 py-8">
          <Card><CardContent className="py-10 text-center text-muted-foreground">Profile unavailable.</CardContent></Card>
        </div>
      </AppLayout>
    );
  }

  const isClinician = me.role === "DOCTOR" || me.role === "ADMIN_DOCTOR" || me.role === "THERAPIST";
  const isPharmacist = me.role === "PHARMACIST";
  const isPatient = me.role === "PATIENT";
  const canEdit = isClinician || isPharmacist || isPatient;
  const hasPersonalCard = isClinician || isPharmacist;

  const clinicianData = (isClinician ? profileData : null) as ClinicianProfile | null;
  const pharmacistData = (isPharmacist ? profileData : null) as PharmacistProfile | null;
  const personalData = (clinicianData ?? pharmacistData) as
    | { phoneNumber: string | null; bio: string | null; languages: string[] | null; updatedAt?: string }
    | null;

  const subtitle = clinicianData
    ? [clinicianData.specialization, clinicianData.yearsExperience ? `${clinicianData.yearsExperience} yrs exp` : null]
        .filter(Boolean).join(" • ")
    : pharmacistData
      ? [pharmacistData.qualification, pharmacistData.yearsExperience ? `${pharmacistData.yearsExperience} yrs exp` : null]
          .filter(Boolean).join(" • ")
      : "";

  const languagesList = Array.isArray(personalData?.languages) ? personalData!.languages : [];

  const bioCharCount = (buf.bio ?? "").length;
  const bioOverLimit = bioCharCount > BIO_MAX;

  return (
    <AppLayout>
      <div className="container max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Header card */}
        <Card>
          <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="relative group shrink-0">
              <Avatar className="h-20 w-20">
                {photoUrl && <AvatarImage src={photoUrl} alt={displayName} />}
                <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                  {getInitials(displayName)}
                </AvatarFallback>
              </Avatar>
              {canEdit && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handlePhotoChange}
                  />
                  <button
                    type="button"
                    onClick={openFilePicker}
                    disabled={uploadingPhoto}
                    aria-label="Change profile photo"
                    className="absolute inset-0 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity flex items-center justify-center disabled:cursor-wait"
                  >
                    {uploadingPhoto
                      ? <Loader2 className="h-5 w-5 animate-spin" />
                      : <Camera className="h-5 w-5" />}
                  </button>
                  {photoUrl && !uploadingPhoto && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      aria-label="Remove profile photo"
                      title="Remove profile photo"
                      className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-background border border-border shadow-sm flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold truncate">{displayName}</h1>
              {subtitle && (
                <p className="text-sm text-primary font-medium truncate mt-0.5">{subtitle}</p>
              )}
              <p className="text-sm text-muted-foreground truncate">{me.email}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="secondary">{me.role.replace("_", " ")}</Badge>
                {me.branch && <Badge variant="outline">{me.branch.name}</Badge>}
                {me.hospital && <Badge variant="outline">{me.hospital.plan}</Badge>}
                {me.emailVerifiedAt && (
                  <Badge variant="outline" className="gap-1">
                    <Check className="h-3 w-3" /> Email verified
                  </Badge>
                )}
                {me.mfaEnabled && <Badge variant="outline">MFA enabled</Badge>}
              </div>
            </div>
            {canEdit && !editing && (
              <Button variant="outline" onClick={startEdit}>
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </Button>
            )}
            {editing && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={cancel} disabled={saving}>
                  <X className="mr-2 h-4 w-4" /> Cancel
                </Button>
                <Button onClick={save} disabled={saving || bioOverLimit}>
                  <Save className="mr-2 h-4 w-4" /> {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Account details (read-only — identity fields) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account</CardTitle>
            <CardDescription>Email, role, and branch are managed by an administrator.</CardDescription>
          </CardHeader>
          <CardContent>
            <Row icon={Mail}         label="Email"       value={me.email} />
            <Row icon={ShieldCheck}  label="Role"        value={me.role.replace("_", " ")} />
            <Row icon={Building2}    label="Branch"      value={me.branch ? me.branch.name : null} />
            {me.hospital && (
              <Row icon={Stethoscope} label="Hospital"    value={`${me.hospital.name} (${me.hospital.plan})`} />
            )}
            <Row icon={Activity}     label="Member since" value={new Date(me.createdAt).toLocaleDateString()} />
          </CardContent>
        </Card>

        {/* Role-specific section */}
        {isPatient && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Patient details</CardTitle>
              <CardDescription>Used by triage for age-adjusted urgency and pregnancy context.</CardDescription>
            </CardHeader>
            <CardContent>
              {editing ? (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="fullName">Full name</Label>
                    <Input id="fullName" value={buf.fullName}
                           onChange={(e) => setBuf({ ...buf, fullName: sanitizeName(e.target.value) })}
                           onBlur={() => setBuf(b => ({ ...b, fullName: stripEdgeSpaces(b.fullName ?? "") }))} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="dob">Date of birth</Label>
                      <Input id="dob" type="date" value={buf.dob}
                             onChange={(e) => setBuf({ ...buf, dob: e.target.value })} />
                    </div>
                    <div>
                      <Label htmlFor="gender">Gender</Label>
                      <Select value={buf.gender} onValueChange={(v) => setBuf({ ...buf, gender: v })}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {GENDERS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="phone">Phone</Label>
                      <Input id="phone" type="tel" inputMode="tel" autoComplete="tel"
                             placeholder="+919876543210" value={buf.phoneNumber}
                             onChange={(e) => setBuf({ ...buf, phoneNumber: sanitizePhone(e.target.value) })}
                             onBlur={() => setBuf(b => ({ ...b, phoneNumber: stripEdgeSpaces(b.phoneNumber ?? "") }))} />
                    </div>
                    <div>
                      <Label htmlFor="therapyType">Therapy type</Label>
                      <Input id="therapyType" value={buf.therapyType}
                             onChange={(e) => setBuf({ ...buf, therapyType: e.target.value })} />
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <Row icon={User}  label="Full name"    value={me.patient?.fullName} />
                  <Row icon={Cake}  label="Date of birth" value={me.patient?.dob ? new Date(me.patient.dob).toLocaleDateString() : null} />
                  <Row icon={Cake}  label="Age"          value={me.patient?.age} />
                  <Row icon={User}  label="Gender"       value={me.patient?.gender ? me.patient.gender.replace(/_/g, " ").toLowerCase() : null} />
                  <Row icon={Phone} label="Phone"        value={me.patient?.phoneNumber} />
                  <Row icon={Activity} label="Therapy type" value={me.patient?.therapyType} />
                  <Row icon={Activity} label="Zen points"   value={me.patient?.zenPoints} />
                  {me.patient?.patientId && (
                    <Row icon={ShieldCheck} label="Patient ID" value={me.patient.patientId} />
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {isClinician && clinicianData && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Clinical credentials</CardTitle>
              <CardDescription>
                Specialization, qualification, experience, and registration are managed by an administrator. You can update your clinic below.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Row icon={Briefcase}      label="Specialization"      value={clinicianData.specialization} />
              <Row icon={GraduationCap}  label="Qualification"       value={clinicianData.qualification} />
              <Row icon={Clock}          label="Years of experience" value={clinicianData.yearsExperience} />
              <Row icon={BadgeCheck}     label="Registration number" value={clinicianData.registrationNumber} />
              {editing ? (
                <div className="pt-3">
                  <Label htmlFor="clinic">Clinic / Practice</Label>
                  <Input id="clinic" value={buf.clinic}
                         placeholder="e.g. Vaidya Clinic, Mumbai"
                         onChange={(e) => setBuf({ ...buf, clinic: e.target.value })}
                         onBlur={() => setBuf(b => ({ ...b, clinic: stripEdgeSpaces(b.clinic ?? "") }))} />
                </div>
              ) : (
                <Row icon={Building2}    label="Clinic / Practice"   value={clinicianData.clinic} />
              )}
            </CardContent>
          </Card>
        )}

        {hasPersonalCard && personalData && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Personal details</CardTitle>
              <CardDescription>
                Help patients and colleagues reach you and get to know your background.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {editing ? (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="fullName">Full name</Label>
                    <Input id="fullName" value={buf.fullName}
                           onChange={(e) => setBuf({ ...buf, fullName: sanitizeName(e.target.value) })}
                           onBlur={() => setBuf(b => ({ ...b, fullName: stripEdgeSpaces(b.fullName ?? "") }))} />
                  </div>
                  <div>
                    <Label htmlFor="phone">Contact phone</Label>
                    <Input id="phone" type="tel" inputMode="tel" autoComplete="tel"
                           placeholder="+919876543210" value={buf.phoneNumber}
                           onChange={(e) => setBuf({ ...buf, phoneNumber: sanitizePhone(e.target.value) })}
                           onBlur={() => setBuf(b => ({ ...b, phoneNumber: stripEdgeSpaces(b.phoneNumber ?? "") }))} />
                    <p className="text-xs text-muted-foreground mt-1">Visible to admins and staff for coordination. 7–15 digits, optional leading +.</p>
                  </div>
                  <div>
                    <Label htmlFor="languages">Languages spoken</Label>
                    <Input id="languages" value={buf.languagesText}
                           placeholder="English, Tamil, Hindi"
                           onChange={(e) => setBuf({ ...buf, languagesText: e.target.value })} />
                    <p className="text-xs text-muted-foreground mt-1">Comma-separated. Up to {LANGUAGES_MAX} languages.</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="bio">About / bio</Label>
                      <span className={`text-xs ${bioOverLimit ? "text-destructive" : "text-muted-foreground"}`}>
                        {bioCharCount}/{BIO_MAX}
                      </span>
                    </div>
                    <Textarea
                      id="bio"
                      rows={5}
                      value={buf.bio}
                      placeholder="A short professional bio — areas of focus, approach to care, anything patients should know."
                      onChange={(e) => setBuf({ ...buf, bio: e.target.value })}
                    />
                    {bioOverLimit && (
                      <p className="text-xs text-destructive mt-1">Bio must be {BIO_MAX} characters or fewer.</p>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <Row icon={User}      label="Full name"    value={(profileData as any)?.fullName} />
                  <Row icon={Phone}     label="Contact phone" value={personalData.phoneNumber} />
                  <Row icon={Languages} label="Languages" value={
                    languagesList.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {languagesList.map((lang) => (
                          <Badge key={lang} variant="secondary" className="font-normal">{lang}</Badge>
                        ))}
                      </div>
                    ) : null
                  } />
                  <Row icon={FileText}  label="About" value={personalData.bio} />
                  {personalData.updatedAt && (
                    <>
                      <Separator className="my-2" />
                      <p className="text-xs text-muted-foreground">
                        Last updated {new Date(personalData.updatedAt).toLocaleString()}
                      </p>
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {isPharmacist && pharmacistData && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pharmacist credentials</CardTitle>
              <CardDescription>Qualification and years of experience are managed by an administrator.</CardDescription>
            </CardHeader>
            <CardContent>
              <Row icon={GraduationCap} label="Qualification"        value={pharmacistData.qualification} />
              <Row icon={Clock}         label="Years of experience"  value={pharmacistData.yearsExperience} />
            </CardContent>
          </Card>
        )}

        {/* Security */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Security</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => navigate("/forgot-password")}>
              Change password
            </Button>
            {!me.mfaEnabled && (
              <Button variant="outline" onClick={() => navigate("/mfa/setup")}>
                Enable two-factor authentication
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

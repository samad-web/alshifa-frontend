/**
 * Patient Profile — Home Therapy Location card (Task 10).
 *
 * Shows the patient's home address, a verified/unverified badge, primary
 * and alternative phone numbers (tap to call), an embedded Google Map
 * preview, and a "Re-verify Location" button that re-fires the
 * geocode-on-update path. When `locationVerified === false`, an amber
 * banner sits at the top of the card to flag that home-therapy sessions
 * cannot be scheduled until the address resolves.
 *
 * Admins (ADMIN, ADMIN_DOCTOR) also get an inline "Edit / Add Address"
 * affordance that PATCHes the patient row and triggers a server-side
 * re-geocode — the only path to set or correct a patient's address
 * post-creation.
 *
 * Map gracefully degrades when VITE_GOOGLE_MAPS_API_KEY is unset — the
 * card still renders address + verification UI, just without the map
 * preview.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  GoogleMap,
  Marker,
  useJsApiLoader,
} from "@react-google-maps/api";
import {
  MapPin, Phone, ShieldCheck, ShieldAlert, RefreshCw, Home, Loader2,
  AlertTriangle, Pencil, Save, X,
} from "lucide-react";

const MAP_LIBRARIES: ("places" | "geometry" | "drawing" | "visualization")[] = [];

const MAP_CONTAINER_STYLE = { width: "100%", height: "180px" };

export interface PatientLocationFields {
  id: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  primaryPhone?: string | null;
  alternativePhone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationVerified?: boolean;
}

export interface PatientLocationCardProps {
  patient: PatientLocationFields;
  /** Fired after a successful re-verify with the refreshed patient row. */
  onUpdated?: (patient: PatientLocationFields) => void;
  /**
   * "admin" (default) → reads/writes via /api/user/patient/:id, gated to
   *                     ADMIN / ADMIN_DOCTOR.
   * "self"            → reads/writes via /api/user/me (PATCH/GET), Edit
   *                     button is always shown because the user IS the
   *                     patient. Use on the patient dashboard.
   */
  mode?: "admin" | "self";
}

interface MeResponse {
  patient: PatientLocationFields | null;
}

type EditableDraft = Pick<
  PatientLocationFields,
  "addressLine1" | "addressLine2" | "city" | "state" | "pincode" | "primaryPhone" | "alternativePhone"
>;

const EMPTY_DRAFT: EditableDraft = {
  addressLine1: "", addressLine2: "", city: "", state: "", pincode: "",
  primaryPhone: "", alternativePhone: "",
};

// Allows the user to type natural separators while editing, but the canonical
// stored form is digits + optional leading "+" only — that's what the backend
// regex (/^\+?[0-9]{7,15}$/) accepts.
const sanitizePhone = (raw: string) => raw.replace(/[^0-9+\-\s]/g, "").slice(0, 20);
const normalisePhone = (raw: string) => raw.replace(/[\s-]/g, "");
const PHONE_RE = /^\+?[0-9]{7,15}$/;
/** Empty is valid (the field is optional). Non-empty must match the canonical form. */
const isValidPhone = (raw: string | null | undefined) => {
  const v = (raw ?? "").trim();
  if (v === "") return true;
  return PHONE_RE.test(normalisePhone(v));
};

export function PatientLocationCard({ patient, onUpdated, mode = "admin" }: PatientLocationCardProps) {
  const { toast } = useToast();
  const { role, refreshProfile } = useAuth();
  const [verifying, setVerifying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<EditableDraft>(EMPTY_DRAFT);
  const [local, setLocal] = useState<PatientLocationFields>(patient);

  // Sync the local copy only when the *target patient* changes — i.e. when
  // the parent really swaps to a different record. Depending on `patient`
  // by reference would clobber our freshly saved local state every time the
  // parent re-renders with the same (now-stale) prop, which manifests as
  // "address saved but card still shows No address provided".
  useEffect(() => { setLocal(patient); }, [patient.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // In self-service mode the user IS the patient, so they always have edit
  // rights on their own row. In admin mode we mirror the backend's role gate.
  const canEdit = mode === "self" || role === "ADMIN" || role === "ADMIN_DOCTOR";

  // Normalises the backend response shape so admin (Patient row) and self
  // (/me wrapping the row in `.patient`) hit the same downstream code.
  const refetchPatient = useCallback(async (): Promise<PatientLocationFields | null> => {
    if (mode === "self") {
      const { data } = await apiClient.get<MeResponse>(`/api/user/me`);
      return data?.patient ?? null;
    }
    const { data } = await apiClient.get<PatientLocationFields>(`/api/user/patient/${local.id}`);
    return data;
  }, [mode, local.id]);

  const patchEndpoint = mode === "self" ? `/api/user/me` : `/api/user/patient/${local.id}`;

  // Inline phone validation. Empty is fine (both fields are optional);
  // non-empty must satisfy the same regex the backend uses, so we never
  // ship a draft to the API only to bounce back with a 400.
  const primaryPhoneError = !isValidPhone(draft.primaryPhone)
    ? "Enter 7–15 digits, optional leading +"
    : null;
  const alternativePhoneError = !isValidPhone(draft.alternativePhone)
    ? "Enter 7–15 digits, optional leading +"
    : null;
  const hasFormErrors = !!primaryPhoneError || !!alternativePhoneError;

  // Treat placeholder strings (used in .env templates) as "unset" so the
  // card degrades to its setup notice rather than firing a failing
  // Maps script load with a 403 banner.
  const rawKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  const apiKey = rawKey && !/^REPLACE_WITH_/i.test(rawKey) ? rawKey : undefined;
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey ?? "",
    libraries: MAP_LIBRARIES,
    id: "google-maps-script",
  });

  const fullAddress = useMemo(() => [
    local.addressLine1,
    local.addressLine2,
    local.city,
    local.state,
    local.pincode,
  ].map((p) => (typeof p === "string" ? p.trim() : "")).filter(Boolean).join(", "), [local]);

  const hasCoordinates = local.latitude != null && local.longitude != null;
  const isVerified = !!local.locationVerified && hasCoordinates;
  const hasAddress = fullAddress.length > 0;

  const reverify = useCallback(async () => {
    if (!hasAddress) {
      toast({ title: "No address to verify", variant: "destructive" });
      return;
    }
    setVerifying(true);
    try {
      // PATCH the patient row with the existing address fields. The backend
      // re-runs the geocode and updates latitude/longitude/locationVerified
      // accordingly. Endpoint differs between admin and self-service flows
      // (see `patchEndpoint` above).
      await apiClient.patch(patchEndpoint, {
        addressLine1: local.addressLine1 ?? "",
        addressLine2: local.addressLine2 ?? "",
        city:         local.city ?? "",
        state:        local.state ?? "",
        pincode:      local.pincode ?? "",
      });
      // Read back the canonical row so we reflect the new lat/lng / verified flag.
      const refreshed = await refetchPatient();
      if (refreshed) {
        setLocal((prev) => ({ ...prev, ...refreshed }));
        onUpdated?.(refreshed);
      }
      if (mode === "self") {
        try { await refreshProfile(); } catch { /* ignore */ }
      }
      if (refreshed?.locationVerified) {
        toast({ title: "Location verified", description: "Coordinates refreshed." });
      } else {
        toast({
          title: "Could not verify the address",
          description: "Geocoding returned no match — review and re-save the address.",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Re-verify failed",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    } finally {
      setVerifying(false);
    }
  }, [hasAddress, mode, patchEndpoint, refetchPatient, local.addressLine1, local.addressLine2, local.city, local.state, local.pincode, onUpdated, refreshProfile, toast]);

  const openEdit = useCallback(() => {
    setDraft({
      addressLine1:     local.addressLine1     ?? "",
      addressLine2:     local.addressLine2     ?? "",
      city:             local.city             ?? "",
      state:            local.state            ?? "",
      pincode:          local.pincode          ?? "",
      primaryPhone:     local.primaryPhone     ?? "",
      alternativePhone: local.alternativePhone ?? "",
    });
    setEditing(true);
  }, [local]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
    setDraft(EMPTY_DRAFT);
  }, []);

  const saveEdit = useCallback(async () => {
    // Defence-in-depth: the Save button is disabled when phones are invalid,
    // but guard against keyboard activation / programmatic clicks too.
    if (!isValidPhone(draft.primaryPhone) || !isValidPhone(draft.alternativePhone)) {
      toast({
        title: "Check your phone number",
        description: "Enter 7–15 digits, optional leading +.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      // Strings are sent as-is (including empty). Backend re-runs the geocode
      // and refreshes latitude/longitude/locationVerified. Phones are
      // canonicalised (digits + optional +) so the backend regex passes
      // even when the user typed natural separators while editing.
      const payload = {
        addressLine1:     draft.addressLine1     ?? "",
        addressLine2:     draft.addressLine2     ?? "",
        city:             draft.city             ?? "",
        state:            draft.state            ?? "",
        pincode:          draft.pincode          ?? "",
        primaryPhone:     normalisePhone(draft.primaryPhone     ?? ""),
        alternativePhone: normalisePhone(draft.alternativePhone ?? ""),
      };
      // Self mode: PATCH /me returns the full user object including the
      // freshly-written patient row, so we use it directly instead of a
      // second GET. Admin mode returns the Patient row directly.
      let refreshed: PatientLocationFields | null = null;
      if (mode === "self") {
        const { data } = await apiClient.patch<MeResponse>(patchEndpoint, payload);
        refreshed = data?.patient ?? null;
      } else {
        const { data } = await apiClient.patch<PatientLocationFields>(patchEndpoint, payload);
        refreshed = data ?? null;
      }
      if (refreshed) {
        setLocal((prev) => ({ ...prev, ...refreshed }));
        onUpdated?.(refreshed);
      }
      // Bust the global auth cache so consumers like the dashboard's
      // "Add your home address" banner pick up the new addressLine1 and
      // disappear immediately. Failure is non-fatal — local state is fresh.
      if (mode === "self") {
        try { await refreshProfile(); } catch { /* ignore */ }
      }
      setEditing(false);
      if (refreshed?.locationVerified) {
        toast({ title: "Address saved", description: "Location verified — map updated." });
      } else {
        toast({
          title: "Address saved",
          description: "Could not verify the location automatically. Try Re-verify Location once the address is correct.",
        });
      }
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }, [mode, patchEndpoint, draft, onUpdated, refreshProfile, toast]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Home className="h-4 w-4 text-primary" />
            Home Therapy Location
          </CardTitle>
          {canEdit && !editing && (
            <Button variant="outline" size="sm" onClick={openEdit} className="gap-2 h-8">
              <Pencil className="w-3.5 h-3.5" />
              {hasAddress ? "Edit" : "Add Address"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {/* Unverified banner */}
        {!isVerified && hasAddress && (
          <div role="alert" className="flex items-start gap-2 rounded-xl border border-amber-300/70 bg-amber-50/80 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Location unverified — home therapy sessions cannot be scheduled until the address is verified.
            </span>
          </div>
        )}
        {!hasAddress && (
          <div role="alert" className="flex items-start gap-2 rounded-xl border border-amber-300/70 bg-amber-50/80 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>No home address on file. Edit the patient record to add one.</span>
          </div>
        )}

        {editing ? (
          <div className="space-y-3 rounded-lg border border-border/60 bg-secondary/10 p-3">
            <div className="space-y-1.5">
              <Label htmlFor="loc-addressLine1" className="text-xs flex items-center gap-1.5">
                <MapPin className="w-3 h-3 text-muted-foreground" /> Address Line 1
              </Label>
              <Input
                id="loc-addressLine1"
                placeholder="Flat / House No., Building, Street"
                value={draft.addressLine1 ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, addressLine1: e.target.value }))}
                maxLength={200}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="loc-addressLine2" className="text-xs">Address Line 2 (optional)</Label>
              <Input
                id="loc-addressLine2"
                placeholder="Area, Landmark"
                value={draft.addressLine2 ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, addressLine2: e.target.value }))}
                maxLength={200}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="loc-city" className="text-xs">City</Label>
                <Input
                  id="loc-city"
                  placeholder="e.g. Chennai"
                  value={draft.city ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))}
                  maxLength={100}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="loc-state" className="text-xs">State</Label>
                <Input
                  id="loc-state"
                  placeholder="e.g. Tamil Nadu"
                  value={draft.state ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, state: e.target.value }))}
                  maxLength={100}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="loc-pincode" className="text-xs">Pincode</Label>
                <Input
                  id="loc-pincode"
                  inputMode="numeric"
                  placeholder="600001"
                  value={draft.pincode ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="loc-primaryPhone" className="text-xs flex items-center gap-1.5">
                  <Phone className="w-3 h-3 text-muted-foreground" /> Primary Phone
                </Label>
                <Input
                  id="loc-primaryPhone"
                  inputMode="tel"
                  placeholder="+91 98xxxx xxxx"
                  value={draft.primaryPhone ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, primaryPhone: sanitizePhone(e.target.value) }))}
                  aria-invalid={primaryPhoneError ? true : undefined}
                  aria-describedby={primaryPhoneError ? "loc-primaryPhone-err" : undefined}
                  className={cn(primaryPhoneError && "border-destructive focus-visible:ring-destructive")}
                />
                {primaryPhoneError && (
                  <p id="loc-primaryPhone-err" className="text-[11px] text-destructive">
                    {primaryPhoneError}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="loc-alternativePhone" className="text-xs">Alternative Phone (optional)</Label>
                <Input
                  id="loc-alternativePhone"
                  inputMode="tel"
                  placeholder="+91 98xxxx xxxx"
                  value={draft.alternativePhone ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, alternativePhone: sanitizePhone(e.target.value) }))}
                  aria-invalid={alternativePhoneError ? true : undefined}
                  aria-describedby={alternativePhoneError ? "loc-alternativePhone-err" : undefined}
                  className={cn(alternativePhoneError && "border-destructive focus-visible:ring-destructive")}
                />
                {alternativePhoneError && (
                  <p id="loc-alternativePhone-err" className="text-[11px] text-destructive">
                    {alternativePhoneError}
                  </p>
                )}
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              The address is geocoded on save so the live-tracking map and route distances refresh immediately.
            </p>
          </div>
        ) : (
          <>
            {/* Address + verified badge */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 min-w-0">
                <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div className="text-sm break-words">
                  {hasAddress ? fullAddress : <span className="text-muted-foreground italic">No address provided</span>}
                </div>
              </div>
              {hasAddress && (
                <Badge
                  className={cn(
                    "shrink-0",
                    isVerified ? "bg-emerald-600 text-white" : "bg-amber-500 text-white",
                  )}
                >
                  {isVerified
                    ? <span className="inline-flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Verified</span>
                    : <span className="inline-flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Unverified</span>}
                </Badge>
              )}
            </div>

            {/* Phones — tappable tel: links */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <PhoneLine label="Primary" value={local.primaryPhone} />
              <PhoneLine label="Alternative" value={local.alternativePhone} />
            </div>
          </>
        )}

        {/* Embedded Map — non-interactive preview */}
        {!apiKey ? (
          <div className="rounded-lg border border-dashed border-border/60 bg-secondary/10 px-3 py-3 text-xs text-muted-foreground">
            Map preview unavailable — set <code className="px-1 py-0.5 bg-background/40 rounded">VITE_GOOGLE_MAPS_API_KEY</code> to enable.
          </div>
        ) : !hasCoordinates ? (
          <div className="rounded-lg border border-dashed border-border/60 bg-secondary/10 px-3 py-3 text-xs text-muted-foreground">
            Map preview will appear once the address is verified.
          </div>
        ) : loadError ? (
          <div className="rounded-lg border border-red-300/60 bg-red-50/60 px-3 py-3 text-xs text-red-700">
            Map failed to load: {String(loadError.message)}
          </div>
        ) : !isLoaded ? (
          <div className="rounded-lg border border-border/60 bg-secondary/10 px-3 py-3 text-xs text-muted-foreground inline-flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading map…
          </div>
        ) : (
          <div className="rounded-lg overflow-hidden border border-border/60">
            <GoogleMap
              mapContainerStyle={MAP_CONTAINER_STYLE}
              center={{ lat: local.latitude!, lng: local.longitude! }}
              zoom={15}
              options={{
                disableDefaultUI: true,
                draggable: false,
                scrollwheel: false,
                disableDoubleClickZoom: true,
                clickableIcons: false,
                gestureHandling: "none",
              }}
            >
              <Marker position={{ lat: local.latitude!, lng: local.longitude! }} />
            </GoogleMap>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          {editing ? (
            <>
              <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={saving} className="gap-2">
                <X className="w-4 h-4" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={saveEdit}
                disabled={saving || hasFormErrors}
                title={hasFormErrors ? "Fix the highlighted fields before saving." : undefined}
                className="gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Address
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={reverify}
              disabled={verifying || !hasAddress}
              className="gap-2"
            >
              {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Re-verify Location
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PhoneLine({ label, value }: { label: string; value?: string | null }) {
  if (!value) {
    return (
      <div className="rounded-lg border border-dashed border-border/40 px-3 py-2 text-xs text-muted-foreground">
        <span className="text-[10px] uppercase tracking-wider mr-2">{label}</span>
        Not provided
      </div>
    );
  }
  return (
    <a
      href={`tel:${value}`}
      className="rounded-lg border border-border/60 px-3 py-2 text-sm flex items-center gap-2 hover:bg-secondary/30 transition-colors"
    >
      <Phone className="w-3.5 h-3.5 text-primary" />
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </a>
  );
}

export default PatientLocationCard;

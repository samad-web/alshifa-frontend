/**
 * Home Therapy — Admin Live Map (Task 7).
 *
 * Renders a full-page Google Map with one marker per active HOME session
 * scheduled today plus a marker per patient's home. Subscribes to the
 * dedicated `/home-therapy` Socket.IO namespace and listens for
 * `therapist_location_update` events — on each event the corresponding
 * therapist marker is moved smoothly via `marker.setPosition()` without
 * re-rendering the map.
 *
 * Render strategy:
 *   - Fetch today's HOME sessions with a status in [SCHEDULED,
 *     THERAPIST_EN_ROUTE, THERAPIST_ARRIVED, IN_SESSION].
 *   - Plot two markers per session (therapist + patient home).
 *   - Therapist marker starts at the last known ping (if any).
 *   - DirectionsRenderer drawn only for THERAPIST_EN_ROUTE sessions.
 *   - Sidebar lists all active sessions with status badge + last ping ts.
 *
 * Graceful degrade:
 *   - If `VITE_GOOGLE_MAPS_API_KEY` is unset, render a setup notice instead
 *     of crashing the page. The sidebar list still renders so admins can
 *     see who's out and which status they're in even without the map.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import { useBranchScope } from "@/hooks/useBranchScope";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { io, type Socket } from "socket.io-client";
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  DirectionsRenderer,
} from "@react-google-maps/api";
import {
  RefreshCw,
  MapPin,
  Loader2,
  Home,
  AlertCircle,
} from "lucide-react";
import {
  homeTherapyService,
  type HomeTherapySession,
  type HomeTherapySessionStatus,
} from "@/services/homeTherapy.service";

const ACTIVE_HOME_STATUSES: HomeTherapySessionStatus[] = [
  "SCHEDULED", "THERAPIST_EN_ROUTE", "THERAPIST_ARRIVED", "IN_SESSION",
];

const STATUS_TONE: Record<HomeTherapySessionStatus, string> = {
  SCHEDULED:          "bg-slate-500 text-white",
  THERAPIST_EN_ROUTE: "bg-amber-500 text-white",
  THERAPIST_ARRIVED:  "bg-blue-600 text-white",
  IN_SESSION:         "bg-emerald-600 text-white",
  COMPLETED:          "bg-emerald-700 text-white",
  CANCELLED:          "bg-slate-400 text-white",
  NO_SHOW:            "bg-red-500 text-white",
};

const MAP_CONTAINER_STYLE = { width: "100%", height: "100%" };

// Default centre — Chennai, India. Overwritten by the first plotted session.
const DEFAULT_CENTER = { lat: 13.0827, lng: 80.2707 };

// Cast to satisfy @react-google-maps types — `libraries` must be a string array.
const MAP_LIBRARIES: ("places" | "geometry" | "drawing" | "visualization")[] = [];

interface MarkerPos { lat: number; lng: number }
interface TherapistMarkerState {
  sessionId: string;
  position: MarkerPos | null;
  lastPingAt: string | null;
  fullName: string;
  status: HomeTherapySessionStatus;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

export default function HomeTherapyLiveMap() {
  const { toast } = useToast();
  const { profile, role } = useAuth();
  const { branchIdParam } = useBranchScope();
  // BRANCH_ADMIN stays pinned to their own branch; ADMIN and ADMIN_DOCTOR
  // follow the navbar scope. ADMIN_DOCTOR was previously locked to the
  // home branch here, which appeared as "stuck on Chennai" regardless of
  // the navbar selection.
  const homeBranchId = (profile as { branchId?: string | null } | null)?.branchId ?? null;
  const effectiveBranchId =
    role === "BRANCH_ADMIN"
      ? homeBranchId ?? undefined
      : branchIdParam;

  // Treat placeholder strings (used in .env templates) as "unset" so the
  // page degrades to its setup notice rather than failing the Maps fetch.
  const rawKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  const apiKey = rawKey && !/^REPLACE_WITH_/i.test(rawKey) ? rawKey : undefined;
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey ?? "",
    libraries: MAP_LIBRARIES,
    id: "google-maps-script",
  });

  const [sessions, setSessions] = useState<HomeTherapySession[]>([]);
  const [loading, setLoading] = useState(true);

  // Therapist marker positions are stored in component state so we can
  // smoothly move them when location-ping events arrive.
  const [therapistMarkers, setTherapistMarkers] = useState<Record<string, TherapistMarkerState>>({});

  // Ref-only Map instance — stored without React state so map prop changes
  // don't recreate the map.
  const mapRef = useRef<google.maps.Map | null>(null);
  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  // Refresh — fetch today's sessions and seed therapist markers from the
  // most recent ping for each en-route / in-session row.
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await homeTherapyService.listSessions({
        date: todayKey(),
        branchId: effectiveBranchId,
      });
      const filtered = (rows ?? []).filter((s) =>
        s.mode === "HOME" && ACTIVE_HOME_STATUSES.includes(s.status),
      );
      setSessions(filtered);

      // Seed marker state — best-effort fetch of last ping for each session.
      const seeded: Record<string, TherapistMarkerState> = {};
      await Promise.all(filtered.map(async (s) => {
        let position: MarkerPos | null = null;
        let lastPingAt: string | null = null;
        try {
          const p = await homeTherapyService.getLastLocation(s.id);
          if (p && typeof p.latitude === "number" && typeof p.longitude === "number") {
            position = { lat: p.latitude, lng: p.longitude };
            lastPingAt = p.timestamp;
          }
        } catch { /* no ping yet — leave undefined */ }
        seeded[s.id] = {
          sessionId: s.id,
          position,
          lastPingAt,
          fullName: s.therapist?.fullName ?? "Therapist",
          status: s.status,
        };
      }));
      setTherapistMarkers(seeded);
    } catch (err) {
      toast({
        title: "Failed to load live map",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [effectiveBranchId, toast]);

  useEffect(() => { refresh(); }, [refresh]);

  // Subscribe to the /home-therapy namespace for live location updates.
  // We open a SECOND socket here (separate from the default-namespace
  // singleton in WebSocketContext) because the namespaces are distinct
  // connections in socket.io-client. The connection is closed on unmount.
  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    let socket: Socket | null = null;
    let cancelled = false;
    try {
      socket = io(`${API_BASE}/home-therapy`, {
        auth: { token },
        transports: ["websocket", "polling"],
        reconnection: true,
      });
    } catch { return; }

    const sessionIds = sessions.map((s) => s.id);

    socket.on("connect", () => {
      if (cancelled || !socket) return;
      // Join one room per visible session so events fan out only for what
      // the admin is currently watching. Tab-switching the live map page
      // will tear down + reconnect, which re-registers the rooms.
      sessionIds.forEach((id) => socket!.emit("join_session", { sessionId: id }));
    });

    socket.on("therapist_location_update", (payload: {
      sessionId: string;
      latitude: number;
      longitude: number;
      timestamp: string;
    }) => {
      setTherapistMarkers((prev) => {
        const existing = prev[payload.sessionId];
        if (!existing) return prev;
        return {
          ...prev,
          [payload.sessionId]: {
            ...existing,
            position: { lat: payload.latitude, lng: payload.longitude },
            lastPingAt: payload.timestamp,
          },
        };
      });
    });

    socket.on("session_status_changed", () => {
      // Status changes can move a session in/out of ACTIVE_HOME_STATUSES.
      // Cheap fix: refetch the list — the page will re-seed markers from
      // the new server state.
      refresh();
    });

    return () => {
      cancelled = true;
      try {
        sessionIds.forEach((id) => socket?.emit("leave_session", { sessionId: id }));
        socket?.disconnect();
      } catch { /* swallow */ }
    };
  }, [sessions, refresh]);

  // Center the map on the first plotted session once we have data.
  const initialCenter = useMemo<MarkerPos>(() => {
    for (const s of sessions) {
      const m = therapistMarkers[s.id]?.position;
      if (m) return m;
      if (s.patient?.latitude != null && s.patient?.longitude != null) {
        return { lat: s.patient.latitude, lng: s.patient.longitude };
      }
    }
    return DEFAULT_CENTER;
  }, [sessions, therapistMarkers]);

  // Directions for the en-route session — first one only to keep the map
  // readable. Per the spec, polyline only renders while THERAPIST_EN_ROUTE.
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  useEffect(() => {
    if (!isLoaded || typeof google === "undefined") return;
    const enRoute = sessions.find((s) => s.status === "THERAPIST_EN_ROUTE");
    if (!enRoute) { setDirections(null); return; }
    const ther = therapistMarkers[enRoute.id]?.position;
    const home = enRoute.patient?.latitude != null && enRoute.patient?.longitude != null
      ? { lat: enRoute.patient.latitude, lng: enRoute.patient.longitude }
      : null;
    if (!ther || !home) { setDirections(null); return; }
    const svc = new google.maps.DirectionsService();
    svc.route(
      { origin: ther, destination: home, travelMode: google.maps.TravelMode.DRIVING },
      (result, status) => {
        if (status === "OK" && result) setDirections(result);
        else setDirections(null);
      },
    );
  }, [isLoaded, sessions, therapistMarkers]);

  return (
    <AppLayout>
      <PageTransition>
        <div className="container max-w-7xl mx-auto px-4 py-6 space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <PageHeader
              title="Home Therapy — Live Map"
              subtitle="Real-time location of therapists currently visiting patients."
            />
            <Button variant="outline" size="sm" onClick={refresh} className="gap-2">
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>

          {!apiKey && (
            <div className="rounded-xl border border-amber-300/60 bg-amber-50/80 dark:bg-amber-950/30 p-4 text-sm text-amber-800 dark:text-amber-200 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold mb-0.5">Google Maps API key not set</div>
                <p className="text-xs">
                  Add <code className="px-1 py-0.5 bg-background/40 rounded">VITE_GOOGLE_MAPS_API_KEY</code> to <code>alshifa-frontend/.env</code> and rebuild. The session list below still updates in real time.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 h-[640px]">
            {/* Map */}
            <div className="rounded-2xl border border-border/60 bg-secondary/10 overflow-hidden">
              {!apiKey ? (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  Map unavailable until VITE_GOOGLE_MAPS_API_KEY is configured.
                </div>
              ) : loadError ? (
                <div className="h-full flex items-center justify-center text-red-600 text-sm">
                  Map failed to load: {String(loadError.message)}
                </div>
              ) : !isLoaded ? (
                <div className="h-full flex items-center justify-center text-muted-foreground gap-2 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading map…
                </div>
              ) : (
                <GoogleMap
                  mapContainerStyle={MAP_CONTAINER_STYLE}
                  center={initialCenter}
                  zoom={12}
                  onLoad={onMapLoad}
                  options={{
                    streetViewControl: false,
                    mapTypeControl: false,
                    fullscreenControl: true,
                  }}
                >
                  {sessions.map((s) => {
                    const t = therapistMarkers[s.id];
                    const home = s.patient?.latitude != null && s.patient?.longitude != null
                      ? { lat: s.patient.latitude, lng: s.patient.longitude }
                      : null;
                    return (
                      <span key={s.id}>
                        {home && (
                          <Marker
                            position={home}
                            label={{ text: "🏠", fontSize: "16px" }}
                            title={s.patient?.fullName ?? "Patient home"}
                          />
                        )}
                        {t?.position && (
                          <Marker
                            position={t.position}
                            label={{ text: "🚶", fontSize: "16px" }}
                            title={`${t.fullName} (${s.status.replace(/_/g, " ")})`}
                          />
                        )}
                      </span>
                    );
                  })}
                  {directions && <DirectionsRenderer directions={directions} options={{ suppressMarkers: true }} />}
                </GoogleMap>
              )}
            </div>

            {/* Sidebar */}
            <aside className="rounded-2xl border border-border/60 bg-background overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b">
                <h3 className="font-semibold flex items-center gap-2">
                  <Home className="w-4 h-4 text-primary" />
                  Active Sessions
                </h3>
                <p className="text-xs text-muted-foreground">{sessions.length} ongoing</p>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-border/40">
                {loading ? (
                  <div className="p-6 flex items-center justify-center text-muted-foreground gap-2 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    No active home therapy sessions right now.
                  </div>
                ) : (
                  sessions.map((s) => {
                    const t = therapistMarkers[s.id];
                    return (
                      <div key={s.id} className="px-4 py-3 space-y-1.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-medium text-sm">{s.therapist?.fullName ?? "Therapist"}</span>
                          <Badge className={cn("text-[10px]", STATUS_TONE[s.status])}>
                            {s.status.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {s.patient?.fullName ?? "Patient"}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Last ping: {t?.lastPingAt ? new Date(t.lastPingAt).toLocaleTimeString() : "—"}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </aside>
          </div>
        </div>
      </PageTransition>
    </AppLayout>
  );
}

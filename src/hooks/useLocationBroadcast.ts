import { useCallback, useEffect, useRef, useState } from "react";
import { homeTherapyService } from "@/services/homeTherapy.service";

/**
 * Continuously broadcast the therapist's GPS position to the home-therapy
 * server while a session is en-route or in progress.
 *
 * Uses `navigator.geolocation.watchPosition` with high-accuracy mode. Each
 * position update POSTs to `/api/home-therapy/sessions/:id/location-ping`,
 * which the backend rate-limits to 1 ping / 10 seconds per therapist (returns
 * 429 on the second hit; we silently swallow that — the next watch tick will
 * succeed).
 *
 * Activation: caller passes `active=true` and `sessionId`. Deactivation —
 * either by passing `active=false`, a different sessionId, or unmount —
 * calls `clearWatch` and stops broadcasting.
 *
 * Permission denial: we expose `permissionState` so the parent UI can show a
 * "Please enable location" modal. We don't render that modal here — it's a
 * UI concern that belongs to the dashboard page.
 *
 * Failure modes:
 *   - permission denied → `permissionState='denied'`, hook is a no-op
 *   - geolocation API unavailable (rare) → `permissionState='unsupported'`
 *   - position-fetch error → counted in `errorCount`, hook keeps trying
 *   - rate-limit 429 → silently dropped (next watch tick will land)
 *
 * The hook does NOT start until both `active` and `sessionId` are truthy
 * AND we have a positive `permissionState`. This means: pass `active=false`
 * during page load; flip to `true` only after the user has opted in.
 */

export type LocationPermissionState =
  | "unknown"
  | "prompt"
  | "granted"
  | "denied"
  | "unsupported";

export interface UseLocationBroadcastOptions {
  /** When false, watcher is torn down. */
  active: boolean;
  /** HomeTherapySession.id we're broadcasting for. */
  sessionId: string | null;
  /** Optional: called when the geolocation API errors (other than permission). */
  onError?: (err: GeolocationPositionError) => void;
}

export interface UseLocationBroadcastResult {
  permissionState: LocationPermissionState;
  /** Last successful position (lat, lng, accuracy). null until first fix. */
  lastPosition: { lat: number; lng: number; accuracy: number; timestamp: number } | null;
  /** Number of network errors since the watcher started. */
  errorCount: number;
  /** Manual permission re-request — useful from the "Please enable location" CTA. */
  requestPermission: () => void;
}

const WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 10000,
  timeout: 15000,
};

export function useLocationBroadcast({
  active,
  sessionId,
  onError,
}: UseLocationBroadcastOptions): UseLocationBroadcastResult {
  const [permissionState, setPermissionState] = useState<LocationPermissionState>("unknown");
  const [lastPosition, setLastPosition] = useState<UseLocationBroadcastResult["lastPosition"]>(null);
  const [errorCount, setErrorCount] = useState(0);
  const watchIdRef = useRef<number | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  // Read the Permissions API once on mount so we can render the right CTA
  // copy without prompting the user yet. Some browsers (older Safari) lack
  // this API — we fall back to "unknown" and the broadcast attempt itself
  // will surface the prompt.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setPermissionState("unsupported");
      return;
    }
    if (typeof navigator.permissions?.query !== "function") {
      setPermissionState("unknown");
      return;
    }
    let cancelled = false;
    navigator.permissions.query({ name: "geolocation" })
      .then((status) => {
        if (cancelled) return;
        setPermissionState(status.state as LocationPermissionState);
        // Listen for runtime changes (user revokes/grants in browser settings).
        status.onchange = () => {
          if (cancelled) return;
          setPermissionState(status.state as LocationPermissionState);
        };
      })
      .catch(() => { if (!cancelled) setPermissionState("unknown"); });
    return () => { cancelled = true; };
  }, []);

  // Manual permission re-request — fires a one-shot getCurrentPosition which
  // triggers the browser permission dialog. The watcher in the next effect
  // will then pick up the granted state.
  const requestPermission = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      () => setPermissionState("granted"),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setPermissionState("denied");
      },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }, []);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    // Tear-down — runs whenever active / sessionId / permission changes.
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (!active || !sessionId) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setPermissionState("unsupported");
      return;
    }
    if (permissionState === "denied" || permissionState === "unsupported") {
      return;
    }

    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        if (permissionState !== "granted") setPermissionState("granted");
        const payload = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        };
        setLastPosition(payload);
        // Send to the backend — rate-limited to 1 / 10s per therapist.
        // We don't await heavily; if a request piles up while another is
        // in flight that's fine — the server will rate-limit appropriately.
        const currentSession = sessionIdRef.current;
        if (!currentSession) return;
        try {
          await homeTherapyService.ping(currentSession, {
            latitude: payload.lat,
            longitude: payload.lng,
            accuracy: payload.accuracy,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "";
          if (/Too many|429/.test(message)) return; // rate-limited — expected
          setErrorCount((n) => n + 1);
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setPermissionState("denied");
        } else {
          setErrorCount((n) => n + 1);
          onError?.(err);
        }
      },
      WATCH_OPTIONS,
    );
    watchIdRef.current = id;

    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [active, sessionId, permissionState, onError]);

  return { permissionState, lastPosition, errorCount, requestPermission };
}

export default useLocationBroadcast;

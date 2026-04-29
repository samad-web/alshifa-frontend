/**
 * Centralized API client — single source of truth for all backend HTTP calls.
 *
 * REPLACES: scattered `fetch(API_BASE_URL, ...)` + manual localStorage token
 *           reads across every page component.
 *
 * PROVIDES:
 *   • Single baseURL from env var
 *   • Automatic Authorization header injection
 *   • Transparent 401 → logout handling
 *   • Consistent error shape: { message: string, code?: string, details?: any[] }
 *   • Type-safe response generics
 *
 * Usage:
 *   import { apiClient } from '@/lib/api-client';
 *   const { data } = await apiClient.get<Appointment[]>('/appointments');
 *   const { data } = await apiClient.post<Appointment>('/appointments', body);
 */

const _rawApiUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;

if (!_rawApiUrl && import.meta.env.PROD) {
  throw new Error(
    '[api-client] VITE_API_BASE_URL is required in production. ' +
    'Set it in your deployment environment variables.'
  );
}

const API_BASE_URL = _rawApiUrl || 'http://localhost:4000';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ApiError {
  message: string;
  code?: string;
  details?: Array<{ path: string; message: string }>;
  status: number;
  /** Raw response body — used by callers that need structured error data
   *  beyond `details` (e.g. the diet-package assign flow reads `conflicts`). */
  payload?: unknown;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
}

export class ApiClientError extends Error {
  code?: string;
  status: number;
  details?: Array<{ path: string; message: string }>;
  payload?: unknown;

  constructor(error: ApiError) {
    // Fold structured validation errors into the human message so callers that
    // only show `err.message` still see field-level detail. Zod returns
    // `{ path: string, message: string }[]` in `details`.
    const tail = error.details && error.details.length > 0
      ? '\n' + error.details
          .map((d) => (d.path ? `• ${d.path}: ${d.message}` : `• ${d.message}`))
          .join('\n')
      : '';
    super(`${error.message}${tail}`);
    this.name = 'ApiClientError';
    this.code = error.code;
    this.status = error.status;
    this.details = error.details;
    this.payload = error.payload;
  }
}

// ── Token helpers ─────────────────────────────────────────────────────────────

function getAccessToken(): string | null {
  return localStorage.getItem('accessToken');
}

function clearTokens(): void {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

// Pulled from useAuth so concurrent 401-retries share one in-flight POST to
// /api/auth/refresh. The shared singleton is critical: without it, two
// simultaneously-failing requests both refresh, the second refresh trips the
// backend's reuse-detection (refresh tokens are single-use), and BOTH
// sessions get nuked.
import { refreshAccessTokenShared } from '@/hooks/useAuth';

// ── Core fetch wrapper ────────────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {},
  params?: Record<string, string | number | boolean | undefined | null>,
  _retryCount = 0
): Promise<ApiResponse<T>> {
  const token = getAccessToken();

  // Build query string from params object (skip null/undefined)
  let url = `${API_BASE_URL}${path}`;
  if (params) {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    if (qs) url += `?${qs}`;
  }

  // Don't force Content-Type for FormData — the browser must set
  // `multipart/form-data; boundary=...` itself or the server can't parse it.
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers: HeadersInit = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });

  // Handle empty responses (204, DELETE, etc.)
  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const body = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    // 429 → rate limited — back off and retry up to 2 times before surfacing the error.
    // The Retry-After header is respected when present.
    if (response.status === 429 && _retryCount < 2) {
      const retryAfter = response.headers.get('Retry-After');
      const delayMs = retryAfter ? parseFloat(retryAfter) * 1000 : ((_retryCount + 1) * 2000);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return request<T>(path, options, params, _retryCount + 1);
    }

    // 401 → access token expired (or missing). If we have a refresh token,
    // try once to get a new access token and retry the original request.
    // Only on the second 401 (or when refresh fails) do we clear tokens
    // and bounce the user. We guard with `_retryCount` so a refresh that
    // itself returns 401 doesn't loop.
    if (response.status === 401 && token && _retryCount === 0) {
      const refreshed = await refreshAccessTokenShared(API_BASE_URL);
      if (refreshed) {
        // Retry the same call with a fresh access token. The token-helper
        // pulls from localStorage on each call so the retry picks up the
        // new value automatically.
        return request<T>(path, options, params, _retryCount + 1);
      }
      // Refresh failed — fall through to logout.
      clearTokens();
      window.dispatchEvent(new CustomEvent('auth:session-expired'));
    } else if (response.status === 401 && token) {
      // Already retried once (or no refresh token). Hard logout.
      clearTokens();
      window.dispatchEvent(new CustomEvent('auth:session-expired'));
    }

    const errorPayload = typeof body === 'object' ? body : { error: body };
    throw new ApiClientError({
      message: errorPayload.error || errorPayload.message || 'Request failed',
      code: errorPayload.code,
      details: errorPayload.details,
      status: response.status,
      payload: errorPayload,
    });
  }

  return { data: body as T, status: response.status };
}

// ── HTTP method helpers ───────────────────────────────────────────────────────

export const apiClient = {
  get<T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined | null>
  ): Promise<ApiResponse<T>> {
    return request<T>(path, { method: 'GET' }, params);
  },

  post<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
    return request<T>(path, { method: 'POST', body: JSON.stringify(body) });
  },

  put<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
    return request<T>(path, { method: 'PUT', body: JSON.stringify(body) });
  },

  patch<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
    return request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
  },

  delete<T = void>(path: string): Promise<ApiResponse<T>> {
    return request<T>(path, { method: 'DELETE' });
  },

  /** Upload a file via multipart/form-data */
  upload<T>(path: string, formData: FormData): Promise<ApiResponse<T>> {
    // Don't capture the token here. request() injects a fresh
    // Authorization header on every call (including auto-refresh retries).
    // FormData bodies skip Content-Type automatically inside request() so
    // the browser sets the multipart boundary correctly.
    return request<T>(path, {
      method: 'POST',
      body: formData,
    });
  },

  /**
   * GET that returns the raw response Blob — used by export/download flows
   * (CSV, PDF, etc.) where the body is binary and not JSON. Bypasses the
   * shared request() helper because we need response.blob() rather than
   * response.json().
   */
  async getBlob(
    path: string,
    params?: Record<string, string | number | boolean | undefined | null>,
  ): Promise<Blob> {
    const token = getAccessToken();
    let url = `${API_BASE_URL}${path}`;
    if (params) {
      const qs = Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');
      if (qs) url += `?${qs}`;
    }
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      let msg = `Request failed (${res.status})`;
      try {
        const txt = await res.text();
        if (txt) msg = txt;
      } catch { /* swallow */ }
      throw new ApiClientError({ message: msg, status: res.status });
    }
    return res.blob();
  },
};

export default apiClient;

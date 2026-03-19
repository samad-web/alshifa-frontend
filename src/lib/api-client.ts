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
}

export interface ApiResponse<T> {
  data: T;
  status: number;
}

export class ApiClientError extends Error {
  code?: string;
  status: number;
  details?: Array<{ path: string; message: string }>;

  constructor(error: ApiError) {
    super(error.message);
    this.name = 'ApiClientError';
    this.code = error.code;
    this.status = error.status;
    this.details = error.details;
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

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
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

    // 401 → session expired — but ONLY if we actually sent a token.
    // Unauthenticated requests (no token) legitimately get 401 and must NOT
    // trigger logout, since that would race with a concurrent login flow and
    // delete freshly-stored tokens.
    if (response.status === 401 && token) {
      clearTokens();
      window.dispatchEvent(new CustomEvent('auth:session-expired'));
    }

    const errorPayload = typeof body === 'object' ? body : { error: body };
    throw new ApiClientError({
      message: errorPayload.error || errorPayload.message || 'Request failed',
      code: errorPayload.code,
      details: errorPayload.details,
      status: response.status,
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
    const token = getAccessToken();
    return request<T>(path, {
      method: 'POST',
      headers: {
        // Omit Content-Type — browser must set it with boundary automatically
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
  },
};

export default apiClient;

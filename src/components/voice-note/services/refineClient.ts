// Thin fetch wrapper that POSTs the transcript to the host app's backend
// `/api/voice-note/refine` endpoint and returns the cleaned transcript +
// structured prescription data.
//
// Deliberately does NOT depend on Alshifa's `apiClient` — keeps the module
// portable across any host app. The host wires in auth + base URL via the
// options bag.

import type {
  ParsedVoiceNote,
  RefineClientOptions,
  RefineResponse,
  VoiceLanguage,
} from "../types";

export class RefineRequestError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "RefineRequestError";
    this.status = status;
  }
}

const DEFAULT_ENDPOINT = "/api/voice-note/refine";

export async function refineTranscript(
  transcript: string,
  language: VoiceLanguage,
  options: RefineClientOptions = {},
): Promise<{ refinedTranscript: string; structured: ParsedVoiceNote }> {
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
  const baseUrl = options.baseUrl ?? "";
  const url = `${baseUrl}${endpoint}`;

  const token = options.getAuthToken?.();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  // 60s timeout — sits above the backend's 45s OpenAI SDK timeout so that
  // an upstream LLM hang surfaces as a useful error from the backend before
  // we abort. If the abort fires, the network itself is wedged.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ transcript, language }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new RefineRequestError(
        "Request timed out after 60 seconds. The backend may be unreachable — try again or check the server.",
        0,
      );
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  // Try to parse JSON either way — error bodies usually carry useful detail.
  const contentType = response.headers.get("content-type") ?? "";
  const body: unknown = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => null);

  if (!response.ok) {
    const message =
      (typeof body === "object" && body !== null && "error" in body
        ? String((body as { error: unknown }).error)
        : null) ||
      (typeof body === "string" ? body : null) ||
      response.statusText ||
      "Refine request failed";
    throw new RefineRequestError(message, response.status);
  }

  const json = body as RefineResponse | null;
  if (!json || !json.success || !json.structured) {
    throw new RefineRequestError(
      json?.error || "Refine response was malformed",
      response.status,
    );
  }

  return {
    refinedTranscript: json.refinedTranscript ?? transcript,
    structured: json.structured,
  };
}

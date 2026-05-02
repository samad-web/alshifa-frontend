// Shared types for the voice-note module. Single source of truth — both the
// frontend hook/components and the integration example import from here.

export type VoiceLanguage = "en" | "ta" | "mixed";

export interface VoiceNoteError {
  /** Web Speech API error code: "network", "not-allowed", "audio-capture",
   *  "no-speech", "service-not-allowed", "language-not-supported",
   *  "audio-capture", "unsupported", "start-failed", or "unknown". */
  code: string;
  /** Browser-supplied detail (often empty in Chrome). */
  message: string;
}

/** Returned by `useVoiceNote` — a thin wrapper around the browser's
 *  Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`).
 *  Transcripts build live as the doctor speaks. */
export interface UseVoiceNoteResult {
  /** True when the browser exposes `SpeechRecognition` or
   *  `webkitSpeechRecognition`. False on Firefox and very old browsers. */
  isSupported: boolean;
  /** True from the moment `startListening()` succeeds until `stopListening()`
   *  is called and `onend` has fired. */
  isListening: boolean;
  /** Final, committed text. Grows as the API marks results `isFinal: true`. */
  transcript: string;
  /** The latest in-progress phrase the API hasn't committed yet. Empty when
   *  the recogniser is idle or has just finalised the last word. */
  interim: string;
  error: VoiceNoteError | null;
  startListening: (language: VoiceLanguage) => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

export interface ParsedMedication {
  name: string;
  dosage: string;
  frequency: string;
  /** Optional — folded into `frequency` by the integration example since the
   *  default Alshifa PrescriptionRow has no separate timing column. Hosts
   *  with a richer schema can read this field directly. */
  timing?: string;
  duration: string;
}

export interface ParsedVoiceNote {
  medications: ParsedMedication[];
  /** Imperative bullet-style guidance ("avoid cold water", "rest 2 days").
   *  The integration example folds these into the host app's treatment-notes
   *  field on top of the dedicated `treatmentNotes` summary field. */
  instructions: string[];
  /** Primary diagnosis as a short phrase. Empty string when not stated. */
  diagnosis: string;
  /** Free-text treatment notes paragraph distinct from `instructions`. */
  treatmentNotes: string;
  /** Free-text physical-activity recommendations: bed rest, walking,
   *  yoga, etc. The host fills this into its Exercise Plan section. */
  exercisePlan: string;
  /** Free-text dietary recommendations. */
  dietaryAdvice: string;
  /** What the patient should do next (review, lab tests, lifestyle). */
  nextSteps: string;
  /** ISO 8601 date string (YYYY-MM-DD) when stated; empty otherwise.
   *  The LLM should resolve relative phrases like "in 2 weeks" to absolute
   *  dates using the current date as the reference point. */
  followUpDate: string;
  /** The transcript text the LLM was given, returned for traceability. */
  rawText: string;
}

export interface RefineResponse {
  success: boolean;
  refinedTranscript: string;
  structured: ParsedVoiceNote;
  error?: string;
}

export interface RefineClientOptions {
  /** Backend endpoint. Defaults to `/api/voice-note/refine`. Override when
   *  the host app proxies under a different path. */
  endpoint?: string;
  /** Returns the bearer token to attach as `Authorization: Bearer <token>`.
   *  Optional — call without auth if your backend route is public. */
  getAuthToken?: () => string | null | undefined;
  /** Optional override of the API base URL (e.g. `import.meta.env.VITE_API_BASE_URL`). */
  baseUrl?: string;
}

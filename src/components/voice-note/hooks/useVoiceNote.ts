// Browser Web Speech API hook for live voice-to-text in the voice-note module.
//
// Builds the transcript incrementally as the doctor speaks. Final phrases are
// appended to `transcript`; the latest in-progress phrase lives in `interim`
// and disappears once it's finalised. When `stopListening()` is called the
// API auto-finalises any pending interim, so no text is lost.
//
// Browser support: Chromium-based browsers (Chrome, Edge, Brave, Opera) and
// recent Safari expose `SpeechRecognition` / `webkitSpeechRecognition`.
// Firefox does not — `isSupported` is false there and the component should
// surface a fallback. Recognition uses Google's free service backend in
// Chrome, which means it requires network connectivity.
//
// Auto-restart: Chrome's `SpeechRecognition.continuous = true` still hits an
// internal silence timeout after ~60s and fires `onend`. We restart it
// transparently while the user hasn't clicked Stop, so a long dictation
// doesn't get cut off.

import { useCallback, useEffect, useRef, useState } from "react";
import type { UseVoiceNoteResult, VoiceLanguage, VoiceNoteError } from "../types";

// Maps the UI's language tab to the BCP-47 tag the Web Speech API accepts.
// The API can only target ONE language per recognition session — there is no
// true bilingual mode. 'mixed' (Tanglish) maps to ta-IN because the Tamil
// recogniser preserves Tamil words in Tamil script AND keeps interleaved
// English words readable, whereas en-IN garbles Tamil words badly
// ("Adathodai" → "Audio Day"). The OpenAI prompt downstream already handles
// Tanglish + Tamil-script phonetic garbles, so feeding it Tamil-script-rich
// input produces noticeably better extractions.
function langToBcp47(lang: VoiceLanguage): string {
  if (lang === "ta") return "ta-IN";
  if (lang === "mixed") return "ta-IN";
  return "en-IN";
}

function getSpeechRecognitionCtor():
  | (new () => SpeechRecognition)
  | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function useVoiceNote(): UseVoiceNoteResult {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<VoiceNoteError | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  // True while the user wants to keep listening. Chrome's `onend` fires after
  // its internal silence timeout even when continuous=true; this flag tells us
  // whether to silently restart or actually flip the UI to "stopped".
  const expectListeningRef = useRef(false);
  // Pending setTimeout id for the deferred restart, so we can cancel it if
  // the user clicks Stop between onend and the actual restart.
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isSupported = getSpeechRecognitionCtor() !== null;

  const startListening = useCallback(
    (language: VoiceLanguage) => {
      const Ctor = getSpeechRecognitionCtor();
      if (!Ctor) {
        setError({
          code: "unsupported",
          message: "Live speech recognition isn't supported in this browser.",
        });
        return;
      }
      // Reset transcript state on each fresh start. If the doctor wants to
      // append, they can use the editable textarea afterwards.
      setError(null);
      setTranscript("");
      setInterim("");

      const recognition = new Ctor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = langToBcp47(language);
      // Only the top alternative is interesting for clinical dictation.
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalChunk = "";
        let interimChunk = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0]?.transcript ?? "";
          if (result.isFinal) finalChunk += text;
          else interimChunk += text;
        }
        if (finalChunk) {
          setTranscript((prev) => {
            // Avoid runaway double-spaces when the API emits leading whitespace.
            const trimmed = finalChunk.replace(/^\s+/, "");
            return prev ? `${prev} ${trimmed}`.replace(/\s+/g, " ") : trimmed;
          });
        }
        setInterim(interimChunk);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        // 'no-speech' is benign — Chrome fires it after a silent stretch and
        // immediately follows with onend, where we'll auto-restart. Don't
        // surface it as an error to the user.
        if (event.error === "no-speech") return;
        setError({
          code: event.error || "unknown",
          message: event.message || "",
        });
        expectListeningRef.current = false;
        setIsListening(false);
      };

      recognition.onend = () => {
        if (expectListeningRef.current) {
          // Chrome auto-stopped after its silence timeout (~30s) — restart so
          // the doctor can keep dictating. The restart MUST be deferred a tick:
          // calling .start() synchronously inside onend throws
          // "InvalidStateError" because the recogniser hasn't fully released
          // its internal state yet. 250ms is enough for Chrome and Edge.
          if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
          restartTimerRef.current = setTimeout(() => {
            restartTimerRef.current = null;
            if (!expectListeningRef.current) return; // user clicked Stop in the meantime
            try {
              recognition.start();
            } catch {
              expectListeningRef.current = false;
              setIsListening(false);
              setInterim("");
            }
          }, 250);
          return;
        }
        setIsListening(false);
        setInterim("");
      };

      recognitionRef.current = recognition;
      expectListeningRef.current = true;
      try {
        recognition.start();
        setIsListening(true);
      } catch (err) {
        expectListeningRef.current = false;
        setError({
          code: "start-failed",
          message: (err as Error).message || "Could not start recognition",
        });
      }
    },
    [],
  );

  const stopListening = useCallback(() => {
    expectListeningRef.current = false;
    // Cancel any pending auto-restart so we don't bounce back to listening
    // 250 ms after the user clicked Stop.
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    const recognition = recognitionRef.current;
    if (recognition) {
      try {
        recognition.stop();
      } catch {
        /* already stopped */
      }
    }
    // We deliberately do NOT setIsListening(false) here — let onend do it once
    // any pending interim has been finalised, otherwise the textarea misses
    // the last word.
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setInterim("");
    setError(null);
  }, []);

  // Stop the recogniser if the consuming component unmounts mid-dictation,
  // otherwise Chrome keeps the mic indicator on until the tab closes.
  useEffect(() => {
    return () => {
      expectListeningRef.current = false;
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      const recognition = recognitionRef.current;
      if (recognition) {
        try {
          recognition.stop();
        } catch {
          /* noop */
        }
      }
    };
  }, []);

  return {
    isSupported,
    isListening,
    transcript,
    interim,
    error,
    startListening,
    stopListening,
    resetTranscript,
  };
}

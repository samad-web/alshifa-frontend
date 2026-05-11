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
  // Mirrors the most recent interim chunk synchronously. onend cannot read
  // React state to recover unfinalised speech, but it can read this ref —
  // we flush it into transcript before auto-restarting so a phrase that
  // was mid-utterance when the silence timeout fired is preserved.
  const lastInterimRef = useRef<string>("");

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
      lastInterimRef.current = "";

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
        // Mirror the latest interim into a ref as well as state. The ref is
        // what the auto-restart path flushes into the transcript so a phrase
        // the doctor was mid-saying when Chrome's silence timeout fires is
        // not lost. State alone can't be read synchronously inside onend.
        lastInterimRef.current = interimChunk;
        setInterim(interimChunk);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        // 'no-speech' is benign — Chrome fires it after a silent stretch and
        // immediately follows with onend, where we'll auto-restart. Don't
        // surface it as an error to the user.
        // 'aborted' is also benign in our flow: it fires whenever .stop() or
        // a re-start collides with an existing session (HMR re-mount, dialog
        // close + immediate re-open, browser pauses the tab). The recognizer
        // is already in the process of restarting via onend, and a flashing
        // red banner the doctor can't act on is worse than silence.
        if (event.error === "no-speech" || event.error === "aborted") return;
        setError({
          code: event.error || "unknown",
          message: event.message || "",
        });
        expectListeningRef.current = false;
        setIsListening(false);
      };

      recognition.onend = () => {
        // Rescue any unfinalised phrase: when Chrome's silence timeout fires
        // mid-utterance the latest `interim` chunk gets dropped on the floor
        // because the next recognition session resets indices and overwrites
        // it. Flush it into transcript so words spoken at the moment of
        // auto-stop don't disappear.
        const pending = lastInterimRef.current.trim();
        if (pending) {
          setTranscript((prev) => (prev ? `${prev} ${pending}`.replace(/\s+/g, " ") : pending));
          lastInterimRef.current = "";
        }
        setInterim("");

        if (expectListeningRef.current) {
          // Chrome auto-stopped after its silence timeout (~30s) — restart so
          // the doctor can keep dictating. The restart MUST be deferred a tick:
          // calling .start() synchronously inside onend throws
          // "InvalidStateError" because the recogniser hasn't fully released
          // its internal state yet.
          //
          // Tightened from 250 ms → try immediate first, fallback to 50 ms,
          // then 250 ms. Every ms here is mic-down time during which the
          // doctor's speech is *not* being captured, so the smaller this gap
          // the fewer words go missing.
          if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
          const tryRestart = (delayMs: number, nextDelayMs: number | null) => {
            restartTimerRef.current = setTimeout(() => {
              restartTimerRef.current = null;
              if (!expectListeningRef.current) return; // user clicked Stop in the meantime
              try {
                recognition.start();
              } catch {
                if (nextDelayMs !== null) {
                  tryRestart(nextDelayMs, null);
                } else {
                  expectListeningRef.current = false;
                  setIsListening(false);
                }
              }
            }, delayMs);
          };
          tryRestart(50, 250);
          return;
        }
        setIsListening(false);
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
      try { recognition.stop(); } catch { /* already stopped */ }
    }
    // We deliberately do NOT setIsListening(false) here — let onend do it once
    // any pending interim has been finalised, otherwise the textarea misses
    // the last word.
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setInterim("");
    lastInterimRef.current = "";
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
        try { recognition.stop(); } catch { /* noop */ }
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

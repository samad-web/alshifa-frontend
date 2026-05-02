// Mic button + dialog for the voice-note feature.
//
// Flow (back to live Web Speech API):
//   1. Click "Start listening" → browser STT begins; words appear live in the
//      textarea as the doctor speaks (final + interim).
//   2. Click "Stop"             → recogniser stops; the textarea becomes
//      editable so the doctor can fix any mis-recognised words.
//   3. Click "Structure Data"   → POST /api/voice-note/refine (OpenAI), which
//      returns the 7 visit-summary fields as a structured preview.
//   4. Click "Generate Prescription" → onResult fires, host fills the form,
//      dialog closes.
//
// Editing the transcript clears the structured preview, so Generate stays
// disabled until the doctor re-runs Structure Data on the new text.

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Wand2, Sparkles, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useVoiceNote } from "../hooks/useVoiceNote";
import { refineTranscript, RefineRequestError } from "../services/refineClient";
import type {
  ParsedVoiceNote,
  RefineClientOptions,
  VoiceLanguage,
  VoiceNoteError,
} from "../types";

// Translate the recogniser's error codes into something the doctor can act on.
function friendlyError(err: VoiceNoteError | null): string | null {
  if (!err) return null;
  switch (err.code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access was blocked. Click the mic icon in the address bar to allow it, then try again.";
    case "audio-capture":
      return "No microphone detected. Check that one is plugged in and selected as the default device.";
    case "network":
      return "Live recognition needs internet — Chrome's speech service is unreachable. Type the transcript manually instead.";
    case "language-not-supported":
      return "This browser doesn't support the selected language. Switch to English or try Chrome.";
    case "unsupported":
      return "Live speech recognition isn't supported in this browser. Use Chrome, Edge, Brave, or Safari.";
    case "start-failed":
      return err.message || "Could not start recognition. Check microphone permissions.";
    default:
      return err.message || `Recognition error: ${err.code}`;
  }
}

export interface VoiceNoteButtonProps {
  /** Called once with the structured visit-summary data when the doctor
   *  clicks "Generate Prescription". Host wires this into form state. */
  onResult: (parsed: ParsedVoiceNote) => void;
  /** Disable the trigger button (e.g. when no appointment is selected). */
  disabled?: boolean;
  /** Forwarded to the refine client. */
  refineEndpoint?: RefineClientOptions["endpoint"];
  baseUrl?: RefineClientOptions["baseUrl"];
  getAuthToken?: RefineClientOptions["getAuthToken"];
}

export default function VoiceNoteButton({
  onResult,
  disabled,
  refineEndpoint,
  baseUrl,
  getAuthToken,
}: VoiceNoteButtonProps) {
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState<VoiceLanguage>("en");

  // Editable transcript state. While the recogniser is listening, this mirrors
  // baseline + hook.transcript + hook.interim. When listening stops, the
  // doctor can edit it freely without the hook overwriting their changes.
  const [transcript, setTranscript] = useState("");

  // The committed transcript at the moment the CURRENT listening session
  // started. Newly-recognised speech is appended onto this rather than
  // replacing it, so Stop → Start preserves prior dictation (and any manual
  // edits the doctor made between sessions). Reset only by Clear / Cancel /
  // Generate Prescription.
  const baselineRef = useRef("");

  const [isStructuring, setIsStructuring] = useState(false);
  // Holds the LLM extraction; null until Structure Data succeeds. Resets on
  // transcript edit so Generate Prescription forces a re-structure.
  const [structured, setStructured] = useState<ParsedVoiceNote | null>(null);

  const {
    isSupported, isListening, transcript: liveTranscript, interim,
    error, startListening, stopListening, resetTranscript,
  } = useVoiceNote();

  // Stop the recogniser if the dialog closes mid-listen.
  useEffect(() => {
    if (!open && isListening) stopListening();
  }, [open, isListening, stopListening]);

  // While listening, sync baseline + hook's live transcript (final + interim)
  // into the local editable state. The effect deliberately does NOT run when
  // isListening is false, so the doctor's manual edits stick afterwards.
  useEffect(() => {
    if (!isListening) return;
    const liveCombined = interim
      ? `${liveTranscript} ${interim}`.trim()
      : liveTranscript.trim();
    const merged = baselineRef.current && liveCombined
      ? `${baselineRef.current} ${liveCombined}`.replace(/\s+/g, " ").trim()
      : (baselineRef.current || liveCombined).replace(/\s+/g, " ").trim();
    setTranscript(merged);
    // Any new speech invalidates a previously-structured preview.
    setStructured((prev) => (prev ? null : prev));
  }, [isListening, liveTranscript, interim]);

  // When listening just stopped, fold the just-completed session's text into
  // the baseline so the next Start appends to it instead of overwriting.
  const wasListeningRef = useRef(false);
  useEffect(() => {
    if (wasListeningRef.current && !isListening) {
      const sessionText = liveTranscript.trim();
      if (sessionText) {
        baselineRef.current = baselineRef.current
          ? `${baselineRef.current} ${sessionText}`.replace(/\s+/g, " ").trim()
          : sessionText;
        setTranscript(baselineRef.current);
      }
    }
    wasListeningRef.current = isListening;
  }, [isListening, liveTranscript]);

  const handleToggleListen = () => {
    if (isListening) {
      stopListening();
      return;
    }
    // Preserve any text already in the textarea — it becomes the baseline that
    // the next session will append onto. Reset only the hook's per-session
    // state so the new session starts from a clean slate (otherwise
    // hook.transcript would still hold the previous session's text and the
    // sync effect would double-append).
    baselineRef.current = transcript.trim();
    resetTranscript();
    startListening(language);
  };

  const handleTranscriptChange = (next: string) => {
    setTranscript(next);
    // Manual edits between sessions update the baseline, otherwise the next
    // Start would silently revert to the pre-edit text.
    if (!isListening) baselineRef.current = next;
    if (structured) setStructured(null);
  };

  const handleStructure = async () => {
    const text = transcript.trim();
    if (!text) {
      toast.error("Dictate something or type into the transcript first.");
      return;
    }
    try {
      setIsStructuring(true);
      const result = await refineTranscript(text, language, {
        endpoint: refineEndpoint,
        baseUrl,
        getAuthToken,
      });
      const s = result.structured;
      const filledParts: string[] = [];
      if (s.medications?.length) filledParts.push(`${s.medications.length} medication${s.medications.length > 1 ? "s" : ""}`);
      if (s.diagnosis) filledParts.push("diagnosis");
      if (s.treatmentNotes) filledParts.push("treatment notes");
      if (s.exercisePlan) filledParts.push("exercise plan");
      if (s.dietaryAdvice) filledParts.push("dietary advice");
      if (s.nextSteps) filledParts.push("next steps");
      if (s.followUpDate) filledParts.push("follow-up date");
      if (filledParts.length === 0) {
        toast.warning("Couldn't extract any fields. Edit the transcript and try again.");
        setStructured(null);
        return;
      }
      setStructured(s);
      toast.success(`Structured: ${filledParts.join(", ")}. Review below, then click Generate Prescription.`);
    } catch (err) {
      const message = err instanceof RefineRequestError
        ? `Structure failed (${err.status || "network"}): ${err.message}`
        : err instanceof Error
        ? err.message
        : "Structure failed";
      toast.error(message);
      setStructured(null);
    } finally {
      setIsStructuring(false);
    }
  };

  const handleGenerate = () => {
    if (!structured) return;
    onResult(structured);
    handleReset();
    setOpen(false);
  };

  const handleReset = () => {
    if (isListening) stopListening();
    resetTranscript();
    setTranscript("");
    baselineRef.current = "";
    setStructured(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) handleReset();
    setOpen(next);
  };

  const busy = isListening || isStructuring;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" disabled={disabled}>
          <Mic className="h-4 w-4 mr-1" />
          Voice Note
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-primary" />
            Voice Note
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Dictate the visit summary, then click <span className="font-medium">Structure Data</span> to extract the 7 fields. Review the preview, then click <span className="font-medium">Generate Prescription</span> to fill the form.
          </p>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Language */}
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Language</Label>
            <Tabs value={language} onValueChange={(v) => setLanguage(v as VoiceLanguage)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="en" disabled={isListening}>English</TabsTrigger>
                <TabsTrigger value="ta" disabled={isListening}>தமிழ்</TabsTrigger>
                <TabsTrigger value="mixed" disabled={isListening}>Mixed (Tanglish)</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Recogniser */}
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Recogniser</Label>
            {!isSupported ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                Live speech recognition isn't supported in this browser. Use Chrome, Edge, Brave, or Safari (recent versions).
              </div>
            ) : (
              <div
                className={
                  "rounded-lg border p-4 transition-colors " +
                  (isListening ? "border-red-300 bg-red-50/60" : "bg-muted/40")
                }
              >
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant={isListening ? "destructive" : "default"}
                    onClick={handleToggleListen}
                    disabled={isStructuring}
                    className="min-w-[8rem]"
                  >
                    {isListening ? (
                      <><MicOff className="h-4 w-4 mr-2" /> Stop</>
                    ) : (
                      <><Mic className="h-4 w-4 mr-2" /> Start listening</>
                    )}
                  </Button>
                  <div className="flex-1 text-sm">
                    {isListening ? (
                      <span className="flex items-center gap-2 font-medium text-red-700">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                        </span>
                        Listening — speak now
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        Click <span className="font-medium text-foreground">Start listening</span>, then dictate the full visit summary.
                      </span>
                    )}
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Recognition runs in the browser via the Web Speech API. Words appear live as you speak; you can edit them after stopping.
                </p>
              </div>
            )}
            {error && (
              <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {friendlyError(error)}
              </div>
            )}
          </div>

          {/* Transcript editor */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Transcript</Label>
              {transcript && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  disabled={busy}
                >
                  Clear
                </Button>
              )}
            </div>
            <Textarea
              rows={7}
              placeholder="Dictate above, or type the visit summary directly. You can edit the transcript before clicking Structure Data."
              value={transcript}
              onChange={(e) => handleTranscriptChange(e.target.value)}
              disabled={isListening}
            />
          </div>

          {/* Structured preview, after Structure Data succeeds. */}
          {structured && (
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Structured preview
              </Label>
              <div className="rounded-lg border border-emerald-300 bg-emerald-50/60 p-4 space-y-3 text-sm">
                <PreviewField label="Diagnosis" value={structured.diagnosis} />
                <PreviewField label="Treatment notes" value={structured.treatmentNotes} multiline />
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-800 mb-1">
                    Prescriptions ({structured.medications?.length ?? 0})
                  </p>
                  {structured.medications?.length ? (
                    <ul className="space-y-1">
                      {structured.medications.map((m, i) => (
                        <li key={i} className="text-foreground text-[13px]">
                          <span className="font-medium">{m.name || "Unnamed"}</span>
                          {m.dosage && <> — {m.dosage}</>}
                          {(m.frequency || m.timing) && <> · {[m.frequency, m.timing].filter(Boolean).join(", ")}</>}
                          {m.duration && <> · {m.duration}</>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground text-[13px] italic">none</p>
                  )}
                </div>
                <PreviewField label="Exercise plan" value={structured.exercisePlan} multiline />
                <PreviewField label="Dietary advice" value={structured.dietaryAdvice} multiline />
                <PreviewField label="Next steps" value={structured.nextSteps} multiline />
                <PreviewField label="Follow-up date" value={structured.followUpDate} />
                <p className="text-[11px] text-muted-foreground pt-1 border-t border-emerald-200">
                  Editing the transcript above clears this preview. Click <span className="font-medium">Generate Prescription</span> to fill the form.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isStructuring}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={handleStructure}
            disabled={!transcript.trim() || busy}
          >
            {isStructuring ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Structuring…</>
            ) : (
              <><Sparkles className="h-4 w-4 mr-2" /> Structure Data</>
            )}
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={!structured || busy}
          >
            <Wand2 className="h-4 w-4 mr-2" />
            Generate Prescription
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreviewField({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  if (!value) {
    return (
      <div className="flex items-baseline gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-emerald-800 min-w-[110px]">{label}</span>
        <span className="text-muted-foreground text-[13px] italic">empty</span>
      </div>
    );
  }
  return (
    <div className={multiline ? "space-y-0.5" : "flex items-baseline gap-2"}>
      <span className={"text-[11px] font-medium uppercase tracking-wide text-emerald-800 " + (multiline ? "block" : "min-w-[110px]")}>
        {label}
      </span>
      <span className={"text-foreground text-[13px] " + (multiline ? "block whitespace-pre-wrap" : "")}>
        {value}
      </span>
    </div>
  );
}

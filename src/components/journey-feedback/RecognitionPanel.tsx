/**
 * "This Week's Recognition" — public thank-you cards addressed to the
 * calling clinician. Listens for live `letter_received` Socket events so
 * the panel updates without a refresh.
 *
 * Mounts on the doctor / admin-doctor / therapist dashboard. Renders
 * nothing when no PUBLIC cards exist in the lookback window — keeps the
 * dashboard quiet when there's nothing to surface.
 */

import { useCallback, useEffect, useState } from "react";
import { Heart, MessageSquareHeart } from "lucide-react";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { useTenantFeatures } from "@/hooks/useTenantFeatures";
import {
  journeyFeedbackApi,
  type RecognitionLetter,
} from "@/services/journeyFeedback.service";

interface LetterReceivedPayload {
  feedbackId: string;
  journeyId:  string;
  visibility: 'PUBLIC' | 'PRIVATE';
  excerpt:    string;
  receivedAt: string;
}

export function RecognitionPanel({ sinceDays = 7 }: { sinceDays?: number }) {
  const { has, isLoading: flagsLoading } = useTenantFeatures();
  const flagEnabled = has('JOURNEY_FEEDBACK');
  const { socket } = useWebSocket();

  const [letters, setLetters] = useState<RecognitionLetter[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!flagEnabled) { setLoading(false); return; }
    try {
      setLoading(true);
      const list = await journeyFeedbackApi.getRecognition(sinceDays);
      setLetters(list);
    } catch {
      /* silent — panel just stays empty */
    } finally {
      setLoading(false);
    }
  }, [flagEnabled, sinceDays]);

  useEffect(() => {
    if (flagsLoading) return;
    load();
  }, [flagsLoading, load]);

  // Socket: re-fetch on PUBLIC letter delivery so the panel updates live.
  // PRIVATE deliveries also fire the event but we ignore them here — they
  // don't belong on the public recognition surface.
  useEffect(() => {
    if (!socket) return;
    const handler = (payload: LetterReceivedPayload) => {
      if (payload?.visibility === 'PUBLIC') {
        load();
      }
    };
    socket.on('letter_received', handler);
    return () => { socket.off('letter_received', handler); };
  }, [socket, load]);

  if (!flagEnabled || (loading && letters.length === 0) || letters.length === 0) {
    return null;
  }

  return (
    <section className="rounded-xl border bg-gradient-to-br from-rose-50 via-white to-amber-50 border-rose-200 shadow-card overflow-hidden">
      <div className="px-5 py-3 border-b border-rose-100 flex items-center justify-between bg-rose-50/50">
        <h2 className="font-semibold flex items-center gap-2 text-rose-900">
          <Heart className="w-5 h-5 text-rose-600" /> This Week's Recognition
        </h2>
        <span className="text-xs text-rose-700/70">
          {letters.length} {letters.length === 1 ? 'letter' : 'letters'}
        </span>
      </div>
      <div className="divide-y divide-rose-100 max-h-[320px] overflow-y-auto">
        {letters.map((letter) => (
          <article key={letter.id} className="px-5 py-3.5">
            <div className="flex items-start gap-3">
              <MessageSquareHeart className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-amber-950 whitespace-pre-wrap leading-relaxed">
                  {letter.content}
                </p>
                <div className="mt-1.5 text-[11px] text-rose-700/60 flex items-center gap-2">
                  {letter.journeyTitle && <span className="truncate max-w-[60%]">{letter.journeyTitle}</span>}
                  <span className="ml-auto whitespace-nowrap">
                    {new Date(letter.createdAt).toLocaleDateString(undefined, {
                      month: 'short', day: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

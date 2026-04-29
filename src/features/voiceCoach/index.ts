/**
 * Voice Health Coach feature — public exports.
 *
 * Outside this folder, only import from this index. The internal module
 * structure (CoachWidget vs CoachConversation vs CoachComposer split) can
 * change freely as long as the surface here stays stable.
 */

export { CoachWidget } from "./CoachWidget";
export { default as CoachPage } from "./CoachPage";
export { useCoachSession } from "./useCoachSession";
export { coachService } from "./coach.service";
export type {
    CoachLanguage,
    CoachMessage,
    CoachSession,
    SeverityFlag,
    DetectedIntent,
} from "./types";

export const VOICE_COACH_FEATURE_KEY = "AYURVEDIC_VOICE_COACH";

import { describe, it, expect } from "vitest";
import { composeInstructions, extractFrequency, clampFrequency } from "@/lib/dietFrequency";
import { describeActivity, formatRelative } from "@/lib/auditActivity";

// ─── Diet meal frequency encoding ─────────────────────────────────────

describe("dietFrequency.composeInstructions", () => {
    it("returns undefined when frequency=1 and no instruction text", () => {
        expect(composeInstructions(1, "")).toBeUndefined();
        expect(composeInstructions(1, "   ")).toBeUndefined();
        expect(composeInstructions(1, null)).toBeUndefined();
    });

    it("passes through plain text when frequency=1", () => {
        expect(composeInstructions(1, "Drink warm")).toBe("Drink warm");
    });

    it("encodes frequency as a leading prefix when > 1", () => {
        expect(composeInstructions(3, "After meal")).toBe("Frequency: 3x/day - After meal");
        expect(composeInstructions(2, "")).toBe("Frequency: 2x/day");
    });

    it("clamps frequency to 1-50 range", () => {
        expect(composeInstructions(0, "x")).toBe("x"); // 0 → clamps to 1 → no prefix
        expect(composeInstructions(99, "x")).toBe("Frequency: 50x/day - x");
        expect(composeInstructions(-5, "x")).toBe("x"); // negative → clamps to 1
    });

    it("ignores NaN / non-finite values (treated as frequency=1)", () => {
        // clampFrequency rejects non-finite numbers and falls back to 1, which
        // means the prefix is suppressed and the tail is returned verbatim.
        expect(composeInstructions(NaN, "y")).toBe("y");
        expect(composeInstructions(Infinity, "y")).toBe("y");
        expect(composeInstructions(-Infinity, "y")).toBe("y");
    });
});

describe("dietFrequency.extractFrequency", () => {
    it("returns frequency=1 + empty when input is null/empty", () => {
        expect(extractFrequency(null)).toEqual({ frequency: 1, instructions: "" });
        expect(extractFrequency("")).toEqual({ frequency: 1, instructions: "" });
    });

    it("recovers frequency + tail from the prefix", () => {
        expect(extractFrequency("Frequency: 4x/day - Hot water"))
            .toEqual({ frequency: 4, instructions: "Hot water" });
    });

    it("handles prefix-only (no tail)", () => {
        expect(extractFrequency("Frequency: 2x/day")).toEqual({ frequency: 2, instructions: "" });
    });

    it("treats an unprefixed string as plain instructions", () => {
        expect(extractFrequency("Just text")).toEqual({ frequency: 1, instructions: "Just text" });
    });

    it("clamps a malicious prefix value", () => {
        expect(extractFrequency("Frequency: 9999x/day - boom").frequency).toBe(50);
    });

    it("compose then extract round-trips losslessly for valid input", () => {
        for (const [f, raw] of [[3, "Take with honey"], [7, ""], [1, "After meal"], [50, "Max"]] as Array<[number, string]>) {
            const composed = composeInstructions(f, raw);
            const parsed = extractFrequency(composed ?? "");
            expect(parsed.frequency).toBe(f <= 1 ? 1 : f);
            expect(parsed.instructions).toBe(raw);
        }
    });
});

describe("dietFrequency.clampFrequency", () => {
    it("clamps to [1, 50]", () => {
        expect(clampFrequency(0)).toBe(1);
        expect(clampFrequency(-1)).toBe(1);
        expect(clampFrequency(1)).toBe(1);
        expect(clampFrequency(25)).toBe(25);
        expect(clampFrequency(50)).toBe(50);
        expect(clampFrequency(51)).toBe(50);
        expect(clampFrequency(NaN)).toBe(1);
    });
});

// ─── Activity feed describeActivity ───────────────────────────────────

const mkActivity = (over: Partial<{ action: string; entityType: string }> = {}) => ({
    id: "a", entityId: "e", createdAt: "2026-04-25T00:00:00Z",
    actor: { id: "u", name: "Dr X", role: "DOCTOR" },
    action: over.action || "X",
    entityType: over.entityType || "Generic",
});

describe("auditActivity.describeActivity", () => {
    it("maps user lifecycle actions", () => {
        expect(describeActivity(mkActivity({ action: "CREATE_USER" })).verb).toBe("added a new user");
        expect(describeActivity(mkActivity({ action: "UPDATE_USER" })).verb).toBe("updated user profile");
        expect(describeActivity(mkActivity({ action: "DELETE_USER" })).verb).toBe("removed a user");
    });

    it("handles prescription verb prefixes", () => {
        expect(describeActivity(mkActivity({ action: "CREATE_PRESCRIPTION" })).verb).toBe("issued a prescription");
        expect(describeActivity(mkActivity({ action: "CREATE_PRESCRIPTION_BATCH" })).verb).toBe("issued a prescription");
        expect(describeActivity(mkActivity({ action: "UPDATE_PRESCRIPTION_REFILL" })).verb).toBe("updated a prescription");
    });

    it("handles appointment lifecycle", () => {
        expect(describeActivity(mkActivity({ action: "CREATE_APPOINTMENT" })).verb).toBe("booked an appointment");
        expect(describeActivity(mkActivity({ action: "UPDATE_APPOINTMENT_REMINDER", entityType: "Appointment" })).verb).toBe("updated appointment");
        expect(describeActivity(mkActivity({ action: "CANCEL_APPOINTMENT" })).verb).toBe("cancelled an appointment");
    });

    it("falls back to underscore-stripped verb for unmapped actions", () => {
        const out = describeActivity(mkActivity({ action: "WIDGET_REINDEXED", entityType: "Widget" }));
        expect(out.verb).toBe("widget reindexed");
        expect(out.subject).toBe("Widget");
    });

    it("uses 'Event' subject when entityType is empty", () => {
        const out = describeActivity({
            id: "a", entityId: null, createdAt: "x", actor: { id: null, name: "S", role: "SYSTEM" },
            action: "FOO_BAR", entityType: "",
        });
        expect(out.subject).toBe("Event");
    });
});

// ─── formatRelative ───────────────────────────────────────────────────

describe("auditActivity.formatRelative", () => {
    const NOW = new Date("2026-04-25T12:00:00Z").getTime();

    it("returns 'just now' for sub-minute deltas", () => {
        // The threshold is Math.round(diffMs / 60000) < 1, which means deltas
        // up to 29 seconds round to 0. 30 seconds rounds up to 1 minute by
        // banker's rounding in JS.
        expect(formatRelative("2026-04-25T12:00:00Z", NOW)).toBe("just now");
        expect(formatRelative("2026-04-25T11:59:35Z", NOW)).toBe("just now"); // 25s
    });

    it("returns Nm ago for minute-scale deltas", () => {
        expect(formatRelative("2026-04-25T11:55:00Z", NOW)).toBe("5m ago");
        expect(formatRelative("2026-04-25T11:01:00Z", NOW)).toBe("59m ago");
    });

    it("returns Nh ago for hour-scale deltas", () => {
        expect(formatRelative("2026-04-25T09:00:00Z", NOW)).toBe("3h ago");
        expect(formatRelative("2026-04-24T14:00:00Z", NOW)).toBe("22h ago");
    });

    it("returns Nd ago up to 7 days", () => {
        expect(formatRelative("2026-04-23T12:00:00Z", NOW)).toBe("2d ago");
        expect(formatRelative("2026-04-19T12:00:00Z", NOW)).toBe("6d ago");
    });

    it("falls back to date string beyond a week", () => {
        const out = formatRelative("2026-03-01T12:00:00Z", NOW);
        // locale-dependent string but never one of the relative buckets
        expect(out).not.toMatch(/(just now|m ago|h ago|d ago)/);
    });

    it("returns empty string for invalid ISO", () => {
        expect(formatRelative("not-a-date", NOW)).toBe("");
    });
});

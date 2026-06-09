/**
 * F08 / F04 / F03 / F01 — frontend component tests.
 *
 * Every component:
 *   • Uses useQuery from @tanstack/react-query → wrap in QueryClientProvider.
 *   • Reads a feature flag via useTenantFeatures → mocked per test.
 *   • Fetches via a service module → mocked.
 *
 * No real network. No real localStorage tokens. shadcn/Radix uses Portals
 * for Popover content — we render the trigger and assert against either
 * the trigger surface or the document-wide screen for portalled content.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// ── Shared mocks ──────────────────────────────────────────────────────────
const hasMock = vi.fn();
vi.mock("@/hooks/useTenantFeatures", () => ({
    useTenantFeatures: () => ({
        has: hasMock,
        isLoading: false,
        isSuperAdmin: false,
        error: null,
    }),
}));

// Service mocks — declared at the top so vi.mock factories can reference them.
const getTriageSessionMock = vi.fn();
vi.mock("@/services/triage.service", () => ({
    getTriageSession: (...a: unknown[]) => getTriageSessionMock(...a),
}));

const getDoshaForecastsMock = vi.fn();
vi.mock("@/services/doshaForecast.service", () => ({
    getPatientDoshaForecasts: (...a: unknown[]) => getDoshaForecastsMock(...a),
}));

const getTongueObsMock = vi.fn();
vi.mock("@/services/tongueObservation.service", () => ({
    getPatientTongueObservations: (...a: unknown[]) => getTongueObsMock(...a),
}));

const getDigitalTwinMock = vi.fn();
vi.mock("@/services/digitalTwin.service", () => ({
    getDigitalTwin: (...a: unknown[]) => getDigitalTwinMock(...a),
}));

// Imports must come AFTER the mocks so the vi.mock factories take effect.
const { ExplainabilityPopover } = await import("@/components/triage/ExplainabilityPopover");
const { DoshaForecastPanel }    = await import("@/components/consultation/DoshaForecastPanel");
const { TongueTrendChart }       = await import("@/components/consultation/TongueTrendChart");
const { DigitalTwinPanel }       = await import("@/components/consultation/DigitalTwinPanel");

function renderWithQuery(ui: React.ReactElement) {
    const qc = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
    hasMock.mockReset();
    getTriageSessionMock.mockReset();
    getDoshaForecastsMock.mockReset();
    getTongueObsMock.mockReset();
    getDigitalTwinMock.mockReset();
});

// ── F08 · ExplainabilityPopover ───────────────────────────────────────────
describe("ExplainabilityPopover", () => {
    it('renders the "Why?" trigger', () => {
        renderWithQuery(<ExplainabilityPopover triageSessionId="ts-1" />);
        // Default label per component spec is "Why?".
        expect(screen.getByText("Why?")).toBeInTheDocument();
    });

    it("does not fetch until the popover opens (lazy)", () => {
        renderWithQuery(<ExplainabilityPopover triageSessionId="ts-1" />);
        expect(getTriageSessionMock).not.toHaveBeenCalled();
    });

    it("renders score header on successful fetch after open", async () => {
        getTriageSessionMock.mockResolvedValue({
            id: "ts-1",
            patientId: "pt-1",
            severity: "HIGH",
            suggestedSpecialty: "General Consultation",
            alternativeSpecialties: [],
            compositeScore: 2.3,
            urgencyLevel: "CRITICAL",
            confidenceScore: 0.25,
            inputCompleteness: 0.5,
            routingMatchStrength: 0,
            redFlagsMatched: ["vitals_critical"],
            redFlagForced: true,
            flags: ["red_flag_forced"],
            triageNotes: "RED FLAG: Recorded vitals outside safe range",
            isEscalated: true,
            reviewCount: 0,
            overriddenUrgencyLevel: null,
            overriddenSpecialty: null,
            overrideReason: null,
            createdAt: new Date().toISOString(),
        });
        renderWithQuery(<ExplainabilityPopover triageSessionId="ts-1" />);
        fireEvent.click(screen.getByText("Why?"));
        // Popover content lives in a portal — query the whole document.
        await waitFor(() => {
            expect(screen.getByText(/CRITICAL/)).toBeInTheDocument();
        });
        // 2.3 / 10 with 25% confidence.
        expect(screen.getByText(/2\.3/)).toBeInTheDocument();
    });

    it("renders red flag entries when redFlagsMatched is non-empty", async () => {
        getTriageSessionMock.mockResolvedValue({
            id: "ts-1", patientId: "pt-1", severity: "HIGH",
            suggestedSpecialty: null, alternativeSpecialties: [],
            compositeScore: 5, urgencyLevel: "URGENT", confidenceScore: 0.6,
            inputCompleteness: 0.7, routingMatchStrength: 0.5,
            redFlagsMatched: ["vitals_critical", "severe_pain_chronic"],
            redFlagForced: true, flags: [], triageNotes: null,
            isEscalated: true, reviewCount: 0,
            overriddenUrgencyLevel: null, overriddenSpecialty: null,
            overrideReason: null, createdAt: new Date().toISOString(),
        });
        renderWithQuery(<ExplainabilityPopover triageSessionId="ts-1" />);
        fireEvent.click(screen.getByText("Why?"));
        await waitFor(() => {
            expect(screen.getByText(/vitals critical/i)).toBeInTheDocument();
        });
        // The "Urgency was upgraded automatically" banner from redFlagForced.
        expect(screen.getByText(/upgraded automatically/i)).toBeInTheDocument();
    });

    it("renders error state on fetch failure", async () => {
        getTriageSessionMock.mockRejectedValue(new Error("boom"));
        renderWithQuery(<ExplainabilityPopover triageSessionId="ts-1" />);
        fireEvent.click(screen.getByText("Why?"));
        await waitFor(() => {
            expect(screen.getByText(/Couldn't load/i)).toBeInTheDocument();
        });
    });
});

// ── F04 · DoshaForecastPanel ──────────────────────────────────────────────
describe("DoshaForecastPanel", () => {
    it("renders nothing when feature flag is off", () => {
        hasMock.mockReturnValue(false);
        const { container } = renderWithQuery(<DoshaForecastPanel patientId="pt-1" />);
        expect(container.firstChild).toBeNull();
        // Fetch never queued.
        expect(getDoshaForecastsMock).not.toHaveBeenCalled();
    });

    it("renders nothing when no forecast data is returned", async () => {
        hasMock.mockReturnValue(true);
        getDoshaForecastsMock.mockResolvedValue([]);
        const { container } = renderWithQuery(<DoshaForecastPanel patientId="pt-1" />);
        // Wait for the query to settle; once data is [], component returns null.
        await waitFor(() => {
            expect(container.firstChild).toBeNull();
        });
    });

    it("renders dominantDosha label and trigger factors on a non-resolved forecast", async () => {
        hasMock.mockReturnValue(true);
        getDoshaForecastsMock.mockResolvedValue([
            {
                id: "fc-1",
                generatedAt: new Date().toISOString(),
                daysUntilSymp: 12,
                confidence: 0.74,
                dominantDosha: "VATA",
                imbalanceType: "AGGRAVATION",
                triggerFactors: [
                    "Pain rising +0.5/day over 9 days",
                    "Sleep declined 8 → 6 hrs",
                ],
                alertEmitted: true,
                alertEmittedAt: new Date().toISOString(),
                resolved: false,
                resolvedAt: null,
            },
        ]);
        renderWithQuery(<DoshaForecastPanel patientId="pt-1" />);
        await waitFor(() => {
            expect(screen.getByText(/VATA AGGRAVATION/i)).toBeInTheDocument();
        });
        expect(screen.getByText(/Pain rising/i)).toBeInTheDocument();
        expect(screen.getByText(/12 days/i)).toBeInTheDocument();
        expect(screen.getByText(/Alert sent to care queue/i)).toBeInTheDocument();
    });

    it("shows the resolved state when every forecast is resolved=true", async () => {
        hasMock.mockReturnValue(true);
        getDoshaForecastsMock.mockResolvedValue([
            {
                id: "fc-resolved",
                generatedAt: new Date().toISOString(),
                daysUntilSymp: 10, confidence: 0.5,
                dominantDosha: "KAPHA", imbalanceType: "AGGRAVATION",
                triggerFactors: [],
                alertEmitted: true, alertEmittedAt: null,
                resolved: true, resolvedAt: new Date().toISOString(),
            },
        ]);
        renderWithQuery(<DoshaForecastPanel patientId="pt-1" />);
        await waitFor(() => {
            expect(screen.getByText(/marked resolved/i)).toBeInTheDocument();
        });
    });
});

// ── F03 · TongueTrendChart ────────────────────────────────────────────────
describe("TongueTrendChart", () => {
    it("renders nothing when feature flag is off", () => {
        hasMock.mockReturnValue(false);
        const { container } = renderWithQuery(<TongueTrendChart patientId="pt-1" />);
        expect(container.firstChild).toBeNull();
    });

    it("renders nothing when no observations", async () => {
        hasMock.mockReturnValue(true);
        getTongueObsMock.mockResolvedValue([]);
        const { container } = renderWithQuery(<TongueTrendChart patientId="pt-1" />);
        await waitFor(() => expect(container.firstChild).toBeNull());
    });

    it("renders a table with the expected columns + trend summary", async () => {
        hasMock.mockReturnValue(true);
        getTongueObsMock.mockResolvedValue([
            {
                id: "to-1",
                photoUrl: null,
                observedAt: "2026-06-06T00:00:00.000Z",
                aiCoatingColour: "YELLOW", aiCoatingThickness: "MODERATE",
                aiMoisture: "DRY", cracks: false,
                doshaIndication: "PITTA", confidence: 0.82,
                analysisNotes: null, alertEmitted: true,
            },
            {
                id: "to-2",
                photoUrl: null,
                observedAt: "2026-05-30T00:00:00.000Z",
                aiCoatingColour: "WHITE", aiCoatingThickness: "THIN",
                aiMoisture: "NORMAL", cracks: false,
                doshaIndication: "KAPHA", confidence: 0.71,
                analysisNotes: null, alertEmitted: false,
            },
            {
                id: "to-3",
                photoUrl: null,
                observedAt: "2026-05-23T00:00:00.000Z",
                aiCoatingColour: "WHITE", aiCoatingThickness: "THIN",
                aiMoisture: "NORMAL", cracks: false,
                doshaIndication: "KAPHA", confidence: 0.7,
                analysisNotes: null, alertEmitted: false,
            },
        ]);
        renderWithQuery(<TongueTrendChart patientId="pt-1" />);
        await waitFor(() => {
            expect(screen.getByText(/Tongue Trend/i)).toBeInTheDocument();
        });
        // Headers
        expect(screen.getByText("Date")).toBeInTheDocument();
        expect(screen.getByText("Coating")).toBeInTheDocument();
        expect(screen.getByText("Moisture")).toBeInTheDocument();
        expect(screen.getByText("Dosha")).toBeInTheDocument();
        // Trend summary line is data-derived (no LLM call); it should mention
        // one of the patterns. With WHITE → YELLOW drift the summary calls
        // out "Coating shifting".
        expect(screen.getByText(/shifting|drift|pattern/i)).toBeInTheDocument();
    });
});

// ── F01 · DigitalTwinPanel ────────────────────────────────────────────────
describe("DigitalTwinPanel", () => {
    it("renders nothing when feature flag is off", () => {
        hasMock.mockReturnValue(false);
        const { container } = renderWithQuery(<DigitalTwinPanel patientId="pt-1" />);
        expect(container.firstChild).toBeNull();
    });

    it("renders nothing when fetch errors", async () => {
        hasMock.mockReturnValue(true);
        getDigitalTwinMock.mockRejectedValue(new Error("boom"));
        const { container } = renderWithQuery(<DigitalTwinPanel patientId="pt-1" />);
        await waitFor(() => expect(container.firstChild).toBeNull());
    });

    it("renders all 4 sections + dosha bars + sparklines on a full payload", async () => {
        hasMock.mockReturnValue(true);
        getDigitalTwinMock.mockResolvedValue({
            patientId: "pt-1",
            prakriti: "VATA_PITTA",
            agniType: "MANDAGNI",
            satvaRating: 7,
            painTrend:     Array.from({ length: 14 }, (_, i) => ({ date: `2026-05-${10 + i}`, value: i % 5 })),
            sleepTrend:    Array.from({ length: 14 }, (_, i) => ({ date: `2026-05-${10 + i}`, value: 7 + (i % 3) })),
            moodTrend:     Array.from({ length: 14 }, (_, i) => ({ date: `2026-05-${10 + i}`, value: 3 })),
            mobilityTrend: Array.from({ length: 14 }, (_, i) => ({ date: `2026-05-${10 + i}`, value: 5 })),
            doshaBalance: { vata: 50, pitta: 35, kapha: 15 },
            forecast: {
                dominantDosha: "VATA",
                daysUntilSymp: 12,
                confidence: 0.74,
                triggerFactors: ["Pain rising"],
            },
            tongueSummary: {
                latestDosha: "PITTA",
                latestColour: "YELLOW",
                trend: "WORSENING",
            },
            activeMedCount: 5,
            activeMeds: [
                { name: "Adathodai", dosage: "1tsp", frequency: "BD" },
                { name: "Triphala",   dosage: "500mg", frequency: "OD" },
                { name: "Brahmi",     dosage: "1 cap", frequency: "OD" },
            ],
            wellnessScore: 72,
            journeyCondition: "Sandhigata Vata",
            journeyStatus: "ACTIVE",
            similarPatientsCount: 17,
            privacyFloor: 5,
        });
        const { container } = renderWithQuery(<DigitalTwinPanel patientId="pt-1" />);
        await waitFor(() => {
            expect(screen.getByText("Digital Twin")).toBeInTheDocument();
        });
        // Section 1 header — prakriti subtitle + wellness pill.
        expect(screen.getByText(/VATA_PITTA/)).toBeInTheDocument();
        expect(screen.getByText(/Wellness 72/i)).toBeInTheDocument();
        // Section 2 — dosha bars + forecast indicator. The dosha names
        // appear multiple times across sections (bars + forecast badge +
        // tongueSummary), so assert "at least one" instead of exactly one.
        expect(screen.getAllByText("VATA").length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText("PITTA").length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText("KAPHA").length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText(/aggravation forecast in 12 days/i)).toBeInTheDocument();
        // Section 3 — inline SVG sparklines (4 of them).
        const svgs = container.querySelectorAll("svg.block");
        expect(svgs.length).toBeGreaterThanOrEqual(4);
        // Section 4 — meds + cohort.
        expect(screen.getByText(/5 active/i)).toBeInTheDocument();
        expect(screen.getByText(/Adathodai/)).toBeInTheDocument();
        expect(screen.getByText(/Sandhigata Vata/)).toBeInTheDocument();
        expect(screen.getByText(/17 patients/i)).toBeInTheDocument();
    });

    it('shows "Limited data" when similarPatientsCount < privacy floor', async () => {
        hasMock.mockReturnValue(true);
        getDigitalTwinMock.mockResolvedValue({
            patientId: "pt-1",
            prakriti: "VATA", agniType: null, satvaRating: null,
            painTrend: [], sleepTrend: [], moodTrend: [], mobilityTrend: [],
            doshaBalance: { vata: 70, pitta: 15, kapha: 15 },
            forecast: null,
            tongueSummary: null,
            activeMedCount: 0,
            activeMeds: [],
            wellnessScore: null,
            journeyCondition: "Niche condition",
            journeyStatus: "ACTIVE",
            similarPatientsCount: 2,
            privacyFloor: 5,
        });
        renderWithQuery(<DigitalTwinPanel patientId="pt-1" />);
        await waitFor(() => {
            expect(screen.getByText(/Limited data/i)).toBeInTheDocument();
        });
        // Numeric cohort string must NOT appear.
        expect(screen.queryByText(/2 patients/i)).not.toBeInTheDocument();
    });

    it("colours wellness pill via tier (≥70 emerald, 40-69 amber, <40 rose)", async () => {
        hasMock.mockReturnValue(true);
        // Render 3 panels with different scores, each in its own client so
        // the queries don't share cache.
        async function expectWellnessTier(score: number | null, tone: RegExp | null) {
            getDigitalTwinMock.mockResolvedValueOnce({
                patientId: "pt-test",
                prakriti: "VATA", agniType: null, satvaRating: null,
                painTrend: [], sleepTrend: [], moodTrend: [], mobilityTrend: [],
                doshaBalance: { vata: 100, pitta: 0, kapha: 0 },
                forecast: null, tongueSummary: null,
                activeMedCount: 0, activeMeds: [],
                wellnessScore: score, journeyCondition: null, journeyStatus: null,
                similarPatientsCount: 0, privacyFloor: 5,
            });
            const { unmount } = renderWithQuery(<DigitalTwinPanel patientId={`pt-tier-${score}`} />);
            if (tone === null) {
                // No score → no Wellness pill.
                await waitFor(() => {
                    expect(screen.getByText("Digital Twin")).toBeInTheDocument();
                });
                expect(screen.queryByText(/Wellness/i)).not.toBeInTheDocument();
            } else {
                const pill = await screen.findByText(/Wellness/i);
                expect(pill.className).toMatch(tone);
            }
            unmount();
        }
        await expectWellnessTier(85, /emerald/);
        await expectWellnessTier(55, /amber/);
        await expectWellnessTier(20, /rose/);
        await expectWellnessTier(null, null);
    });
});

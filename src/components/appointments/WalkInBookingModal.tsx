/**
 * Walk-In Booking Modal — 5-step wizard for ADMIN / ADMIN_DOCTOR.
 *
 * Step 1: Patient (search existing OR register new walk-in)
 * Step 2: Consultation type (Doctor / Therapist / Combined; mode is always OFFLINE)
 * Step 3: Select clinician (doctor required; therapist if T/C type)
 * Step 4: Date + time-slot grid (morning / afternoon / evening sections)
 * Step 5: Confirm + admin notes → POST /api/appointments/walk-in
 *
 * Conflict handling: on Step 4, clicking a BOOKED/BLOCKED slot opens the
 * override-reason dropdown. The booking still goes through the same
 * confirm flow but `overrideReason` is included in the payload.
 */

import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import {
    walkInBookingService,
    type SlotsResponse,
    type WalkInSlot,
} from '@/services/walkInBooking.service';

interface WalkInBookingModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Called after a successful booking; parent uses this to refresh the
     *  appointments list. */
    onBooked?: () => void;
}

type PatientResult = {
    id: string;
    fullName?: string | null;
    phoneNumber?: string | null;
    patientId?: string | null;
    isGuest?: boolean;
    user?: { email?: string };
    onboardingData?: { name?: string };
};

type ClinicianResult = {
    id: string;
    fullName?: string | null;
    user?: { email?: string };
};

const CONSULTATION_TYPES: Array<{ value: 'DOCTOR' | 'THERAPIST' | 'COMBINED'; label: string; sub: string }> = [
    { value: 'DOCTOR', label: 'Doctor Only', sub: '30 min consultation' },
    { value: 'THERAPIST', label: 'Therapist Only', sub: '45 min therapy session' },
    { value: 'COMBINED', label: 'Doctor + Therapist', sub: '60 min combined session' },
];

const OVERRIDE_REASONS = [
    'Emergency walk-in',
    'Doctor approved override',
    'Patient reschedule',
    'System error correction',
];

const TEAL = '#0D6E6E';

function displayName(p: PatientResult | ClinicianResult | null | undefined): string {
    if (!p) return '';
    return p.fullName
        || (p as PatientResult).onboardingData?.name
        || p.user?.email
        || 'Unknown';
}

export function WalkInBookingModal({ isOpen, onClose, onBooked }: WalkInBookingModalProps) {
    // ── Step state ────────────────────────────────────────────────────────
    const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

    // Step 1 — patient selection
    const [patientMode, setPatientMode] = useState<'existing' | 'new'>('existing');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<PatientResult[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState<PatientResult | null>(null);
    const [guestData, setGuestData] = useState({
        name: '', phone: '', age: '', gender: '', prakriti: '',
    });

    // Step 2/3 — clinical
    const [consultationType, setConsultationType] = useState<'DOCTOR' | 'THERAPIST' | 'COMBINED'>('DOCTOR');
    const [doctors, setDoctors] = useState<ClinicianResult[]>([]);
    const [therapists, setTherapists] = useState<ClinicianResult[]>([]);
    const [selectedDoctor, setSelectedDoctor] = useState('');
    const [selectedTherapist, setSelectedTherapist] = useState('');

    // Step 4 — date + slot grid
    const todayIso = useMemo(() => new Date().toISOString().split('T')[0], []);
    const [selectedDate, setSelectedDate] = useState(todayIso);
    const [slotsData, setSlotsData] = useState<SlotsResponse | null>(null);
    const [slotsLoading, setSlotsLoading] = useState(false);
    const [selectedTime, setSelectedTime] = useState('');
    const [overrideReason, setOverrideReason] = useState('');
    const [showOverride, setShowOverride] = useState(false);

    // Step 5
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Reset everything when the modal closes
    useEffect(() => {
        if (!isOpen) {
            setStep(1);
            setPatientMode('existing');
            setSearchQuery('');
            setSearchResults([]);
            setSelectedPatient(null);
            setGuestData({ name: '', phone: '', age: '', gender: '', prakriti: '' });
            setConsultationType('DOCTOR');
            setSelectedDoctor('');
            setSelectedTherapist('');
            setSelectedDate(todayIso);
            setSlotsData(null);
            setSelectedTime('');
            setOverrideReason('');
            setShowOverride(false);
            setNotes('');
        }
    }, [isOpen, todayIso]);

    // Load doctors/therapists once when modal opens
    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;
        (async () => {
            try {
                const data = await walkInBookingService.listClinicians(true);
                if (cancelled) return;
                setDoctors(data.doctors || []);
                setTherapists(data.therapists || []);
            } catch (err) {
                console.error('[WalkInBooking] failed to load clinicians', err);
            }
        })();
        return () => { cancelled = true; };
    }, [isOpen]);

    // Debounced patient search (existing-patient mode only)
    useEffect(() => {
        if (patientMode !== 'existing') return;
        if (searchQuery.trim().length < 2) {
            setSearchResults([]);
            return;
        }
        let cancelled = false;
        setSearchLoading(true);
        const t = setTimeout(async () => {
            try {
                const data = await walkInBookingService.searchPatients(searchQuery.trim());
                if (cancelled) return;
                setSearchResults(Array.isArray(data) ? (data as PatientResult[]).slice(0, 10) : []);
            } catch (err) {
                console.error('[WalkInBooking] search failed', err);
            } finally {
                if (!cancelled) setSearchLoading(false);
            }
        }, 300);
        return () => { cancelled = true; clearTimeout(t); };
    }, [searchQuery, patientMode]);

    // Load slots whenever we reach Step 4 OR doctor/date change
    useEffect(() => {
        if (step !== 4 || !selectedDoctor) return;
        let cancelled = false;
        setSlotsLoading(true);
        (async () => {
            try {
                const data = await walkInBookingService.getSlots(selectedDoctor, selectedDate);
                if (cancelled) return;
                setSlotsData(data);
                setSelectedTime('');
                setShowOverride(false);
                setOverrideReason('');
            } catch (err) {
                console.error('[WalkInBooking] slot load failed', err);
                if (!cancelled) setSlotsData(null);
            } finally {
                if (!cancelled) setSlotsLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [step, selectedDoctor, selectedDate]);

    // ── Helpers ──────────────────────────────────────────────────────────
    const step1Valid = patientMode === 'existing'
        ? !!selectedPatient
        : !!(guestData.name && guestData.phone && guestData.age && guestData.gender);

    const step3Valid = !!selectedDoctor &&
        (consultationType !== 'THERAPIST' || !!selectedTherapist) &&
        (consultationType !== 'COMBINED' || !!selectedDoctor);

    const resolvedPatientName = patientMode === 'existing'
        ? displayName(selectedPatient)
        : guestData.name;
    const selectedDoctorName = doctors.find((d) => d.id === selectedDoctor) ? displayName(doctors.find((d) => d.id === selectedDoctor)!) : '';

    const { morningSlots, afternoonSlots, eveningSlots } = useMemo(() => {
        const arr = slotsData?.slots ?? [];
        return {
            morningSlots: arr.filter((s) => parseInt(s.time.split(':')[0], 10) < 12),
            afternoonSlots: arr.filter((s) => {
                const h = parseInt(s.time.split(':')[0], 10);
                return h >= 12 && h < 17;
            }),
            eveningSlots: arr.filter((s) => parseInt(s.time.split(':')[0], 10) >= 17),
        };
    }, [slotsData]);

    function handleSlotClick(slot: WalkInSlot) {
        if (slot.status === 'PAST') return;
        if (slot.status === 'AVAILABLE') {
            setSelectedTime(slot.time);
            setShowOverride(false);
            setOverrideReason('');
        } else if (slot.status === 'BOOKED' || slot.status === 'BLOCKED') {
            // Admin override path — select the slot AND require an override reason.
            setSelectedTime(slot.time);
            setShowOverride(true);
        }
    }

    async function handleConfirmBooking() {
        setIsSubmitting(true);
        try {
            // 1. Resolve patient id — create guest if registering new.
            let resolvedPatientId = selectedPatient?.id;
            if (patientMode === 'new') {
                const guestRes = await walkInBookingService.createGuestPatient({
                    name: guestData.name.trim(),
                    phone: guestData.phone.trim(),
                    age: parseInt(guestData.age, 10),
                    gender: guestData.gender,
                    prakriti: guestData.prakriti || undefined,
                });
                resolvedPatientId = guestRes.patient.id;
                if (guestRes.alreadyExists) {
                    toast.message('Patient already in system — using existing profile');
                }
            }

            // 2. Create walk-in.
            await walkInBookingService.createWalkIn({
                patientId: resolvedPatientId,
                doctorId: selectedDoctor,
                therapistId: selectedTherapist || undefined,
                consultationType,
                date: selectedDate,
                time: selectedTime,
                notes: notes.trim() || undefined,
                overrideReason: overrideReason || undefined,
            });

            toast.success('Walk-in appointment booked successfully!');
            onBooked?.();
            onClose();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Booking failed';
            toast.error(message);
        } finally {
            setIsSubmitting(false);
        }
    }

    function renderSlotButton(slot: WalkInSlot) {
        const isSelected = selectedTime === slot.time;
        const baseTitle = slot.status === 'PAST'
            ? 'This time has already passed'
            : slot.status === 'BOOKED'
                ? `Booked: ${slot.patientName || 'Patient'}`
                : slot.status === 'BLOCKED'
                    ? `Blocked: ${slot.blockReason || ''}`
                    : '';
        // PAST gets its own explicit branch with line-through so the patient
        // booking form and the walk-in modal share the same visual grammar.
        // Without this, PAST slots fell through to the generic disabled-fallback
        // tile and looked indistinguishable from "no data" / dead rows.
        const cls = isSelected
            ? 'border-teal-600 bg-teal-600 text-white'
            : slot.status === 'AVAILABLE'
                ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                : slot.status === 'PAST'
                    ? 'border-gray-200 bg-gray-100 text-gray-400 line-through cursor-not-allowed'
                    : slot.status === 'BOOKED'
                        ? 'border-gray-200 bg-gray-100 text-gray-500'
                        : slot.status === 'BLOCKED'
                            ? 'border-red-100 bg-red-50 text-red-500'
                            : 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed';
        return (
            <button
                key={slot.time}
                type="button"
                onClick={() => handleSlotClick(slot)}
                disabled={slot.status === 'PAST'}
                title={baseTitle}
                className={`py-2 rounded-lg text-xs font-medium border transition-colors ${cls}`}
            >
                {slot.time}
                {slot.status === 'BOOKED' && <span className="block text-[10px]">Booked</span>}
                {slot.status === 'BLOCKED' && <span className="block text-[10px]">Blocked</span>}
                {slot.status === 'PAST' && <span className="block text-[10px]">Past</span>}
            </button>
        );
    }

    return (
        <Dialog open={isOpen} onOpenChange={(o) => !o && !isSubmitting && onClose()}>
            <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <span>Book Walk-In Appointment</span>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="text-gray-400 hover:text-gray-600"
                            aria-label="Close"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </DialogTitle>
                </DialogHeader>

                {/* ── Step 1: Patient ────────────────────────────────────── */}
                {step === 1 && (
                    <div>
                        <h3 className="font-semibold text-base mb-1">Step 1 of 5 — Find Patient</h3>
                        <p className="text-sm text-gray-500 mb-4">Search for an existing patient or register a new walk-in</p>

                        <div className="flex gap-2 mb-4">
                            <button
                                type="button"
                                onClick={() => setPatientMode('existing')}
                                className={`flex-1 py-2 rounded-lg border text-sm font-medium ${patientMode === 'existing' ? 'border-teal-600 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-600'}`}
                            >
                                Existing Patient
                            </button>
                            <button
                                type="button"
                                onClick={() => setPatientMode('new')}
                                className={`flex-1 py-2 rounded-lg border text-sm font-medium ${patientMode === 'new' ? 'border-teal-600 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-600'}`}
                            >
                                New Walk-In
                            </button>
                        </div>

                        {patientMode === 'existing' ? (
                            <div>
                                <div className="relative mb-3">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search by name or phone number (min 2 chars)…"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-9 pr-3 py-3 border border-gray-200 rounded-xl text-sm"
                                    />
                                </div>
                                <div className="max-h-64 overflow-y-auto">
                                    {searchLoading && (
                                        <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
                                            <Loader2 className="w-3 h-3 animate-spin" /> Searching…
                                        </div>
                                    )}
                                    {!searchLoading && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                                        <p className="text-xs text-gray-400 italic py-2">No matching patients.</p>
                                    )}
                                    {searchResults.map((p) => (
                                        <div
                                            key={p.id}
                                            onClick={() => setSelectedPatient(p)}
                                            className={`p-3 rounded-xl border cursor-pointer mb-2 ${selectedPatient?.id === p.id ? 'border-teal-600 bg-teal-50' : 'border-gray-100'}`}
                                        >
                                            <div className="font-medium text-sm">{displayName(p)}</div>
                                            <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                                                {p.phoneNumber && <span>{p.phoneNumber}</span>}
                                                {p.patientId && <span>· {p.patientId}</span>}
                                                {p.isGuest && (
                                                    <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[10px]">
                                                        Walk-in (unregistered)
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <input
                                    placeholder="Full name *"
                                    value={guestData.name}
                                    onChange={(e) => setGuestData((d) => ({ ...d, name: e.target.value }))}
                                    className="w-full p-3 border border-gray-200 rounded-xl text-sm"
                                />
                                <input
                                    placeholder="Phone number *"
                                    value={guestData.phone}
                                    onChange={(e) => setGuestData((d) => ({ ...d, phone: e.target.value }))}
                                    className="w-full p-3 border border-gray-200 rounded-xl text-sm"
                                />
                                <div className="grid grid-cols-2 gap-3">
                                    <input
                                        placeholder="Age *"
                                        type="number"
                                        value={guestData.age}
                                        onChange={(e) => setGuestData((d) => ({ ...d, age: e.target.value }))}
                                        className="p-3 border border-gray-200 rounded-xl text-sm"
                                    />
                                    <select
                                        value={guestData.gender}
                                        onChange={(e) => setGuestData((d) => ({ ...d, gender: e.target.value }))}
                                        className="p-3 border border-gray-200 rounded-xl text-sm bg-white"
                                    >
                                        <option value="">Gender *</option>
                                        <option value="MALE">Male</option>
                                        <option value="FEMALE">Female</option>
                                        <option value="OTHER">Other</option>
                                    </select>
                                </div>
                                <select
                                    value={guestData.prakriti}
                                    onChange={(e) => setGuestData((d) => ({ ...d, prakriti: e.target.value }))}
                                    className="w-full p-3 border border-gray-200 rounded-xl text-sm bg-white"
                                >
                                    <option value="">Prakriti (optional)</option>
                                    <option value="VATA">Vata</option>
                                    <option value="PITTA">Pitta</option>
                                    <option value="KAPHA">Kapha</option>
                                    <option value="VATA_PITTA">Vata-Pitta</option>
                                    <option value="PITTA_KAPHA">Pitta-Kapha</option>
                                    <option value="VATA_KAPHA">Vata-Kapha</option>
                                </select>
                            </div>
                        )}

                        <Button
                            onClick={() => setStep(2)}
                            disabled={!step1Valid}
                            className="w-full mt-4 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-50"
                            style={{ background: TEAL }}
                        >
                            Next →
                        </Button>
                    </div>
                )}

                {/* ── Step 2: Consultation Type ──────────────────────────── */}
                {step === 2 && (
                    <div>
                        <h3 className="font-semibold text-base mb-3">Step 2 of 5 — Consultation Type</h3>
                        <div className="space-y-2 mb-4">
                            {CONSULTATION_TYPES.map((type) => (
                                <div
                                    key={type.value}
                                    onClick={() => setConsultationType(type.value)}
                                    className={`p-4 rounded-xl border cursor-pointer ${consultationType === type.value ? 'border-teal-600 bg-teal-50' : 'border-gray-200'}`}
                                >
                                    <div className="font-medium text-sm">{type.label}</div>
                                    <div className="text-xs text-gray-500">{type.sub}</div>
                                </div>
                            ))}
                        </div>
                        <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 text-sm text-teal-700 mb-4">
                            📍 Mode: In-Person (Offline) — all walk-in appointments are offline
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setStep(1)} className="flex-1 py-2.5 rounded-xl">Back</Button>
                            <Button onClick={() => setStep(3)} className="flex-1 py-2.5 rounded-xl text-white" style={{ background: TEAL }}>Next →</Button>
                        </div>
                    </div>
                )}

                {/* ── Step 3: Clinician ──────────────────────────────────── */}
                {step === 3 && (
                    <div>
                        <h3 className="font-semibold text-base mb-3">Step 3 of 5 — Select Clinician</h3>

                        <label className="text-xs text-gray-500 mb-1 block">
                            Doctor {consultationType !== 'THERAPIST' ? '*' : '(optional)'}
                        </label>
                        <select
                            value={selectedDoctor}
                            onChange={(e) => { setSelectedDoctor(e.target.value); setSelectedTime(''); }}
                            className="w-full p-3 border border-gray-200 rounded-xl text-sm mb-3 bg-white"
                        >
                            <option value="">Select a doctor</option>
                            {doctors.map((d) => (
                                <option key={d.id} value={d.id}>{displayName(d)}</option>
                            ))}
                        </select>

                        {(consultationType === 'THERAPIST' || consultationType === 'COMBINED') && (
                            <>
                                <label className="text-xs text-gray-500 mb-1 block">
                                    Therapist {consultationType === 'THERAPIST' ? '*' : '(optional)'}
                                </label>
                                <select
                                    value={selectedTherapist}
                                    onChange={(e) => setSelectedTherapist(e.target.value)}
                                    className="w-full p-3 border border-gray-200 rounded-xl text-sm mb-3 bg-white"
                                >
                                    <option value="">Select a therapist</option>
                                    {therapists.map((t) => (
                                        <option key={t.id} value={t.id}>{displayName(t)}</option>
                                    ))}
                                </select>
                            </>
                        )}

                        <div className="flex gap-2 mt-4">
                            <Button variant="outline" onClick={() => setStep(2)} className="flex-1 py-2.5 rounded-xl">Back</Button>
                            <Button
                                onClick={() => setStep(4)}
                                disabled={!step3Valid}
                                className="flex-1 py-2.5 rounded-xl text-white disabled:opacity-50"
                                style={{ background: TEAL }}
                            >
                                Next →
                            </Button>
                        </div>
                    </div>
                )}

                {/* ── Step 4: Date + Slots ───────────────────────────────── */}
                {step === 4 && (
                    <div>
                        <h3 className="font-semibold text-base mb-3">Step 4 of 5 — Select Date & Time</h3>

                        <input
                            type="date"
                            value={selectedDate}
                            min={todayIso}
                            onChange={(e) => { setSelectedDate(e.target.value); setSelectedTime(''); setShowOverride(false); setOverrideReason(''); }}
                            className="w-full p-3 border border-gray-200 rounded-xl text-sm mb-4"
                        />

                        {slotsData?.nextAvailable && !selectedTime && (
                            <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 text-sm text-teal-700 mb-3">
                                Next available slot: <strong>{slotsData.nextAvailable}</strong>
                            </div>
                        )}

                        {slotsLoading ? (
                            <div className="grid grid-cols-4 gap-2">
                                {Array.from({ length: 12 }).map((_, i) => (
                                    <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
                                ))}
                            </div>
                        ) : (slotsData?.slots ?? []).length === 0 ? (
                            <div className="text-sm text-gray-400 italic py-4 text-center">
                                No working hours configured for this clinician on this date.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {morningSlots.length > 0 && (
                                    <div>
                                        <div className="text-xs text-gray-400 mb-2">Morning</div>
                                        <div className="grid grid-cols-4 gap-2">{morningSlots.map(renderSlotButton)}</div>
                                    </div>
                                )}
                                {afternoonSlots.length > 0 && (
                                    <div>
                                        <div className="text-xs text-gray-400 mb-2">Afternoon</div>
                                        <div className="grid grid-cols-4 gap-2">{afternoonSlots.map(renderSlotButton)}</div>
                                    </div>
                                )}
                                {eveningSlots.length > 0 && (
                                    <div>
                                        <div className="text-xs text-gray-400 mb-2">Evening</div>
                                        <div className="grid grid-cols-4 gap-2">{eveningSlots.map(renderSlotButton)}</div>
                                    </div>
                                )}
                            </div>
                        )}

                        {showOverride && (
                            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                                <div className="text-sm font-medium text-amber-800 mb-2">
                                    ⚠ This slot is already booked or blocked. Override reason required:
                                </div>
                                <select
                                    value={overrideReason}
                                    onChange={(e) => setOverrideReason(e.target.value)}
                                    className="w-full p-2 border border-amber-200 rounded-lg text-sm bg-white"
                                >
                                    <option value="">Select reason…</option>
                                    {OVERRIDE_REASONS.map((r) => (
                                        <option key={r} value={r}>{r}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="flex gap-2 mt-4">
                            <Button variant="outline" onClick={() => setStep(3)} className="flex-1 py-2.5 rounded-xl">Back</Button>
                            <Button
                                onClick={() => setStep(5)}
                                disabled={!selectedTime || (showOverride && !overrideReason)}
                                className="flex-1 py-2.5 rounded-xl text-white disabled:opacity-50"
                                style={{ background: TEAL }}
                            >
                                Next →
                            </Button>
                        </div>
                    </div>
                )}

                {/* ── Step 5: Confirm ─────────────────────────────────────── */}
                {step === 5 && (
                    <div>
                        <h3 className="font-semibold text-base mb-3">Step 5 of 5 — Confirm Booking</h3>

                        <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Patient</span>
                                <span className="font-medium">{resolvedPatientName}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Doctor</span>
                                <span className="font-medium">{selectedDoctorName}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Type</span>
                                <span className="font-medium">{consultationType}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Date</span>
                                <span className="font-medium">
                                    {new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Time</span>
                                <span className="font-medium text-teal-700">{selectedTime}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Mode</span>
                                <span className="font-medium">In-Person (Offline)</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Status</span>
                                <span className="font-medium text-green-600">CONFIRMED (no approval needed)</span>
                            </div>
                            {overrideReason && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Override</span>
                                    <span className="font-medium text-amber-600">{overrideReason}</span>
                                </div>
                            )}
                        </div>

                        <textarea
                            placeholder="Admin notes (optional)"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                            className="w-full p-3 border border-gray-200 rounded-xl text-sm mb-4 resize-none"
                        />

                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setStep(4)} className="flex-1 py-2.5 rounded-xl" disabled={isSubmitting}>Back</Button>
                            <Button
                                onClick={() => void handleConfirmBooking()}
                                disabled={isSubmitting}
                                className="flex-1 py-2.5 rounded-xl text-white disabled:opacity-70"
                                style={{ background: TEAL }}
                            >
                                {isSubmitting ? (
                                    <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Booking…</>
                                ) : (
                                    'Confirm Walk-In Booking'
                                )}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

/**
 * RetentionChecklistModal
 *
 * A unified follow-up accountability tool for Doctors and Therapists.
 * Embedded within the consultation flow — does not alter existing
 * booking, prescription, or dashboard workflows.
 *
 * Five structured categories:
 *   General Routine · Diet · Yoga/Guided Exercises · Therapy at Home · Others
 *
 * Status options:  Completed · Partial · Not Followed
 * Optional per-row notes (up to 1 000 chars each)
 * Auto-loads existing submission; upserts on save.
 */

import { useCallback, useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
    ClipboardList,
    ChevronDown,
    ChevronUp,
    CheckCircle2,
    AlertCircle,
    XCircle,
    Loader2,
    Save,
} from 'lucide-react';
import type {
    RetentionCategory,
    RetentionStatus,
    RetentionChecklistItem,
    RetentionChecklist,
} from '@/types';
import {
    RETENTION_CATEGORY_LABELS,
    RETENTION_STATUS_CONFIG,
} from '@/types';
import { apiClient } from '@/lib/api-client';
const ORDERED_CATEGORIES: RetentionCategory[] = [
    'GENERAL_ROUTINE',
    'DIET',
    'YOGA_EXERCISE',
    'THERAPY_HOME',
    'OTHERS',
];

// ── Status icon helper ────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: RetentionStatus | null }) {
    if (!status) return null;
    if (status === 'COMPLETED')    return <CheckCircle2 className="w-3.5 h-3.5" />;
    if (status === 'PARTIAL')      return <AlertCircle  className="w-3.5 h-3.5" />;
    return                                <XCircle      className="w-3.5 h-3.5" />;
}

// ── Row state type ────────────────────────────────────────────────────────────

interface RowState {
    status: RetentionStatus | null;
    notes:  string;
    showNotes: boolean;
}

function buildDefaultRows(): Record<RetentionCategory, RowState> {
    const rows = {} as Record<RetentionCategory, RowState>;
    ORDERED_CATEGORIES.forEach(cat => {
        rows[cat] = { status: null, notes: '', showNotes: false };
    });
    return rows;
}

function applyExistingItems(
    items: RetentionChecklistItem[],
): Record<RetentionCategory, RowState> {
    const rows = buildDefaultRows();
    (items ?? []).forEach(item => {
        if (rows[item.category] !== undefined) {
            rows[item.category] = {
                status:    item.status,
                notes:     item.notes ?? '',
                showNotes: !!item.notes,
            };
        }
    });
    return rows;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface RetentionChecklistModalProps {
    isOpen:        boolean;
    onClose:       () => void;
    appointmentId: string;
    patientName?:  string;
    /** When true the form is read-only (e.g. patient or admin viewing) */
    readOnly?:     boolean;
    onSuccess?:    (checklist: RetentionChecklist) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RetentionChecklistModal({
    isOpen,
    onClose,
    appointmentId,
    patientName,
    readOnly = false,
    onSuccess,
}: RetentionChecklistModalProps) {
    const [rows, setRows]           = useState<Record<RetentionCategory, RowState>>(buildDefaultRows);
    const [loading, setLoading]     = useState(true);
    const [saving,  setSaving]      = useState(false);
    const [existing, setExisting]   = useState<RetentionChecklist | null>(null);

    // ── Load existing checklist ───────────────────────────────────────────

    const load = useCallback(async () => {
        if (!appointmentId) return;
        setLoading(true);
        try {
            const { data } = await apiClient.get<RetentionChecklist | null>(`/api/retention-checklist/appointment/${appointmentId}`);
            if (data) {
                setExisting(data);
                setRows(applyExistingItems(data.items));
            } else {
                setExisting(null);
                setRows(buildDefaultRows());
            }
        } catch {
            // network error — start fresh; non-fatal
        } finally {
            setLoading(false);
        }
    }, [appointmentId]);

    useEffect(() => {
        if (isOpen) load();
    }, [isOpen, load]);

    // ── Handlers ──────────────────────────────────────────────────────────

    const setStatus = (cat: RetentionCategory, status: RetentionStatus) => {
        if (readOnly) return;
        setRows(prev => ({ ...prev, [cat]: { ...prev[cat], status } }));
    };

    const setNotes = (cat: RetentionCategory, notes: string) => {
        if (readOnly) return;
        setRows(prev => ({ ...prev, [cat]: { ...prev[cat], notes } }));
    };

    const toggleNotes = (cat: RetentionCategory) => {
        setRows(prev => ({ ...prev, [cat]: { ...prev[cat], showNotes: !prev[cat].showNotes } }));
    };

    const handleSave = async () => {
        const items: RetentionChecklistItem[] = ORDERED_CATEGORIES
            .filter(cat => rows[cat].status !== null)
            .map(cat => ({
                category: cat,
                status:   rows[cat].status as RetentionStatus,
                notes:    rows[cat].notes.trim() || null,
            }));

        if (items.length === 0) {
            toast.warning('Please mark at least one category before saving.');
            return;
        }

        setSaving(true);
        try {
            const { data: saved } = await apiClient.post<RetentionChecklist>(`/api/retention-checklist/${appointmentId}`, { items });
            toast.success(existing ? 'Checklist updated' : 'Retention checklist saved');
            setExisting(saved);
            onSuccess?.(saved);
            onClose();
        } catch (err: any) {
            toast.error(err?.message || 'Failed to save checklist');
        } finally {
            setSaving(false);
        }
    };

    // ── Summary badge ─────────────────────────────────────────────────────

    const completedCount = ORDERED_CATEGORIES.filter(c => rows[c].status === 'COMPLETED').length;
    const totalFilled    = ORDERED_CATEGORIES.filter(c => rows[c].status !== null).length;

    // ── Render ────────────────────────────────────────────────────────────

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-lg font-black">
                        <ClipboardList className="w-5 h-5 text-primary" />
                        Patient Retention Checklist
                        {existing && (
                            <Badge className="ml-2 text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary border-primary/20">
                                Previously Saved
                            </Badge>
                        )}
                    </DialogTitle>
                    <DialogDescription asChild>
                        <div className="space-y-1">
                            {patientName && (
                                <p className="text-sm text-muted-foreground">
                                    Follow-up review for <span className="font-semibold text-foreground">{patientName}</span>
                                </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                                Record patient adherence across structured categories. Notes are optional.
                            </p>
                            {!loading && totalFilled > 0 && (
                                <p className="text-xs font-medium text-primary">
                                    {completedCount}/{ORDERED_CATEGORIES.length} completed · {totalFilled} filled
                                </p>
                            )}
                        </div>
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="py-16 flex items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-sm">Loading checklist…</span>
                    </div>
                ) : (
                    <div className="space-y-3 mt-2">
                        {ORDERED_CATEGORIES.map((cat, idx) => {
                            const row    = rows[cat];
                            const config = row.status ? RETENTION_STATUS_CONFIG[row.status] : null;

                            return (
                                <div
                                    key={cat}
                                    className={cn(
                                        'rounded-xl border transition-all',
                                        config ? `${config.bg} shadow-sm` : 'bg-muted/30 border-border/50',
                                    )}
                                >
                                    {/* Row header */}
                                    <div className="flex items-center justify-between gap-3 p-3">
                                        {/* Category label */}
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="flex-none w-6 h-6 rounded-full bg-background border border-border/60 flex items-center justify-center text-[10px] font-black text-muted-foreground">
                                                {idx + 1}
                                            </span>
                                            <span className="font-semibold text-sm text-foreground truncate">
                                                {RETENTION_CATEGORY_LABELS[cat]}
                                            </span>
                                        </div>

                                        {/* Status selectors */}
                                        <div className="flex items-center gap-1.5 flex-none">
                                            {(['COMPLETED', 'PARTIAL', 'NOT_FOLLOWED'] as RetentionStatus[]).map(s => {
                                                const cfg    = RETENTION_STATUS_CONFIG[s];
                                                const active = row.status === s;
                                                return (
                                                    <button
                                                        key={s}
                                                        type="button"
                                                        disabled={readOnly}
                                                        onClick={() => setStatus(cat, s)}
                                                        aria-pressed={active}
                                                        className={cn(
                                                            'flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-black uppercase tracking-tight transition-all',
                                                            active
                                                                ? `${cfg.bg} ${cfg.color} shadow-sm scale-105`
                                                                : 'bg-background text-muted-foreground border-border/40 hover:border-border hover:bg-muted/50',
                                                            readOnly && 'cursor-default opacity-80',
                                                        )}
                                                    >
                                                        <StatusIcon status={active ? s : null} />
                                                        <span className="hidden sm:inline">{cfg.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Optional notes toggle + textarea */}
                                    {!readOnly ? (
                                        <div className="px-3 pb-3">
                                            <button
                                                type="button"
                                                onClick={() => toggleNotes(cat)}
                                                className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                                            >
                                                {row.showNotes
                                                    ? <ChevronUp   className="w-3 h-3" />
                                                    : <ChevronDown className="w-3 h-3" />
                                                }
                                                {row.showNotes ? 'Hide notes' : 'Add notes'}
                                            </button>
                                            {row.showNotes && (
                                                <Textarea
                                                    value={row.notes}
                                                    onChange={e => setNotes(cat, e.target.value)}
                                                    placeholder="Optional comment for this category…"
                                                    rows={2}
                                                    maxLength={1000}
                                                    className="mt-2 text-xs resize-none"
                                                />
                                            )}
                                        </div>
                                    ) : row.notes ? (
                                        <div className="px-3 pb-3">
                                            <p className="text-xs text-muted-foreground italic leading-relaxed">
                                                {row.notes}
                                            </p>
                                        </div>
                                    ) : null}
                                </div>
                            );
                        })}

                        {/* Timestamp footer when previously saved */}
                        {existing && (
                            <p className="text-[10px] text-muted-foreground text-right">
                                Last saved: {new Date(existing.updatedAt).toLocaleString()}
                            </p>
                        )}

                        {/* Actions */}
                        {!readOnly && (
                            <div className="flex gap-3 justify-end pt-2 border-t border-border/50">
                                <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                                    Cancel
                                </Button>
                                <Button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={saving || totalFilled === 0}
                                    className="gap-2"
                                >
                                    {saving ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                                    ) : (
                                        <><Save className="w-4 h-4" /> {existing ? 'Update Checklist' : 'Save Checklist'}</>
                                    )}
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

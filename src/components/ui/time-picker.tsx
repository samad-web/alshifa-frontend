import { useMemo, useState } from "react";
import { Clock as ClockIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface TimePickerProps {
    /** HH:mm string (matches the native `<input type="time">` value shape). */
    value: string;
    onChange: (hhmm: string) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    /** Minute granularity for the picker. Default 5 → 00, 05, 10, …, 55. */
    minuteStep?: 1 | 5 | 10 | 15 | 30;
    id?: string;
}

/**
 * Themed time picker — drop-in replacement for `<Input type="time">`.
 * Mirrors the look of `DatePicker`: outline trigger button with a leading
 * Clock icon, popover with two scrollable hour / minute columns.
 *
 * Keeps the same `HH:mm` value contract so existing form state works
 * without changes.
 */
export function TimePicker({
    value, onChange, placeholder = "Pick a time",
    className, disabled, minuteStep = 5, id,
}: TimePickerProps) {
    const [open, setOpen] = useState(false);

    const { selectedHour, selectedMinute } = useMemo(() => {
        if (!value || !/^\d{1,2}:\d{2}$/.test(value)) {
            return { selectedHour: null as number | null, selectedMinute: null as number | null };
        }
        const [h, m] = value.split(":").map(Number);
        return { selectedHour: h, selectedMinute: m };
    }, [value]);

    const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
    const minutes = useMemo(() => {
        const list: number[] = [];
        for (let m = 0; m < 60; m += minuteStep) list.push(m);
        return list;
    }, [minuteStep]);

    const emit = (h: number | null, m: number | null) => {
        if (h == null || m == null) return;
        onChange(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    id={id}
                    type="button"
                    variant="outline"
                    disabled={disabled}
                    className={cn(
                        "w-full justify-start text-left font-normal",
                        !value && "text-muted-foreground",
                        className,
                    )}
                >
                    <ClockIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                    {value || placeholder}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="start">
                <div className="flex gap-2">
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground py-1">Hr</span>
                        <ScrollArea className="h-56 w-14 rounded-md border">
                            <div className="flex flex-col p-1 gap-0.5">
                                {hours.map((h) => {
                                    const active = h === selectedHour;
                                    return (
                                        <Button
                                            key={h}
                                            type="button"
                                            size="sm"
                                            variant={active ? "default" : "ghost"}
                                            className={cn(
                                                "h-8 w-full justify-center px-0 text-sm font-mono",
                                                active && "bg-gradient-to-br from-primary to-wellness text-primary-foreground",
                                            )}
                                            onClick={() => {
                                                emit(h, selectedMinute ?? 0);
                                            }}
                                        >
                                            {String(h).padStart(2, "0")}
                                        </Button>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground py-1">Min</span>
                        <ScrollArea className="h-56 w-14 rounded-md border">
                            <div className="flex flex-col p-1 gap-0.5">
                                {minutes.map((m) => {
                                    const active = m === selectedMinute;
                                    return (
                                        <Button
                                            key={m}
                                            type="button"
                                            size="sm"
                                            variant={active ? "default" : "ghost"}
                                            className={cn(
                                                "h-8 w-full justify-center px-0 text-sm font-mono",
                                                active && "bg-gradient-to-br from-primary to-wellness text-primary-foreground",
                                            )}
                                            onClick={() => {
                                                emit(selectedHour ?? 0, m);
                                            }}
                                        >
                                            {String(m).padStart(2, "0")}
                                        </Button>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
                <div className="flex items-center justify-between gap-2 pt-2 mt-2 border-t">
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-xs h-7"
                        onClick={() => {
                            const now = new Date();
                            const h = now.getHours();
                            // Snap to nearest step so the highlighted minute matches the list.
                            const m = Math.round(now.getMinutes() / minuteStep) * minuteStep;
                            emit(h, m % 60);
                        }}
                    >
                        Now
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => setOpen(false)}
                    >
                        Done
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}

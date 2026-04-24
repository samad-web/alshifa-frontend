import { useMemo, useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DatePickerProps {
    /** ISO `yyyy-MM-dd` string (matches the native `<input type="date">` value shape). */
    value: string;
    onChange: (isoDate: string) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    fromDate?: Date;
    toDate?: Date;
    /** date-fns display format for the button label. Default is Indian short
     *  format "dd/MM/yyyy" (e.g. "22/04/2026"). */
    displayFormat?: string;
    /** Match the native input's required affordance (no HTML form validation — visual only). */
    required?: boolean;
    id?: string;
}

/**
 * Themed date picker — drop-in replacement for `<Input type="date">`.
 * Keeps the same ISO `yyyy-MM-dd` value contract so existing state/form
 * code works without changes.
 */
export function DatePicker({
    value, onChange, placeholder = "Pick a date",
    className, disabled, fromDate, toDate,
    displayFormat = "dd/MM/yyyy", required, id,
}: DatePickerProps) {
    const [open, setOpen] = useState(false);

    // Parse the ISO string without timezone drift — treat "yyyy-MM-dd" as a
    // local date rather than UTC midnight.
    const selected = useMemo(() => {
        if (!value) return undefined;
        const [y, m, d] = value.split("-").map(Number);
        if (!y || !m || !d) return undefined;
        return new Date(y, m - 1, d);
    }, [value]);

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
                        !selected && "text-muted-foreground",
                        className,
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                    {selected ? format(selected, displayFormat) : (
                        <>
                            {placeholder}
                            {required && <span className="ml-1 text-destructive">*</span>}
                        </>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="single"
                    selected={selected}
                    onSelect={(d) => {
                        if (d) {
                            // Emit "yyyy-MM-dd" in local time (NOT toISOString(),
                            // which would shift by the UTC offset and land on
                            // the previous day for anything west of UTC).
                            const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                            onChange(iso);
                        }
                        setOpen(false);
                    }}
                    fromDate={fromDate}
                    toDate={toDate}
                    initialFocus
                />
            </PopoverContent>
        </Popover>
    );
}

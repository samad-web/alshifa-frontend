import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";

export interface PatientLite {
    id: string;
    fullName: string | null;
    phoneNumber?: string | null;
}

interface PatientPickerProps {
    value: string;
    onChange: (id: string) => void;
    placeholder?: string;
    className?: string;
    /** Pre-loaded list — if omitted, the component fetches /api/user/list-patients itself. */
    patients?: PatientLite[];
    disabled?: boolean;
}

/**
 * Searchable patient selector. Drop-in replacement for a flat <Select> when
 * the patient list is large enough that scrolling is painful. Filters on
 * name, phone, or id substring.
 */
export function PatientPicker({
    value, onChange, placeholder = "Select a patient",
    className, patients: externalPatients, disabled,
}: PatientPickerProps) {
    const [open, setOpen] = useState(false);
    const [fetched, setFetched] = useState<PatientLite[] | null>(null);

    useEffect(() => {
        if (externalPatients) return;
        apiClient.get<PatientLite[]>("/api/user/list-patients")
            .then(({ data }) => setFetched(data))
            .catch(() => setFetched([]));
    }, [externalPatients]);

    const patients = externalPatients ?? fetched ?? [];
    const selected = useMemo(() => patients.find((p) => p.id === value), [patients, value]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    disabled={disabled}
                    className={cn("w-full justify-between font-normal", className)}
                >
                    <span className="flex items-center gap-2 truncate">
                        <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="truncate">{selected?.fullName || placeholder}</span>
                    </span>
                    <ChevronsUpDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command
                    filter={(itemValue, search) => {
                        // itemValue is the haystack string we pass below.
                        return itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
                    }}
                >
                    <CommandInput placeholder="Search by name or phone…" />
                    <CommandList>
                        <CommandEmpty>No patients match.</CommandEmpty>
                        <CommandGroup>
                            {patients.map((p) => {
                                const haystack = [p.fullName ?? "", p.phoneNumber ?? "", p.id].join(" ");
                                return (
                                    <CommandItem
                                        key={p.id}
                                        value={haystack}
                                        onSelect={() => { onChange(p.id); setOpen(false); }}
                                    >
                                        <Check className={cn("mr-2 h-4 w-4", value === p.id ? "opacity-100" : "opacity-0")} />
                                        <div className="flex flex-col">
                                            <span className="text-sm">{p.fullName || "Unnamed"}</span>
                                            {p.phoneNumber && (
                                                <span className="text-xs text-muted-foreground">{p.phoneNumber}</span>
                                            )}
                                        </div>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * SearchableSelect — drop-in replacement for `<Select>` when the option list
 * is long enough to warrant a filter box. Deliberately narrow-API: pass the
 * options as data (`items`), not JSX children, so the combobox can filter.
 *
 * Options can provide:
 *   - `label`   (string, displayed + searched)
 *   - `sub`     (optional secondary line — also searchable)
 *   - `keywords`(extra searchable terms not shown: phone, id, etc.)
 *   - `disabled`(bool)
 *
 * Keep shadcn `<Select>` for short enum-style lists (Gender, Role, Status).
 */
export interface SearchableSelectItem {
    value: string;
    label: string;
    sub?: string;
    keywords?: string[];
    disabled?: boolean;
}

interface SearchableSelectProps {
    value: string;
    onChange: (value: string) => void;
    items: SearchableSelectItem[];
    placeholder?: string;
    searchPlaceholder?: string;
    emptyMessage?: string;
    className?: string;
    triggerClassName?: string;
    popoverClassName?: string;
    disabled?: boolean;
    required?: boolean;
    id?: string;
    /** If set, shown when no items are passed. Useful while a parent is fetching. */
    loadingPlaceholder?: string;
    loading?: boolean;
}

export function SearchableSelect({
    value, onChange, items,
    placeholder = "Select…",
    searchPlaceholder = "Search…",
    emptyMessage = "No matches.",
    className, triggerClassName, popoverClassName,
    disabled, required, id,
    loadingPlaceholder = "Loading…",
    loading,
}: SearchableSelectProps) {
    const [open, setOpen] = useState(false);

    const selected = useMemo(
        () => items.find((it) => it.value === value),
        [items, value],
    );

    return (
        <div className={className}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        id={id}
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        aria-required={required || undefined}
                        disabled={disabled || loading}
                        className={cn(
                            "w-full justify-between font-normal",
                            !selected && "text-muted-foreground",
                            triggerClassName,
                        )}
                    >
                        <span className="truncate">
                            {loading ? loadingPlaceholder : (selected?.label || placeholder)}
                        </span>
                        <ChevronsUpDown className="w-4 h-4 text-muted-foreground flex-shrink-0 ml-2" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent
                    className={cn("w-[--radix-popover-trigger-width] p-0", popoverClassName)}
                    align="start"
                >
                    <Command
                        filter={(itemValue, search) => {
                            // itemValue is the haystack we construct below.
                            return itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
                        }}
                    >
                        <CommandInput placeholder={searchPlaceholder} />
                        <CommandList>
                            <CommandEmpty>{emptyMessage}</CommandEmpty>
                            <CommandGroup>
                                {items.map((it) => {
                                    const haystack = [it.label, it.sub ?? "", ...(it.keywords ?? [])].join(" ");
                                    return (
                                        <CommandItem
                                            key={it.value}
                                            value={haystack}
                                            disabled={it.disabled}
                                            onSelect={() => {
                                                onChange(it.value);
                                                setOpen(false);
                                            }}
                                        >
                                            <Check className={cn("mr-2 h-4 w-4", value === it.value ? "opacity-100" : "opacity-0")} />
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-sm truncate">{it.label}</span>
                                                {it.sub && (
                                                    <span className="text-xs text-muted-foreground truncate">{it.sub}</span>
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
        </div>
    );
}

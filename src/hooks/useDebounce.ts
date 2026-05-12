// useDebounce — returns the latest `value` after `delay` ms of inactivity.
// Used by Diet Plans search, Treatment Packages enroll combobox, and the
// Group Sessions multi-patient picker so per-keystroke API hits collapse
// into one fetch when the user stops typing.

import { useEffect, useState } from "react";

export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debounced;
}

export default useDebounce;

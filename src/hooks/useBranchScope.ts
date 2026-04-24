import { useEffect, useState, useCallback } from "react";

const STORAGE_KEY = "branchScope";
const EVENT_NAME = "branchScope:changed";
export const ALL_BRANCHES = "all";

export function useBranchScope() {
  const [scope, setScopeState] = useState<string>(
    () => sessionStorage.getItem(STORAGE_KEY) ?? ALL_BRANCHES,
  );

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<string>;
      setScopeState(ce.detail);
    };
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, []);

  const setBranchScope = useCallback((value: string) => {
    sessionStorage.setItem(STORAGE_KEY, value);
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: value }));
  }, []);

  const isAll = !scope || scope === ALL_BRANCHES;

  return {
    scope,
    isAll,
    branchIdParam: isAll ? undefined : scope,
    setBranchScope,
  };
}

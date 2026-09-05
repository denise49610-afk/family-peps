import { useEffect, useState } from "react";
import { useFamilyStore } from "./store";

export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const api = useFamilyStore.persist;
    const finish = () => setHydrated(true);
    const unsub = api.onFinishHydration(finish);
    if (api.hasHydrated()) finish();
    const t = window.setTimeout(finish, 800);
    return () => {
      unsub();
      window.clearTimeout(t);
    };
  }, []);
  return hydrated;
}

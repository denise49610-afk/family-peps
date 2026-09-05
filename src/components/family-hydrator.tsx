import { useEffect } from "react";
import { toast } from "sonner";
import { useFamilyStore } from "@/lib/family/store";
import { initCloudSync, joinFamilyCloud } from "@/lib/family/sync";

/** Rehydrate localStorage then start optional cloud sync. Client-only. */
export function FamilyHydrator() {
  useEffect(() => {
    const api = useFamilyStore.persist;
    const start = () => {
      const st = useFamilyStore.getState();
      const demo = st.members.some((m) =>
        ["member-maman", "member-papa", "member-sofiane", "member-ayyoub"].includes(m.id),
      );
      if (demo) {
        st.wipeAll();
      }
      void (async () => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("famille") || params.get("code") || params.get("family");
        if (code) {
          const res = await joinFamilyCloud(code);
          if ("ok" in res) {
            toast.success("Connecté au planning partagé");
          } else {
            toast.error(res.error);
            initCloudSync();
          }
          const url = new URL(window.location.href);
          url.searchParams.delete("famille");
          url.searchParams.delete("code");
          url.searchParams.delete("family");
          window.history.replaceState({}, "", url.pathname + url.search + url.hash);
          return;
        }
        initCloudSync();
      })();
    };
    void api.rehydrate();
    if (api.hasHydrated()) {
      start();
      return;
    }
    return api.onFinishHydration(start);
  }, []);
  return null;
}

import { useEffect } from "react";
import { toast } from "sonner";
import { useFamilyStore } from "@/lib/family/store";
import { initCloudSync, joinFamilyCloud } from "@/lib/family/sync";

const BACKUP_KEY = "famizen-family-code";

/** Rehydrate localStorage then start optional cloud sync. Client-only. */
export function FamilyHydrator() {
  useEffect(() => {
    const api = useFamilyStore.persist;
    const start = () => {
      const st = useFamilyStore.getState();
      if (!Array.isArray(st.settings.completedKeys)) {
        st.updateSettings({ completedKeys: [] });
      }

      void (async () => {
        const params = new URLSearchParams(window.location.search);
        const fromUrl =
          params.get("famille") || params.get("code") || params.get("family") || "";
        const fromBackup =
          typeof localStorage !== "undefined" ? localStorage.getItem(BACKUP_KEY) || "" : "";
        const fromSettings = st.settings.familyCode || "";

        const code = (fromUrl || fromSettings || fromBackup).trim().toUpperCase();

        if (code) {
          try {
            localStorage.setItem(BACKUP_KEY, code);
          } catch {
            /* ignore */
          }
          const res = await joinFamilyCloud(code);
          if ("ok" in res) {
            if (fromUrl) toast.success("Connecté au planning partagé");
          } else {
            st.updateSettings({ familyCode: code, cloudSync: true });
            if (fromUrl) toast.error(res.error);
            initCloudSync();
          }
          if (fromUrl) {
            const url = new URL(window.location.href);
            url.searchParams.delete("famille");
            url.searchParams.delete("code");
            url.searchParams.delete("family");
            window.history.replaceState({}, "", url.pathname + url.search + url.hash);
          }
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

import { Check, Copy, Link2, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useFamilyStore } from "@/lib/family/store";
import {
  createFamilyCloud,
  joinFamilyCloud,
  onSyncStatus,
  shareFamilyUrl,
  type SyncStatus,
} from "@/lib/family/sync";

export function ShareFamilyCard({ compact = false }: { compact?: boolean }) {
  const settings = useFamilyStore((s) => s.settings);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("off");

  useEffect(
    () =>
      onSyncStatus((st) => {
        setSyncStatus(st);
      }),
    [],
  );

  const code = settings.familyCode;
  const connected = Boolean(code && settings.cloudSync);
  const shareUrl = code ? shareFamilyUrl(code) : "";

  async function copyShare() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      toast.success("Lien copié — envoyez-le à la famille");
    } catch {
      toast.error("Copie impossible");
    }
  }

  async function nativeShare() {
    if (!shareUrl) return;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "Fami'Zen",
          text: `Rejoins le planning de la famille (${code})`,
          url: shareUrl,
        });
        return;
      } catch {
        // fallback
      }
    }
    await copyShare();
  }

  if (compact && connected) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-[1.4rem] bg-member-turquoise-soft px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-member-turquoise-fg/70">
            Appli partagée
          </p>
          <p className="truncate font-display text-lg font-extrabold tracking-wide text-member-turquoise-fg">
            {code}
            {syncStatus === "synced" ? " · à jour" : syncStatus === "connecting" ? " · sync…" : ""}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void nativeShare()}>
          <Share2 className="size-4" />
          Partager
        </Button>
      </div>
    );
  }

  return (
    <section className="rounded-[1.6rem] bg-surface p-5 card-shadow">
      <div className="mb-3 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-member-turquoise-soft text-member-turquoise">
          <Link2 className="size-5" />
        </span>
        <div>
          <h2 className="font-display text-xl font-extrabold">Appli partagée</h2>
          <p className="mt-0.5 text-sm font-semibold text-muted">
            Un seul planning pour tous les téléphones. Le lien ouvre la même famille, photos
            comprises.
          </p>
        </div>
      </div>

      {connected ? (
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl bg-member-turquoise-soft px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-member-turquoise-fg/70">
              Code famille
            </p>
            <p className="font-display text-2xl font-extrabold tracking-wider text-member-turquoise-fg">
              {code}
            </p>
            <p className="mt-1 text-xs font-semibold text-member-turquoise-fg/80">
              {syncStatus === "synced"
                ? "Synchronisé — les changements apparaissent partout"
                : syncStatus === "connecting"
                  ? "Connexion au cloud…"
                  : syncStatus === "error"
                    ? "Erreur de sync — réessayez"
                    : "En attente de sync"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void nativeShare()}>
              <Share2 className="size-4" />
              Envoyer le lien
            </Button>
            <Button variant="outline" onClick={() => void copyShare()}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copié" : "Copier le lien"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const res = await createFamilyCloud();
                if ("error" in res) toast.error(res.error);
                else {
                  toast.success(`Famille créée · ${res.code}`);
                  const url = shareFamilyUrl(res.code);
                  try {
                    await navigator.clipboard.writeText(url);
                    toast.message("Lien copié — envoyez-le à Maman, Papa, etc.");
                  } catch {
                    /* ignore */
                  }
                }
              } finally {
                setBusy(false);
              }
            }}
          >
            Créer l'appli partagée
          </Button>
          <Field label="Rejoindre avec un code">
            <div className="flex gap-2">
              <Input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ZEN-XXXXXX"
                className="font-mono uppercase"
              />
              <Button
                variant="outline"
                disabled={busy || !joinCode.trim()}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const res = await joinFamilyCloud(joinCode);
                    if ("error" in res) toast.error(res.error);
                    else toast.success("Connecté à la famille");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Rejoindre
              </Button>
            </div>
          </Field>
        </div>
      )}
    </section>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ColorPicker } from "@/components/forms";
import { ShareFamilyCard } from "@/components/share-family";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/empty";
import { useFamilyStore } from "@/lib/family/store";
import {
  leaveFamilyCloud,
  onSyncStatus,
  testCloudConnection,
  type SyncStatus,
} from "@/lib/family/sync";
import type { MemberColor } from "@/lib/family/types";

export const Route = createFileRoute("/parametres")({ component: SettingsPage });

function SettingsPage() {
  const store = useFamilyStore();
  const s = store.settings;
  const [busy, setBusy] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("off");
  const [syncMsg, setSyncMsg] = useState<string | undefined>();

  useEffect(
    () =>
      onSyncStatus((st, msg) => {
        setSyncStatus(st);
        setSyncMsg(msg);
      }),
    [],
  );

  function requestNotif() {
    if (typeof Notification === "undefined") {
      toast.error("Les notifications ne sont pas disponibles ici.");
      return;
    }
    void Notification.requestPermission().then((p) => {
      store.updateSettings({ remindersEnabled: p === "granted" });
      toast.success(p === "granted" ? "Rappels activés" : "Notifications refusées");
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Paramètres" subtitle="Tout est modifiable. Rien n'est figé." />

      <ShareFamilyCard />
      {s.familyCode ? (
        <div className="-mt-2 flex flex-wrap gap-2 px-1">
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const res = await testCloudConnection();
                if ("ok" in res) toast.success("Cloud OK — prêt à partager");
                else toast.error(res.error, { duration: 8000 });
              } finally {
                setBusy(false);
              }
            }}
          >
            Tester la connexion
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await leaveFamilyCloud();
                toast.success("Déconnecté du cloud — données locales conservées");
              } finally {
                setBusy(false);
              }
            }}
          >
            Quitter le cloud
          </Button>
          {syncStatus === "error" && syncMsg ? (
            <p className="w-full text-xs font-semibold text-danger">{syncMsg}</p>
          ) : null}
        </div>
      ) : null}

      <section className="rounded-3xl bg-surface p-5 card-shadow">
        <h2 className="mb-4 font-display text-xl font-semibold">Application</h2>
        <div className="flex flex-col gap-3">
          <Field label="Nom de l'application">
            <Input
              value={s.appName}
              onChange={(e) => store.updateSettings({ appName: e.target.value })}
            />
          </Field>
          <Field label="Nom de famille (accueil)">
            <Input
              value={s.familyName || ""}
              onChange={(e) => store.updateSettings({ familyName: e.target.value })}
              placeholder="Lamhamdi"
            />
          </Field>
          <Field label="Ville (météo)">
            <Input
              value={s.city}
              onChange={(e) => store.updateSettings({ city: e.target.value })}
            />
          </Field>
          <Field label="Je suis">
            <Select
              value={s.currentMemberId}
              onChange={(e) => store.updateSettings({ currentMemberId: e.target.value })}
            >
              {store.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.firstName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="La semaine commence">
            <Select
              value={String(s.weekStartsOn)}
              onChange={(e) =>
                store.updateSettings({ weekStartsOn: Number(e.target.value) as 0 | 1 })
              }
            >
              <option value="1">Lundi</option>
              <option value="0">Dimanche</option>
            </Select>
          </Field>
        </div>
      </section>

      <section className="rounded-3xl bg-surface p-5 card-shadow">
        <h2 className="mb-4 font-display text-xl font-semibold">Rappels</h2>
        <label className="mb-3 flex min-h-11 items-center justify-between gap-3">
          <span className="font-semibold">Activer les rappels</span>
          <input
            type="checkbox"
            className="size-5 accent-primary"
            checked={s.remindersEnabled}
            onChange={(e) => store.updateSettings({ remindersEnabled: e.target.checked })}
          />
        </label>
        <Field label="Rappel par défaut">
          <Select
            value={String(s.defaultReminderMinutes)}
            onChange={(e) =>
              store.updateSettings({ defaultReminderMinutes: Number(e.target.value) })
            }
          >
            <option value="15">15 minutes avant</option>
            <option value="60">1 heure avant</option>
            <option value="120">2 heures avant</option>
            <option value="1440">La veille</option>
          </Select>
        </Field>
        <Button className="mt-3" variant="outline" onClick={requestNotif}>
          Autoriser les notifications du navigateur
        </Button>
      </section>

      <section className="rounded-3xl bg-surface p-5 card-shadow">
        <h2 className="mb-4 font-display text-xl font-semibold">Catégories</h2>
        <ul className="flex flex-col gap-4">
          {store.categories.map((c) => (
            <li key={c.id} className="flex flex-col gap-2 rounded-2xl bg-surface-2 p-3">
              <div className="flex items-center gap-2">
                <Input
                  value={c.name}
                  onChange={(e) => store.updateCategory(c.id, { name: e.target.value })}
                />
                {!c.builtin ? (
                  <Button variant="ghost" size="sm" onClick={() => store.removeCategory(c.id)}>
                    Retirer
                  </Button>
                ) : null}
              </div>
              <ColorPicker
                value={c.color}
                onChange={(color: MemberColor) => store.updateCategory(c.id, { color })}
              />
            </li>
          ))}
        </ul>
        <Button
          className="mt-3"
          variant="outline"
          onClick={() =>
            store.addCategory({ name: "Nouvelle catégorie", icon: "star", color: "turquoise" })
          }
        >
          Créer une catégorie
        </Button>
      </section>

      <section className="rounded-3xl bg-surface p-5 card-shadow">
        <h2 className="mb-2 font-display text-xl font-semibold">Données</h2>
        <p className="mb-4 text-sm text-muted">
          En local, tout reste sur cet appareil. Avec un code famille, le cloud synchronise aussi.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="danger"
            onClick={() => {
              if (confirm("Tout supprimer définitivement ?")) {
                store.wipeAll();
                toast.success("Données effacées");
              }
            }}
          >
            Tout supprimer
          </Button>
        </div>
      </section>
    </div>
  );
}

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import {
  parseBrainDump,
  proposalToPayload,
  type DumpProposal,
} from "@/lib/family/brain-dump";
import { useFamilyStore } from "@/lib/family/store";

export function BrainDumpForm({ onClose }: { onClose: () => void }) {
  const members = useFamilyStore((s) => s.members);
  const addEvent = useFamilyStore((s) => s.addEvent);
  const addActivity = useFamilyStore((s) => s.addActivity);
  const addTask = useFamilyStore((s) => s.addTask);
  const [text, setText] = useState("");
  const [proposals, setProposals] = useState<DumpProposal[]>([]);
  const [step, setStep] = useState<"write" | "review">("write");

  function analyze() {
    if (!text.trim()) {
      toast.error("Écrivez ce que vous voulez retenir");
      return;
    }
    const list = parseBrainDump(text, members);
    if (!list.length) {
      toast.error("Rien d'exploitable — essayez une phrase par info");
      return;
    }
    setProposals(list);
    setStep("review");
  }

  function toggle(id: string) {
    setProposals((prev) =>
      prev.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p)),
    );
  }

  function patch(id: string, field: keyof DumpProposal, value: string) {
    setProposals((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
    );
  }

  function saveAll() {
    const chosen = proposals.filter((p) => p.selected);
    if (!chosen.length) {
      toast.error("Cochez au moins une proposition");
      return;
    }
    let n = 0;
    for (const p of chosen) {
      const payload = proposalToPayload(p);
      if (payload.kind === "event") addEvent(payload.data);
      else if (payload.kind === "activity") addActivity(payload.data);
      else addTask(payload.data);
      n += 1;
    }
    toast.success(
      n === 1 ? "1 élément ajouté" : `${n} éléments ajoutés au planning / tâches`,
    );
    onClose();
  }

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={step === "write" ? "Balance tout" : "On a rangé ça"}
      footer={
        step === "write" ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button onClick={analyze}>Analyser</Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setStep("write")}>
              Modifier le texte
            </Button>
            <Button onClick={saveAll}>Ajouter la sélection</Button>
          </>
        )
      }
    >
      {step === "write" ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-muted">
            Une idée par ligne — RDV, sport, courses… on classe pour vous.
          </p>
          <Field label="Écrivez en vrac">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder={
                "Ex.\nDentiste Sofiane mardi 15h\nJJB lundi et mercredi 18h\nAcheter fournitures\n"
              }
              className="min-h-[10rem]"
            />
          </Field>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-muted">
            Cochez ce que vous voulez garder, corrigez si besoin.
          </p>
          <ul className="flex flex-col gap-2">
            {proposals.map((p) => (
              <li
                key={p.id}
                className="rounded-2xl border border-line bg-surface-2 px-3 py-2.5"
              >
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-1.5 size-4"
                    checked={p.selected}
                    onChange={() => toggle(p.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-muted">
                        {p.kind === "event"
                          ? "Planning"
                          : p.kind === "activity"
                            ? "Activité"
                            : "Tâche"}
                      </span>
                      <Input
                        value={p.title}
                        onChange={(e) => patch(p.id, "title", e.target.value)}
                        className="h-8 flex-1 text-sm font-bold"
                      />
                    </div>
                    <p className="mt-1 text-[11px] font-semibold text-muted">
                      {p.date ? `${p.date} ` : ""}
                      {p.startTime
                        ? `${p.startTime}${p.endTime ? "–" + p.endTime : ""}`
                        : ""}
                      {p.memberIds.length
                        ? ` · ${
                            p.memberIds
                              .map(
                                (id) =>
                                  members.find((m) => m.id === id)?.firstName ||
                                  "?",
                              )
                              .join(", ")
                          }`
                        : " · (personne non détectée)"}
                    </p>
                    <p className="mt-0.5 text-[10px] italic text-muted/80">
                      « {p.raw} »
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}

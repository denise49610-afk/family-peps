import {
  Camera,
  ClipboardPaste,
  ImagePlus,
  Plus,
  Sparkles,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { WeekGrid, slotsToBlocks } from "@/components/week-grid";
import { formatTimeRange, weekdayLabel } from "@/lib/family/dates";
import { parseScheduleWithAi } from "@/lib/family/ai-parse";
import { fileToStoredDataUrl, imageDataUrlForAi, sniffIsImage } from "@/lib/family/files";
import {
  applyDaysToSlots,
  clipboardToScheduleText,
  extractPdfStrings,
  looksLikeTimetable,
  parseClipboardDraft,
  parseScheduleText,
  slotsNeedDay,
  toScheduleSlots,
  type LooseSlot,
} from "@/lib/family/parse-schedule";
import { useFamilyStore } from "@/lib/family/store";
import type { ScheduleSlot } from "@/lib/family/types";
import { cn, uid } from "@/lib/utils";

const SCHOOL_DAYS = [1, 2, 3, 4, 5, 6];

function defaultSchoolDay(): number {
  const d = new Date().getDay();
  return d >= 1 && d <= 5 ? d : 1;
}

function mapAiSlots(slots: Array<Omit<ScheduleSlot, "id"> & { id?: string }>): LooseSlot[] {
  return slots.map((s) => ({
    dayOfWeek: s.dayOfWeek,
    startTime: s.startTime,
    endTime: s.endTime,
    subject: s.subject,
    room: s.room ?? "",
    teacher: s.teacher ?? "",
  }));
}

function CourseList({ slots }: { slots: LooseSlot[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {slots.map((s, i) => (
        <li
          key={`${s.startTime}-${s.subject}-${i}`}
          className="rounded-[1.15rem] bg-surface-2 px-3.5 py-2.5"
        >
          <p className="text-xs font-extrabold tabular-nums text-primary">
            {formatTimeRange(s.startTime, s.endTime)}
            {s.dayOfWeek >= 0 ? ` · ${weekdayLabel(s.dayOfWeek, true)}` : ""}
          </p>
          <p className="font-display text-[15px] font-extrabold leading-tight">{s.subject}</p>
          {s.teacher || s.room ? (
            <p className="mt-0.5 text-xs font-semibold text-muted">
              {[s.teacher, s.room].filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function DayChips({
  selected,
  onToggle,
}: {
  selected: number[];
  onToggle: (day: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {SCHOOL_DAYS.map((d) => {
        const on = selected.includes(d);
        return (
          <button
            key={d}
            type="button"
            onClick={() => onToggle(d)}
            className={cn(
              "h-11 min-w-11 rounded-2xl px-3 text-sm font-extrabold transition-colors",
              on ? "bg-primary text-primary-fg shadow-card" : "bg-surface-2 text-ink",
            )}
          >
            {weekdayLabel(d, true)}
          </button>
        );
      })}
    </div>
  );
}

export function ImportScheduleForm({
  memberId,
  onClose,
}: {
  memberId?: string;
  onClose: () => void;
}) {
  const members = useFamilyStore((s) => s.members);
  const schedules = useFamilyStore((s) => s.schedules);
  const upsertScheduleForMember = useFamilyStore((s) => s.upsertScheduleForMember);
  const [owner, setOwner] = useState(
    memberId ?? members.find((m) => m.role === "enfant")?.id ?? members[0]?.id ?? "",
  );
  const [text, setText] = useState("");
  const [slots, setSlots] = useState<ScheduleSlot[] | null>(null);
  const [pending, setPending] = useState<LooseSlot[] | null>(null);
  const [pendingMerge, setPendingMerge] = useState(false);
  const [pickedDays, setPickedDays] = useState<number[]>([defaultSchoolDay()]);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");
  const [source, setSource] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [name, setName] = useState("Emploi du temps");
  const [editingId, setEditingId] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const slotsRef = useRef(slots);
  slotsRef.current = slots;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const ownerMember = members.find((m) => m.id === owner);
  const existing = schedules.find((s) => s.memberId === owner);
  const liveDraft = useMemo(
    () => (text.trim().length > 8 ? parseScheduleText(text) : { slots: [] as LooseSlot[], needsDay: false }),
    [text],
  );

  function applySlots(next: ScheduleSlot[], src: string, raw?: string, merge = false) {
    setPending(null);
    setSlots((prev) => {
      if (merge && prev?.length) {
        const seen = new Set(
          prev.map((s) => `${s.dayOfWeek}|${s.startTime}|${s.subject.toLowerCase()}`),
        );
        const extra = next.filter(
          (s) => !seen.has(`${s.dayOfWeek}|${s.startTime}|${s.subject.toLowerCase()}`),
        );
        return [...prev, ...extra];
      }
      return next;
    });
    setSource(src);
    if (raw && raw.trim() && raw.trim() !== text.trim()) setText(raw);
  }

  function ingestLoose(next: LooseSlot[], src: string, raw?: string, merge = false) {
    if (!next.length) return false;
    if (slotsNeedDay(next)) {
      setPending(next);
      setPendingMerge(merge);
      setSource(src);
      if (raw && raw.trim()) setText(raw);
      toast.success(
        `${next.length} cours lu${next.length > 1 ? "s" : ""} — choisissez le jour`,
      );
      return true;
    }
    applySlots(toScheduleSlots(next), src, raw, merge);
    toast.success(
      `${next.length} cours bien placé${next.length > 1 ? "s" : ""} — vérifiez la grille`,
    );
    return true;
  }

  function confirmPendingDays() {
    if (!pending?.length || !pickedDays.length) {
      toast.error("Choisissez au moins un jour");
      return;
    }
    const dated = applyDaysToSlots(pending, pickedDays);
    applySlots(dated, source || "Texte collé", undefined, pendingMerge);
    setPending(null);
  }

  function toggleDay(day: number) {
    setPickedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b),
    );
  }

  async function runAnalysis(opts: {
    text?: string;
    html?: string;
    imageDataUrl?: string;
    label?: string;
    merge?: boolean;
  }) {
    setBusy(true);
    setBusyLabel(opts.imageDataUrl ? "Lecture de la photo…" : "Lecture du planning…");
    if (!opts.merge && !opts.imageDataUrl) setSlots(null);
    try {
      const draft = parseClipboardDraft(opts.html, opts.text || text || "");
      if (draft.slots.length && !opts.imageDataUrl) {
        ingestLoose(draft.slots, opts.label || "Copier-coller", opts.text, opts.merge);
        if (draft.slots.length >= 3) return;
      }

      const imageDataUrl = opts.imageDataUrl
        ? await imageDataUrlForAi(opts.imageDataUrl)
        : undefined;
      const ai = await parseScheduleWithAi({
        text: opts.text,
        imageDataUrl,
      });
      if (ai.ok && ai.slots.length) {
        ingestLoose(mapAiSlots(ai.slots), opts.label || ai.source, ai.rawText, opts.merge);
        return;
      }
      if (draft.slots.length) {
        ingestLoose(draft.slots, opts.label || "Copier-coller", undefined, opts.merge);
        return;
      }
      if (opts.imageDataUrl) {
        setSlots((prev) => prev ?? []);
        toast.message(
          "Photo ouverte — ajoutez les cours à la main, ou recadrez plus près du tableau.",
        );
        return;
      }
      toast.error(
        "Rien détecté. Collez le tableau (Horaire / Cours / Prof), ou une photo nette.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Analyse impossible");
    } finally {
      setBusy(false);
      setBusyLabel("");
    }
  }

  async function analyzeFile(file: File, merge = false) {
    setBusy(true);
    setBusyLabel("Ouverture du fichier…");
    try {
      let extracted = "";
      let imageDataUrl: string | undefined;
      const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      const isTxt = file.type.startsWith("text/") || /\.txt$/i.test(file.name);
      if (await sniffIsImage(file)) {
        imageDataUrl = await fileToStoredDataUrl(file);
        setPreview(imageDataUrl);
        toast.message("Lecture de la photo…");
      } else if (isPdf) {
        extracted = extractPdfStrings(await file.arrayBuffer());
        if (extracted) setText(extracted);
        if (!extracted.trim()) {
          toast.error("PDF sans texte (scan). Prenez une photo de la page, c'est plus fiable.");
          return;
        }
      } else if (isTxt) {
        extracted = await file.text();
        if (extracted) setText(extracted);
      } else {
        try {
          imageDataUrl = await fileToStoredDataUrl(file);
          setPreview(imageDataUrl);
        } catch {
          extracted = await file.text();
          if (extracted) setText(extracted);
        }
      }
      await runAnalysis({
        text: extracted || text || undefined,
        imageDataUrl,
        label: imageDataUrl ? "Photo" : "Fichier",
        merge,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fichier illisible");
    } finally {
      setBusy(false);
      setBusyLabel("");
    }
  }

  async function ingestClipboard(e: ClipboardEvent, merge = false) {
    const data = e.clipboardData;
    if (!data) return false;
    const items = data.items;
    if (items) {
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            void analyzeFile(file, merge || Boolean(slotsRef.current?.length));
            return true;
          }
        }
      }
    }
    const html = data.getData("text/html");
    const pasted = data.getData("text") || data.getData("text/plain");
    if (html && /<table/i.test(html)) {
      e.preventDefault();
      const asText = clipboardToScheduleText(html, pasted);
      setText(asText);
      void runAnalysis({
        html,
        text: asText,
        label: "Tableau collé",
        merge: merge || Boolean(slotsRef.current?.length),
      });
      return true;
    }
    if (pasted && looksLikeTimetable(pasted)) {
      setText(pasted);
      void runAnalysis({
        text: pasted,
        label: "Texte collé",
        merge: merge || Boolean(slotsRef.current?.length),
      });
      return true;
    }
    if (pasted.trim().length > 0 && (e.target as HTMLElement | null)?.tagName !== "TEXTAREA") {
      setText((t) => (t ? `${t}\n${pasted}` : pasted));
    }
    return false;
  }

  async function pasteFromClipboard() {
    setBusy(true);
    setBusyLabel("Lecture du presse-papiers…");
    try {
      if (navigator.clipboard && "read" in navigator.clipboard) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imageType = item.types.find((t) => t.startsWith("image/"));
          if (imageType) {
            const blob = await item.getType(imageType);
            const file = new File([blob], "capture.png", { type: blob.type || "image/png" });
            await analyzeFile(file, Boolean(slotsRef.current?.length));
            return;
          }
          if (item.types.includes("text/html")) {
            const blob = await item.getType("text/html");
            const html = await blob.text();
            if (/<table/i.test(html)) {
              const asText = clipboardToScheduleText(html, "");
              setText(asText);
              await runAnalysis({ html, text: asText, label: "Tableau collé" });
              return;
            }
          }
        }
      }
      const textClip = await navigator.clipboard.readText();
      if (textClip.trim()) {
        setText(textClip);
        await runAnalysis({ text: textClip, label: "Texte collé" });
        return;
      }
      toast.message("Rien dans le presse-papiers. Utilisez Ctrl+V (ou Cmd+V).");
    } catch {
      textareaRef.current?.focus();
      toast.message("Collez avec Ctrl+V (ou Cmd+V) dans la zone de texte.");
    } finally {
      setBusy(false);
      setBusyLabel("");
    }
  }

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField = Boolean(target?.closest("textarea, input"));
      const hasImage = [...(e.clipboardData?.items ?? [])].some((i) =>
        i.type.startsWith("image/"),
      );
      const html = e.clipboardData?.getData("text/html") ?? "";
      const hasTable = /<table/i.test(html);
      if (inField && !hasImage && !hasTable) {
        const pasted = e.clipboardData?.getData("text") ?? "";
        if (looksLikeTimetable(pasted)) {
          window.setTimeout(() => {
            void runAnalysis({ text: pasted, label: "Texte collé" });
          }, 40);
        }
        return;
      }
      void ingestClipboard(e);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function confirm() {
    const finalSlots = slots?.length ? slots : toScheduleSlots(liveDraft.slots);
    if (!finalSlots.length) {
      toast.error("Aucun créneau à importer");
      return;
    }
    if (!owner) {
      toast.error("Choisissez un élève");
      return;
    }
    const member = members.find((m) => m.id === owner);
    upsertScheduleForMember({
      memberId: owner,
      name: (name.trim() || `Planning — ${member?.firstName ?? ""}`).trim(),
      slots: finalSlots,
      photo: preview,
    });
    toast.success(`Planning de ${member?.firstName ?? "la famille"} mis à jour`);
    onClose();
  }

  function addManualSlot() {
    const next: ScheduleSlot = {
      id: uid("slot"),
      dayOfWeek: pickedDays[0] ?? defaultSchoolDay(),
      startTime: "08:00",
      endTime: "09:00",
      subject: "Cours",
      room: "",
      teacher: "",
    };
    setSlots((prev) => [...(prev ?? []), next]);
    setEditingId(next.id);
    setPending(null);
    setSource(source || "Manuel");
  }

  function patchSlot(id: string, patch: Partial<ScheduleSlot>) {
    setSlots((prev) => (prev ?? []).map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function removeSlot(id: string) {
    setSlots((prev) => (prev ? prev.filter((x) => x.id !== id) : prev));
    if (editingId === id) setEditingId(null);
  }

  function duplicateSlot(id: string) {
    const src = (slots ?? []).find((s) => s.id === id);
    if (!src) return;
    const copy: ScheduleSlot = {
      ...src,
      id: uid("slot"),
      dayOfWeek: src.dayOfWeek === 5 ? 1 : src.dayOfWeek + 1,
    };
    setSlots((prev) => [...(prev ?? []), copy]);
    setEditingId(copy.id);
    toast.success("Cours dupliqué — changez le jour si besoin");
  }

  function copyToMember(targetId: string) {
    const finalSlots = slots?.length ? slots : toScheduleSlots(liveDraft.slots);
    if (!finalSlots.length || !targetId) return;
    const member = members.find((m) => m.id === targetId);
    upsertScheduleForMember({
      memberId: targetId,
      name: name.trim() || `Planning — ${member?.firstName ?? ""}`,
      slots: finalSlots.map((s) => ({ ...s, id: uid("slot") })),
      photo: preview,
    });
    toast.success(`Copié vers ${member?.firstName ?? "un autre membre"}`);
  }

  const editing = slots?.find((s) => s.id === editingId);
  const shownPending = pending;

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Importer un planning"
      description="Collez le tableau, ou prenez une photo — même un jour sans lundi/mardi."
      wide
      footer={
        slots !== null ? (
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setSlots(null);
                setEditingId(null);
                setPending(null);
              }}
            >
              Revenir
            </Button>
            <Button variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button onClick={confirm} disabled={!slots.length}>
              Confirmer
            </Button>
          </>
        ) : shownPending?.length ? (
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setPending(null);
              }}
            >
              Modifier
            </Button>
            <Button onClick={confirmPendingDays} disabled={!pickedDays.length || busy}>
              Ajouter {shownPending.length} cours
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button
              onClick={() => void runAnalysis({ text, label: "Texte collé" })}
              disabled={busy || !text.trim()}
            >
              <Sparkles className="size-4" />
              Analyser
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-4">
        {members.length === 0 ? (
          <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">
            Ajoutez d'abord un membre de la famille.
          </p>
        ) : (
          <Field label="Pour qui">
            <Select value={owner} onChange={(e) => setOwner(e.target.value)}>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.firstName}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {slots !== null ? (
          <div className="flex flex-col gap-3">
            <Field label="Nom du planning">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            {existing ? (
              <p className="rounded-xl bg-member-jaune-soft px-3 py-2 text-xs font-bold text-member-jaune-fg">
                Le planning actuel de {ownerMember?.firstName} sera remplacé.
              </p>
            ) : null}
            <p className="rounded-xl bg-accent/10 px-3 py-2 text-sm font-semibold text-accent-fg">
              {slots.length} cours {source ? `(${source})` : ""} — touchez une case pour corriger
              le jour ou l'heure.
            </p>
            {preview ? (
              <details className="rounded-2xl bg-surface-2 p-2">
                <summary className="cursor-pointer px-2 py-1 text-sm font-extrabold">
                  Photo d'origine
                </summary>
                <img
                  src={preview}
                  alt="Photo importée"
                  className="mt-2 max-h-56 w-full rounded-xl object-contain"
                />
              </details>
            ) : null}
            <WeekGrid
              blocks={slotsToBlocks(slots, ownerMember?.color)}
              onBlockClick={(b) => setEditingId(b.id)}
              emptyHint="Aucun cours — ajoutez-les à la main ou importez une autre photo."
            />
            {editing ? (
              <div className="rounded-2xl bg-surface-2 p-3">
                <p className="mb-2 text-sm font-extrabold">Corriger ce cours</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Select
                    value={String(editing.dayOfWeek)}
                    onChange={(e) => patchSlot(editing.id, { dayOfWeek: Number(e.target.value) })}
                  >
                    {SCHOOL_DAYS.map((d) => (
                      <option key={d} value={d}>
                        {weekdayLabel(d)}
                      </option>
                    ))}
                  </Select>
                  <Input
                    value={editing.subject}
                    onChange={(e) => patchSlot(editing.id, { subject: e.target.value })}
                  />
                  <Input
                    type="time"
                    value={editing.startTime}
                    onChange={(e) => patchSlot(editing.id, { startTime: e.target.value })}
                  />
                  <Input
                    type="time"
                    value={editing.endTime}
                    onChange={(e) => patchSlot(editing.id, { endTime: e.target.value })}
                  />
                  <Input
                    placeholder="Salle"
                    value={editing.room}
                    onChange={(e) => patchSlot(editing.id, { room: e.target.value })}
                  />
                  <Input
                    placeholder="Professeur"
                    value={editing.teacher}
                    onChange={(e) => patchSlot(editing.id, { teacher: e.target.value })}
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                    OK
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => duplicateSlot(editing.id)}>
                    Dupliquer
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => removeSlot(editing.id)}>
                    Retirer
                  </Button>
                </div>
              </div>
            ) : null}
            {members.length > 1 ? (
              <Field label="Copier aussi vers">
                <Select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) copyToMember(e.target.value);
                    e.target.value = "";
                  }}
                >
                  <option value="">Choisir un membre…</option>
                  {members
                    .filter((m) => m.id !== owner)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.firstName}
                      </option>
                    ))}
                </Select>
              </Field>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
                <ImagePlus className="size-4" />
                Autre photo
              </Button>
              <Button variant="soft" onClick={addManualSlot}>
                <Plus className="size-4" />
                Ajouter un cours
              </Button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,image/jpeg,image/png,image/webp,image/heic,application/pdf,.pdf,.txt,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void analyzeFile(f, true);
                e.target.value = "";
              }}
            />
          </div>
        ) : shownPending?.length ? (
          <div className="flex flex-col gap-3">
            <div className="rounded-[1.3rem] bg-accent/10 px-3.5 py-3">
              <p className="font-display text-base font-extrabold text-accent-fg">
                {shownPending.length} cours reconnus
              </p>
              <p className="mt-0.5 text-xs font-semibold text-accent-fg/80">
                Ce tableau n'indique pas le jour. Choisissez-le — plusieurs jours si c'est le
                même emploi.
              </p>
            </div>
            {preview ? (
              <img
                src={preview}
                alt="Planning collé"
                className="max-h-36 w-full rounded-2xl bg-surface-2 object-contain"
              />
            ) : null}
            <CourseList slots={shownPending} />
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-extrabold text-ink">C'est pour quel jour ?</p>
              <DayChips selected={pickedDays} onToggle={toggleDay} />
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void analyzeFile(f);
                  e.target.value = "";
                }}
              />
              <input
                ref={fileRef}
                type="file"
                accept="image/*,image/jpeg,image/png,image/webp,image/heic,application/pdf,.pdf,.txt,text/plain"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void analyzeFile(f);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                disabled={busy}
                className="flex min-h-[5.5rem] flex-col items-center justify-center gap-1.5 rounded-[1.35rem] bg-primary/10 px-3 py-3 text-primary tap"
              >
                <Camera className="size-6" />
                <span className="font-display text-sm font-extrabold">Photo</span>
                <span className="text-[11px] font-semibold text-primary/80">Appareil ou capture</span>
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="flex min-h-[5.5rem] flex-col items-center justify-center gap-1.5 rounded-[1.35rem] bg-surface-2 px-3 py-3 text-ink tap"
              >
                <ImagePlus className="size-6 text-primary" />
                <span className="font-display text-sm font-extrabold">Galerie</span>
                <span className="text-[11px] font-semibold text-muted">Image ou PDF</span>
              </button>
            </div>

            <div
              onDragEnter={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const f = e.dataTransfer.files?.[0];
                if (f) void analyzeFile(f);
              }}
              className={
                dragging
                  ? "rounded-[1.4rem] bg-primary/10 px-4 py-4 shadow-[inset_0_0_0_2px_var(--color-primary)]"
                  : "rounded-[1.4rem] bg-surface-2 px-4 py-4"
              }
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="font-display text-sm font-extrabold">Coller le tableau</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void pasteFromClipboard()}
                  disabled={busy}
                >
                  <ClipboardPaste className="size-4" />
                  Presse-papiers
                </Button>
              </div>
              <Textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="min-h-36 bg-surface font-mono text-[13px]"
                placeholder={`Collez ici (Ctrl+V / Cmd+V), par exemple :\n\nHoraire | Cours | Professeur / salle\n9h00 – 12h05 | Pratique pro | Gillet R. — Atelier`}
              />
              <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-muted">
                <Upload className="size-3.5" />
                Pronote, Excel, Word, markdown, ou une photo collée.
              </p>
            </div>

            {preview ? (
              <img
                src={preview}
                alt="Planning à importer"
                className="max-h-44 w-full rounded-2xl bg-surface-2 object-contain"
              />
            ) : null}

            {liveDraft.slots.length > 0 && !busy && !pending ? (
              <p className="text-sm font-semibold text-accent">
                {liveDraft.slots.length} cours déjà reconnu
                {liveDraft.slots.length > 1 ? "s" : ""}
                {liveDraft.needsDay ? " — le jour sera demandé ensuite" : " — appuyez sur Analyser"}.
              </p>
            ) : null}

            <Button variant="soft" onClick={addManualSlot} disabled={busy}>
              <Plus className="size-4" />
              Saisir un cours à la main
            </Button>
          </>
        )}
        {busy ? (
          <p className="text-sm font-semibold text-accent">{busyLabel || "Analyse en cours…"}</p>
        ) : null}
      </div>
    </Modal>
  );
}

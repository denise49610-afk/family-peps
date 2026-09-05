import { createFileRoute } from "@tanstack/react-router";
import {
  Briefcase,
  Car,
  Download,
  FileText,
  GraduationCap,
  HeartPulse,
  House,
  IdCard,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { memberTone } from "@/components/brand";
import { useEditors } from "@/components/editors-context";
import { downloadDataUrl } from "@/lib/family/files";
import { CAT } from "@/lib/family/ids";
import { useFamilyStore } from "@/lib/family/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/documents")({ component: DocumentsPage });

const GROUPS = [
  { id: "identite", label: "Identité", icon: IdCard, cats: [CAT.administratif] },
  { id: "sante", label: "Santé", icon: HeartPulse, cats: [CAT.sante] },
  { id: "vehicule", label: "Véhicule", icon: Car, cats: [CAT.vehicule] },
  { id: "maison", label: "Maison", icon: House, cats: [CAT.maison] },
  { id: "travail", label: "Travail", icon: Briefcase, cats: [CAT.travail] },
  { id: "ecole", label: "École", icon: GraduationCap, cats: [CAT.ecole] },
  {
    id: "autres",
    label: "Autres",
    icon: FileText,
    cats: [CAT.famille, CAT.rdv, CAT.important, CAT.sport],
  },
] as const;

function DocumentsPage() {
  const documents = useFamilyStore((s) => s.documents);
  const categories = useFamilyStore((s) => s.categories);
  const members = useFamilyStore((s) => s.members);
  const removeDocument = useFamilyStore((s) => s.removeDocument);
  const updateDocument = useFamilyStore((s) => s.updateDocument);
  const { open } = useEditors();
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<string>("all");

  const groupedCats = useMemo(() => {
    const g = GROUPS.find((x) => x.id === group);
    return g ? new Set<string>(g.cats) : null;
  }, [group]);

  const list = documents.filter((d) => {
    if (groupedCats && !groupedCats.has(d.categoryId)) return false;
    if (q.trim() && !d.name.toLowerCase().includes(q.trim().toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <header className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[1.65rem] font-extrabold">Documents</h1>
          <p className="text-sm font-semibold text-muted">Toujours à portée de main</p>
        </div>
        <button
          type="button"
          onClick={() => open({ type: "document" })}
          className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-fg card-shadow"
          aria-label="Ajouter un document"
        >
          <Plus className="size-5" />
        </button>
      </header>

      <label className="mb-4 flex min-h-12 items-center gap-2 rounded-full bg-surface px-4 card-shadow">
        <Search className="size-4 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un document"
          className="h-12 flex-1 bg-transparent text-sm font-semibold outline-none"
        />
      </label>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        <Chip label="Tous" active={group === "all"} onClick={() => setGroup("all")} />
        {GROUPS.map((g) => (
          <Chip
            key={g.id}
            label={g.label}
            active={group === g.id}
            onClick={() => setGroup(g.id)}
          />
        ))}
      </div>

      {list.length === 0 ? (
        <div className="rounded-[1.6rem] bg-surface px-6 py-12 text-center card-shadow">
          <p className="font-display text-lg font-extrabold">Aucun document</p>
          <p className="mt-1 text-sm text-muted">Carte mutuelle, CV, pièce d'identité…</p>
          <button
            type="button"
            onClick={() => open({ type: "document" })}
            className="mt-4 h-11 rounded-full bg-primary px-5 text-sm font-extrabold text-primary-fg"
          >
            Ajouter un document
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((d) => {
            const cat = categories.find((c) => c.id === d.categoryId);
            const member = members.find((m) => m.id === d.memberId);
            const isImage = d.mimeType.startsWith("image/");
            const groupMeta =
              GROUPS.find((g) => (g.cats as readonly string[]).includes(d.categoryId)) ?? GROUPS[6];
            const Icon = groupMeta.icon;
            return (
              <article key={d.id} className="rounded-[1.5rem] bg-surface p-4 card-shadow">
                {isImage ? (
                  <img
                    src={d.dataUrl}
                    alt=""
                    className="mb-3 h-28 w-full rounded-2xl object-cover"
                  />
                ) : (
                  <div
                    className="mb-3 flex h-16 items-center justify-center rounded-2xl"
                    style={{
                      backgroundColor: memberTone(cat?.color ?? "violet", "soft"),
                      color: memberTone(cat?.color ?? "violet"),
                    }}
                  >
                    <Icon className="size-7" />
                  </div>
                )}
                <input
                  value={d.name}
                  onChange={(e) => updateDocument(d.id, { name: e.target.value })}
                  className="w-full bg-transparent font-extrabold outline-none"
                />
                <p className="text-xs font-semibold text-muted">
                  {groupMeta.label}
                  {member ? ` · ${member.firstName}` : ""}
                  {" · "}
                  {d.createdAt.slice(8, 10)}/{d.createdAt.slice(5, 7)}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => downloadDataUrl(d.dataUrl, d.name)}
                    className="inline-flex h-10 items-center gap-1 rounded-full bg-surface-2 px-3 text-xs font-extrabold"
                  >
                    <Download className="size-4" />
                    Télécharger
                  </button>
                  <button
                    type="button"
                    aria-label="Supprimer"
                    onClick={() => {
                      removeDocument(d.id);
                      toast.success("Document supprimé");
                    }}
                    className="flex size-10 items-center justify-center rounded-full text-muted"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-3.5 py-2 text-sm font-extrabold",
        active ? "bg-ink text-surface" : "bg-surface text-ink card-shadow",
      )}
    >
      {label}
    </button>
  );
}

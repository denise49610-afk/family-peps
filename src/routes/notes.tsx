import { createFileRoute } from "@tanstack/react-router";
import {
  Bell,
  CalendarDays,
  CheckSquare,
  FileText,
  ImagePlus,
  Paperclip,
  Send,
  Smile,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { MemberAvatar } from "@/components/member-avatar";
import { useEditors } from "@/components/editors-context";
import { fileToStoredDataUrl } from "@/lib/family/files";
import { CAT } from "@/lib/family/ids";
import { useFamilyStore } from "@/lib/family/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/notes")({ component: ChatPage });

const DAY_MS = 24 * 60 * 60 * 1000;
const REACTIONS = ["👍", "❤️", "👏", "😊"] as const;

function isFresh(createdAt: string, now = Date.now()) {
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return false;
  return now - t < DAY_MS;
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function ChatPage() {
  const notes = useFamilyStore((s) => s.notes);
  const members = useFamilyStore((s) => s.members);
  const settings = useFamilyStore((s) => s.settings);
  const addNote = useFamilyStore((s) => s.addNote);
  const removeNote = useFamilyStore((s) => s.removeNote);
  const toggleNoteReaction = useFamilyStore((s) => s.toggleNoteReaction);
  const addDocument = useFamilyStore((s) => s.addDocument);
  const { open } = useEditors();
  const [text, setText] = useState("");
  const [attach, setAttach] = useState(false);
  const [reactFor, setReactFor] = useState<string | null>(null);
  const [notifOk, setNotifOk] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const knownIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    setNotifOk(typeof Notification !== "undefined" && Notification.permission === "granted");
  }, []);

  const meId = settings.currentMemberId || members[0]?.id || "";
  const me = members.find((m) => m.id === meId);

  const messages = useMemo(() => {
    const now = Date.now();
    return [...notes]
      .filter((n) => n.visibility !== "personal" && isFresh(n.createdAt, now))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [notes]);

  useEffect(() => {
    return () => {
      const { notes: all, removeNote: drop } = useFamilyStore.getState();
      for (const n of all) {
        if (n.visibility !== "personal") drop(n.id);
      }
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    if (knownIds.current === null) {
      knownIds.current = new Set(messages.map((m) => m.id));
      return;
    }
    for (const msg of messages) {
      if (knownIds.current.has(msg.id)) continue;
      knownIds.current.add(msg.id);
      if (msg.memberId && msg.memberId !== meId) {
        const who = members.find((m) => m.id === msg.memberId);
        const label = `${who?.firstName ?? "Quelqu'un"} : ${msg.content.slice(0, 100)}`;
        toast.message(label, { duration: 4000 });
        notifyChat(label);
      }
    }
    knownIds.current = new Set(messages.map((m) => m.id));
  }, [messages, meId, members]);

  function send(content = text) {
    const body = content.trim();
    if (!body) return;
    if (!meId) {
      toast.error("Choisis qui tu es dans Réglages → Je suis");
      return;
    }
    addNote({
      content: body,
      visibility: "family",
      memberId: meId,
      date: null,
      pinned: false,
    });
    setText("");
    setAttach(false);
  }

  async function enableNotifs() {
    if (typeof Notification === "undefined") {
      toast.error("Notifications non disponibles sur ce navigateur");
      return;
    }
    const p = await Notification.requestPermission();
    setNotifOk(p === "granted");
    if (p === "granted") {
      toast.success("Notifications activées pour le chat");
      try {
        new Notification("Fami'Zen · Chat", {
          body: "Tu recevras une alerte quand quelqu’un écrit.",
          icon: "/favicon.svg",
        });
      } catch {
        /* ignore */
      }
    }
  }

  async function onPickFile(file?: File) {
    if (!file) return;
    try {
      const dataUrl = await fileToStoredDataUrl(file);
      addDocument({
        name: file.name,
        categoryId: CAT.famille,
        memberId: meId || null,
        mimeType: file.type || "application/octet-stream",
        dataUrl,
      });
      send(`📎 ${file.name}`);
      toast.success("Fichier ajouté aux documents");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fichier trop lourd");
    }
  }

  return (
    <div className="flex min-h-[70dvh] flex-col">
      <header className="mb-3">
        <h1 className="font-display text-[1.65rem] font-extrabold">Chat Famille</h1>
        <p className="text-sm font-semibold text-muted">
          Les messages s'effacent tout seuls quand vous quittez le chat.
        </p>
      </header>

      {!notifOk ? (
        <button
          type="button"
          onClick={() => void enableNotifs()}
          className="mb-3 flex items-center gap-2 rounded-2xl bg-member-orange-soft px-4 py-3 text-left text-sm font-bold text-member-orange-fg"
        >
          <Bell className="size-5 shrink-0" />
          Activer les notifications
        </button>
      ) : null}

      <div className="flex min-h-[52dvh] flex-1 flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto py-2">
          {messages.length === 0 ? (
            <p className="rounded-[1.6rem] bg-surface px-5 py-10 text-center text-sm font-semibold text-muted card-shadow">
              Dis bonjour à la famille.
            </p>
          ) : (
            messages.map((n) => {
              const who = members.find((m) => m.id === n.memberId);
              const mine = n.memberId === meId;
              return (
                <div key={n.id} className={cn("flex gap-2", mine ? "flex-row-reverse" : "flex-row")}>
                  {who ? <MemberAvatar member={who} size="sm" /> : <span className="size-9" />}
                  <div className={cn("max-w-[78%]", mine && "text-right")}>
                    {!mine && who ? (
                      <p className="mb-1 px-1 text-xs font-extrabold">{who.firstName}</p>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setReactFor(reactFor === n.id ? null : n.id)}
                      className={cn(
                        "rounded-[1.2rem] px-3.5 py-2.5 text-left text-sm font-semibold leading-relaxed card-shadow",
                        mine ? "rounded-tr-md bg-surface" : "rounded-tl-md bg-surface",
                      )}
                    >
                      <p className="whitespace-pre-wrap">{n.content}</p>
                    </button>
                    <p className="mt-1 px-1 text-[11px] font-bold text-muted">
                      {formatTime(n.createdAt)}
                    </p>
                    {(n.reactions ?? []).length > 0 ? (
                      <div className={cn("mt-1 flex flex-wrap gap-1", mine && "justify-end")}>
                        {(n.reactions ?? []).map((r) => (
                          <button
                            key={r.emoji}
                            type="button"
                            onClick={() => meId && toggleNoteReaction(n.id, r.emoji, meId)}
                            className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-xs font-bold card-shadow"
                          >
                            {r.emoji} {r.memberIds.length}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {reactFor === n.id && meId ? (
                      <div className={cn("mt-1 flex gap-1", mine && "justify-end")}>
                        {REACTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => {
                              toggleNoteReaction(n.id, emoji, meId);
                              setReactFor(null);
                            }}
                            className="flex size-9 items-center justify-center rounded-full bg-surface text-base card-shadow"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {attach ? (
          <div className="mb-2 grid grid-cols-4 gap-2">
            <AttachBtn
              icon={ImagePlus}
              label="Photo"
              onClick={() => fileRef.current?.click()}
            />
            <AttachBtn
              icon={FileText}
              label="Document"
              onClick={() => {
                setAttach(false);
                open({ type: "document" });
              }}
            />
            <AttachBtn
              icon={CalendarDays}
              label="Événement"
              onClick={() => {
                setAttach(false);
                open({ type: "event" });
              }}
            />
            <AttachBtn
              icon={CheckSquare}
              label="Tâche"
              onClick={() => {
                setAttach(false);
                open({ type: "task" });
              }}
            />
          </div>
        ) : null}

        <form
          className="flex items-center gap-2 rounded-full bg-surface p-1.5 card-shadow"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <button
            type="button"
            aria-label={attach ? "Fermer" : "Joindre"}
            onClick={() => setAttach((v) => !v)}
            className="flex size-11 items-center justify-center rounded-full text-muted"
          >
            {attach ? <X className="size-5" /> : <Paperclip className="size-5" />}
          </button>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Écrire un message…"
            className="min-h-11 flex-1 bg-transparent text-base outline-none"
            maxLength={500}
          />
          <span className="hidden sm:flex size-11 items-center justify-center text-muted">
            <Smile className="size-5" />
          </span>
          <button
            type="submit"
            aria-label="Envoyer"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-fg"
          >
            <Send className="size-5" />
          </button>
        </form>
        {me ? (
          <p className="mt-2 text-center text-[11px] font-bold text-muted">
            Tu écris en tant que {me.firstName}
          </p>
        ) : (
          <p className="mt-2 text-center text-[11px] font-bold text-warn">
            Choisis ton profil dans Réglages
          </p>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.pdf,.doc,.docx,.txt"
          className="sr-only"
          onChange={(e) => void onPickFile(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}

function AttachBtn({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof FileText;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1 rounded-2xl bg-surface py-3 text-[11px] font-extrabold card-shadow"
    >
      <Icon className="size-5 text-primary" />
      {label}
    </button>
  );
}

function notifyChat(body: string) {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification("Fami'Zen · Chat", {
      body,
      icon: "/favicon.svg",
      tag: "family-peps-chat",
    });
  } catch {
    /* ignore */
  }
}

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type EditorTarget =
  | { type: "event"; id?: string; date?: string; memberId?: string }
  | { type: "task"; id?: string }
  | { type: "member"; id?: string }
  | { type: "activity"; id?: string }
  | { type: "schedule"; id?: string; memberId?: string }
  | { type: "import-schedule"; memberId?: string }
  | { type: "document"; id?: string }
  | { type: "note"; id?: string }
  | { type: "info"; id?: string }
  | { type: "contact"; id?: string; memberId?: string }
  | { type: "quick" }
  | null;

type Ctx = {
  target: EditorTarget;
  open: (t: EditorTarget) => void;
  close: () => void;
};

const EditorsContext = createContext<Ctx | null>(null);

export function EditorsProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<EditorTarget>(null);
  const close = useCallback(() => setTarget(null), []);
  const value = useMemo(
    () => ({
      target,
      open: setTarget,
      close,
    }),
    [target, close],
  );
  return <EditorsContext.Provider value={value}>{children}</EditorsContext.Provider>;
}

export function useEditors() {
  const ctx = useContext(EditorsContext);
  if (!ctx) throw new Error("useEditors must be used within EditorsProvider");
  return ctx;
}

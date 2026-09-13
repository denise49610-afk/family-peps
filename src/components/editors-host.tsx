import { ImportScheduleForm } from "@/components/import-schedule-form";
import { BrainDumpForm } from "@/components/brain-dump-form";
import { useEditors } from "@/components/editors-context";
import { EditorsHost as FormsEditorsHost } from "@/components/forms";

/**
 * Wrapper: gère brain-dump, délègue le reste au host dans forms.tsx
 */
export function EditorsHost() {
  const { target, close } = useEditors();
  if (!target) return null;
  if (target.type === "brain-dump") {
    return <BrainDumpForm onClose={close} />;
  }
  return <FormsEditorsHost />;
}

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/taches")({
  component: Page,
});

function Page() {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-extrabold tracking-tight">Taches</h1>
      <p className="font-semibold" style={{ color: "#8a8494" }}>Liste des taches familiales</p>
    </div>
  );
}

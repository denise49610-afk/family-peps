import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/calendrier")({
  component: Page,
});

function Page() {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-extrabold tracking-tight">Planning</h1>
      <p className="font-semibold" style={{ color: "#8a8494" }}>Calendrier familial</p>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/famille")({
  component: Page,
});

function Page() {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-extrabold tracking-tight">Famille</h1>
      <p className="font-semibold" style={{ color: "#8a8494" }}>Membres de la famille</p>
    </div>
  );
}

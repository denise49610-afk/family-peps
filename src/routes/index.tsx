import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Page,
});

function Page() {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-extrabold tracking-tight">Accueil</h1>
      <p className="font-semibold" style={{ color: "#8a8494" }}>Bienvenue sur Fami'Zen</p>
    </div>
  );
}

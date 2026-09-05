import { createFileRoute } from "@tanstack/react-router";
import { PlanningTimeline } from "@/components/planning-timeline";

export const Route = createFileRoute("/calendrier")({ component: CalendrierPage });

function CalendrierPage() {
  return <PlanningTimeline />;
}

import { Link } from "@tanstack/react-router";
import { ClosureSnapshot } from "../../cycles/ui/closure-snapshot";
import type { ProjectDetailData } from "./data";
export function ProjectCycleHistory({
  history,
}: {
  history: ProjectDetailData["cycleHistory"];
}) {
  if (!history.length) return null;
  return (
    <section
      className="project-detail__section"
      aria-label="Closed cycle history"
    >
      <h2>Closed cycle history</h2>
      {history.map((entry) => (
        <details key={entry.cycleId}>
          <summary>
            {entry.name} ·{" "}
            {entry.snapshot.progress.percentage === null
              ? "No committed work"
              : `${entry.snapshot.progress.completed} / ${entry.snapshot.progress.total} ${entry.snapshot.progress.unit === "points" ? "points" : "by issue count"}`}
          </summary>
          <Link to="/app/cycles/$cycleId" params={{ cycleId: entry.cycleId }}>
            Open {entry.name}
          </Link>
          <ClosureSnapshot snapshot={entry.snapshot} />
        </details>
      ))}
    </section>
  );
}

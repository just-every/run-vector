import { useEffect } from "react";
import { useApiResource } from "../../app/api-client";
import { slaProjection } from "./schema";
import "./slas.css";
const countdownSchema = slaProjection.nullable();
export function SlaCountdown({
  identifier,
  version,
}: {
  identifier: string;
  version: number;
}) {
  const resource = useApiResource(
    `/api/issues/${identifier}/sla`,
    countdownSchema,
  );
  useEffect(() => {
    resource.reload();
    const timer = setInterval(resource.reload, 60000);
    return () => clearInterval(timer);
  }, [version, resource.reload]);
  const sla = resource.data;
  if (resource.error)
    return (
      <p role="alert">
        Resolution SLA unavailable.{" "}
        <button type="button" onClick={resource.reload}>
          Retry
        </button>
      </p>
    );
  if (!sla) return null;
  return (
    <p
      className="sla-countdown"
      role="note"
      aria-label="Resolution SLA remaining time"
    >
      <strong>Resolution SLA</strong>
      {" · "}
      {sla.state === "resolved"
        ? "Resolved"
        : sla.state === "stopped"
          ? "Stopped"
          : sla.remainingMinutes <= 0
            ? `Breached by ${Math.abs(sla.remainingMinutes)} business minutes`
            : `${sla.remainingMinutes} business minutes remaining`}
      {" · "}
      {sla.timezone}
      {sla.warnedAt ? " · Warning recorded" : ""}
      {sla.breachedAt ? " · Breach recorded" : ""}
    </p>
  );
}

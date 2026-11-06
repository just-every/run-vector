import { useState, type FormEvent } from "react";
import { fetchJson, useApiResource } from "../../app/api-client";
import { useHydrated } from "../../app/initial-resources";
import type { Administration } from "../administration/schema";
import { slaSettings } from "./schema";
import "./slas.css";
export function TeamSla({
  data,
  team,
}: {
  data: Administration;
  team: Administration["teams"][number];
}) {
  const path = `/api/settings/teams/${team.id}/sla`,
    resource = useApiResource(path, slaSettings);
  const [pending, setPending] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const hydrated = useHydrated();
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    setMessage("");
    try {
      const receipt = await fetchJson(path, slaSettings, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          enabled: values.get("enabled") === "on",
          priority: values.get("priority") || null,
          labelId: values.get("label") || null,
          targetMinutes: Number(values.get("target")),
          warnBeforeMinutes: Number(values.get("warning")),
          workingDays: values.getAll("days").map(Number),
          startsAt: values.get("start"),
          endsAt: values.get("end"),
        }),
      });
      resource.publishReceipt(() => receipt);
      setMessage("Resolution SLA saved.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The SLA could not be saved.",
      );
    } finally {
      setPending(false);
    }
  }
  const rule = resource.data?.rule;
  return (
    <section className="team-block sla-settings" aria-label="Resolution SLA">
      <h2 className="group-heading">Resolution SLA</h2>
      <p>
        Set a resolution target for matching issues during business hours in{" "}
        {resource.data?.timezone ?? data.workspace.timezone}.
      </p>
      {resource.loading && <p role="status">Loading SLA…</p>}
      {resource.error && (
        <p role="alert">
          {resource.error.message}{" "}
          <button type="button" onClick={resource.reload}>
            Retry
          </button>
        </p>
      )}
      {resource.data && (
        <form
          aria-label="Resolution SLA target"
          onSubmit={save}
          key={JSON.stringify(rule)}
        >
          <fieldset disabled={pending || !hydrated}>
            <label className="sla-choice">
              <input
                name="enabled"
                type="checkbox"
                defaultChecked={rule?.enabled ?? false}
              />{" "}
              Enable resolution target
            </label>
            <div className="sla-fields">
              <div className="sla-field">
                <label htmlFor={`sla-priority-${team.id}`}>
                  Matching priority
                </label>
                <select
                  id={`sla-priority-${team.id}`}
                  name="priority"
                  defaultValue={rule ? (rule.priority ?? "") : "urgent"}
                >
                  <option value="">Any priority</option>
                  {["urgent", "high", "medium", "low", "none"].map((value) => (
                    <option key={value} value={value}>
                      {value[0].toUpperCase() + value.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sla-field">
                <label htmlFor={`sla-label-${team.id}`}>Matching label</label>
                <select
                  id={`sla-label-${team.id}`}
                  name="label"
                  defaultValue={rule?.labelId ?? ""}
                >
                  <option value="">Any label</option>
                  {data.labels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
              <label>
                Resolve within (business minutes)
                <input
                  name="target"
                  type="number"
                  min={2}
                  max={525600}
                  required
                  defaultValue={rule?.targetMinutes ?? 240}
                />
              </label>
              <label>
                Warn before (business minutes)
                <input
                  name="warning"
                  type="number"
                  min={1}
                  max={525599}
                  required
                  defaultValue={rule?.warnBeforeMinutes ?? 60}
                />
              </label>
              <label>
                Business hours start
                <input
                  name="start"
                  type="time"
                  required
                  defaultValue={rule?.startsAt ?? "09:00"}
                />
              </label>
              <label>
                Business hours end
                <input
                  name="end"
                  type="time"
                  required
                  defaultValue={rule?.endsAt ?? "17:00"}
                />
              </label>
            </div>
            <fieldset className="sla-days">
              <legend>Business days</legend>
              {[
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
                "Sunday",
              ].map((day, index) => (
                <label key={day}>
                  <input
                    name="days"
                    type="checkbox"
                    value={index + 1}
                    defaultChecked={(
                      rule?.workingDays ?? [1, 2, 3, 4, 5]
                    ).includes(index + 1)}
                  />
                  {day}
                </label>
              ))}
            </fieldset>
            <p>
              When both filters are selected, an issue must match both. Existing
              clocks keep their original target and timezone. Completion,
              withdrawal or disabling stops a clock permanently.
            </p>
            <button className="button-primary" type="submit">
              Save resolution SLA
            </button>
          </fieldset>
        </form>
      )}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

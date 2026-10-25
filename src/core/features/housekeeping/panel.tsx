import { useState } from "react";
import { z } from "zod";
import { fetchJson } from "../../app/api-client";
import type { Administration } from "../administration/schema";
import { SettingsSaveForm } from "../settings/ui/settings-save-form";
import { administrationSchema } from "../administration/schema";
import { housekeepingPreviewSchema, type Housekeeping } from "./schema";
import "./housekeeping.css";

type Preview = z.infer<typeof housekeepingPreviewSchema>;
const period = (value: FormDataEntryValue | null) => (value ? Number(value) : null);
const read = (form: HTMLFormElement): Housekeeping => {
  const fields = new FormData(form);
  return { closeAfterDays: period(fields.get("close")), archiveAfterDays: period(fields.get("archive")), exemptBugs: fields.get("bugs") === "on" };
};

export function HousekeepingPanel({ data, onChanged }: { data: Administration; onChanged: () => void }) {
  const [previews, setPreviews] = useState<Record<string, Preview | string>>({});
  async function preview(form: HTMLFormElement, teamId: string) {
    if (!form.reportValidity()) return;
    try {
      const result = await fetchJson(`/api/settings/teams/${teamId}/housekeeping/preview`, housekeepingPreviewSchema, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(read(form)),
      });
      setPreviews((all) => ({ ...all, [teamId]: result }));
    } catch (cause) {
      setPreviews((all) => ({ ...all, [teamId]: cause instanceof Error ? cause.message : "The preview could not be loaded." }));
    }
  }
  return (
    <section id="housekeeping" aria-labelledby="housekeeping-heading" className="housekeeping-panel">
      <h2 id="housekeeping-heading">Auto-close and auto-archive</h2>
      <p>
        The scheduled run closes open issues with no activity for the set number of days to the team’s Canceled status, with an
        automation entry explaining why, and archives completed or canceled issues the set number of days after they closed.
        Archived issues leave lists and default search; search with archived records, links and exports still include them.
        Leave a period blank to turn it off. Preview shows what the next run would change.
      </p>
      {data.teams.filter((t) => !t.archivedAt).map((team) => {
        const rule = data.housekeeping.find((h) => h.teamId === team.id);
        const result = previews[team.id];
        return (
          <SettingsSaveForm key={team.id} aria-label={`Auto-close and auto-archive ${team.name}`} path={`/api/settings/teams/${team.id}/housekeeping`} schema={administrationSchema} read={fields => ({closeAfterDays:period(fields.get("close")), archiveAfterDays:period(fields.get("archive")), exemptBugs:fields.get("bugs")==="on"})} onSaved={onChanged}>
            <h3>{team.name}</h3>
            <fieldset>
              <label>Auto-close after (days without activity)
                <input name="close" type="number" min={1} max={3650} defaultValue={rule?.closeAfterDays ?? ""} placeholder="Off" />
              </label>
              <label>Auto-archive after (days since closed)
                <input name="archive" type="number" min={1} max={3650} defaultValue={rule?.archiveAfterDays ?? ""} placeholder="Off" />
              </label>
              <label className="housekeeping-check">
                <input name="bugs" type="checkbox" defaultChecked={rule?.exemptBugs ?? true} />
                Never auto-close issues labelled Bug
              </label>
              <div className="housekeeping-actions">
                <button type="button" onClick={(event) => preview(event.currentTarget.form!, team.id)}>Preview</button>
              </div>
            </fieldset>
            {typeof result === "string" && <p role="alert">{result}</p>}
            {result && typeof result !== "string" && (
              <div className="housekeeping-preview" role="status" aria-label={`Preview for ${team.name}`}>
                {(["close", "archive"] as const).map((kind) => (
                  <div key={kind}>
                    <h4>{kind === "close" ? `Would close ${result.close.length}` : `Would archive ${result.archive.length}`}</h4>
                    {result[kind].length ? <ul>{result[kind].map((issue) => (
                      <li key={issue.id}><a href={`/app/issues/${issue.identifier}`}>{issue.identifier}</a> {issue.title} · {issue.days} days</li>
                    ))}</ul> : <p>Nothing yet.</p>}
                  </div>
                ))}
              </div>
            )}
          </SettingsSaveForm>
        );
      })}
    </section>
  );
}

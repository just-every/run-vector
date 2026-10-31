import { useHydrated } from "../../../app/initial-resources";
import { useRef, useState, type FormEvent } from "react";
import type { Administration } from "../../administration/schema";
import { useAdministrationAction } from "./administration-action";
import { AdministrationFeedback } from "./administration-feedback";

/** Owners and Admins define exclusive groups here; each label chooses its group
 * in its own editor, so a group keeps its identity when it is renamed. */
export function LabelGroupsPanel({
  groups,
  labels,
  onChanged,
}: {
  groups: Administration["labelGroups"];
  labels: Administration["labels"];
  onChanged: () => void;
}) {
  const action = useAdministrationAction(onChanged);
  const hydrated = useHydrated();
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (await action.run("/api/settings/label-groups", "POST", { name: new FormData(form).get("name") })) form.reset();
  }
  return (
    <div aria-labelledby="label-groups-heading" role="group">
      <h3 id="label-groups-heading">Label groups</h3>
      <p>An issue carries at most one label from each group, for example Area or Type.</p>
      <form aria-label="Create label group" onSubmit={create}>
        <fieldset disabled={action.pending || !hydrated}>
          <label>
            Group name
            <input name="name" required maxLength={120} />
          </label>
          <button>Create group</button>
        </fieldset>
      </form>
      <AdministrationFeedback action={action} />
      {groups.map((group) => (
        <LabelGroupEditor key={group.id} group={group} count={labels.filter((label) => label.groupId === group.id).length} onChanged={onChanged} />
      ))}
    </div>
  );
}
function LabelGroupEditor({
  group,
  count,
  onChanged,
}: {
  group: Administration["labelGroups"][number];
  count: number;
  onChanged: () => void;
}) {
  const action = useAdministrationAction(onChanged);
  const hydrated = useHydrated();
  const [confirm, setConfirm] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <details>
      <summary>
        {group.name} · {count} {count === 1 ? "label" : "labels"}
      </summary>
      <form
        aria-label={`Edit label group ${group.name}`}
        onSubmit={async (event) => {
          event.preventDefault();
          await action.run(`/api/settings/label-groups/${group.id}`, "PATCH", { name: new FormData(event.currentTarget).get("name") });
        }}
      >
        <fieldset disabled={action.pending || !hydrated}>
          <label>
            Group name
            <input name="name" required maxLength={120} defaultValue={group.name} />
          </label>
          <button>Save group</button>
          <button ref={trigger} type="button" onClick={() => setConfirm(true)}>
            Delete group
          </button>
        </fieldset>
      </form>
      {confirm && (
        <div role="group" aria-label="Confirm label group deletion">
          <p id={`delete-group-${group.id}`}>Delete {group.name}? Its labels stay, ungrouped, on every issue.</p>
          <div className="admin-actions">
            <button
              type="button"
              autoFocus
              disabled={action.pending || !hydrated}
              aria-describedby={`delete-group-${group.id}`}
              onClick={() => void action.run(`/api/settings/label-groups/${group.id}`, "DELETE")}
            >
              Confirm delete group
            </button>
            <button
              type="button"
              disabled={action.pending || !hydrated}
              onClick={() => {
                setConfirm(false);
                trigger.current?.focus();
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      <AdministrationFeedback action={action} />
    </details>
  );
}

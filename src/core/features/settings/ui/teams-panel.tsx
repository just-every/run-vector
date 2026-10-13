import { useState, type FormEvent } from "react";
import { useAdministrationAction } from "./administration-action";
import { AdministrationFeedback } from "./administration-feedback";

import type { Administration } from "../../administration/schema";
type Team = Administration["teams"][number];
type Status = Team["statuses"][number];
const categories = [
  "intake",
  "backlog",
  "unstarted",
  "started",
  "completed",
  "canceled",
  "duplicate",
];
export function TeamsPanel({
  teams,
  onChanged,
}: {
  teams: Team[];
  onChanged: () => void;
}) {
  const action = useAdministrationAction(onChanged);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    if (
      await action.run("/api/settings/teams", "POST", {
        name: fields.get("name"),
        identifierPrefix: fields.get("prefix"),
      })
    )
      form.reset();
  }
  return (
    <section
      id="teams"
      className="administration-panel"
      aria-labelledby="teams-heading"
    >
      <h2 id="teams-heading">Teams</h2>
      <p>
        Teams organise work. Archived teams retain their issues and history.
      </p>
      <form aria-label="Create team" onSubmit={create}>
        <fieldset disabled={action.pending}>
          <label>
            Team name
            <input name="name" required maxLength={120} />
          </label>
          <label>
            Identifier prefix
            <input
              name="prefix"
              required
              pattern="[A-Z]{2,10}"
              minLength={2}
              maxLength={10}
              title="Two to ten uppercase letters"
            />
          </label>
          <button type="submit">Create team</button>
        </fieldset>
      </form>
      <AdministrationFeedback action={action} />
      {teams.map((team) => (
        <TeamEditor key={team.id} team={team} onChanged={onChanged} />
      ))}
    </section>
  );
}
function TeamEditor({
  team,
  onChanged,
}: {
  team: Team;
  onChanged: () => void;
}) {
  const action = useAdministrationAction(onChanged);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    await action.run(`/api/settings/teams/${team.id}`, "PATCH", {
      name: fields.get("name"),
      ...(team.prefixEditable
        ? { identifierPrefix: fields.get("prefix") }
        : {}),
    });
  }
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    if (
      await action.run(`/api/settings/teams/${team.id}/statuses`, "POST", {
        name: fields.get("name"),
        category: fields.get("category"),
      })
    )
      form.reset();
  }
  const statuses = [...team.statuses].sort((a, b) => a.position - b.position);
  return (
    <details>
      <summary>
        {team.name} · {team.identifierPrefix}
        {team.archivedAt ? " · Archived" : ""}
      </summary>
      <form aria-label={`Edit ${team.name}`} onSubmit={save}>
        <fieldset disabled={action.pending}>
          <label>
            Team name
            <input
              name="name"
              required
              maxLength={120}
              defaultValue={team.name}
            />
          </label>
          {team.prefixEditable ? (
            <label>
              Identifier prefix
              <input
                name="prefix"
                required
                pattern="[A-Z]{2,10}"
                minLength={2}
                maxLength={10}
                defaultValue={team.identifierPrefix}
              />
            </label>
          ) : (
            <p>
              Identifier prefix {team.identifierPrefix} is frozen because this
              team has issued an identifier.
            </p>
          )}
          <button type="submit">Save team</button>
          <button
            type="button"
            onClick={() =>
              void action.run(`/api/settings/teams/${team.id}`, "PATCH", {
                archived: !team.archivedAt,
              })
            }
          >
            {team.archivedAt ? "Unarchive team" : "Archive team"}
          </button>
        </fieldset>
      </form>
      <h3>Workflow</h3>
      <p>
        Each category keeps at least one status. The first status in a category
        is its default.
      </p>
      {statuses.map((status, index) => (
        <StatusEditor
          key={status.id}
          teamId={team.id}
          status={status}
          statuses={statuses}
          index={index}
          onChanged={onChanged}
        />
      ))}
      <form aria-label={`Add status to ${team.name}`} onSubmit={add}>
        <fieldset disabled={action.pending}>
          <label>
            Status name
            <input name="name" required maxLength={120} />
          </label>
          <label>
            Status category
            <select name="category">
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category[0].toUpperCase() + category.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Add status</button>
        </fieldset>
      </form>
      <AdministrationFeedback action={action} />
    </details>
  );
}
function StatusEditor({
  teamId,
  status,
  statuses,
  index,
  onChanged,
}: {
  teamId: string;
  status: Status;
  statuses: Status[];
  index: number;
  onChanged: () => void;
}) {
  const action = useAdministrationAction(onChanged);
  const [destination, setDestination] = useState("");
  const choices = statuses.filter(
    (s) => s.category === status.category && s.id !== status.id,
  );
  async function rename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await action.run(
      `/api/settings/teams/${teamId}/statuses/${status.id}`,
      "PATCH",
      { name: new FormData(event.currentTarget).get("name") },
    );
  }
  function reorder(offset: number) {
    const ids = statuses.map((s) => s.id);
    [ids[index], ids[index + offset]] = [ids[index + offset], ids[index]];
    void action.run(`/api/settings/teams/${teamId}/statuses/order`, "PUT", {
      statusIds: ids,
    });
  }
  return (
    <div
      className="admin-status"
      role="group"
      aria-label={`Workflow status ${status.name}`}
    >
      <p>
        {status.category[0].toUpperCase() + status.category.slice(1)}
        {statuses.find((s) => s.category === status.category)?.id === status.id
          ? " · Default"
          : ""}
      </p>
      <form aria-label={`Rename ${status.name}`} onSubmit={rename}>
        <label>
          Status name
          <input
            name="name"
            required
            maxLength={120}
            defaultValue={status.name}
            disabled={action.pending}
          />
        </label>
        <button disabled={action.pending}>Rename status</button>
      </form>
      <div className="admin-actions">
        <button
          type="button"
          disabled={action.pending || index === 0}
          onClick={() => reorder(-1)}
        >
          Move up
        </button>
        <button
          type="button"
          disabled={action.pending || index === statuses.length - 1}
          onClick={() => reorder(1)}
        >
          Move down
        </button>
      </div>
      {choices.length ? (
        <>
          <label>
            Destination status
            <select
              value={destination}
              disabled={action.pending}
              onChange={(event) => setDestination(event.target.value)}
            >
              <option value="">Choose a same-category destination</option>
              {choices.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={action.pending || !destination}
            onClick={() =>
              void action.run(
                `/api/settings/teams/${teamId}/statuses/${status.id}`,
                "DELETE",
                { destinationStatusId: destination },
              )
            }
          >
            Remove status
          </button>
        </>
      ) : (
        <p>This category’s last status cannot be removed.</p>
      )}
      <AdministrationFeedback action={action} />
    </div>
  );
}

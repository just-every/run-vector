import type { Administration } from "../administration/schema";
import { SettingsSaveForm } from "../settings/ui/settings-save-form";
import { timezoneName } from "../settings/ui/timezone-picker";
import { administrationSchema } from "../administration/schema";
const weekdays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
export function CycleSchedulePanel({
  data,
  onChanged,
}: {
  data: Administration;
  onChanged: () => void;
}) {
  return (
    <section aria-labelledby="schedule-heading">
      <h3 id="schedule-heading">Automatic cycle schedule</h3>
      <p>
        Keep upcoming cycles ready for rollover. Cycles start at midnight in{" "}
        {timezoneName(data.workspace.timezone)}. Saving applies the cadence to future
        automatic cycles; cycles already started keep their dates.
      </p>
      {data.teams
        .filter((t) => !t.archivedAt)
        .map((team) => {
          const schedule = data.cycleSchedules.find(
            (s) => s.teamId === team.id,
          );
          return (
            <SettingsSaveForm
              key={team.id}
              aria-label={`Cycle schedule ${team.name}`}
              path={`/api/settings/teams/${team.id}/cycle-schedule`} schema={administrationSchema} onSaved={onChanged}
              read={fields => ({weeks:Number(fields.get("weeks")), startWeekday:Number(fields.get("weekday")), cooldownWeeks:Number(fields.get("cooldown")), upcomingCount:Number(fields.get("upcoming"))})}
            >
              <h4>
                {team.name}
                {schedule ? " · Scheduled" : ""}
              </h4>
              <fieldset>
                <label>
                  Cycle length (weeks)
                  <input
                    name="weeks"
                    type="number"
                    min={1}
                    max={8}
                    required
                    defaultValue={schedule?.weeks ?? 2}
                  />
                </label>
                <label>
                  Start weekday
                  <select
                    name="weekday"
                    defaultValue={schedule?.startWeekday ?? 1}
                  >
                    {weekdays.map((day, index) => (
                      <option key={day} value={index}>
                        {day}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Cooldown (weeks)
                  <input
                    name="cooldown"
                    type="number"
                    min={0}
                    max={8}
                    required
                    defaultValue={schedule?.cooldownWeeks ?? 0}
                  />
                </label>
                <label>
                  Upcoming cycles to keep
                  <input
                    name="upcoming"
                    type="number"
                    min={1}
                    max={24}
                    required
                    defaultValue={schedule?.upcomingCount ?? 3}
                  />
                </label>
              </fieldset>
            </SettingsSaveForm>
          );
        })}
    </section>
  );
}

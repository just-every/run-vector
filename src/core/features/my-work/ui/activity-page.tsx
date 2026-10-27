import { useDateFormat } from "../../../shared/date-format";
import { Link } from "@tanstack/react-router";
import { useApiResource } from "../../../app/api-client";
import { activityChanges, activityTitle } from "../../issues/ui/activity-changes";
import { optionsSchema } from "../../streams/ui/data";
import { relativeTime } from "../../streams/ui/helpers";
import { myActivitySchema } from "../schema";
import { MyWorkTabs } from "./my-work-tabs";

/** WORK-004 Activity: the member's own recent changes and comments, newest first. */
export function MyActivity() {
  const { date } = useDateFormat();
  const activity = useApiResource("/api/my-work/activity", myActivitySchema, 5000);
  const options = useApiResource("/api/options", optionsSchema);
  return (
    <main className="my-work-activity" aria-label="My activity">
      <MyWorkTabs current="Activity" />
      <header className="issues-heading">
        <div>
          <h1>Activity</h1>
          <p>Your recent changes and comments, newest first.</p>
        </div>
      </header>
      {activity.error ? (
        <p role="alert">
          Could not load your activity. {activity.error.message}{" "}
          <button type="button" onClick={activity.reload}>Retry</button>
        </p>
      ) : null}
      {activity.loading && !activity.data ? <p role="status">Loading activity…</p> : null}
      {activity.data && !activity.data.entries.length ? (
        <section className="issues-empty">
          <h2>No activity yet</h2>
          <p>Changes and comments you make on issues appear here.</p>
        </section>
      ) : null}
      {activity.data?.entries.length ? (
        <ol className="my-activity-list">
          {activity.data.entries.map((entry) => {
            const changes = activityChanges(entry.kind, entry.previousValue, entry.nextValue, options.data, date);
            return (
              <li key={entry.id}>
                <Link to="/app/issues/$identifier" params={{ identifier: entry.issue.identifier }} search={{}}>
                  <span className="my-activity-issue">
                    <span className="issues-identifier">{entry.issue.identifier}</span>
                    <strong>{entry.issue.title}</strong>
                  </span>
                  <span className="my-activity-what">
                    {activityTitle(entry.kind, entry.nextValue)}
                    {changes.length
                      ? ": " + changes.map((change) => (change.to === undefined ? change.field : `${change.field} ${change.from} → ${change.to}`)).join("; ")
                      : ""}
                  </span>
                  {entry.comment ? <span className="my-activity-comment">{entry.comment}</span> : null}
                  <time dateTime={entry.at}>{relativeTime(entry.at)}</time>
                </Link>
              </li>
            );
          })}
        </ol>
      ) : null}
    </main>
  );
}

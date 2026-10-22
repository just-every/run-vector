import { useApiResource } from "../../../app/api-client";
import { administrationSchema } from "../../administration/schema";
import { CyclesPanel } from "./cycles-panel";
import "../../settings/ui/settings.css";
export function CyclesWorkspace() {
  const resource = useApiResource(
    "/api/metadata",
    administrationSchema,
  );
  return (
    <main className="settings-page" aria-labelledby="cycles-title">
      <header>
        <p className="settings-eyebrow">Commitments</p>
        <h1 id="cycles-title">Cycles</h1>
      </header>
      {resource.loading && <p role="status">Loading cycles…</p>}
      {resource.error && (
        <p role="alert">
          {resource.error.message}{" "}
          <button type="button" onClick={resource.reload}>
            Retry cycles
          </button>
        </p>
      )}
      {resource.data && (
        <CyclesPanel
          data={resource.data}
          onChanged={resource.reload}
          heading="Manual cycles"
        />
      )}
    </main>
  );
}

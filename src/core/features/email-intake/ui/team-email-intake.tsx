import {EventWebhookKey} from "./event-key";
import { useState, type FormEvent } from "react";
import { fetchJson, useApiResource } from "../../../app/api-client";
import { useViewerTime } from "../../../app/viewer-time";
import { useHydrated } from "../../../app/initial-resources";
import { emailSettingsSchema } from "./schema";

type Team = { teamId: string; teamName: string };

export function TeamEmailIntake({ archived, ...team }: Team & { archived: boolean }) {
  if (archived) return <section aria-label={`Email intake for ${team.teamName}`}>
    <h3>Email intake</h3>
    <p>Email intake is unavailable while this team is archived. Unarchive the team to manage its retained settings.</p>
  </section>;
  return <ActiveTeamEmailIntake {...team} />;
}

function ActiveTeamEmailIntake({ teamId, teamName }: Team) {
  const { formatInstant } = useViewerTime();
  const hydrated = useHydrated();
  const path = `/api/settings/teams/${teamId}/email-intake`;
  const resource = useApiResource(path, emailSettingsSchema, undefined, {
    abortPendingOnDispose: false,
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !resource.data) return;
    const fields = new FormData(event.currentTarget);
    setPending(true); setError(""); setSaved(false);
    try {
      const receipt = await fetchJson(path, emailSettingsSchema, {
        method: "PUT", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          enabled: fields.has("enabled"), address: fields.get("address"),
          allowedSenders: String(fields.get("allowedSenders") ?? "").split(/\r?\n/).map(value => value.trim()).filter(Boolean),
          acknowledgement: fields.has("acknowledgement"),
        }),
      });
      resource.publishReceipt(() => receipt);
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Email intake settings could not be saved.");
    } finally { setPending(false); }
  }
  const data = resource.data;
  return <section aria-label={`Email intake for ${teamName}`}>
    <h3>Email intake</h3>
    <p>Forward mail from Gmail, Outlook or a shared inbox to a private team address. Only the exact sender addresses below are admitted.</p>
    <p>Configure Cloudflare Email Routing to send this address to this installation’s Worker. Saving these settings does not provision an address or configure your mail domain.</p>
    {resource.error && <p role="alert">{resource.error.message} <button type="button" onClick={resource.reload}>Retry email intake settings</button></p>}
    {resource.loading && <p role="status">Loading email intake…</p>}
    {data && <>
      {!data.ingressConfigured && <p>Provider routing is not verified by Vector. Confirm the Cloudflare route before forwarding mail.</p>}
      <form aria-label={`Configure email intake for ${teamName}`} onSubmit={save}>
        <fieldset disabled={pending || !hydrated}>
          <label className="admin-checkbox"><input type="checkbox" name="enabled" defaultChecked={data.settings.enabled} />Enable email intake</label>
          <label>Private intake address<input type="email" name="address" maxLength={254} defaultValue={data.settings.address} /></label>
          {/* A textarea's saved list is its text content; a wrapping label would carry it in its own text. */}
          <label htmlFor={`email-senders-field-${teamId}`}>Allowed sender addresses</label>
          <textarea id={`email-senders-field-${teamId}`} name="allowedSenders" rows={4} defaultValue={data.settings.allowedSenders.join("\n")} aria-describedby={`email-senders-${teamId}`} />
          <p id={`email-senders-${teamId}`}>One full email address per line. Domains and wildcards are not accepted. An empty list admits no senders.</p>
          <label className="admin-checkbox"><input type="checkbox" name="acknowledgement" defaultChecked={data.settings.acknowledgement} />Send one acknowledgement with the issue identifier</label>
          <p>Acknowledgements are off by default. Team managers enable them explicitly. Internal comments and status changes are never emailed.</p>
          <button type="submit">{pending ? "Saving…" : "Save email intake"}</button>
        </fieldset>
      </form>
      <EventWebhookKey teamId={teamId} configured={data.eventWebhook.configured} url={data.eventWebhook.url} onChanged={resource.refreshAfterMutation}/>
      {saved && <p role="status">Email intake settings saved.</p>}
      <p>Customer domain mapping is unavailable in this installation. Requesters are recorded by their email address without a seat or sign-in.</p>
      {data.receipts.length > 0 && <details>
        <summary>Recent inbound mail · {data.receipts.length}</summary>
        <ul>{data.receipts.map(receipt => <li key={receipt.id}>
          <time dateTime={receipt.createdAt}>{formatInstant(receipt.createdAt)}</time>{" · "}{receipt.status}
          {receipt.issueIdentifier && <> · <a href={`/app/issues/${encodeURIComponent(receipt.issueIdentifier)}`}>{receipt.issueIdentifier}</a></>}
          {receipt.error && <> · {receipt.error}</>}
        </li>)}</ul>
      </details>}
    </>}
    {error && <p role="alert">{error}</p>}
  </section>;
}

import { emailModes, type ChannelChoice, type EmailMode } from "../channel-schema";
import type { NotificationKind } from "../schema";
import { channelLabels } from "./channel-data";

type ChannelRow = ChannelChoice & { inherited?: boolean };
const emailLabels: Record<EmailMode, string> = {
  off: "Off", immediate: "Immediate", hourly: "Hourly digest", daily: "Daily digest",
};

export function ChannelMatrix({ rows, defaults = false, disabled, slackReason, onChange, onReset }: {
  rows: ChannelRow[];
  defaults?: boolean;
  disabled: boolean;
  slackReason?: string;
  onChange: (choice: ChannelChoice) => void;
  onReset?: (kind: NotificationKind) => void;
}) {
  return <table className="notification-channel-matrix" role="table">
    <caption>{defaults ? "Workspace default notification channels" : "Your notification channels"}</caption>
    <thead role="rowgroup"><tr role="row">
      <th scope="col">Event</th><th scope="col">Inbox</th><th scope="col">Email</th>
      <th scope="col">Slack</th>{!defaults && <th scope="col">Preference</th>}
    </tr></thead>
    <tbody role="rowgroup">{rows.map(({ kind, emailMode, slack, inherited }) => {
      const label = channelLabels[kind];
      return <tr key={kind} role="row">
        <th scope="row" role="rowheader">{label}</th>
        <td role="cell"><span className="channel-mobile-label" aria-hidden="true">Inbox</span>
          <span aria-label={`Inbox for ${label}: always retained`}>Always</span></td>
        <td role="cell"><label>
          <span className="channel-mobile-label" aria-hidden="true">Email</span>
          <select aria-label={`${defaults ? "Default email" : "Email"} for ${label}`} disabled={disabled}
            value={emailMode} onChange={event => onChange({ kind, emailMode: event.target.value as EmailMode, slack })}>
            {emailModes.map(mode => <option key={mode} value={mode}>{emailLabels[mode]}</option>)}
          </select>
        </label></td>
        <td role="cell"><label className="notification-checkbox" title={slackReason}>
          <span className="channel-mobile-label" aria-hidden="true">Slack</span>
          <input type="checkbox" aria-label={`${defaults ? "Default Slack" : "Slack"} for ${label}`}
            aria-describedby={slackReason ? "notification-slack-channel-reason" : undefined}
            checked={slack} disabled={disabled || Boolean(slackReason)}
            onChange={event => onChange({ kind, emailMode, slack: event.target.checked })} />
        </label></td>
        {!defaults && <td role="cell" className="channel-inheritance">
          {inherited ? <span>Workspace default</span> : <>
            <span>Custom</span>
            <button type="button" disabled={disabled} aria-label={`Use workspace default for ${label}`}
              onClick={() => onReset?.(kind)}>Reset</button>
          </>}
        </td>}
      </tr>;
    })}</tbody>
  </table>;
}

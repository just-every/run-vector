const actions: Record<string, string> = {
  'auth.signed_in': 'Signed in',
  'operator.joined': 'Joined the workspace',
  'operator.invited': 'Invited a person',
  'operator.removed': 'Removed a person',
  'operator.role_changed': 'Changed a person’s role',
  'person.erased': 'Erased a person’s data',
  'workspace.label_creation_changed': 'Changed who can create labels',
  'team.permission_changed': 'Changed team permissions',
  'cycle.schedule.updated': 'Updated the cycle schedule',
  'cycle.created.automation': 'Created a cycle automatically',
  'cycle.rescheduled.automation': 'Rescheduled a cycle automatically',
  'workload.capacity_changed': 'Updated workload capacity',
  'issue.deleted': 'Deleted an issue',
  'integration.source_received': 'Received an integration update',
  'audit.exported': 'Exported the audit log',
  'channel.bound': 'Connected a notification channel',
  'channel.unbound': 'Disconnected a notification channel',
  'slack.connected': 'Connected Slack',
  'slack.app_configured': 'Configured the Slack app',
  'slack.app_installed': 'Installed the Slack app',
  'slack.channel_allowed': 'Allowed a Slack channel',
  'slack.channel_disallowed': 'Removed a Slack channel allowance',
  'slack.member_mapped': 'Linked a person to Slack',
  'slack.member_unmapped': 'Unlinked a person from Slack',
  'slack.signing_secret_changed': 'Updated Slack verification',
};
export const actorLabels: Record<string, string> = {
  person: 'Person', automation: 'Automation', integration: 'Integration', agent: 'Agent', unknown: 'Unknown history',
};
export function auditAction(action: string) {
  if (actions[action]) return actions[action];
  const words = action.replaceAll('operator', 'person').replaceAll('auth', 'sign in').replaceAll(/[._]/g, ' ');
  return words[0]!.toUpperCase() + words.slice(1);
}
export function auditActor(entry: { actorName: string | null; actorKind: string }) {
  return entry.actorName ?? (entry.actorKind === 'person' ? 'Deleted person' : actorLabels[entry.actorKind]);
}

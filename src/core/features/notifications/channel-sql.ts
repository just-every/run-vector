/** SQL fragments use only fixed internal identifiers, never request strings. */
export const effectiveEmailSql = (kind = 'cause.value', operator = 'o.id', workspace = 't.workspace_id') =>
  `COALESCE((SELECT email_mode FROM notification_channel_overrides WHERE operator_id=${operator} AND kind=${kind}),
    (SELECT email_mode FROM notification_channel_defaults WHERE workspace_id=${workspace} AND kind=${kind}),
    CASE WHEN ${kind} IN ('assignment','mention') THEN 'immediate' ELSE 'off' END)`;
export const effectiveSlackSql = (kind = 'cause.value', operator = 'o.id', workspace = 't.workspace_id') =>
  `COALESCE((SELECT slack_enabled FROM notification_channel_overrides WHERE operator_id=${operator} AND kind=${kind}),
    (SELECT slack_enabled FROM notification_channel_defaults WHERE workspace_id=${workspace} AND kind=${kind}),
    EXISTS(SELECT 1 FROM vector_slack_member_links legacy,json_each(legacy.dm_kinds) selected
      WHERE legacy.operator_id=${operator} AND selected.value=${kind}),0)`;
export const unmutedCauseSql = `NOT EXISTS(SELECT 1 FROM notification_type_mutes mute WHERE mute.operator_id=o.id AND mute.kind=cause.value)`;

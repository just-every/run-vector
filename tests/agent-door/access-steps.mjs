const from = (id, pointer = '/id') => ({ $from: id, pointer });
const sponsor = { $sponsor: 'id' };
const standard = [{ class: 'standard', facts: { measure: 1 } }];
const access = (measure, direction = 'narrows', setting) => [
  { class: 'access', facts: { measure, direction } },
  ...(setting ? [{ class: 'security', facts: { measure: 1, setting } }] : []),
];
const step = (id, tool, args, expect = standard) => ({ id, tool, args, expect });

/** Native single-owner installation coverage. Counts deliberately describe the
 * real initializer topology; a caller with admitted Members supplies its
 * actual recipient count. No operator, session, invitation or grant is seeded
 * in SQL, and no owner no-op is presented as a self-escalation probe. */
export function accessSteps({ teamId = from('options', '/teams/0/id'), memberCount = 0,
  permissionMemberCount = 0 } = {}) {
  return [
    step('access-workspace', 'vector.ops.member_management', {}),
    step('access-member-grants', 'vector.ops.member_management.grants', { id: sponsor }),
    step('access-team', 'vector.role.team_membership', { id: teamId }),
    step('access-membership-grants', 'vector.role.team_membership.member_grants', { id: teamId, operator_id: from('access-team', '/memberships/0/operatorId') }),
    step('access-team-grants', 'vector.role.team_membership.grants', { id: teamId }),
    step('access-time', 'vector.ops.workspace_time.set', { timezone: 'Australia/Brisbane', reminderTime: '08:45' }),
    step('access-time-restore', 'vector.ops.workspace_time.set', {
      timezone: from('access-workspace', '/workspace/timezone'), reminderTime: from('access-workspace', '/workspace/reminderTime') }),
    step('access-role-current', 'vector.role.workspace_roles.set', { id: sponsor, role: 'owner' }, access(0)),
    step('access-team-current', 'vector.role.team_membership.set', { id: teamId, operatorId: sponsor, role: 'owner' }, access(0)),
    step('access-team-join-current', 'vector.role.team_membership.join', { id: teamId }, access(0, 'widens')),
    step('access-permissions-narrow', 'vector.role.team_permissions.set', { id: teamId,
      input: { settings: 'team_owners', planning: 'team_owners' } }, access(permissionMemberCount, 'narrows', 'team.permissions')),
    step('access-requests-expose', 'vector.team.join_permissions.set', { id: teamId,
      input: { mode: 'invite_only', requestsEnabled: true } }, access(memberCount, 'narrows', 'team.membership')),
    step('access-request-current', 'vector.team.join_permissions.request', { id: teamId }),
    step('access-requests-restore', 'vector.team.join_permissions.set', { id: teamId,
      input: { mode: from('access-team', '/team/membershipMode'), requestsEnabled: from('access-team', '/team/requestsEnabled') } },
      access(memberCount, 'widens', 'team.membership')),
    step('access-private', 'vector.role.private_teams.set', { id: teamId, isPrivate: true }, access(memberCount, 'narrows', 'team.privacy')),
    step('access-public', 'vector.role.private_teams.set', { id: teamId, isPrivate: false }, access(memberCount, memberCount ? 'widens' : 'narrows', 'team.privacy')),
    step('access-invitations-off', 'vector.ops.member_management.invitation_permission', { memberInvites: false }, access(0, 'narrows', 'workspace.member_invitations')),
    step('access-invitations-on', 'vector.ops.member_management.invitation_permission', { memberInvites: true }, access(memberCount, memberCount ? 'widens' : 'narrows', 'workspace.member_invitations')),
    step('access-invitations-restore', 'vector.ops.member_management.invitation_permission', {
      memberInvites: from('access-workspace', '/workspace/memberInvites') }, access(memberCount, 'narrows', 'workspace.member_invitations')),
    step('access-team-creation-on', 'vector.team.creation_permission.set', { membersMayCreate: true }, access(memberCount, memberCount ? 'widens' : 'narrows', 'workspace.team_creation')),
    step('access-team-creation-off', 'vector.team.creation_permission.set', { membersMayCreate: false }, access(memberCount, 'narrows', 'workspace.team_creation')),
    step('access-label-creation-off', 'vector.issue.labels.creation_permission', { membersMayCreate: false }, access(memberCount, 'narrows', 'workspace.label_creation')),
    step('access-label-creation-on', 'vector.issue.labels.creation_permission', { membersMayCreate: true }, access(memberCount, memberCount ? 'widens' : 'narrows', 'workspace.label_creation')),
  ];
}

/** Use once per fresh native topology, after a separately admitted native
 * member has become another owner of leaveTeamId. The two people and request
 * must be prepared through real invitation/magic-link confirmation. */
export function accessLifecycleSteps({ memberId, leaveTeamId, requestedTeamId, removedTeamId, removedMemberId }) {
  if (!memberId || !leaveTeamId || !requestedTeamId || !removedTeamId || !removedMemberId) throw new Error('A real admitted native member, membership and native membership request are required');
  return [
    step('access-grant-member-owner', 'vector.role.team_membership.set', { id: leaveTeamId, operatorId: memberId, role: 'owner' }, access(1, 'widens')),
    step('access-approve-member', 'vector.team.join_permissions.decide', { id: requestedTeamId, requesterId: memberId, decision: 'approved' }, access(1, 'widens')),
    step('access-leave', 'vector.role.team_membership.leave', { id: leaveTeamId }, access(1)),
    step('access-left-request', 'vector.team.join_permissions.request', { id: leaveTeamId }),
    step('access-membership-remove', 'vector.role.team_membership.remove', { id: removedTeamId, operator_id: removedMemberId }, access(1)),
    step('access-member-demote', 'vector.role.workspace_roles.set', { id: memberId, role: 'viewer', teamIds: [leaveTeamId, requestedTeamId] }, access(1)),
    step('access-member-remove', 'vector.ops.safe_removal', { id: memberId }, [
      ...access(1), { class: 'destructive' }]),
  ];
}

export function accessNarrowings({ leaveTeamId, removedMemberId, removedTeamId }) {
  return [
    { tool: 'vector.role.team_membership.leave', step: 'access-leave', witness: {
      tool: 'vector.role.team_membership.grants', args: { id: leaveTeamId }, pointer: '/grants' } },
    { tool: 'vector.role.team_membership.remove', step: 'access-membership-remove', witness: {
      tool: 'vector.role.team_membership.member_grants', args: { id: removedTeamId, operator_id: removedMemberId }, pointer: '/grants' } },
    { tool: 'vector.ops.safe_removal', step: 'access-member-remove', witness: {
      tool: 'vector.ops.member_management.grants', args: { id: removedMemberId }, pointer: '/grants' } },
  ];
}

/** These probes grant the current sponsor membership on a team they actually
 * left. Base's ordinary escalation phase supplies the unchanged native witness.
 * The installation Owner cannot gain workspace role, privacy access or the
 * member-only permissions; no false probes are supplied for those operations. */
export function accessEscalations({ leftTeamId }) {
  return [
    { id: 'access-join-self', tool: 'vector.role.team_membership.join', args: { id: leftTeamId } },
    { id: 'access-team-owner-self', tool: 'vector.role.team_membership.set', args: { id: leftTeamId, operatorId: sponsor, role: 'owner' } },
    { id: 'access-approve-self', tool: 'vector.team.join_permissions.decide', args: { id: leftTeamId, requesterId: sponsor, decision: 'approved' } },
    { id: 'access-open-self', tool: 'vector.team.join_permissions.set', args: { id: leftTeamId, input: { mode: 'open', requestsEnabled: true } } },
  ];
}

export default accessSteps();

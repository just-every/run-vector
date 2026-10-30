# Native agent registry

The declared capability set is **core only**: tools, policy, pause, audit and idempotency. Principal authorization and owner-bound tokens always apply. Events/subscriptions, multi-sponsor, mail edges, resource refresh, timed lifecycle, dual host, queued lifecycle and owner-native administration are undeclared. Existing native tools remain registered; multi-person lifecycle assertions remain pending the undeclared multi-sponsor family. Released rer 0.2.87 has no capability-subset manifest key; a later Base re-pin adds that declaration.

| Tool | Classes | Current clauses |
| --- | --- | --- |
| `vector.issues.list` | standard | AGENT-005, OPS-001, VIEW-001 |
| `vector.issues.read` | standard | AGENT-005, OPS-001, ISSUE-001 |
| `vector.projects.list` | standard | AGENT-005, PROJ-001 |
| `vector.projects.read` | standard | AGENT-005, PROJ-001 |
| `vector.metadata.read` | standard | AGENT-005, OPS-001 |
| `vector.cycles.read` | standard | AGENT-005, CYCLE-001 |
| `vector.issue.creation` | standard | ISSUE-001, ISSUE-002 |
| `vector.issue.stable_identifiers` | standard | ISSUE-002 |
| `vector.issue.concurrent_edits` | standard | ISSUE-001, ISSUE-006, ISSUE-013, ISSUE-025, ISSUE-026 |
| `vector.issue.priority` | standard | ISSUE-003 |
| `vector.issue.status_transitions` | standard | ISSUE-004 |
| `vector.issue.assignment` | standard | ISSUE-005 |
| `vector.issue.estimates` | standard | ISSUE-011 |
| `vector.issue.labels` | standard | ISSUE-014 |
| `vector.proj.project_membership` | standard | PROJ-003 |
| `vector.cycle.commitment` | standard | CYCLE-002 |
| `vector.issue.set_due_date` | standard | ISSUE-001, CURR-003, CURR-004 |
| `vector.issue.activity_history` | standard | ISSUE-007 |
| `vector.intake.intake_creation` | standard | INTAKE-001, INTAKE-003 |
| `vector.intake.evidence_revisions` | standard | INTAKE-003, INTAKE-008 |
| `vector.intake.inspectable_assessment` | standard | INTAKE-004 |
| `vector.intake.decision_policy` | standard | INTAKE-010 |
| `vector.intake.accept` | standard | INTAKE-005, INTAKE-010 |
| `vector.intake.defer` | standard | INTAKE-006, INTAKE-010 |
| `vector.intake.decline` | standard | INTAKE-007, INTAKE-010 |
| `vector.intake.return` | standard | INTAKE-006 |
| `vector.rel.dependencies` | standard | REL-001, REL-002 |
| `vector.rel.remove_dependency` | standard | REL-001, REL-002 |
| `vector.rel.related_issues` | standard | REL-007 |
| `vector.rel.remove_related_issue` | standard | REL-007 |
| `vector.rel.duplicate_decision` | standard | REL-003, REL-004 |
| `vector.rel.undo_duplicate` | standard | REL-005 |
| `vector.rel.canonical_duplicates` | standard | REL-004 |
| `vector.rel.blocked_state` | standard | REL-002 |
| `vector.rel.parent_and_child` | standard | REL-006 |
| `vector.issue.sub_issue_progress` | standard | ISSUE-019, REL-006 |
| `vector.issue.create_sub_issue` | standard | ISSUE-019, REL-006 |
| `vector.issue.reorder_sub_issues` | standard | ISSUE-019, REL-006 |
| `vector.issue.read_sub_issue_rule` | standard | ISSUE-019 |
| `vector.issue.set_sub_issue_rule` | standard | ISSUE-019 |
| `vector.issue.read_discussion` | standard | ISSUE-008, ISSUE-009 |
| `vector.issue.comments_and_safe_comment_removal` | standard | ISSUE-008, ISSUE-013 |
| `vector.issue.edit_comment` | standard | ISSUE-008 |
| `vector.issue.remove_comment` | destructive | ISSUE-008 |
| `vector.issue.discussion_threads_and_resolution` | standard | ISSUE-008 |
| `vector.issue.read_reactions` | standard | ISSUE-017 |
| `vector.issue.reactions` | standard | ISSUE-017 |
| `vector.issue.remove_reaction` | standard | ISSUE-017 |
| `vector.issue.read_links` | standard | ISSUE-009 |
| `vector.issue.attachments_and_links` | standard | ISSUE-009 |
| `vector.issue.remove_link` | destructive | ISSUE-009 |
| `vector.issue.description_history` | standard | ISSUE-018 |
| `vector.issue.restore_description` | standard | ISSUE-018 |
| `vector.issue.checklists` | standard | ISSUE-025 |
| `vector.issue.tick_comment_checklist` | standard | ISSUE-025 |
| `vector.issue.issue_references_and_backlinks` | standard | ISSUE-027 |
| `vector.issue.remove_file` | destructive | ISSUE-009 |
| `vector.issue.moving_teams` | standard | ISSUE-012 |
| `vector.issue.copy_issue` | standard | ISSUE-023 |
| `vector.issue.bulk_edit` | standard | ISSUE-006, VIEW-004 |
| `vector.issue.bulk_move_teams` | standard | ISSUE-012, VIEW-004 |
| `vector.issue.bulk_duplicate` | standard | REL-003, REL-004, REL-005, VIEW-004 |
| `vector.issue.read_manual_order` | standard | VIEW-001 |
| `vector.issue.reorder` | standard | VIEW-001 |
| `vector.proj.project_record` | standard | PROJ-001 |
| `vector.proj.project_record.edit` | standard | PROJ-001, PROJ-002, PROJ-009 |
| `vector.proj.manual_lifecycle` | standard | PROJ-002 |
| `vector.proj.project_archiving` | standard | PROJ-009 |
| `vector.proj.project_record.delete` | destructive | PROJ-001 |
| `vector.proj.milestones` | standard | PROJ-011 |
| `vector.proj.milestones.edit` | standard | PROJ-011 |
| `vector.proj.milestones.order` | standard | PROJ-011 |
| `vector.proj.milestones.delete` | destructive | PROJ-011 |
| `vector.proj.progress` | standard | PROJ-004 |
| `vector.proj.health` | standard | PROJ-005 |
| `vector.proj.risk_explanation` | standard | PROJ-006 |
| `vector.proj.historical_truth` | standard | PROJ-008 |
| `vector.proj.portfolio` | standard | PROJ-007 |
| `vector.team.team_identity` | standard | TEAM-001 |
| `vector.team.team_archiving` | standard | TEAM-003 |
| `vector.team.team_settings` | standard | TEAM-005 |
| `vector.team.team_workflow` | standard | TEAM-002 |
| `vector.team.team_workflow.rename` | standard | TEAM-002 |
| `vector.team.team_workflow.order` | standard | TEAM-002 |
| `vector.team.status_removal` | destructive | TEAM-004 |
| `vector.issue.labels.create` | standard | ISSUE-014 |
| `vector.issue.labels.edit` | standard | ISSUE-014 |
| `vector.issue.labels.merge` | destructive | ISSUE-014 |
| `vector.issue.labels.delete` | destructive | ISSUE-014 |
| `vector.cycles.next_window` | standard | CYCLE-001 |
| `vector.cycle.time_box` | standard | CYCLE-001 |
| `vector.cycle.automatic_cycle_schedule` | standard | CYCLE-007 |
| `vector.cycle.automatic_cycle_membership` | standard | CYCLE-008 |
| `vector.cycle.progress_and_capacity` | standard | CYCLE-003 |
| `vector.cycle.closure_snapshot` | standard | CYCLE-005 |
| `vector.cycle.missing_next_cycle` | standard | CYCLE-006 |
| `vector.init.initiatives` | standard | INIT-001 |
| `vector.init.initiatives.edit` | standard | INIT-001 |
| `vector.init.initiatives.projects` | standard | INIT-001, INIT-002 |
| `vector.init.initiatives.list` | standard | INIT-001 |
| `vector.init.initiative_roll_up` | standard | INIT-002 |
| `vector.release.releases` | standard | RELEASE-001 |
| `vector.release.releases.edit` | standard | RELEASE-001 |
| `vector.release.releases.scope` | standard | RELEASE-001 |
| `vector.release.releases.list` | standard | RELEASE-001 |
| `vector.release.releases.read` | standard | RELEASE-001 |
| `vector.proj.project_documents_and_specs` | standard | PROJ-013 |
| `vector.proj.project_documents_and_specs.edit` | standard | PROJ-013 |
| `vector.proj.project_documents_and_specs.comment` | standard | PROJ-013 |
| `vector.proj.project_documents_and_specs.link` | standard | PROJ-013 |
| `vector.proj.project_documents_and_specs.unlink` | standard | PROJ-013 |
| `vector.proj.project_documents_and_specs.list` | standard | PROJ-013 |
| `vector.proj.project_documents_and_specs.read` | standard | PROJ-013 |
| `vector.proj.project_documents_and_specs.revisions` | standard | PROJ-013 |
| `vector.proj.project_documents_and_specs.comments` | standard | PROJ-013 |
| `vector.proj.project_documents_and_specs.specification` | standard | PROJ-013 |
| `vector.proj.project_templates` | standard | PROJ-012 |
| `vector.proj.project_templates.edit` | standard | PROJ-012 |
| `vector.proj.project_templates.capture` | standard | PROJ-012 |
| `vector.proj.project_templates.apply` | standard | PROJ-012 |
| `vector.proj.project_templates.delete` | destructive | PROJ-012 |
| `vector.proj.project_templates.list` | standard | PROJ-012 |
| `vector.proj.project_templates.read` | standard | PROJ-012 |
| `vector.curr.disjoint_stream` | standard | CURR-001 |
| `vector.curr.needs_decision` | standard | CURR-002 |
| `vector.curr.now` | standard | CURR-003 |
| `vector.curr.next` | standard | CURR-004 |
| `vector.curr.recently_done` | standard | CURR-005 |
| `vector.curr.explainable_attention` | standard | CURR-006 |
| `vector.curr.ranking` | standard | CURR-007 |
| `vector.curr.freshness` | standard | CURR-008 |
| `vector.curr.stream_controls` | standard | CURR-009 |
| `vector.work.personal_queue` | standard | WORK-001 |
| `vector.work.personal_defaults` | standard | WORK-002 |
| `vector.work.cycle_context` | standard | WORK-003 |
| `vector.work.created` | standard | WORK-004 |
| `vector.work.subscribed` | standard | WORK-004 |
| `vector.work.activity` | standard | WORK-004 |
| `vector.search.global_search` | standard | SEARCH-001 |
| `vector.search.exact_identifier` | standard | SEARCH-002 |
| `vector.search.index_freshness` | standard | SEARCH-003 |
| `vector.search.options` | standard | SEARCH-001, SEARCH-004 |
| `vector.view.saved_views.delete` | destructive | VIEW-002 |
| `vector.view.issue_controls` | standard | VIEW-001 |
| `vector.search.advanced_filters` | standard | SEARCH-004 |
| `vector.view.team_board` | standard | VIEW-005 |
| `vector.view.workspace_wide_views` | standard | VIEW-009 |
| `vector.view.saved_views` | standard | VIEW-002 |
| `vector.view.saved_views.read` | standard | VIEW-002 |
| `vector.view.saved_views.create` | standard | VIEW-002 |
| `vector.view.saved_views.edit` | standard | VIEW-002 |
| `vector.view.saved_views.duplicate` | standard | VIEW-002 |
| `vector.view.control_persistence` | standard | VIEW-003 |
| `vector.view.control_persistence.save` | standard | VIEW-003 |
| `vector.view.control_persistence.reset` | standard | VIEW-003 |
| `vector.view.timeline_and_calendar_views` | standard | VIEW-007 |
| `vector.view.appearance` | standard | VIEW-011 |
| `vector.view.appearance.save` | standard | VIEW-011 |
| `vector.notify.inbox_events` | standard | NOTIFY-001 |
| `vector.notify.inbox_events.read` | standard | NOTIFY-001 |
| `vector.notify.inbox_events.count` | standard | NOTIFY-001 |
| `vector.notify.followers` | standard | NOTIFY-002 |
| `vector.notify.no_self_notification` | standard | NOTIFY-003 |
| `vector.notify.read_and_mute` | standard | NOTIFY-002, NOTIFY-004 |
| `vector.notify.read_and_mute.read` | standard | NOTIFY-004 |
| `vector.notify.read_and_mute.read_all` | standard | NOTIFY-004 |
| `vector.notify.due_reminders` | standard | NOTIFY-005, NOTIFY-008 |
| `vector.notify.assignment_and_mention_email` | standard | NOTIFY-006 |
| `vector.notify.assignment_and_mention_email.save` | standard | NOTIFY-004, NOTIFY-006 |
| `vector.notify.snooze_and_reminders` | standard | NOTIFY-008 |
| `vector.notify.snooze_and_reminders.cancel` | standard | NOTIFY-008 |
| `vector.notify.snooze_and_reminders.snooze` | standard | NOTIFY-008 |
| `vector.notify.snooze_and_reminders.unsnooze` | standard | NOTIFY-008 |
| `vector.notify.channels_and_digests` | standard | NOTIFY-007 |
| `vector.notify.channels_and_digests.save` | standard | NOTIFY-007 |
| `vector.notify.subscriptions` | standard | NOTIFY-009 |
| `vector.notify.subscriptions.read` | standard | NOTIFY-009 |
| `vector.notify.subscriptions.subscribe` | standard | NOTIFY-009 |
| `vector.notify.subscriptions.unsubscribe` | standard | NOTIFY-009 |
| `vector.notify.personal_time_zone_and_working_hours` | standard | NOTIFY-010 |
| `vector.notify.personal_time_zone_and_working_hours.save` | standard | NOTIFY-010 |
| `vector.report.dashboards.delete` | destructive | REPORT-003 |
| `vector.report.insights` | standard | REPORT-001 |
| `vector.report.cycle_and_project_charts` | standard | REPORT-002 |
| `vector.report.project_completion_forecast` | standard | REPORT-002 |
| `vector.report.dashboards` | standard | REPORT-003 |
| `vector.report.dashboards.read` | standard | REPORT-003 |
| `vector.report.dashboards.create` | standard | REPORT-003 |
| `vector.report.dashboards.edit` | standard | REPORT-003 |
| `vector.report.workload` | standard | REPORT-004 |
| `vector.report.workload.personal_capacity` | standard | REPORT-004 |
| `vector.report.workload.set_capacity` | standard | REPORT-004 |
| `vector.report.warehouse_and_spreadsheet_export` | standard | REPORT-005 |
| `vector.role.audit_log` | standard | ROLE-005 |
| `vector.role.audit_log.export` | standard | ROLE-005 |
| `vector.role.team_membership` | standard | ROLE-007, TEAM-007 |
| `vector.role.team_membership.grants` | standard | ROLE-007, ROLE-009 |
| `vector.role.team_membership.join` | access | ROLE-007, TEAM-007 |
| `vector.role.team_membership.leave` | access | ROLE-007, TEAM-007 |
| `vector.role.team_membership.set` | access | ROLE-007, ROLE-003, ROLE-013 |
| `vector.team.join_permissions.request` | standard | TEAM-007, ROLE-002 |
| `vector.team.join_permissions.decide` | access | TEAM-007, ROLE-002 |
| `vector.role.team_membership.member_grants` | standard | ROLE-007, ROLE-009 |
| `vector.role.team_membership.remove` | access | ROLE-007, ROLE-003, ROLE-013 |
| `vector.role.team_permissions.set` | access, security | ROLE-009, ROLE-007 |
| `vector.team.join_permissions.set` | access, security | TEAM-007, ROLE-002 |
| `vector.role.private_teams.set` | access, security | ROLE-002, OPS-001 |
| `vector.ops.member_management` | standard | OPS-002, ROLE-001, OPS-003 |
| `vector.ops.member_management.grants` | standard | OPS-002, ROLE-001, ROLE-007 |
| `vector.ops.workspace_time.set` | standard | OPS-003, NOTIFY-005 |
| `vector.ops.member_management.invitation_permission` | access, security | OPS-002, ROLE-001 |
| `vector.team.creation_permission.set` | access, security | TEAM-008 |
| `vector.issue.labels.creation_permission` | access, security | ISSUE-014 |
| `vector.role.workspace_roles.set` | access | ROLE-001, ROLE-003, ROLE-013 |
| `vector.ops.safe_removal` | access, destructive | OPS-002, OPS-004 |
| `vector.events.list` | standard | BASE-AGENT-010 |

## Resources

- `vector://issues/{identifier}`
- `vector://projects/{id}`
- `vector://cycles/{id}`
- `vector://workspace/planning`
- `vector://issues/{identifier}/discussion`
- `vector://issues/{identifier}/description-history`
- `vector://issues/{identifier}/subissues`
- `vector://issues/{identifier}/references`
- `vector://issues/{identifier}/reactions`
- `vector://documents/{id}`
- `vector://releases/{id}`
- `vector://initiatives/{id}`
- `vector://project-templates/{id}`
- `vector://teams/{id}`
- `vector://labels/{id}`
- `vector://statuses/{id}`
- `vector://milestones/{id}`
- `vector://audit/{id}`
- `vector://views/{id}`
- `vector://notifications/{id}`
- `vector://reminders/{id}`
- `vector://subscriptions/{id}`
- `vector://dashboards/{id}`
- `vector://preferences/{id}`
- `vector://teams/{teamId}/members/{operatorId}`

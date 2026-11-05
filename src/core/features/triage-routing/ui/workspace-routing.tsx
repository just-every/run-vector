import { AddRuleButton, RuleDraftFields, useRuleDraft } from './rule-draft';
import { RoutingRules } from './rule-list';
import { useRouting } from './use-routing';

/** Workspace-wide rules, for Owners and Admins: they run before every team's own rules. */
export function WorkspaceIntakeRouting() {
  const routing = useRouting('/api/settings/triage-routing');
  const draft = useRuleDraft(routing);
  const view = routing.resource.data;
  return <RoutingRules routing={routing} label="Workspace intake routing"
    intro="New Sentry issues from any team’s connection follow these rules before that team’s own."
    empty="Connect Sentry under Connections to route its new issues.">
    {view && (draft.open
      ? <form className="add-status" aria-label="New workspace routing rule" onSubmit={draft.submit}><RuleDraftFields draft={draft} view={view} /></form>
      : <AddRuleButton draft={draft} />)}
  </RoutingRules>;
}

import type { Administration } from '../../administration/schema';
import { AddRuleButton, RuleDraftFields, useRuleDraft } from './rule-draft';
import { RoutingRules } from './rule-list';
import { useRouting } from './use-routing';

/** A team's own rules for the Sentry connection that sends issues to it, in its Automation tab. */
export function TeamIntakeRouting({ team }: { team: Administration['teams'][number] }) {
  const routing = useRouting(`/api/settings/teams/${team.id}/triage-routing`);
  const draft = useRuleDraft(routing);
  const view = routing.resource.data;
  return <RoutingRules routing={routing} label={`Intake routing for ${team.name}`}
    intro="New Sentry issues from this team’s connection go to the first rule’s team."
    empty="No Sentry connection sends issues to this team yet.">
    {view && (draft.open
      ? <form className="add-status" aria-label={`New routing rule for ${team.name}`} onSubmit={draft.submit}><RuleDraftFields draft={draft} view={view} /></form>
      : <AddRuleButton draft={draft} />)}
  </RoutingRules>;
}

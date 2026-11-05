import type { RoutingProvenance } from './data';
import './routing.css';

/** Under a routed item's title: the rule that placed it and the saved revision it acted on. */
export function RoutedBy({ routing }: { routing: RoutingProvenance }) {
  return <p className="issue-routed-by">
    Routed by {routing.scope === 'workspace' ? 'workspace' : 'team'} rule “{routing.ruleName}” · revision {routing.revision}
    {routing.configuredByName ? ` · saved by ${routing.configuredByName}` : ''}
  </p>;
}

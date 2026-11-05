import { ApiError, fetchJson, useApiResource } from '../../../app/api-client';
import { useSerialSaves } from '../../settings/ui/fields/serial-saves';
import { Refusal } from '../../settings/ui/fields/use-autosave';
import { routingViewSchema, type RoutingRule, type RoutingView } from './data';

export type RuleChange = (rules: RoutingRule[]) => RoutingRule[];

/**
 * One scope's routing: every change stores the whole ordered list against the saved revision it was made from.
 * Changes go one after another, each on the revision the last answer returned; a refused one keeps what was shown.
 */
export function useRouting(path: string) {
  const resource = useApiResource(path, routingViewSchema, undefined, { abortPendingOnDispose: false });
  const serial = useSerialSaves<RoutingView | null>(resource.data);
  const save = (change: RuleChange) => serial(async base => {
    if (!base) throw new Refusal('The routing rules are still loading.');
    try {
      const saved = await fetchJson(path, routingViewSchema, {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ expectedVersion: base.version, rules: change(base.rules) }),
      });
      resource.publishReceipt(() => saved);
      return saved;
    } catch (error) {
      if (error instanceof ApiError && error.status === 409 && (error.body as { error?: string } | null)?.error === 'routing_version_conflict') {
        resource.reload();
        throw new Refusal('These rules changed in the meantime. Retry to save your change on top of the latest.');
      }
      if (error instanceof ApiError && error.status === 403) throw new Refusal('You no longer have permission to change this routing.');
      throw error;
    }
  });
  return { resource, save };
}
export type Routing = ReturnType<typeof useRouting>;

/** "Sentry · Delivery": a connection is named by the team whose webhook it receives. */
export function sourceLabel(view: RoutingView, sourceId: string) {
  const source = view.sources.find(item => item.id === sourceId);
  if (!source) return 'A Sentry connection that is no longer available';
  const team = view.teams.find(item => item.id === source.teamId);
  return `${source.name} · ${team?.name ?? 'another team'}`;
}
export const teamLabel = (view: RoutingView, teamId: string) =>
  view.teams.find(item => item.id === teamId)?.name ?? 'A team that is no longer available';

import { createFileRoute, stripSearchParams, useNavigate, type SearchSchemaInput } from '@tanstack/react-router';
import { editorLeaf } from '../core/editor/leaf';
import { issueListQuerySchema, type IssueListQuery } from '../core/features/issues/list-schema';
import { IssueBrowserSurface } from '../core/features/issues/ui/issues-browser';
import { StoredIssueControls } from '../core/features/issues/ui/issue-list-preferences';
import { changeIssueListFilters } from '../core/features/issues/ui/issue-list-controls';
const defaults = issueListQuerySchema.parse({ category: 'backlog' });
export const Route = createFileRoute('/app/issues_/backlog')({
  validateSearch: (search: SearchSchemaInput & Record<string, unknown>) => issueListQuerySchema.parse({ ...search, category: 'backlog' }),
  search: { middlewares: [stripSearchParams(defaults)] },
  component: editorLeaf(Backlog),
});
function Backlog() {
  const query = Route.useSearch(), navigate = useNavigate();
  const change = (changes: Partial<IssueListQuery>) => {
    const search = changeIssueListFilters(query, changes);
    void navigate({ to: search.category === 'backlog' ? '/app/issues/backlog' : '/app/issues', search });
  };
  return <StoredIssueControls surface="issues" query={query} onChange={change}>
    {(onChange, onReset) => <IssueBrowserSurface query={query} layout="list" onChange={onChange} onReset={onReset}
      onOpen={identifier => { void navigate({ to: '/app/issues/$identifier', params: { identifier }, search: query }); }} />}
  </StoredIssueControls>;
}

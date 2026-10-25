import {
  createFileRoute,
  redirect,
  useMatch,
  useNavigate,
  stripSearchParams,
  type SearchSchemaInput,
} from "@tanstack/react-router";
import { useRef } from 'react';
import { issueListQuerySchema } from "../core/features/issues/list-schema";
import { editorLeaf } from "../core/editor/leaf";
import { IssuesBrowser } from "../core/features/issues/ui/issues-browser";
import { IssueBrowserPane } from "../core/features/issues/ui/issue-browser-pane";
export const Route = createFileRoute("/app/issues")({
  validateSearch: (search: SearchSchemaInput & Record<string, unknown>) =>
    issueListQuerySchema.parse(search),
  search: { middlewares: [stripSearchParams(issueListQuerySchema.parse({}))] },
  beforeLoad: ({ location, search }) => {
    if (location.pathname.replace(/\/$/, '') === '/app/issues' && search.category === 'backlog')
      throw redirect({ to: '/app/issues/backlog', search, replace: true });
  },
  component: editorLeaf(Page),
});

function Page() {
  const detail = useMatch({ from: "/app/issues/$identifier", shouldThrow: false });
  const listMounted = useRef(!detail);
  if (!detail) listMounted.current = true;
  const navigate = useNavigate();
  const search = Route.useSearch();
  return (
    <IssueBrowserPane
      identifier={detail?.params.identifier ?? null}
      onClose={() => navigate({ to: "/app/issues", search })}
    >
      {listMounted.current && <IssuesBrowser />}
    </IssueBrowserPane>
  );
}

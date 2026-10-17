import {
  createFileRoute,
  useMatch,
  useNavigate,
  stripSearchParams,
  type SearchSchemaInput,
} from "@tanstack/react-router";
import { issueListQuerySchema } from "../core/features/issues/list-schema";
import { editorLeaf } from "../core/editor/leaf";
import { IssuesBrowser } from "../core/features/issues/ui/issues-browser";
import { IssueBrowserPane } from "../core/features/issues/ui/issue-browser-pane";
export const Route = createFileRoute("/app/issues")({
  validateSearch: (search: SearchSchemaInput & Record<string, unknown>) =>
    issueListQuerySchema.parse(search),
  search: { middlewares: [stripSearchParams(issueListQuerySchema.parse({}))] },
  component: editorLeaf(Page),
});

function Page() {
  const detail = useMatch({ from: "/app/issues/$identifier", shouldThrow: false });
  const navigate = useNavigate();
  const search = Route.useSearch();
  return (
    <IssueBrowserPane
      identifier={detail?.params.identifier ?? null}
      onClose={() => navigate({ to: "/app/issues", search })}
    >
      <IssuesBrowser />
    </IssueBrowserPane>
  );
}

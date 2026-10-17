import {
  createFileRoute,
  stripSearchParams,
  type SearchSchemaInput,
} from "@tanstack/react-router";
import { editorLeaf } from "../core/editor/leaf";
import { issueListQuerySchema } from "../core/features/issues/list-schema";
import { MyScopedIssues } from "../core/features/my-work/ui/scoped-issues";
const scoped = (search: Record<string, unknown>) =>
  issueListQuerySchema.parse({ ...search, scope: "subscribed" });
export const Route = createFileRoute("/app/my-work/subscribed")({
  validateSearch: (search: SearchSchemaInput & Record<string, unknown>) => scoped(search),
  search: { middlewares: [stripSearchParams(scoped({}))] },
  component: editorLeaf(Page),
});

function Page() {
  return <MyScopedIssues scope="subscribed" />;
}

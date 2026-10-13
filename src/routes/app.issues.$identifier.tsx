import { editorLeaf } from '../core/editor/leaf';
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { IssueDetail } from "../core/features/issues/ui/issue-detail";
import { focusIssueRow } from "../core/features/issues/ui/issue-browser-pane";
export const Route = createFileRoute("/app/issues/$identifier")({
  component: editorLeaf(Page),
});

function Page() {
  const { identifier } = Route.useParams();
  const navigate = useNavigate();
  const search = Route.useSearch();
  return (
    <main className="direct-issue-page">
      <IssueDetail
        identifier={identifier}
        onBack={async () => {
          await navigate({ to: "/app/issues", search });
          focusIssueRow(identifier);
        }}
      />
    </main>
  );
}

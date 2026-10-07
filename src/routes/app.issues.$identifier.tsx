import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { IssueDetail } from "../core/features/issues/ui/issue-detail";
export const Route = createFileRoute("/app/issues/$identifier")({
  component: Page,
});

function Page() {
  const { identifier } = Route.useParams();
  const navigate = useNavigate();
  const search = Route.useSearch();
  return (
    <main className="direct-issue-page">
      <IssueDetail
        identifier={identifier}
        onBack={() => navigate({ to: "/app/issues", search })}
      />
    </main>
  );
}

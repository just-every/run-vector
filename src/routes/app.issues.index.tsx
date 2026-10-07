import { createFileRoute } from "@tanstack/react-router";
import { IssuesBrowser } from "../core/features/issues/ui/issues-browser";
export const Route = createFileRoute("/app/issues/")({
  component: IssuesBrowser,
});

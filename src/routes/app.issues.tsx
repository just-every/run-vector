import {
  createFileRoute,
  Outlet,
  stripSearchParams,
  type SearchSchemaInput,
} from "@tanstack/react-router";
import { issueListQuerySchema } from "../core/features/issues/list-schema";
export const Route = createFileRoute("/app/issues")({
  validateSearch: (
    search: SearchSchemaInput & {
      q?: string;
      category?: string;
      assignee?: string;
      offset?: number;
    },
  ) => issueListQuerySchema.parse(search),
  search: { middlewares: [stripSearchParams(issueListQuerySchema.parse({}))] },
  component: Outlet,
});

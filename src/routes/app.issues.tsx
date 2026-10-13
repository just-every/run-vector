import {
  createFileRoute,
  Outlet,
  stripSearchParams,
  type SearchSchemaInput,
} from "@tanstack/react-router";
import { issueListQuerySchema } from "../core/features/issues/list-schema";
export const Route = createFileRoute("/app/issues")({
  validateSearch: (search: SearchSchemaInput & Record<string, unknown>) =>
    issueListQuerySchema.parse(search),
  search: { middlewares: [stripSearchParams(issueListQuerySchema.parse({}))] },
  component: Outlet,
});

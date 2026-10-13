import { editorLeaf } from '../core/editor/leaf';
import {
  createFileRoute,
  stripSearchParams,
  type SearchSchemaInput,
} from "@tanstack/react-router";
import { issueListQuerySchema } from "../core/features/issues/list-schema";
import { BoardBrowser } from "../core/features/issues/ui/issues-browser";
export const Route = createFileRoute("/app/board")({
  validateSearch: (search: SearchSchemaInput & Record<string, unknown>) =>
    issueListQuerySchema.parse(search),
  search: { middlewares: [stripSearchParams(issueListQuerySchema.parse({}))] },
  component: editorLeaf(BoardBrowser),
});

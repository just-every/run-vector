import { editorLeaf } from '../core/editor/leaf';
import { createFileRoute } from "@tanstack/react-router";
import { SearchPage } from "../core/features/search/ui/search-page";
export const Route = createFileRoute("/app/search")({ component: editorLeaf(SearchPage) });

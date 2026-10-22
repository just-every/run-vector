import { createFileRoute } from '@tanstack/react-router';
import { AuditPage } from '../core/features/audit/ui/audit-panel';
import { editorLeaf } from '../core/editor/leaf';
export const Route = createFileRoute('/app/settings_/audit')({ component: editorLeaf(AuditPage) });

import {OAuthConsentPage} from '../core/features/oauth-apps/ui/consent-page';
import { createFileRoute, notFound, redirect } from '@tanstack/react-router';
const sections = new Set(['appearance', 'personal-time', 'workspace-time', 'members', 'teams', 'labels', 'projects', 'cycles', 'housekeeping', 'data', 'after-restore', 'integrations', 'notifications']);
export const Route = createFileRoute('/app/settings_/$section')({
  beforeLoad: ({ params }) => {
    if(params.section==='oauth-consent')return;
    if (!sections.has(params.section)) throw notFound();
    throw redirect({ to: '/app/settings', hash: params.section, replace: true });
  },
  component:OAuthConsentPage,
});

import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { editorLeaf } from '../core/editor/leaf';
import { useApiResource } from '../core/app/api-client';
import { FailedResource } from '../core/app/ui/resource-state';
import { administrationSchema } from '../core/features/administration/schema';
import { ProjectCreate } from '../core/features/projects/ui/project-administration';
import { decide } from '../core/features/roles/policy';

export const Route = createFileRoute('/app/projects/new')({ component: editorLeaf(NewProject) });
function NewProject() {
  const metadata = useApiResource('/api/metadata', administrationSchema);
  const navigate = useNavigate();
  if (metadata.error) return <FailedResource kind="project form" retry={metadata.reload} />;
  if (!metadata.data) return <main className="projects-state" aria-live="polite">Loading project…</main>;
  const { viewer, operators, labels, projects } = metadata.data;
  const authority = { role: viewer.role, memberInvites: false, teams: new Map() };
  const close = () => { void navigate({ to: '/app/projects' }); };
  if (decide(authority, { row: 'projects.write' }) !== 'allow')
    return <main className="projects-state"><p>Your workspace role cannot create projects.</p><a href="/app/projects">Back to Projects</a></main>;
  return <main className="projects-workspace"><header className="projects-header"><div><h1>New project</h1></div></header>
    <section className="administration-panel project-detail__section">
      <ProjectCreate operators={operators} labels={labels} viewerId={viewer.id} projectIds={projects.map(project => project.id)} channel={decide(authority, { row: 'channels.create' }) === 'allow'} onChanged={close} onCancel={close} />
    </section>
  </main>;
}

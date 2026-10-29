import {useApiResource} from '../../../app/api-client';
import {projectPortfolioSchema} from './data';
import {ProjectRow} from './project-list';
import './projects.css';

export function TeamProjectsSection({teamId}:{teamId:string}) {
  const portfolio = useApiResource('/api/projects?team='+encodeURIComponent(teamId), projectPortfolioSchema);
  return <section className="document-section" aria-label="Projects">
    <h2>Projects</h2>
    {portfolio.error ? <p role="alert">Couldn't load projects. <button type="button" onClick={portfolio.reload}>Retry projects</button></p>
      : portfolio.data ? portfolio.data.projects.length > 0
        ? <div className="project-list">{portfolio.data.projects.map(project => <ProjectRow key={project.id} project={project}/>)}</div>
        : <p>No projects with this team's issues yet.</p>
      : <p role="status">Loading projects…</p>}
  </section>;
}

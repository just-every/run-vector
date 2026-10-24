import './team-metadata.css';
import type { Administration } from '../../administration/schema';

/** Administrative metadata grants no access to private work. */
export function TeamMetadata({data,team}:{data:Administration;team:Administration['teams'][number]}) {
  return <section className="team-metadata" aria-label={`Metadata for ${team.name}`}>
    <h3>{team.name} · {team.isPrivate?'Private':'Public'}</h3>
    <p>{team.members.length} members · {team.members.filter(member=>member.role==='owner').length} team owners · {team.issueCount} issues</p>
    <ul>{team.members.map(member=><li key={member.operatorId}>{data.operators.find(person=>person.id===member.operatorId)?.name??'Former member'} · {member.role==='owner'?'Team owner':'Member'}</li>)}</ul>
  </section>;
}

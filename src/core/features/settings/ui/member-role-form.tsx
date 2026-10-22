import { useState, type FormEvent } from 'react'
import type { AssignableRole } from '../../roles/matrix'
import { GuestTeams } from './guest-teams'
const labels = {owner:'Owner',admin:'Admin',member:'Member',guest:'Guest'}
export function MemberRoleForm({ member, teams, roles, disabled, onSubmit }: {
  member: { id:string; name:string; role:AssignableRole; teamIds:string[] }
  teams:{id:string;name:string}[]; roles:AssignableRole[]; disabled:boolean
  onSubmit:(event:FormEvent<HTMLFormElement>)=>Promise<void>
}) {
  const [role,setRole] = useState(member.role)
  const [selected,setSelected] = useState(member.teamIds)
  return <form aria-label={`Role for ${member.name}`} onSubmit={onSubmit} onReset={()=>{setRole(member.role);setSelected(member.teamIds)}}>
    <label>Role for {member.name}
      <select name="role" value={role} disabled={disabled} onChange={event => setRole(event.target.value as AssignableRole)}>
        {roles.map(role => <option key={role} value={role}>{labels[role]}</option>)}
      </select>
    </label>
    {role === 'guest' && <GuestTeams teams={teams} selected={selected} onChange={setSelected} disabled={disabled} />}
    <button type="submit" disabled={disabled || role === 'guest' && !selected.length}>Change role</button>
  </form>
}

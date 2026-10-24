type Team = { id: string; name: string }
/** Assignment and invitation use the same named-team choice. */
export function GuestTeams({ teams, selected, onChange, disabled, role = 'guest' }: {
  role?: 'guest' | 'viewer'; teams: Team[]; selected: string[]; onChange: (ids: string[]) => void; disabled: boolean
}) {
  return <fieldset className="guest-team-options" disabled={disabled}>
    <legend>Teams this {role === 'guest' ? 'Guest' : 'Viewer'} can access</legend>
    <p>{role === 'guest' ? 'Choose at least one team. The Guest sees issues and projects contributed by these teams.' : 'The Viewer reads every public team. Choose the private teams they may also read.'}</p>
    {teams.map(team => <label className="admin-checkbox" key={team.id}>
      <input type="checkbox" name="teamIds" value={team.id} checked={selected.includes(team.id)}
        onChange={event => onChange(event.target.checked ? [...selected,team.id] : selected.filter(id => id !== team.id))} />
      {team.name}
    </label>)}
  </fieldset>
}

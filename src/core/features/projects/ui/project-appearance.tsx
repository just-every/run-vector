type Appearance = { color: string | null; icon: string | null };

export function ProjectAppearance({ color, icon }: Appearance) {
  if (color === null && icon === null) return null;
  return <span className="project-appearance">
    {color !== null && <span className="project-color" role="img" aria-label={`Project color ${color}`} style={{ backgroundColor: color }} />}
    {icon !== null && <span role="img" aria-label={`Project icon ${icon}`}>{icon}</span>}
  </span>;
}

export function ProjectAppearanceFields({ project }: { project?: Appearance }) {
  return <>
    <label>
      Project color
      <input name="color" placeholder="#405080" pattern="#[0-9a-fA-F]{6}" maxLength={7} defaultValue={project?.color ?? ""} />
      <small>Six-digit hex color, or leave empty for no color.</small>
    </label>
    <label>
      Project icon
      <input name="icon" placeholder="🚀" defaultValue={project?.icon ?? ""} />
      <small>One emoji, or leave empty for no icon.</small>
    </label>
  </>;
}

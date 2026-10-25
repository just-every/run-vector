import "./project-palette.css";
import { projectIcon } from "../appearance";

type Appearance = { color: string | null; icon: string | null };

export function ProjectAppearance({ color, icon }: Appearance) {
  const emoji = projectIcon.safeParse(icon);
  if (color === null && !emoji.success) return null;
  return <span className="project-appearance">
    {color !== null && <span className="project-color" role="img" aria-label={`Project color ${color}`} style={{ backgroundColor: color }} />}
    {emoji.success && <span role="img" aria-label={`Project icon ${emoji.data}`}>{emoji.data}</span>}
  </span>;
}

export function ProjectAppearanceFields({ project }: { project?: Appearance }) {
  const emoji = projectIcon.safeParse(project?.icon);
  return <>
    <fieldset className="project-palette">
      <legend>Project color</legend>
      {[["", "No colour"], ["#2446dc", "Cobalt"], ["#f59e0b", "Amber"], ["#60a5fa", "Blue"], ["#a78bfa", "Violet"], ["#22c55e", "Green"], ["#ef4444", "Red"],
        ...(project?.color && !["#2446dc", "#f59e0b", "#60a5fa", "#a78bfa", "#22c55e", "#ef4444"].includes(project.color) ? [[project.color, "Current colour"]] : [])].map(([color, name]) =>
        <label key={color}><input type="radio" name="color" value={color} defaultChecked={(project?.color ?? "") === color} />
          {color && <span aria-hidden="true" className="project-color" style={{ backgroundColor: color }} />}{name}
        </label>)}
    </fieldset>
    <label>
      Project icon (optional)
      <input aria-label="Project icon" name="icon" placeholder="🚀" defaultValue={emoji.success ? emoji.data : ""} />
    </label>
  </>;
}

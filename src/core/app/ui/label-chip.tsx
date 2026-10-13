import type { CSSProperties } from "react";

/** A label in the family's quiet treatment: ink text on a tint of the label's own colour, edged in that colour. */
export function LabelChip({ name, color }: { name: string; color: string }) {
  return (
    <span className="label-chip" style={{ "--label": color } as CSSProperties}>
      {name}
    </span>
  );
}

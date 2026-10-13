import { z } from "zod";

export type EditableIssueField =
  "estimate" | "dueDate" | "expectedOutcome" | "customerImpact";

// A field editor owns exactly one mutation; empty optional values clear it.
export function issueFieldPayload(
  expectedVersion: number,
  field: EditableIssueField,
  draft: string,
) {
  const text = draft.trim();
  let value: string | number | null = text || null;
  if (text && field === "estimate") {
    value = Number(text);
    if (!Number.isInteger(value) || value < 1 || value > 100)
      throw new Error("Estimate must be a whole number from 1 to 100.");
  } else if (text && field === "dueDate") {
    if (!z.string().date().safeParse(text).success)
      throw new Error("Choose a valid due date.");
  } else if (text.length > 20000) {
    throw new Error("Use at most 20,000 characters.");
  }
  return { expectedVersion, [field]: value };
}

const priorities: Record<string, string> = { none: "No priority", urgent: "Urgent", high: "High", medium: "Medium", low: "Low" };
const decisions: Record<string, string> = { accepted: "Accepted", deferred: "Deferred", declined: "Declined", returned: "Returned for decision" };
export const priorityLabel = (value: string) => priorities[value] ?? value;
export const decisionLabel = (value: string) => decisions[value] ?? value;

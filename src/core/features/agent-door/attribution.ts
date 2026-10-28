/** Native authorization remains the person. These are historical references
 * and display names from admitted agent context, never credentials. */
export type MutationAttribution = {
  agent: { id: string; name: string };
  person: { id: string; name: string };
  consent?: string;
  approvers: Array<{ id: string; name: string }>;
};

function reference(value: { id: string; name: string }) {
  if (!value.id?.trim() || !value.name?.trim())
    throw new Error('Native agent attribution requires an id and display name.');
  return { id: value.id, name: value.name };
}

/** Snapshot once so caller mutations cannot change attribution between batches. */
export function prepareMutationAttribution(actor: string, input?: MutationAttribution) {
  if (!input) return undefined;
  const agent = reference(input.agent), person = reference(input.person);
  if (person.id !== actor)
    throw new Error('Native agent attribution must name the authorized person.');
  const approvers = input.approvers.map(reference);
  const values = [agent.id, agent.name, person.id, person.name,
    input.consent ?? null, JSON.stringify(approvers), `${agent.name} for ${person.name}`];
  return { key: JSON.stringify(values), values };
}

/** Native authorization remains the person. These are historical references
 * and display names from admitted agent context, never credentials. */
export type MutationAttribution = {
  agent: { id: string; name: string };
  person: { id: string; name: string };
  consent?: string;
  approvers: readonly Readonly<{ id: string; name: string }>[];
  operationId: string;
  idempotencyKey: string | null;
  scopes: readonly string[];
  clientId?: string;
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
  if (!input.operationId.trim() || !input.idempotencyKey || input.idempotencyKey.includes('\0'))
    throw new Error('Native agent writes require the original door operation and idempotency key.');
  const approvers = input.approvers.map(reference);
  const values = [agent.id, agent.name, person.id, person.name,
    input.consent ?? null, JSON.stringify(approvers), `${agent.name} for ${person.name}`,
    input.operationId, input.idempotencyKey, JSON.stringify([...input.scopes]), input.clientId ?? null];
  return { key: JSON.stringify(values), values };
}

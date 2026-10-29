import { z } from 'zod';
import type { JsonSchemaObject } from '../../../../vendor/base/agent-door/index.ts';

/** Publish the transport shape and retain native-only refinements as comments.
 * Native Zod parsing runs before classification and again before every effect.
 * Emoji's Unicode-v regexp cannot be represented by JSON Schema's regexp
 * vocabulary; record-key refinements likewise stay at the native chokepoint. */
export function nativeInputSchema(schema: z.ZodType): JsonSchemaObject {
  const result = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' });
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    const node = value as Record<string, unknown>;
    const names = node.propertyNames;
    if (names && typeof names === 'object') {
      node.$comment = `Native record key validation: ${JSON.stringify(names)}`;
      delete node.propertyNames;
    }
    if (typeof node.pattern === 'string' && node.pattern.includes('\\p{RGI_Emoji}')) {
      node.$comment = `Native Unicode-v emoji validation: ${node.pattern}`;
      delete node.pattern;
    }
    Object.values(node).forEach(visit);
  };
  visit(result);
  return result as JsonSchemaObject;
}

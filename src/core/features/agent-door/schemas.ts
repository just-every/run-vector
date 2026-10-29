import { z } from 'zod';
import type { JsonSchemaObject } from '../../../../vendor/base/agent-door/index.ts';

/** Express native record keys with Base's supported patternProperties keyword.
 * Unconstrained string keys need no assertion: JSON object keys are strings.
 * Native Zod validation still owns refinements at the service boundary. */
function supported(value:unknown):unknown {
  if(Array.isArray(value))return value.map(supported);
  if(!value||typeof value!=='object')return value;
  const node=Object.fromEntries(Object.entries(value).map(([key,item])=>[key,supported(item)]));
  if(node.propertyNames!==undefined){
    const names=node.propertyNames as Record<string,unknown>;
    if(names.type!=='string'||Object.keys(names).some(key=>!['type','minLength','maxLength'].includes(key)))throw new TypeError('Unsupported native record key schema');
    if(names.minLength!==undefined||names.maxLength!==undefined){
      const pattern=`^[\\s\\S]{${names.minLength??0},${names.maxLength??''}}$`;
      node.patternProperties={[pattern]:node.additionalProperties??true};
      node.additionalProperties=false;
    }
    delete node.propertyNames;
  }
  return node;
}
export function nativeInputSchema(schema:z.ZodType):JsonSchemaObject {
  return supported(z.toJSONSchema(schema,{io:'input',unrepresentable:'any'})) as JsonSchemaObject;
}

import { storedAttributionSchema } from './attribution-schema';

/** The alias is a repository-owned SQL identifier, never request input. */
export function attributionJsonSql(alias: string) {
  return `CASE WHEN ${alias}.agent_id IS NOT NULL THEN json_object(
    'agent',json_object('id',${alias}.agent_id,'name',${alias}.agent_name),
    'person',json_object('id',${alias}.person_id,'name',${alias}.person_name),
    'consent',${alias}.consent_reference,'approvers',json(${alias}.approvers_json),
    'label',${alias}.prepared_by) END`;
}

export function projectAttribution<T extends { attributionJson?: unknown }>(row: T) {
  const { attributionJson, ...native } = row;
  return attributionJson
    ? { ...native, attribution: storedAttributionSchema.parse(typeof attributionJson === 'string' ? JSON.parse(attributionJson) : attributionJson) }
    : native;
}

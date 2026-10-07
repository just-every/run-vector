import { and, eq, isNull, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { operators } from '../../platform/db/schema'

export async function databaseIsReachable(binding: D1Database): Promise<boolean> {
  const db = drizzle(binding)
  await db.run(sql`SELECT 1 FROM workspace_settings LIMIT 1`)
  await db.run(sql`SELECT 1 FROM oa_operators LIMIT 1`)
  await db.run(sql`SELECT 1 FROM vector_auth_operators LIMIT 1`)
  return true
}

export async function findActiveOperator(binding: D1Database, operatorId: string) {
  const db = drizzle(binding)
  const [operator] = await db
    .select()
    .from(operators)
    .where(and(eq(operators.id, operatorId), isNull(operators.removedAt)))
    .limit(1)
  return operator ?? null
}

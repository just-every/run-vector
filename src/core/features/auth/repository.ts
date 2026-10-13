export async function admitRate(
  db: D1Database,
  key: string,
  maximum: number,
  durationMs: number,
) {
  const now = Date.now(),
    window = Math.floor(now / durationMs),
    bucket = key + ':' + window
  const row = await db
    .prepare(
      `INSERT INTO access_rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count`,
    )
    .bind(bucket, new Date((window + 1) * durationMs).toISOString())
    .first<{ count: number }>()
  return !!row && row.count <= maximum
}

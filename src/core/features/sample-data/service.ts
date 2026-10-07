import { buildVectorSample } from '../../../../sample-data/vector'
import { insertSampleData } from './repository'
import { sampleDataSchema } from './schema'

let seeded = false

export async function ensureSampleData(binding: D1Database, now: Date): Promise<void> {
  if (seeded) {
    return
  }

  const sample = sampleDataSchema.parse(buildVectorSample(now))
  await insertSampleData(binding, sample)
  seeded = true
}

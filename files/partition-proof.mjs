import { pathToFileURL } from 'node:url';
import { relative } from 'node:path';
import { writeFile } from 'node:fs/promises';
const { createVitest } = await import(pathToFileURL(`${process.cwd()}/node_modules/vitest/dist/node.js`));
const mode = process.argv[2];
const exclude = process.argv.slice(3);
const ctx = await createVitest('test', { config: 'vitest.config.ts', watch: false, shard: '1/6', exclude });
try {
  const specifications = await ctx.globTestSpecifications();
  const rows = {};
  for (let index = 1; index <= 6; index++) {
    ctx.config.shard = { index, count: 6 };
    const seq = new ctx.config.sequence.sequencer(ctx);
    const selected = await seq.shard([...specifications]);
    rows[`${index}/6`] = selected.map(spec => relative(process.cwd(), spec.moduleId)).sort();
  }
  const data = { mode, implementation: 'vitest/node createVitest + globTestSpecifications + configured sequencer.shard (the runner path)', exclude, rows };
  const path = `${process.env.HOME}/rer-consolidation/work/sd-vector-ci-shape-1/packet/partitions-${mode}.json`;
  await writeFile(path, JSON.stringify(data, null, 2) + '\n');
  console.log(JSON.stringify(data, null, 2));
} finally { await ctx.close(); }

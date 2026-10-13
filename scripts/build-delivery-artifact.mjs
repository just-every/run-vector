import { readFile } from 'node:fs/promises';
import { produceSeedArtifact } from './delivery/base/package.mjs';
import { removeEmptyWorkerScratch } from './delivery/build-scratch.mjs';
const config=JSON.parse(await readFile(new URL('./delivery/base/packaging.json',import.meta.url)));
await removeEmptyWorkerScratch(config.artifact.workerDirectory);
console.log(await produceSeedArtifact({config}));
